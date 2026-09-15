import { Router } from "express";
import { prisma } from "../db";
import { publishProjectEvent } from "../events";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const BLOCK_KINDS = ["WORK", "MEETING", "SUPPORT", "OTHER"] as const;
type BlockKind = (typeof BLOCK_KINDS)[number];

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function weekWindow(value: unknown) {
  const reference = parseDate(value) ?? new Date();
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const weekday = start.getDay();
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function overlappingMinutes(startsAt: Date, endsAt: Date, rangeStart: Date, rangeEnd: Date) {
  const starts = Math.max(startsAt.getTime(), rangeStart.getTime());
  const ends = Math.min(endsAt.getTime(), rangeEnd.getTime());
  return Math.max(0, Math.round((ends - starts) / 60000));
}

async function assertProjectMember(userId: string, projectId: string) {
  return prisma.projectMember.findUnique({ where: { userId_projectId: { userId, projectId } } });
}

async function resolveTaskAndProject(userId: string, taskId?: string | null, projectId?: string | null) {
  const task = taskId ? await prisma.task.findUnique({ where: { id: taskId } }) : null;
  const resolvedProjectId = task?.projectId ?? projectId ?? null;
  if (taskId && !task) return { error: "Task not found" } as const;
  if (task && projectId && task.projectId !== projectId) return { error: "Task does not belong to that project" } as const;
  if (resolvedProjectId && !(await assertProjectMember(userId, resolvedProjectId))) {
    return { error: "You are not a member of this project" } as const;
  }
  return { task, projectId: resolvedProjectId } as const;
}

function validBlockKind(value: unknown): value is BlockKind {
  return typeof value === "string" && BLOCK_KINDS.includes(value as BlockKind);
}

router.get("/me/timeline", async (req, res) => {
  const { start, end } = weekWindow(req.query.start);
  const userId = req.user!.userId;
  const [user, blocks, availability, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { weeklyCapacityMinutes: true } }),
    prisma.timeBlock.findMany({
      where: { userId, startsAt: { lt: end }, endsAt: { gt: start } },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.availability.findMany({
      where: { userId, startsAt: { lt: end }, endsAt: { gt: start } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { userId },
      include: { project: { select: { id: true, name: true, tasks: { select: { id: true, title: true } } } } },
      orderBy: { joinedAt: "desc" },
    }),
  ]);

  res.json({
    weekStart: start,
    weekEnd: end,
    weeklyCapacityMinutes: user?.weeklyCapacityMinutes ?? 2400,
    blocks,
    availability,
    projects: memberships.map((membership) => membership.project),
  });
});

router.put("/me/capacity", async (req, res) => {
  const { weeklyCapacityMinutes } = req.body ?? {};
  if (!Number.isInteger(weeklyCapacityMinutes) || weeklyCapacityMinutes < 0 || weeklyCapacityMinutes > 10080) {
    return res.status(400).json({ error: "weeklyCapacityMinutes must be between 0 and 10,080" });
  }
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { weeklyCapacityMinutes },
    select: { weeklyCapacityMinutes: true },
  });
  res.json(user);
});

router.post("/availability", async (req, res) => {
  const { startsAt, endsAt, reason } = req.body ?? {};
  const start = parseDate(startsAt);
  const end = parseDate(endsAt);
  if (!start || !end || end <= start) return res.status(400).json({ error: "A valid start and end time are required" });
  if (reason !== undefined && typeof reason !== "string") return res.status(400).json({ error: "reason must be text" });

  const availability = await prisma.availability.create({
    data: { startsAt: start, endsAt: end, reason: reason?.trim() || null, userId: req.user!.userId },
  });
  res.status(201).json(availability);
});

router.delete("/availability/:id", async (req, res) => {
  const availability = await prisma.availability.findUnique({ where: { id: req.params.id } });
  if (!availability) return res.status(404).json({ error: "Unavailable time not found" });
  if (availability.userId !== req.user!.userId) return res.status(403).json({ error: "You can only edit your own availability" });
  await prisma.availability.delete({ where: { id: availability.id } });
  res.status(204).send();
});

