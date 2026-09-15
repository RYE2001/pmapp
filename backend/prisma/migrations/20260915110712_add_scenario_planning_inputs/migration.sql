-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "estimatedMinutes" INTEGER NOT NULL DEFAULT 0;
