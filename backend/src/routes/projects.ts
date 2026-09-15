import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// List every project the current user belongs to.
router.get("/", async (req, res) => {
  const memberships = await prisma.projectMember.findMany({
    where: { userId: req.user!.userId },
    include: {
      project: {
        include: { _count: { select: { tasks: true, members: true } } },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  res.json(
    memberships.map((m: (typeof memberships)[number]) => ({
      id: m.project.id,
      name: m.project.name,
      description: m.project.description,
      role: m.role,
      taskCount: m.project._count.tasks,
      memberCount: m.project._count.members,
    }))
  );
});

// Create a project. The creator becomes its first ADMIN member.
router.post("/", async (req, res) => {
  const { name, description } = req.body ?? {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description ?? null,
      members: {
        create: { userId: req.user!.userId, role: "ADMIN" },
      },
    },
  });

  res.status(201).json(project);
});

// Fetch one project, including its members. Requires membership.
router.get("/:id", async (req, res) => {
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: req.user!.userId, projectId: req.params.id } },
  });
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  res.json(project);
});

// Add a teammate to the project by email. Only existing ADMINs may invite.
router.post("/:id/members", async (req, res) => {
  const { email, role } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  const requesterMembership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: req.user!.userId, projectId: req.params.id } },
  });
  if (!requesterMembership || requesterMembership.role !== "ADMIN") {
    return res.status(403).json({ error: "Only project admins can add members" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({ error: "No account exists with that email yet" });
  }

  const member = await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: user.id, projectId: req.params.id } },
    update: { role: role === "ADMIN" ? "ADMIN" : "MEMBER" },
    create: { userId: user.id, projectId: req.params.id, role: role === "ADMIN" ? "ADMIN" : "MEMBER" },
  });

  res.status(201).json(member);
});

export default router;
