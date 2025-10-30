-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "registrationMessageId" INTEGER;

-- AlterTable
ALTER TABLE "SessionParticipant" ADD COLUMN     "attendanceStatus" TEXT NOT NULL DEFAULT 'going';
