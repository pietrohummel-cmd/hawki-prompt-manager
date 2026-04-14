-- CreateEnum
CREATE TYPE "SchedulingSystem" AS ENUM ('CLINICORP', 'CONTROLE_ODONTO', 'SIMPLES_DENTAL', 'GOOGLE_AGENDA');

-- CreateEnum
CREATE TYPE "SchedulingMode" AS ENUM ('DIRECT', 'HANDOFF', 'LINK');

-- CreateEnum
CREATE TYPE "ClientTone" AS ENUM ('FORMAL', 'INFORMAL_MODERATE', 'CASUAL');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ModuleKey" AS ENUM ('IDENTITY', 'ABSOLUTE_RULES', 'INJECTION_PROTECTION', 'CONVERSATION_STATE', 'CONVERSATION_RESUME', 'PRESENTATION', 'COMMUNICATION_STYLE', 'HUMAN_BEHAVIOR', 'ACTIVE_LISTENING', 'ATTENDANCE_STAGES', 'QUALIFICATION', 'SLOT_OFFER', 'COMMITMENT_CONFIRMATION', 'OPENING', 'FINAL_OBJECTIVE', 'AUDIO_RULES', 'STATUS_RULES', 'HANDOFF');

-- CreateEnum
CREATE TYPE "GeneratedBy" AS ENUM ('AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('CRITICAL', 'NORMAL', 'IMPROVEMENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'SUGGESTED', 'APPROVED', 'APPLIED', 'REJECTED');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clinicName" TEXT NOT NULL,
    "assistantName" TEXT NOT NULL DEFAULT 'Sofia',
    "city" TEXT,
    "neighborhood" TEXT,
    "address" TEXT,
    "reference" TEXT,
    "phone" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "attendantName" TEXT,
    "schedulingSystem" "SchedulingSystem",
    "schedulingMode" "SchedulingMode",
    "tone" "ClientTone",
    "targetAudience" TEXT,
    "ageRange" TEXT,
    "restrictions" TEXT,
    "mandatoryPhrases" TEXT,
    "paymentInfo" TEXT,
    "specialists" TEXT,
    "technologies" TEXT,
    "differentials" TEXT,
    "businessHours" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ONBOARDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "ragDocument" TEXT,
    "narrativeManual" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "generatedBy" "GeneratedBy" NOT NULL DEFAULT 'AI',
    "changesSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptModule" (
    "id" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "moduleKey" "ModuleKey" NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionTicket" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "conversationTranscript" TEXT,
    "affectedModule" "ModuleKey",
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "aiSuggestion" TEXT,
    "finalCorrection" TEXT,
    "resolvedInVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CorrectionTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingUpload" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "parsedData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_clientId_version_key" ON "PromptVersion"("clientId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PromptModule_promptVersionId_moduleKey_key" ON "PromptModule"("promptVersionId", "moduleKey");

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptModule" ADD CONSTRAINT "PromptModule_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionTicket" ADD CONSTRAINT "CorrectionTicket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionTicket" ADD CONSTRAINT "CorrectionTicket_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingUpload" ADD CONSTRAINT "OnboardingUpload_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
