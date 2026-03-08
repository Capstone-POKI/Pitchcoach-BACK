-- DropIndex
DROP INDEX "Notice_pitchId_key";

-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "isLatest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "NoticeEvaluationCriteria" ADD COLUMN     "irGuide" TEXT;

-- CreateTable
CREATE TABLE "IRDeck" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "noticeId" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "pdfSizeBytes" BIGINT,
    "pdfUploadStatus" "PdfUploadStatus",
    "totalScore" INTEGER,
    "presentationGuide" TEXT,
    "timeAllocation" TEXT,
    "emphasizedSlides" TEXT,
    "improvedItems" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "analysisStatus" "NoticeAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IRDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slide" (
    "id" TEXT NOT NULL,
    "irDeckId" TEXT NOT NULL,
    "slideNumber" INTEGER NOT NULL,
    "category" TEXT,
    "thumbnailUrl" TEXT,
    "contentSummary" TEXT,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlideFeedback" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "detailedFeedback" TEXT,
    "strengths" TEXT,
    "improvements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlideFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckScore" (
    "id" TEXT NOT NULL,
    "irDeckId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "structureSummary" TEXT,
    "strengths" TEXT,
    "improvements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeckScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriteriaScore" (
    "id" TEXT NOT NULL,
    "deckScoreId" TEXT NOT NULL,
    "criteriaId" TEXT,
    "criteriaName" TEXT NOT NULL,
    "pitchcoachInterpretation" TEXT,
    "irGuide" TEXT,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "isCovered" BOOLEAN NOT NULL,
    "feedback" TEXT,
    "relatedSlides" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriteriaScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rehearsal" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "irDeckId" TEXT,
    "rehearsalNumber" INTEGER NOT NULL,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "audioFileUrl" TEXT NOT NULL,
    "audioDurationSeconds" INTEGER,
    "audioDurationDisplay" TEXT,
    "audioFormat" TEXT,
    "wpm" INTEGER,
    "transcription" TEXT,
    "totalScore" INTEGER,
    "structureSummary" TEXT,
    "overallStrengths" TEXT,
    "overallImprovements" TEXT,
    "improvedItems" TEXT,
    "analysisStatus" "NoticeAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rehearsal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RehearsalDetailScore" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "categoryDisplayName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RehearsalDetailScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RehearsalDeliveryAnalysis" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "categoryDisplayName" TEXT NOT NULL,
    "score" INTEGER,
    "feedback" TEXT,
    "metricValue" TEXT,
    "metricLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RehearsalDeliveryAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RehearsalSlideAnalysis" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "slideId" TEXT,
    "slideNumber" INTEGER NOT NULL,
    "startTimestamp" DOUBLE PRECISION NOT NULL,
    "endTimestamp" DOUBLE PRECISION NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "durationDisplay" TEXT,
    "score" INTEGER,
    "transcription" TEXT,
    "contentSummary" TEXT,
    "detailedFeedback" TEXT,
    "strengths" TEXT,
    "improvements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RehearsalSlideAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QATraining" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "totalQuestions" INTEGER NOT NULL DEFAULT 5,
    "totalScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QATraining_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QAQuestion" (
    "id" TEXT NOT NULL,
    "qaTrainingId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answerGuide" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QAQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QAAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "audioFileUrl" TEXT,
    "transcription" TEXT,
    "briefnessScore" INTEGER,
    "evidenceScore" INTEGER,
    "structureScore" INTEGER,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QAAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "noticeId" TEXT,
    "irDeckId" TEXT,
    "rehearsalId" TEXT,
    "noticeSummary" TEXT,
    "noticeScore" INTEGER,
    "irDeckSummary" TEXT,
    "irDeckScore" INTEGER,
    "voiceSummary" TEXT,
    "voiceScore" INTEGER,
    "qaSummary" TEXT,
    "qaScore" INTEGER,
    "finalScore" INTEGER NOT NULL,
    "chartData" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IRDeck_pitchId_idx" ON "IRDeck"("pitchId");

-- CreateIndex
CREATE INDEX "IRDeck_noticeId_idx" ON "IRDeck"("noticeId");

-- CreateIndex
CREATE INDEX "IRDeck_pitchId_version_idx" ON "IRDeck"("pitchId", "version");

-- CreateIndex
CREATE INDEX "IRDeck_pitchId_isLatest_idx" ON "IRDeck"("pitchId", "isLatest");

-- CreateIndex
CREATE INDEX "Slide_irDeckId_idx" ON "Slide"("irDeckId");

-- CreateIndex
CREATE UNIQUE INDEX "Slide_irDeckId_slideNumber_key" ON "Slide"("irDeckId", "slideNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SlideFeedback_slideId_key" ON "SlideFeedback"("slideId");

-- CreateIndex
CREATE UNIQUE INDEX "DeckScore_irDeckId_key" ON "DeckScore"("irDeckId");

-- CreateIndex
CREATE INDEX "CriteriaScore_deckScoreId_idx" ON "CriteriaScore"("deckScoreId");

-- CreateIndex
CREATE INDEX "Rehearsal_pitchId_idx" ON "Rehearsal"("pitchId");

-- CreateIndex
CREATE INDEX "Rehearsal_irDeckId_idx" ON "Rehearsal"("irDeckId");

-- CreateIndex
CREATE INDEX "Rehearsal_pitchId_isLatest_idx" ON "Rehearsal"("pitchId", "isLatest");

-- CreateIndex
CREATE UNIQUE INDEX "Rehearsal_pitchId_rehearsalNumber_key" ON "Rehearsal"("pitchId", "rehearsalNumber");

-- CreateIndex
CREATE INDEX "RehearsalDetailScore_rehearsalId_idx" ON "RehearsalDetailScore"("rehearsalId");

-- CreateIndex
CREATE UNIQUE INDEX "RehearsalDetailScore_rehearsalId_categoryName_key" ON "RehearsalDetailScore"("rehearsalId", "categoryName");

-- CreateIndex
CREATE INDEX "RehearsalDeliveryAnalysis_rehearsalId_idx" ON "RehearsalDeliveryAnalysis"("rehearsalId");

-- CreateIndex
CREATE UNIQUE INDEX "RehearsalDeliveryAnalysis_rehearsalId_categoryName_key" ON "RehearsalDeliveryAnalysis"("rehearsalId", "categoryName");

-- CreateIndex
CREATE INDEX "RehearsalSlideAnalysis_rehearsalId_idx" ON "RehearsalSlideAnalysis"("rehearsalId");

-- CreateIndex
CREATE INDEX "RehearsalSlideAnalysis_slideId_idx" ON "RehearsalSlideAnalysis"("slideId");

-- CreateIndex
CREATE UNIQUE INDEX "RehearsalSlideAnalysis_rehearsalId_slideNumber_key" ON "RehearsalSlideAnalysis"("rehearsalId", "slideNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QATraining_rehearsalId_key" ON "QATraining"("rehearsalId");

-- CreateIndex
CREATE INDEX "QATraining_rehearsalId_idx" ON "QATraining"("rehearsalId");

-- CreateIndex
CREATE INDEX "QAQuestion_qaTrainingId_idx" ON "QAQuestion"("qaTrainingId");

-- CreateIndex
CREATE UNIQUE INDEX "QAAnswer_questionId_key" ON "QAAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_pitchId_key" ON "Report"("pitchId");

-- CreateIndex
CREATE INDEX "Report_pitchId_idx" ON "Report"("pitchId");

-- CreateIndex
CREATE INDEX "Report_noticeId_idx" ON "Report"("noticeId");

-- CreateIndex
CREATE INDEX "Report_irDeckId_idx" ON "Report"("irDeckId");

-- CreateIndex
CREATE INDEX "Report_rehearsalId_idx" ON "Report"("rehearsalId");

-- CreateIndex
CREATE INDEX "Notice_pitchId_idx" ON "Notice"("pitchId");

-- CreateIndex
CREATE INDEX "Notice_pitchId_version_idx" ON "Notice"("pitchId", "version");

-- CreateIndex
CREATE INDEX "Notice_pitchId_isLatest_idx" ON "Notice"("pitchId", "isLatest");

-- CreateIndex
CREATE INDEX "Pitch_isDeleted_idx" ON "Pitch"("isDeleted");

-- AddForeignKey
ALTER TABLE "IRDeck" ADD CONSTRAINT "IRDeck_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IRDeck" ADD CONSTRAINT "IRDeck_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slide" ADD CONSTRAINT "Slide_irDeckId_fkey" FOREIGN KEY ("irDeckId") REFERENCES "IRDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlideFeedback" ADD CONSTRAINT "SlideFeedback_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "Slide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckScore" ADD CONSTRAINT "DeckScore_irDeckId_fkey" FOREIGN KEY ("irDeckId") REFERENCES "IRDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaScore" ADD CONSTRAINT "CriteriaScore_deckScoreId_fkey" FOREIGN KEY ("deckScoreId") REFERENCES "DeckScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaScore" ADD CONSTRAINT "CriteriaScore_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "NoticeEvaluationCriteria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rehearsal" ADD CONSTRAINT "Rehearsal_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rehearsal" ADD CONSTRAINT "Rehearsal_irDeckId_fkey" FOREIGN KEY ("irDeckId") REFERENCES "IRDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehearsalDetailScore" ADD CONSTRAINT "RehearsalDetailScore_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehearsalDeliveryAnalysis" ADD CONSTRAINT "RehearsalDeliveryAnalysis_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehearsalSlideAnalysis" ADD CONSTRAINT "RehearsalSlideAnalysis_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehearsalSlideAnalysis" ADD CONSTRAINT "RehearsalSlideAnalysis_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "Slide"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QATraining" ADD CONSTRAINT "QATraining_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QAQuestion" ADD CONSTRAINT "QAQuestion_qaTrainingId_fkey" FOREIGN KEY ("qaTrainingId") REFERENCES "QATraining"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QAAnswer" ADD CONSTRAINT "QAAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QAQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_irDeckId_fkey" FOREIGN KEY ("irDeckId") REFERENCES "IRDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
