/*
  Warnings:

  - The `noticeType` column on the `Pitch` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('PDF', 'MANUAL', 'NONE');

-- CreateEnum
CREATE TYPE "NoticeAnalysisStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PdfUploadStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Pitch" DROP COLUMN "noticeType",
ADD COLUMN     "noticeType" "NoticeType";

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "pdfSizeBytes" BIGINT,
    "pdfUploadStatus" "PdfUploadStatus",
    "noticeName" TEXT NOT NULL,
    "hostOrganization" TEXT,
    "recruitmentType" TEXT,
    "targetAudience" TEXT,
    "applicationPeriod" TEXT,
    "summary" TEXT,
    "coreRequirements" TEXT,
    "sourceReference" TEXT,
    "additionalCriteria" TEXT,
    "irDeckGuide" TEXT,
    "analysisStatus" "NoticeAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeEvaluationCriteria" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "criteriaName" TEXT NOT NULL,
    "points" INTEGER,
    "importance" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "parentId" TEXT,
    "pitchcoachInterpretation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoticeEvaluationCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IRRequirement" (
    "id" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "requirementName" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IRRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notice_pitchId_key" ON "Notice"("pitchId");

-- CreateIndex
CREATE INDEX "Notice_analysisStatus_idx" ON "Notice"("analysisStatus");

-- CreateIndex
CREATE INDEX "NoticeEvaluationCriteria_noticeId_idx" ON "NoticeEvaluationCriteria"("noticeId");

-- CreateIndex
CREATE INDEX "IRRequirement_criteriaId_idx" ON "IRRequirement"("criteriaId");

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeEvaluationCriteria" ADD CONSTRAINT "NoticeEvaluationCriteria_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeEvaluationCriteria" ADD CONSTRAINT "NoticeEvaluationCriteria_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NoticeEvaluationCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IRRequirement" ADD CONSTRAINT "IRRequirement_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "NoticeEvaluationCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
