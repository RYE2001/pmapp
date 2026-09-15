import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

function parseDeadline(value: unknown) {
  if (typeof value !== "string") return null;
  const deadline = new Date(`${value}T23:59:59`);
  return Number.isNaN(deadline.getTime()) ? null : deadline;
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

router.post("/projects/:projectId/deadline", async (req, res) => {
  const deadline = parseDeadline(req.body?.newDeadline);
  if (!deadline) return res.status(400).json({ error: "newDeadline must be a valid YYYY-MM-DD date" });

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: req.user!.userId, projectId: req.params.projectId } },
  });
  if (!membership) return res.status(403).json({ error: "You are not a member of this project" });

  const now = new Date();
  const horizonMinutes = minutesBetween(now, deadline);
  if (horizonMinutes <= 0) return res.status(400).json({ error: "newDeadline must be in the future" });
  const horizonWeeks = Math.max(1 / 7, horizonMinutes / (7 * 24 * 60));

  const [project, tasks, projectMembers, visibleMemberships] = await Promise.all([
    prisma.project.findUnique({ where: { id: req.params.projectId }, select: { id: true, name: true, priority: true } }),
    prisma.task.findMany({
      where: { projectId: req.params.projectId, status: { not: "DONE" } },
      select: { id: true, title: true, priority: true, estimatedMinutes: true, assigneeId: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId: req.params.projectId },
      include: { user: { select: { id: true, name: true, email: true, weeklyCapacityMinutes: true } } },
    }),
    prisma.projectMember.findMany({
      where: { userId: req.user!.userId },
      select: { projectId: true },
    }),
  ]);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const visibleProjectIds = visibleMemberships.map((item) => item.projectId);
  const users = await prisma.user.findMany({
    where: { memberships: { some: { projectId: { in: visibleProjectIds } } } },
    select: { id: true, name: true, email: true, weeklyCapacityMinutes: true, memberships: { select: { projectId: true } } },
  });
  const allocations = await prisma.workAllocation.findMany({
    where: {
      userId: { in: users.map((user) => user.id) },
      startsAt: { lt: deadline },
      endsAt: { gt: now },
      status: { not: "CANCELLED" },
    },
    select: { userId: true, projectId: true, plannedMinutes: true },
  });

  const estimatedMinutes = tasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  const plannedMinutes = allocations
    .filter((allocation) => allocation.projectId === project.id)
    .reduce((total, allocation) => total + allocation.plannedMinutes, 0);
  const requiredMinutes = Math.max(estimatedMinutes, plannedMinutes);
  const capacityMinutes = projectMembers.reduce((total, member) => total + member.user.weeklyCapacityMinutes * horizonWeeks, 0);
  const deficitMinutes = Math.max(0, requiredMinutes - capacityMinutes);

  const targetMemberIds = new Set(projectMembers.map((member) => member.user.id));
  const candidateOptions = users
    .filter((user) => !targetMemberIds.has(user.id))
    .map((user) => {
      const planned = allocations.filter((allocation) => allocation.userId === user.id).reduce((total, allocation) => total + allocation.plannedMinutes, 0);
      const available = Math.max(0, user.weeklyCapacityMinutes * horizonWeeks - planned);
      const projectIds = new Set(allocations.filter((allocation) => allocation.userId === user.id && allocation.projectId).map((allocation) => allocation.projectId));
      return {
        type: "MOVE_PERSON",
        person: { id: user.id, name: user.name, email: user.email },
        availableMinutes: available,
        projectRiskPercent: planned === 0 ? 0 : Math.round((planned / Math.max(1, user.weeklyCapacityMinutes * horizonWeeks)) * 100),
        projectsAffected: projectIds.size,
        explanation: available > 0
          ? `${user.name} has ${Math.round(available / 60)}h of uncommitted capacity across the visible planning horizon.`
          : `${user.name} has no uncommitted capacity before the new deadline.`,
      };
    })
    .filter((option) => option.availableMinutes > 0)
    .sort((a, b) => b.availableMinutes - a.availableMinutes)
    .slice(0, 5);

  const lowPriorityTasks = tasks
    .filter((task) => task.priority === "LOW" && task.estimatedMinutes > 0)
    .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
  let scopeSaved = 0;
  const scopeTasks: { id: string; title: string; estimatedMinutes: number }[] = [];
  for (const task of lowPriorityTasks) {
    if (scopeSaved >= deficitMinutes) break;
    scopeTasks.push({ id: task.id, title: task.title, estimatedMinutes: task.estimatedMinutes });
    scopeSaved += task.estimatedMinutes;
  }

  res.json({
    project: { id: project.id, name: project.name, priority: project.priority },
    newDeadline: deadline,
    horizonWeeks,
    currentWorkloadMinutes: requiredMinutes,
    availableCapacityMinutes: capacityMinutes,
    deficitMinutes,
    options: {
      movePeople: candidateOptions,
      externalResource: {
        additionalMinutes: deficitMinutes,
        explanation: deficitMinutes > 0 ? "An external resource would cover the remaining deficit without moving existing allocations." : "No external capacity is required at the current estimate.",
      },
      reduceScope: {
        savedMinutes: scopeSaved,
        tasks: scopeTasks,
        fullyCovered: scopeSaved >= deficitMinutes,
      },
    },
  });
});

export default router;
