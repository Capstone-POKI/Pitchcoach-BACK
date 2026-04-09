-- AlterTable
ALTER TABLE "QATraining" DROP CONSTRAINT IF EXISTS "QATraining_rehearsalId_fkey";

DROP INDEX IF EXISTS "QATraining_rehearsalId_key";

ALTER TABLE "QATraining" ALTER COLUMN "rehearsalId" DROP NOT NULL;

ALTER TABLE "QATraining" ADD COLUMN "pitchId" TEXT;
ALTER TABLE "QATraining" ADD COLUMN "noticeId" TEXT;
ALTER TABLE "QATraining" ADD COLUMN "irDeckId" TEXT;
ALTER TABLE "QATraining" ADD COLUMN "voiceAnalysisId" TEXT;
ALTER TABLE "QATraining" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "QATraining" ADD COLUMN "isLatest" BOOLEAN NOT NULL DEFAULT true;

UPDATE "QATraining" q
SET "pitchId" = r."pitchId"
FROM "Rehearsal" r
WHERE q."rehearsalId" = r."id";

UPDATE "QATraining" q
SET "voiceAnalysisId" = q."rehearsalId"
WHERE q."voiceAnalysisId" IS NULL AND q."rehearsalId" IS NOT NULL;

UPDATE "QATraining" q
SET "noticeId" = n."id"
FROM "Notice" n
WHERE q."pitchId" = n."pitchId" AND n."isLatest" = true AND q."noticeId" IS NULL;

UPDATE "QATraining" q
SET "irDeckId" = d."id"
FROM "IRDeck" d
WHERE q."pitchId" = d."pitchId" AND d."isLatest" = true AND q."irDeckId" IS NULL;

ALTER TABLE "QATraining" ALTER COLUMN "pitchId" SET NOT NULL;

WITH ranked AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (PARTITION BY "pitchId" ORDER BY "createdAt" ASC, "id" ASC) AS rn,
        ROW_NUMBER() OVER (PARTITION BY "pitchId" ORDER BY "createdAt" DESC, "id" DESC) AS latest_rn
    FROM "QATraining"
)
UPDATE "QATraining" q
SET
    "version" = ranked.rn,
    "isLatest" = (ranked.latest_rn = 1)
FROM ranked
WHERE q."id" = ranked."id";

ALTER TABLE "QATraining" ADD CONSTRAINT "QATraining_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "QATraining_pitchId_idx" ON "QATraining"("pitchId");
CREATE INDEX "QATraining_pitchId_isLatest_idx" ON "QATraining"("pitchId", "isLatest");
CREATE UNIQUE INDEX "QATraining_pitchId_version_key" ON "QATraining"("pitchId", "version");
