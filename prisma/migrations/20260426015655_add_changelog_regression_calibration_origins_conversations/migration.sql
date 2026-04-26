-- CreateEnum
CREATE TYPE "RegressionRunStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConvOutcome" AS ENUM ('SCHEDULED', 'NOT_SCHEDULED', 'LOST');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "minConversationsPerVersion" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "PromptVersion" ADD COLUMN     "savedBy" TEXT;

-- CreateTable
CREATE TABLE "RegressionCase" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "criteria" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegressionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegressionRun" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "status" "RegressionRunStatus" NOT NULL DEFAULT 'PENDING',
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegressionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calibration" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "humanConversation" TEXT NOT NULL,
    "sofiaConversation" TEXT NOT NULL,
    "gaps" JSONB NOT NULL,
    "appliedToPrompt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Calibration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadOriginTag" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "opening" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadOriginTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSample" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "outcome" "ConvOutcome",
    "notes" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationSample_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RegressionCase" ADD CONSTRAINT "RegressionCase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegressionRun" ADD CONSTRAINT "RegressionRun_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegressionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOriginTag" ADD CONSTRAINT "LeadOriginTag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSample" ADD CONSTRAINT "ConversationSample_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSample" ADD CONSTRAINT "ConversationSample_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