router.post("/time-blocks", async (req, res) => {
  const { title, kind = "WORK", startsAt, endsAt, taskId, projectId } = req.body ?? {};
  const start = parseDate(startsAt);
  const end = parseDate(endsAt);
  if (!title || typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title is required" });
  if (!validBlockKind(kind)) return res.status(400).json({ error: "kind is invalid" });
  if (!start || !end || end <= start) return res.status(400).json({ error: "A valid start and end time are required" });

  const linked = await resolveTaskAndProject(req.user!.userId, taskId, projectId);
  if ("error" in linked) return res.status(linked.error === "Task not found" ? 404 : 403).json({ error: linked.error });

  const plannedMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const block = await prisma.$transaction(async (tx) => {
    const assignment = kind === "WORK" && linked.task
      ? await tx.taskAssignment.create({
          data: { taskId: linked.task.id, userId: req.user!.userId, scheduledFor: start, plannedMinutes },
        })
      : null;
    return tx.timeBlock.create({
      data: {
        title: title.trim(), kind, startsAt: start, endsAt: end, userId: req.user!.userId,
        projectId: linked.projectId, taskId: linked.task?.id ?? null, assignmentId: assignment?.id ?? null,
      },
      include: { project: { select: { id: true, name: true } }, task: { select: { id: true, title: true } } },
    });
  });

  if (linked.projectId) publishProjectEvent(linked.projectId, { type: "planning.created", taskId: linked.task?.id });
  res.status(201).json(block);
});

router.patch("/time-blocks/:id", async (req, res) => {
  const existing = await prisma.timeBlock.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Time block not found" });
  if (existing.userId !== req.user!.userId) return res.status(403).json({ error: "You can only edit your own time blocks" });

  const { title, kind, startsAt, endsAt, taskId, projectId } = req.body ?? {};
  if (title !== undefined && (!title || typeof title !== "string")) return res.status(400).json({ error: "title must be text" });
  if (kind !== undefined && !validBlockKind(kind)) return res.status(400).json({ error: "kind is invalid" });
  const start = startsAt === undefined ? existing.startsAt : parseDate(startsAt);
  const end = endsAt === undefined ? existing.endsAt : parseDate(endsAt);
  if (!start || !end || end <= start) return res.status(400).json({ error: "A valid start and end time are required" });

  const linked = await resolveTaskAndProject(
    req.user!.userId,
    taskId === undefined ? existing.taskId : taskId,
    projectId === undefined ? existing.projectId : projectId
  );
  if ("error" in linked) return res.status(linked.error === "Task not found" ? 404 : 403).json({ error: linked.error });
  const nextKind = kind ?? existing.kind;
  const needsAssignment = nextKind === "WORK" && !!linked.task;
  const plannedMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

  const block = await prisma.$transaction(async (tx) => {
    let assignmentId = existing.assignmentId;
    if (needsAssignment && assignmentId) {
      await tx.taskAssignment.update({
        where: { id: assignmentId },
        data: { taskId: linked.task!.id, scheduledFor: start, plannedMinutes },
      });
    } else if (needsAssignment) {
      const assignment = await tx.taskAssignment.create({
        data: { taskId: linked.task!.id, userId: req.user!.userId, scheduledFor: start, plannedMinutes },
      });
      assignmentId = assignment.id;
    } else if (assignmentId) {
      await tx.timeBlock.update({ where: { id: existing.id }, data: { assignmentId: null } });
      await tx.taskAssignment.delete({ where: { id: assignmentId } });
      assignmentId = null;
    }

    return tx.timeBlock.update({
      where: { id: existing.id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(kind !== undefined && { kind }), startsAt: start, endsAt: end,
        projectId: linked.projectId, taskId: linked.task?.id ?? null, assignmentId,
      },
      include: { project: { select: { id: true, name: true } }, task: { select: { id: true, title: true } } },
    });
  });

  if (linked.projectId ?? existing.projectId) publishProjectEvent(linked.projectId ?? existing.projectId!, { type: "planning.updated", taskId: linked.task?.id });
  res.json(block);
});

router.delete("/time-blocks/:id", async (req, res) => {
  const existing = await prisma.timeBlock.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Time block not found" });
  if (existing.userId !== req.user!.userId) return res.status(403).json({ error: "You can only edit your own time blocks" });
  await prisma.$transaction(async (tx) => {
    await tx.timeBlock.delete({ where: { id: existing.id } });
    if (existing.assignmentId) await tx.taskAssignment.delete({ where: { id: existing.assignmentId } });
  });
  if (existing.projectId) publishProjectEvent(existing.projectId, { type: "planning.deleted", taskId: existing.taskId ?? undefined });
  res.status(204).send();
});

router.get("/tasks/:taskId/assignments", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!(await assertProjectMember(req.user!.userId, task.projectId))) return res.status(403).json({ error: "You are not a member of this project" });
  const assignments = await prisma.taskAssignment.findMany({
    where: { taskId: task.id },
    include: { user: { select: { id: true, name: true, email: true } }, timeBlock: true },
    orderBy: { scheduledFor: "asc" },
  });
  res.json(assignments);
});

router.post("/tasks/:taskId/assignments", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!(await assertProjectMember(req.user!.userId, task.projectId))) return res.status(403).json({ error: "You are not a member of this project" });
  const { userId, startsAt, endsAt } = req.body ?? {};
  const start = parseDate(startsAt);
  const end = parseDate(endsAt);
  if (!userId || typeof userId !== "string") return res.status(400).json({ error: "userId is required" });
  if (!start || !end || end <= start) return res.status(400).json({ error: "A valid start and end time are required" });
  if (!(await assertProjectMember(userId, task.projectId))) return res.status(400).json({ error: "The planned person must be a project member" });

  const plannedMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.taskAssignment.create({
      data: { taskId: task.id, userId, scheduledFor: start, plannedMinutes },
    });
    await tx.timeBlock.create({
      data: {
        title: task.title, kind: "WORK", startsAt: start, endsAt: end, userId,
        projectId: task.projectId, taskId: task.id, assignmentId: created.id,
      },
    });
    return tx.taskAssignment.findUniqueOrThrow({
      where: { id: created.id }, include: { user: { select: { id: true, name: true, email: true } }, timeBlock: true },
    });
  });
  publishProjectEvent(task.projectId, { type: "planning.created", taskId: task.id });
  res.status(201).json(assignment);
});

