import { Router } from "express";
import { prisma } from "../db";
import { publishProjectEvent } from "../events";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

async function assertMember(userId: string, projectId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return !!membership;
}

const taskCommentInclude = {
  author: { select: { id: true, name: true } },
  mentions: { include: { user: { select: { id: true, name: true, email: true } } } },
};

function statusLabel(status: string) {
  return {
    TODO: "To do",
    IN_PROGRESS: "In progress",
    BLOCKED: "Blocked",
    DONE: "Done",
  }[status] ?? status;
}

// Cross-project task list for the signed-in user, with active blockers first.
router.get("/mine", async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { assigneeId: req.user!.userId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      _count: { select: { timeEntries: true } },
      blockers: { where: { resolved: false }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  tasks.sort((a: (typeof tasks)[number], b: (typeof tasks)[number]) => {
    const blockerOrder = Number(b.blockers.length > 0) - Number(a.blockers.length > 0);
    if (blockerOrder !== 0) return blockerOrder;
    if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });

  res.json(
    tasks.map((t: (typeof tasks)[number]) => ({
      ...t,
      activeBlocker: t.blockers[0] ?? null,
      blockers: undefined,
    }))
  );
});

// List all tasks for a project, grouped implicitly by status (the client sorts into columns).
router.get("/project/:projectId", async (req, res) => {
  const isMember = await assertMember(req.user!.userId, req.params.projectId);
  if (!isMember) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.projectId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      _count: { select: { timeEntries: true } },
      blockers: { where: { resolved: false }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ status: "asc" }, { position: "asc" }],
  });

  res.json(
    tasks.map((t: (typeof tasks)[number]) => ({
      ...t,
      activeBlocker: t.blockers[0] ?? null,
      blockers: undefined,
    }))
  );
});

// Task-wide conversation. Mentions are validated against the project's members.
router.get("/:id/comments", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!(await assertMember(req.user!.userId, task.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const comments = await prisma.taskComment.findMany({
    where: { taskId: task.id },
    include: taskCommentInclude,
    orderBy: { createdAt: "asc" },
  });
  res.json(comments);
});

router.get("/:id/activity", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!(await assertMember(req.user!.userId, task.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const activity = await prisma.taskActivity.findMany({
    where: { taskId: task.id },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(activity);
});

router.post("/:id/comments", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!(await assertMember(req.user!.userId, task.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const { message, mentionedUserIds } = req.body ?? {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  if (message.trim().length > 2000) {
    return res.status(400).json({ error: "message must be 2,000 characters or fewer" });
  }

  const mentionIds = Array.isArray(mentionedUserIds)
    ? [...new Set(mentionedUserIds.filter((id): id is string => typeof id === "string"))]
    : [];
  if (mentionIds.length > 0) {
    const validMentionCount = await prisma.projectMember.count({
      where: { projectId: task.projectId, userId: { in: mentionIds } },
    });
    if (validMentionCount !== mentionIds.length) {
      return res.status(400).json({ error: "Mentions must be project members" });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const comment = await tx.taskComment.create({
      data: {
        message: message.trim(),
        taskId: task.id,
        authorId: req.user!.userId,
        mentions: mentionIds.length ? { create: mentionIds.map((userId) => ({ userId })) } : undefined,
      },
      include: taskCommentInclude,
    });
    const activity = await tx.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: req.user!.userId,
        action: "commented",
        summary: mentionIds.length ? "commented and mentioned teammates" : "commented",
      },
      include: { actor: { select: { id: true, name: true } } },
    });
    return { comment, activity };
  });

  publishProjectEvent(task.projectId, { type: "task.commented", taskId: task.id });
  res.status(201).json(result);
});

// Create a task on a project.
router.post("/project/:projectId", async (req, res) => {
  const isMember = await assertMember(req.user!.userId, req.params.projectId);
  if (!isMember) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const { title, description, priority, assigneeId, startDate, dueDate } = req.body ?? {};
  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "title is required" });
  }

  const highestPosition = await prisma.task.aggregate({
    where: { projectId: req.params.projectId, status: "TODO" },
    _max: { position: true },
  });

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title,
        description: description ?? null,
        priority: priority ?? "MEDIUM",
        assigneeId: assigneeId ?? null,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: req.params.projectId,
        position: (highestPosition._max.position ?? 0) + 1,
      },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });
    await tx.taskActivity.create({
      data: { taskId: created.id, actorId: req.user!.userId, action: "created", summary: "created this task" },
    });
    return created;
  });

  publishProjectEvent(req.params.projectId, { type: "task.created", taskId: task.id });
  res.status(201).json(task);
});

// Update a task: used both for edits and for drag-and-drop status/position changes.
router.patch("/:id", async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: "Task not found" });
  }
  const isMember = await assertMember(req.user!.userId, existing.projectId);
  if (!isMember) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const { title, description, status, priority, assigneeId, startDate, dueDate, position } = req.body ?? {};
  const statusChanged = status !== undefined && status !== existing.status;
  const detailsChanged = [title, description, priority, assigneeId, startDate, dueDate].some(
    (value) => value !== undefined
  );
  const activity = statusChanged
    ? { action: "status_changed", summary: `moved this task to ${statusLabel(status)}` }
    : detailsChanged
      ? { action: "updated", summary: "updated task details" }
      : null;

  const task = await prisma.$transaction(async (tx) => {
    if (existing.status === "BLOCKED" && status !== undefined && status !== "BLOCKED") {
      await tx.blocker.updateMany({
        where: { taskId: req.params.id, resolved: false },
        data: { resolved: true, resolvedAt: new Date() },
      });
    }

    const updated = await tx.task.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(position !== undefined && { position }),
      },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });
    if (activity) {
      await tx.taskActivity.create({
        data: { taskId: updated.id, actorId: req.user!.userId, ...activity },
      });
    }
    return updated;
  });

  publishProjectEvent(existing.projectId, { type: "task.updated", taskId: task.id });
  res.json(task);
});

router.delete("/:id", async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: "Task not found" });
  }
  const isMember = await assertMember(req.user!.userId, existing.projectId);
  if (!isMember) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  await prisma.task.delete({ where: { id: req.params.id } });
  publishProjectEvent(existing.projectId, { type: "task.deleted", taskId: existing.id });
  res.status(204).send();
});

export default router;
