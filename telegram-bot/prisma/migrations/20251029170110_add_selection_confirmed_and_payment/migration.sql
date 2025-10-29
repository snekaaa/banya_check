-- AlterTable
ALTER TABLE "SessionParticipant" ADD COLUMN     "selectionConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "sessionParticipantId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentProof" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_sessionParticipantId_fkey" FOREIGN KEY ("sessionParticipantId") REFERENCES "SessionParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
