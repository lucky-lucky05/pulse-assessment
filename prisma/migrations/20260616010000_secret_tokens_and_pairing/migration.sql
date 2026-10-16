-- Pulse stores only transient coordination rows, so rather than migrate data
-- we recreate both tables with the new shape (secret token hash + public id).

-- DropTable
DROP TABLE "Signal";

-- DropTable
DROP TABLE "Presence";

-- CreateTable
CREATE TABLE "Presence" (
    "id" TEXT NOT NULL,
    "pub" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "busy" BOOLEAN NOT NULL DEFAULT false,
    "peerPub" TEXT,
    "pendingPub" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "toPub" TEXT NOT NULL,
    "fromPub" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Presence_pub_key" ON "Presence"("pub");

-- CreateIndex
CREATE INDEX "Presence_lastSeen_idx" ON "Presence"("lastSeen");

-- CreateIndex
CREATE INDEX "Presence_peerPub_idx" ON "Presence"("peerPub");

-- CreateIndex
CREATE INDEX "Signal_toPub_idx" ON "Signal"("toPub");

-- CreateIndex
CREATE INDEX "Signal_createdAt_idx" ON "Signal"("createdAt");
