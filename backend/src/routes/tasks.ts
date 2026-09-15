import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

async function assertMember(userId: string, projectId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return !!membership;
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

  tasks.sort((a, b) => {
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

  const task = await prisma.task.create({
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

  if (existing.status === "BLOCKED" && status !== undefined && status !== "BLOCKED") {
    await prisma.blocker.updateMany({
      where: { taskId: req.params.id, resolved: false },
      data: { resolved: true, resolvedAt: new Date() },
    });
  }

  const task = await prisma.task.update({
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
  res.status(204).send();
});

export default router;
