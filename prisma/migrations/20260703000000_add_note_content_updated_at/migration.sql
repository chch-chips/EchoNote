ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "contentUpdatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Note_contentUpdatedAt_idx" ON "Note"("contentUpdatedAt");
