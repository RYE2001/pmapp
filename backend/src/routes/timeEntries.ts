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

router.get("/task/:taskId", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!(await assertMember(req.user!.userId, task.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const entries = await prisma.timeEntry.findMany({
    where: { taskId: req.params.taskId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { loggedAt: "desc" },
  });
  res.json(entries);
});

router.post("/task/:taskId", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!(await assertMember(req.user!.userId, task.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const { minutes, note } = req.body ?? {};
  if (!minutes || typeof minutes !== "number" || minutes <= 0) {
    return res.status(400).json({ error: "minutes must be a positive number" });
  }

  const entry = await prisma.timeEntry.create({
    data: {
      minutes,
      note: note ?? null,
      taskId: req.params.taskId,
      userId: req.user!.userId,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      actorId: req.user!.userId,
      action: "time_logged",
      summary: `logged ${minutes} minute${minutes === 1 ? "" : "s"}`,
    },
  });

  publishProjectEvent(task.projectId, { type: "time.logged", taskId: task.id });

  res.status(201).json(entry);
});

export default router;
