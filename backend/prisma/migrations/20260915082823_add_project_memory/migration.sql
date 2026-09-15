-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'REVERSED');

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "alternatives" TEXT,
    "status" "DecisionStatus" NOT NULL DEFAULT 'ACTIVE',
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionEvidence" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "decisionId" TEXT NOT NULL,

    CONSTRAINT "DecisionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionPerson" (
    "decisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DecisionPerson_pkey" PRIMARY KEY ("decisionId","userId")
);

-- CreateTable
CREATE TABLE "DecisionTask" (
    "decisionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,

    CONSTRAINT "DecisionTask_pkey" PRIMARY KEY ("decisionId","taskId")
);

-- CreateIndex
CREATE INDEX "Decision_projectId_status_decidedAt_idx" ON "Decision"("projectId", "status", "decidedAt");

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionEvidence" ADD CONSTRAINT "DecisionEvidence_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionPerson" ADD CONSTRAINT "DecisionPerson_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionPerson" ADD CONSTRAINT "DecisionPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionTask" ADD CONSTRAINT "DecisionTask_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionTask" ADD CONSTRAINT "DecisionTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
