-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NoteSource" AS ENUM ('WEB', 'WECHAT_CC_CONNECT', 'API', 'IMPORT');

-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('THOUGHT', 'PLAN', 'REMINDER', 'QUOTE', 'OBSERVATION', 'INFO', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" "NoteSource" NOT NULL DEFAULT 'WEB',
    "rawMessage" TEXT,
    "clientCreatedAt" TIMESTAMP(3),
    "contentUpdatedAt" TIMESTAMP(3),
    "aiStatus" "AiStatus" NOT NULL DEFAULT 'PENDING',
    "aiError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteAiAnalysis" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "summary" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mood" TEXT,
    "energy" INTEGER,
    "kind" "NoteKind",
    "poeticFragment" TEXT,
    "model" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteAiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryFragment" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tone" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryFragment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryRainSnapshot" (
    "id" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "fragmentIds" TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshAfter" TIMESTAMP(3) NOT NULL,
    "forcedRefresh" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MemoryRainSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InletMessage" (
    "id" TEXT NOT NULL,
    "source" "NoteSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "noteId" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InletMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt");

-- CreateIndex
CREATE INDEX "Note_source_idx" ON "Note"("source");

-- CreateIndex
CREATE INDEX "Note_aiStatus_idx" ON "Note"("aiStatus");

-- CreateIndex
CREATE INDEX "Note_userId_createdAt_idx" ON "Note"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Note_contentUpdatedAt_idx" ON "Note"("contentUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NoteAiAnalysis_noteId_key" ON "NoteAiAnalysis"("noteId");

-- CreateIndex
CREATE INDEX "MemoryFragment_createdAt_idx" ON "MemoryFragment"("createdAt");

-- CreateIndex
CREATE INDEX "MemoryFragment_weight_idx" ON "MemoryFragment"("weight");

-- CreateIndex
CREATE INDEX "MemoryRainSnapshot_refreshAfter_idx" ON "MemoryRainSnapshot"("refreshAfter");

-- CreateIndex
CREATE INDEX "MemoryRainSnapshot_generatedAt_idx" ON "MemoryRainSnapshot"("generatedAt");

-- CreateIndex
CREATE INDEX "InletMessage_createdAt_idx" ON "InletMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InletMessage_source_externalId_key" ON "InletMessage"("source", "externalId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAiAnalysis" ADD CONSTRAINT "NoteAiAnalysis_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryFragment" ADD CONSTRAINT "MemoryFragment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
