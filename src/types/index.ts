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
  name?: string;
  email?: string;
  clinicName?: string;
  assistantName?: string;
  attendantName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  neighborhood?: string;
  address?: string;
  reference?: string;
  phone?: string;
  instagram?: string;
  website?: string;
  businessHours?: string;
  specialists?: string;
  certifications?: string;
  technologies?: string;
  differentials?: string;
  tone?: string;
  targetAudience?: string;
  ageRange?: string;
  paymentInfo?: string;
  restrictions?: string;
  mandatoryPhrases?: string;       // informações que Sofia SEMPRE deve mencionar
  consultationInfo?: string;       // como funciona a primeira consulta / avaliação
  schedulingRequirements?: string; // dados obrigatórios para agendar
  schedulingMode?: string;
  schedulingSystem?: string;
  emojiUsage?: string;
  treatmentPronoun?: string;
  urgencyHandling?: string;   // "Sim" / "Não"
  urgencyProcedure?: string;  // como proceder em urgência
  // campos não mapeados ficam aqui
  unmapped: Record<string, string>;
}
