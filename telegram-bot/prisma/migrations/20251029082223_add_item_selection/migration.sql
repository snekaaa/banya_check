-- CreateTable
CREATE TABLE "ItemSelection" (
    "id" TEXT NOT NULL,
    "checkItemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemSelection_checkItemId_participantId_key" ON "ItemSelection"("checkItemId", "participantId");

-- AddForeignKey
ALTER TABLE "ItemSelection" ADD CONSTRAINT "ItemSelection_checkItemId_fkey" FOREIGN KEY ("checkItemId") REFERENCES "CheckItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSelection" ADD CONSTRAINT "ItemSelection_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