router.delete("/assignments/:id", async (req, res) => {
  const assignment = await prisma.taskAssignment.findUnique({ where: { id: req.params.id }, include: { task: true, timeBlock: true } });
  if (!assignment) return res.status(404).json({ error: "Assignment not found" });
  if (!(await assertProjectMember(req.user!.userId, assignment.task.projectId))) return res.status(403).json({ error: "You are not a member of this project" });
  await prisma.$transaction(async (tx) => {
    if (assignment.timeBlock) await tx.timeBlock.delete({ where: { id: assignment.timeBlock.id } });
    await tx.taskAssignment.delete({ where: { id: assignment.id } });
  });
  publishProjectEvent(assignment.task.projectId, { type: "planning.deleted", taskId: assignment.task.id });
  res.status(204).send();
});

router.get("/team-capacity", async (req, res) => {
  const { start, end } = weekWindow(req.query.start);
  const ownMemberships = await prisma.projectMember.findMany({ where: { userId: req.user!.userId }, select: { projectId: true } });
  const projectIds = ownMemberships.map((membership) => membership.projectId);
  if (projectIds.length === 0) return res.json({ weekStart: start, weekEnd: end, people: [], plannedVsActual: [] });

  const [memberships, blocks, availability, actualEntries, taskPlans] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId: { in: projectIds } },
      include: { user: { select: { id: true, name: true, email: true, weeklyCapacityMinutes: true } } },
    }),
    prisma.timeBlock.findMany({
      where: { user: { memberships: { some: { projectId: { in: projectIds } } } }, startsAt: { lt: end }, endsAt: { gt: start } },
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.availability.findMany({
      where: { user: { memberships: { some: { projectId: { in: projectIds } } } }, startsAt: { lt: end }, endsAt: { gt: start } },
    }),
    prisma.timeEntry.findMany({
      where: { loggedAt: { gte: start, lt: end }, task: { projectId: { in: projectIds } } },
      select: { userId: true, minutes: true },
    }),
    prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      select: {
        id: true, title: true,
        assignments: { where: { scheduledFor: { gte: start, lt: end } }, select: { plannedMinutes: true } },
        timeEntries: { where: { loggedAt: { gte: start, lt: end } }, select: { minutes: true } },
      },
    }),
  ]);

  const peopleById = new Map(memberships.map((membership) => [membership.user.id, membership.user]));
  if (!peopleById.has(req.user!.userId)) {
    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { id: true, name: true, email: true, weeklyCapacityMinutes: true } });
    if (currentUser) peopleById.set(currentUser.id, currentUser);
  }

  const people = [...peopleById.values()].map((person) => {
    const personBlocks = blocks.filter((block) => block.userId === person.id);
    const unavailableMinutes = availability
      .filter((item) => item.userId === person.id)
      .reduce((total, item) => total + overlappingMinutes(item.startsAt, item.endsAt, start, end), 0);
    const capacityMinutes = Math.max(0, person.weeklyCapacityMinutes - unavailableMinutes);
    const plannedMinutes = personBlocks.reduce(
      (total, block) => total + overlappingMinutes(block.startsAt, block.endsAt, start, end),
      0
    );
    const actualMinutes = actualEntries.filter((entry) => entry.userId === person.id).reduce((total, entry) => total + entry.minutes, 0);
    const projectMinutes = new Map<string, { name: string; minutes: number }>();
    for (const block of personBlocks) {
      if (!block.project) continue;
      const previous = projectMinutes.get(block.project.id) ?? { name: block.project.name, minutes: 0 };
      previous.minutes += overlappingMinutes(block.startsAt, block.endsAt, start, end);
      projectMinutes.set(block.project.id, previous);
    }
    return {
      ...person,
      capacityMinutes,
      unavailableMinutes,
      plannedMinutes,
      actualMinutes,
      workloadPercent: capacityMinutes === 0 ? (plannedMinutes > 0 ? 100 : 0) : Math.round((plannedMinutes / capacityMinutes) * 100),
      isOverloaded: plannedMinutes > capacityMinutes,
      projectCount: projectMinutes.size,
      contextSwitching: projectMinutes.size >= 3,
      projectAllocations: [...projectMinutes.entries()].map(([projectId, allocation]) => ({ projectId, ...allocation })),
    };
  }).sort((a, b) => b.workloadPercent - a.workloadPercent || a.name.localeCompare(b.name));

  res.json({
    weekStart: start,
    weekEnd: end,
    people,
    plannedVsActual: taskPlans.map((task) => ({
      id: task.id,
      title: task.title,
      plannedMinutes: task.assignments.reduce((total, assignment) => total + assignment.plannedMinutes, 0),
      actualMinutes: task.timeEntries.reduce((total, entry) => total + entry.minutes, 0),
    })).filter((task) => task.plannedMinutes > 0 || task.actualMinutes > 0),
  });
});

export default router;
