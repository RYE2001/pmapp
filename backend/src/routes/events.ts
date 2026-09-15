import { Router } from "express";
import { prisma } from "../db";
import { openProjectEventStream } from "../events";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/project/:projectId", async (req, res) => {
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: req.user!.userId, projectId: req.params.projectId } },
  });
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  openProjectEventStream(req, res, req.params.projectId);
});

export default router;
