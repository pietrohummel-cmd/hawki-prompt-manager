import type { ModuleKey } from "@/generated/prisma";

export const MODULE_LABELS: Record<ModuleKey, string> = {
  IDENTITY: "Identidade",
  INJECTION_PROTECTION: "Proteção contra Injeção",
  TONE_AND_STYLE: "Tom e Estilo",
  OPENING: "Abertura",
  ATTENDANCE_FLOW: "Fluxo de Atendimento",
  QUALIFICATION: "Qualificação e Horários",
  OBJECTION_HANDLING: "Tratamento de Objeções",
  FEW_SHOT_EXAMPLES: "Exemplos (Few-Shot)",
  AUDIO_AND_HANDOFF: "Áudio e Passagem",
  ABSOLUTE_RULES: "Regras Absolutas",
};

export const MODULE_ORDER: ModuleKey[] = [
  "IDENTITY",
  "INJECTION_PROTECTION",
  "TONE_AND_STYLE",
  "OPENING",
  "ATTENDANCE_FLOW",
  "QUALIFICATION",
  "OBJECTION_HANDLING",
  "FEW_SHOT_EXAMPLES",
  "AUDIO_AND_HANDOFF",
  "ABSOLUTE_RULES",
];
