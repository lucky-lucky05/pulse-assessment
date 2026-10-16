-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerPub" TEXT NOT NULL,
    "blockedPub" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Block_blockedPub_idx" ON "Block"("blockedPub");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerPub_blockedPub_key" ON "Block"("blockerPub", "blockedPub");
