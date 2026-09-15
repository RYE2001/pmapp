import bcrypt from "bcryptjs";
import { PrismaClient, TaskStatus, TimeBlockKind } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "demo1234";

function mondayOfCurrentWeek() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const weekday = date.getDay();
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return date;
}

function atDay(monday: Date, dayOffset: number, hour: number, minute = 0) {
  const date = new Date(monday);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const monday = mondayOfCurrentWeek();

  await prisma.$transaction(async (tx) => {
    // This is intentionally a full local demo reset. It does not touch schema or migrations.
    await tx.taskCommentMention.deleteMany();
    await tx.workAllocation.deleteMany();
    await tx.decisionEvidence.deleteMany();
    await tx.decisionPerson.deleteMany();
    await tx.decisionTask.deleteMany();
    await tx.taskSkillRequirement.deleteMany();
    await tx.userSkill.deleteMany();
    await tx.timeBlock.deleteMany();
    await tx.taskAssignment.deleteMany();
    await tx.availability.deleteMany();
    await tx.timeEntry.deleteMany();
    await tx.blockerComment.deleteMany();
    await tx.blocker.deleteMany();
    await tx.taskComment.deleteMany();
    await tx.taskActivity.deleteMany();
    await tx.decision.deleteMany();
    await tx.task.deleteMany();
    await tx.projectMember.deleteMany();
    await tx.project.deleteMany();
    await tx.skill.deleteMany();
    await tx.user.deleteMany();

    const [amina, ali, sarah, karim] = await Promise.all([
      tx.user.create({ data: { name: "Amina Benali", email: "amina@demo.waypoint.local", passwordHash, weeklyCapacityMinutes: 2400 } }),
      tx.user.create({ data: { name: "Ali Mansouri", email: "ali@demo.waypoint.local", passwordHash, weeklyCapacityMinutes: 2400 } }),
      tx.user.create({ data: { name: "Sarah Haddad", email: "sarah@demo.waypoint.local", passwordHash, weeklyCapacityMinutes: 2100 } }),
      tx.user.create({ data: { name: "Karim Toumi", email: "karim@demo.waypoint.local", passwordHash, weeklyCapacityMinutes: 2100 } }),
    ]);

    const [plant, rollout, internal] = await Promise.all([
      tx.project.create({ data: { name: "Plant modernization", description: "Upgrade the line controls, motors, and operator experience." } }),
      tx.project.create({ data: { name: "Customer rollout", description: "Prepare the new control package for the first customer site." } }),
      tx.project.create({ data: { name: "Internal operations", description: "Shared support, documentation, and process improvements." } }),
    ]);

    await tx.projectMember.createMany({
      data: [
        { projectId: plant.id, userId: amina.id, role: "ADMIN" },
        { projectId: plant.id, userId: ali.id, role: "MEMBER" },
        { projectId: plant.id, userId: sarah.id, role: "MEMBER" },
        { projectId: plant.id, userId: karim.id, role: "MEMBER" },
        { projectId: rollout.id, userId: amina.id, role: "ADMIN" },
        { projectId: rollout.id, userId: ali.id, role: "MEMBER" },
        { projectId: rollout.id, userId: sarah.id, role: "MEMBER" },
        { projectId: internal.id, userId: amina.id, role: "ADMIN" },
        { projectId: internal.id, userId: sarah.id, role: "MEMBER" },
        { projectId: internal.id, userId: karim.id, role: "MEMBER" },
      ],
    });

    const [plc, scada, electrical, documentation] = await Promise.all([
      tx.skill.create({ data: { name: "PLC", description: "PLC programming and commissioning" } }),
      tx.skill.create({ data: { name: "SCADA", description: "SCADA and HMI systems" } }),
      tx.skill.create({ data: { name: "Electrical", description: "Electrical design and field work" } }),
      tx.skill.create({ data: { name: "Documentation", description: "Technical and operational documentation" } }),
    ]);

    await tx.userSkill.createMany({
      data: [
        { userId: ali.id, skillId: plc.id, level: 95 },
        { userId: ali.id, skillId: electrical.id, level: 82 },
        { userId: sarah.id, skillId: scada.id, level: 92 },
        { userId: sarah.id, skillId: documentation.id, level: 88 },
        { userId: karim.id, skillId: electrical.id, level: 90 },
        { userId: karim.id, skillId: plc.id, level: 72 },
        { userId: amina.id, skillId: documentation.id, level: 95 },
      ],
    });

    const motor = await tx.task.create({ data: { projectId: plant.id, title: "Replace motor X", description: "Replace the motor after the vibration threshold was exceeded.", status: TaskStatus.BLOCKED, priority: "HIGH", startDate: atDay(monday, 1, 9), dueDate: atDay(monday, 3, 17), position: 1, assigneeId: karim.id } });
    const plcTask = await tx.task.create({ data: { projectId: plant.id, title: "PLC communication architecture", description: "Finalize the Modbus TCP architecture for the upgraded line.", status: TaskStatus.IN_PROGRESS, priority: "HIGH", startDate: atDay(monday, 0, 9), dueDate: atDay(monday, 4, 17), position: 2, assigneeId: ali.id } });
    const hmi = await tx.task.create({ data: { projectId: plant.id, title: "HMI alarm redesign", description: "Make critical alarms easier for operators to understand.", status: TaskStatus.TODO, priority: "MEDIUM", startDate: atDay(monday, 2, 10), dueDate: atDay(monday, 7, 17), position: 3, assigneeId: sarah.id } });
    const commissioning = await tx.task.create({ data: { projectId: plant.id, title: "Line commissioning checklist", status: TaskStatus.DONE, priority: "MEDIUM", dueDate: atDay(monday, -1, 17), position: 4, assigneeId: ali.id } });
    const rolloutTask = await tx.task.create({ data: { projectId: rollout.id, title: "Customer site SCADA package", description: "Prepare the site-specific SCADA screens and tags.", status: TaskStatus.IN_PROGRESS, priority: "HIGH", startDate: atDay(monday, 1, 13), dueDate: atDay(monday, 5, 17), position: 1, assigneeId: sarah.id } });
    const docsTask = await tx.task.create({ data: { projectId: internal.id, title: "Update maintenance playbook", status: TaskStatus.TODO, priority: "LOW", dueDate: atDay(monday, 4, 16), position: 1, assigneeId: sarah.id } });

    await tx.taskSkillRequirement.createMany({
      data: [
        { taskId: plcTask.id, skillId: plc.id, level: 90 },
        { taskId: plcTask.id, skillId: scada.id, level: 40 },
        { taskId: plcTask.id, skillId: electrical.id, level: 30 },
        { taskId: motor.id, skillId: electrical.id, level: 80 },
        { taskId: motor.id, skillId: plc.id, level: 40 },
        { taskId: rolloutTask.id, skillId: scada.id, level: 85 },
      ],
    });

    await tx.taskActivity.createMany({
      data: [
        { taskId: motor.id, actorId: karim.id, action: "created", summary: "created this task" },
        { taskId: motor.id, actorId: karim.id, action: "status_changed", summary: "moved this task to Blocked" },
        { taskId: plcTask.id, actorId: ali.id, action: "created", summary: "created this task" },
        { taskId: hmi.id, actorId: sarah.id, action: "created", summary: "created this task" },
        { taskId: rolloutTask.id, actorId: sarah.id, action: "created", summary: "created this task" },
      ],
    });

    const blocker = await tx.blocker.create({ data: { taskId: motor.id, reason: "Waiting for the Friday shutdown window and vendor delivery confirmation.", isExternal: true, createdById: karim.id } });
    await tx.blockerComment.create({ data: { blockerId: blocker.id, authorId: sarah.id, message: "I will confirm the shutdown window with operations." } });
    await tx.taskActivity.create({ data: { taskId: motor.id, actorId: karim.id, action: "blocker_reported", summary: "reported a blocker" } });

    const comment = await tx.taskComment.create({ data: { taskId: plcTask.id, authorId: ali.id, message: "The architecture depends on supplier A supporting Modbus TCP.", mentions: { create: [{ userId: amina.id }, { userId: sarah.id }] } } });
    await tx.taskActivity.create({ data: { taskId: plcTask.id, actorId: ali.id, action: "commented", summary: "commented and mentioned teammates" } });
    void comment;

    const decision = await tx.decision.create({
      data: {
        projectId: plant.id,
        createdById: amina.id,
        title: "Use supplier A for PLC communication",
        summary: "Use supplier A for the control cabinet and Modbus TCP integration.",
        rationale: "The existing line gateway supports the required protocol and the quote fits the approved budget.",
        alternatives: "Supplier B was cheaper, but its gateway was unavailable during the shutdown window.",
        decidedAt: atDay(monday, -8, 12),
        people: { create: [{ userId: amina.id }, { userId: ali.id }, { userId: karim.id }, { userId: sarah.id }] },
        taskLinks: { create: [{ taskId: plcTask.id }, { taskId: motor.id }] },
        evidence: { create: [{ label: "Quote #1842", url: "https://example.com/demo/quote-1842" }, { label: "Architecture review notes" }] },
      },
    });
    void decision;

    await tx.timeEntry.createMany({
      data: [
        { taskId: plcTask.id, userId: ali.id, minutes: 210, note: "Reviewed gateway protocol and drafted architecture" },
        { taskId: rolloutTask.id, userId: sarah.id, minutes: 150, note: "Built customer alarm screens" },
        { taskId: commissioning.id, userId: ali.id, minutes: 360, note: "Completed commissioning checklist" },
        { taskId: hmi.id, userId: sarah.id, minutes: 90, note: "Reviewed operator feedback" },
      ],
    });

    const unavailableWindows = [
      { userId: karim.id, startsAt: atDay(monday, 4, 13), endsAt: atDay(monday, 4, 17), reason: "Medical appointment" },
      { userId: sarah.id, startsAt: atDay(monday, 2, 9), endsAt: atDay(monday, 2, 12), reason: "Customer training" },
    ];
    for (const window of unavailableWindows) {
      await tx.availability.create({ data: window });
      await tx.workAllocation.create({
        data: {
          userId: window.userId,
          title: window.reason,
          type: "UNAVAILABLE",
          source: "MANUAL",
          status: "PLANNED",
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          plannedMinutes: Math.round((window.endsAt.getTime() - window.startsAt.getTime()) / 60000),
        },
      });
    }

    const blocks = [
      { userId: ali.id, projectId: plant.id, taskId: plcTask.id, title: "PLC architecture work", kind: TimeBlockKind.WORK, startsAt: atDay(monday, 0, 9), endsAt: atDay(monday, 0, 13) },
      { userId: ali.id, projectId: rollout.id, taskId: null, title: "Customer rollout review", kind: TimeBlockKind.MEETING, startsAt: atDay(monday, 1, 14), endsAt: atDay(monday, 1, 16) },
      { userId: sarah.id, projectId: plant.id, taskId: hmi.id, title: "HMI alarm redesign", kind: TimeBlockKind.WORK, startsAt: atDay(monday, 0, 9), endsAt: atDay(monday, 0, 12) },
      { userId: sarah.id, projectId: rollout.id, taskId: rolloutTask.id, title: "SCADA package", kind: TimeBlockKind.WORK, startsAt: atDay(monday, 1, 13), endsAt: atDay(monday, 1, 17) },
      { userId: sarah.id, projectId: internal.id, taskId: docsTask.id, title: "Maintenance playbook", kind: TimeBlockKind.WORK, startsAt: atDay(monday, 2, 13), endsAt: atDay(monday, 2, 16) },
      { userId: sarah.id, projectId: null, taskId: null, title: "Team support hour", kind: TimeBlockKind.SUPPORT, startsAt: atDay(monday, 3, 10), endsAt: atDay(monday, 3, 12) },
      { userId: karim.id, projectId: plant.id, taskId: motor.id, title: "Motor replacement preparation", kind: TimeBlockKind.WORK, startsAt: atDay(monday, 0, 8), endsAt: atDay(monday, 0, 17) },
      { userId: karim.id, projectId: plant.id, taskId: motor.id, title: "Motor replacement preparation", kind: TimeBlockKind.WORK, startsAt: atDay(monday, 1, 8), endsAt: atDay(monday, 1, 17) },
      { userId: karim.id, projectId: plant.id, taskId: motor.id, title: "Motor replacement preparation", kind: TimeBlockKind.WORK, startsAt: atDay(monday, 2, 8), endsAt: atDay(monday, 2, 17) },
      { userId: karim.id, projectId: plant.id, taskId: motor.id, title: "Motor replacement preparation", kind: TimeBlockKind.WORK, startsAt: atDay(monday, 3, 9), endsAt: atDay(monday, 3, 17) },
      { userId: karim.id, projectId: plant.id, taskId: motor.id, title: "Motor replacement preparation", kind: TimeBlockKind.WORK, startsAt: atDay(monday, 4, 8), endsAt: atDay(monday, 4, 16) },
      { userId: amina.id, projectId: null, taskId: null, title: "Weekly planning meeting", kind: TimeBlockKind.MEETING, startsAt: atDay(monday, 0, 10), endsAt: atDay(monday, 0, 11) },
    ];

    for (const block of blocks) {
      let assignmentId: string | null = null;
      if (block.taskId) {
        const assignment = await tx.taskAssignment.create({ data: { taskId: block.taskId, userId: block.userId, scheduledFor: block.startsAt, plannedMinutes: Math.round((block.endsAt.getTime() - block.startsAt.getTime()) / 60000) } });
        assignmentId = assignment.id;
      }
      await tx.timeBlock.create({ data: { ...block, assignmentId } });
      const allocationType = block.taskId
        ? "TASK"
        : block.kind === TimeBlockKind.MEETING
          ? "MEETING"
          : block.kind === TimeBlockKind.SUPPORT
            ? "SUPPORT"
            : "ADMIN";
      await tx.workAllocation.create({
        data: {
          userId: block.userId,
          projectId: block.projectId,
          taskId: block.taskId,
          title: block.title,
          type: allocationType,
          source: block.taskId ? "TASK_ASSIGNMENT" : "MANUAL",
          status: "PLANNED",
          startsAt: block.startsAt,
          endsAt: block.endsAt,
          plannedMinutes: Math.round((block.endsAt.getTime() - block.startsAt.getTime()) / 60000),
        },
      });
    }
  });

  console.log("Demo workspace seeded.");
  console.log("Demo password for all users: %s", DEMO_PASSWORD);
  console.log("Users: amina, ali, sarah, karim @demo.waypoint.local");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
