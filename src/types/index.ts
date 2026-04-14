import type {
  Client,
  PromptVersion,
  PromptModule,
  CorrectionTicket,
  ModuleKey,
  SchedulingMode,
  SchedulingSystem,
  ClientTone,
  ClientStatus,
  TicketPriority,
  TicketStatus,
  GeneratedBy,
} from "@/generated/prisma";

export type {
  Client,
  PromptVersion,
  PromptModule,
  CorrectionTicket,
  ModuleKey,
  SchedulingMode,
  SchedulingSystem,
  ClientTone,
  ClientStatus,
  TicketPriority,
  TicketStatus,
  GeneratedBy,
};

// Dados parseados de um CSV de onboarding
export interface ParsedOnboardingData {
  clinicName?: string;
  assistantName?: string;
  attendantName?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  reference?: string;
  phone?: string;
  instagram?: string;
  website?: string;
  businessHours?: string;
  specialists?: string;
  technologies?: string;
  differentials?: string;
  tone?: string;
  targetAudience?: string;
  ageRange?: string;
  paymentInfo?: string;
  restrictions?: string;
  mandatoryPhrases?: string;
  schedulingMode?: string;
  schedulingSystem?: string;
  // campos não mapeados ficam aqui
  unmapped: Record<string, string>;
}
