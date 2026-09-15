import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Summary report for a project: task counts by status, and time logged per person.
router.get("/project/:projectId", async (req, res) => {
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: req.user!.userId, projectId: req.params.projectId } },
  });
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const [statusCounts, timeByUser, tasks, activeBlockers] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: { projectId: req.params.projectId },
      _count: { _all: true },
    }),
    prisma.timeEntry.groupBy({
      by: ["userId"],
      where: { task: { projectId: req.params.projectId } },
      _sum: { minutes: true },
    }),
    prisma.task.findMany({
      where: { projectId: req.params.projectId },
      select: { id: true, title: true, dueDate: true, status: true },
    }),
    prisma.blocker.findMany({
      where: { resolved: false, isExternal: true, task: { projectId: req.params.projectId } },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const users = await prisma.user.findMany({
    where: { id: { in: timeByUser.map((t: (typeof timeByUser)[number]) => t.userId) } },
    select: { id: true, name: true },
  });
  const userNameById = Object.fromEntries(users.map((u: (typeof users)[number]) => [u.id, u.name]));

  const now = new Date();
  const overdue = tasks.filter((t: (typeof tasks)[number]) => t.status !== "DONE" && t.dueDate && t.dueDate < now);

  res.json({
    tasksByStatus: Object.fromEntries(statusCounts.map((s: (typeof statusCounts)[number]) => [s.status, s._count._all])),
    minutesLoggedByUser: timeByUser.map((t: (typeof timeByUser)[number]) => ({
      userId: t.userId,
      name: userNameById[t.userId] ?? "Unknown",
      minutes: t._sum.minutes ?? 0,
    })),
    overdueTasks: overdue.map((t: (typeof overdue)[number]) => ({ id: t.id, title: t.title, dueDate: t.dueDate })),
    externalBlockers: activeBlockers.map((b: (typeof activeBlockers)[number]) => ({
      taskId: b.task.id,
      title: b.task.title,
      reason: b.reason,
    })),
  });
});

export default router;
