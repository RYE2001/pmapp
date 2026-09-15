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

const blockerInclude = {
  createdBy: { select: { id: true, name: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
};

// The active (unresolved) blocker for a task, with its discussion thread.
router.get("/task/:taskId", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!(await assertMember(req.user!.userId, task.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const blocker = await prisma.blocker.findFirst({
    where: { taskId: req.params.taskId, resolved: false },
    orderBy: { createdAt: "desc" },
    include: blockerInclude,
  });

  res.json({ blocker });
});

// Report what's blocking a task. One active blocker per task at a time.
router.post("/task/:taskId", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!(await assertMember(req.user!.userId, task.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const { reason } = req.body ?? {};
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ error: "reason is required" });
  }

  const existing = await prisma.blocker.findFirst({
    where: { taskId: req.params.taskId, resolved: false },
  });
  if (existing) {
    return res.status(409).json({ error: "This task already has an active blocker" });
  }

  const blocker = await prisma.blocker.create({
    data: { reason: reason.trim(), taskId: req.params.taskId, createdById: req.user!.userId },
    include: blockerInclude,
  });

  // Keep the task's status in sync with the fact that it's now blocked.
  await prisma.task.update({ where: { id: req.params.taskId }, data: { status: "BLOCKED" } });
  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      actorId: req.user!.userId,
      action: "blocker_reported",
      summary: "reported a blocker",
    },
  });
  publishProjectEvent(task.projectId, { type: "blocker.reported", taskId: task.id });

  res.status(201).json({ blocker });
});

// A teammate suggesting a fix, or asking a clarifying question.
router.post("/:blockerId/comments", async (req, res) => {
  const blocker = await prisma.blocker.findUnique({ where: { id: req.params.blockerId } });
  if (!blocker) return res.status(404).json({ error: "Blocker not found" });
  const task = await prisma.task.findUnique({ where: { id: blocker.taskId } });
  if (!task || !(await assertMember(req.user!.userId, task.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const { message } = req.body ?? {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const comment = await prisma.blockerComment.create({
    data: { message: message.trim(), blockerId: blocker.id, authorId: req.user!.userId },
    include: { author: { select: { id: true, name: true } } },
  });

  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      actorId: req.user!.userId,
      action: "blocker_commented",
      summary: "commented on a blocker",
    },
  });
  publishProjectEvent(task.projectId, { type: "blocker.commented", taskId: task.id });

  res.status(201).json(comment);
});

// Flag as needing outside/admin help, and/or mark resolved.
router.patch("/:blockerId", async (req, res) => {
  const blocker = await prisma.blocker.findUnique({ where: { id: req.params.blockerId } });
  if (!blocker) return res.status(404).json({ error: "Blocker not found" });
  const task = await prisma.task.findUnique({ where: { id: blocker.taskId } });
  if (!task || !(await assertMember(req.user!.userId, task.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const { isExternal, resolved } = req.body ?? {};

  const updated = await prisma.blocker.update({
    where: { id: blocker.id },
    data: {
      ...(isExternal !== undefined && { isExternal }),
      ...(resolved !== undefined && { resolved, resolvedAt: resolved ? new Date() : null }),
    },
    include: blockerInclude,
  });

  if (resolved === true) {
    // Resolving from the blocker panel should also return the task to active work.
    await prisma.task.update({ where: { id: task.id }, data: { status: "IN_PROGRESS" } });
  }
  if (isExternal !== undefined || resolved !== undefined) {
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: req.user!.userId,
        action: resolved === true ? "blocker_resolved" : "blocker_updated",
        summary: resolved === true ? "resolved the blocker" : "flagged the blocker for admin attention",
      },
    });
    publishProjectEvent(task.projectId, { type: "blocker.updated", taskId: task.id });
  }

  res.json({ blocker: updated });
});

export default router;
