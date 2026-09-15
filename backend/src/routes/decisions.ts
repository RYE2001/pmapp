import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const decisionInclude = {
  createdBy: { select: { id: true, name: true } },
  people: { include: { user: { select: { id: true, name: true, email: true } } } },
  evidence: true,
  taskLinks: { include: { task: { select: { id: true, title: true, status: true } } } },
};

async function getMembership(userId: string, projectId: string) {
  return prisma.projectMember.findUnique({ where: { userId_projectId: { userId, projectId } } });
}

async function validateLinks(projectId: string, peopleIds: unknown, taskIds: unknown) {
  const people = Array.isArray(peopleIds) ? [...new Set(peopleIds.filter((id): id is string => typeof id === "string"))] : [];
  const tasks = Array.isArray(taskIds) ? [...new Set(taskIds.filter((id): id is string => typeof id === "string"))] : [];

  const [memberCount, taskCount] = await Promise.all([
    prisma.projectMember.count({ where: { projectId, userId: { in: people } } }),
    prisma.task.count({ where: { projectId, id: { in: tasks } } }),
  ]);
  if (memberCount !== people.length) throw new Error("People linked to a decision must be project members");
  if (taskCount !== tasks.length) throw new Error("Tasks linked to a decision must belong to this project");
  return { people, tasks };
}

router.get("/project/:projectId", async (req, res) => {
  if (!(await getMembership(req.user!.userId, req.params.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const decisions = await prisma.decision.findMany({
    where: { projectId: req.params.projectId },
    include: decisionInclude,
    orderBy: [{ status: "asc" }, { decidedAt: "desc" }],
  });
  res.json(decisions);
});

router.post("/project/:projectId", async (req, res) => {
  if (!(await getMembership(req.user!.userId, req.params.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const { title, summary, rationale, alternatives, status, decidedAt, evidence, peopleIds, taskIds } = req.body ?? {};
  if (![title, summary, rationale].every((value) => typeof value === "string" && value.trim())) {
    return res.status(400).json({ error: "title, summary, and rationale are required" });
  }
  if (status && !["ACTIVE", "SUPERSEDED", "REVERSED"].includes(status)) {
    return res.status(400).json({ error: "invalid decision status" });
  }

  let links: { people: string[]; tasks: string[] };
  try {
    links = await validateLinks(req.params.projectId, peopleIds, taskIds);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid decision links" });
  }
  const evidenceItems = Array.isArray(evidence)
    ? evidence.filter((item): item is { label: string; url?: string } => Boolean(item && typeof item.label === "string" && item.label.trim()))
    : [];

  const decision = await prisma.decision.create({
    data: {
      title: title.trim(),
      summary: summary.trim(),
      rationale: rationale.trim(),
      alternatives: typeof alternatives === "string" && alternatives.trim() ? alternatives.trim() : null,
      status: status ?? "ACTIVE",
      decidedAt: decidedAt ? new Date(decidedAt) : new Date(),
      projectId: req.params.projectId,
      createdById: req.user!.userId,
      people: links.people.length ? { create: links.people.map((userId) => ({ userId })) } : undefined,
      taskLinks: links.tasks.length ? { create: links.tasks.map((taskId) => ({ taskId })) } : undefined,
      evidence: evidenceItems.length
        ? { create: evidenceItems.map((item) => ({ label: item.label.trim(), url: item.url?.trim() || null })) }
        : undefined,
    },
    include: decisionInclude,
  });
  res.status(201).json(decision);
});

router.patch("/:id", async (req, res) => {
  const existing = await prisma.decision.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Decision not found" });
  if (!(await getMembership(req.user!.userId, existing.projectId))) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const { status } = req.body ?? {};
  if (!["ACTIVE", "SUPERSEDED", "REVERSED"].includes(status)) {
    return res.status(400).json({ error: "invalid decision status" });
  }
  const decision = await prisma.decision.update({
    where: { id: existing.id },
    data: { status },
    include: decisionInclude,
  });
  res.json(decision);
});

export default router;
