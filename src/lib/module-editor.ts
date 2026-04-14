import Anthropic from "@anthropic-ai/sdk";
import type { Client, ModuleKey } from "@/generated/prisma";
import { MODULE_LABELS } from "@/lib/prompt-constants";
import { logUsage } from "@/lib/usage-logger";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Descrição funcional de cada módulo — guia a IA na sugestão de melhoria
const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  IDENTITY: "Define quem é a assistente, seu nome, para qual clínica trabalha e sua função principal.",
  ABSOLUTE_RULES: "Regras invioláveis que a assistente nunca pode quebrar (ex: nunca dar diagnóstico, nunca inventar horários).",
  INJECTION_PROTECTION: "Proteção contra tentativas de manipulação ou injeção de prompt malicioso por usuários.",
  CONVERSATION_STATE: "Como a assistente gerencia o contexto da conversa e lembra informações do paciente.",
  CONVERSATION_RESUME: "Como retomar conversas antigas ou interrompidas, reconhecendo pacientes que já conversaram antes.",
  PRESENTATION: "A mensagem de apresentação inicial ao receber uma nova mensagem.",
  COMMUNICATION_STYLE: "Tom de voz, formalidade, uso de emojis, comprimento das mensagens e estilo geral.",
  HUMAN_BEHAVIOR: "Comportamentos que tornam a assistente mais humana (pausas, variações de resposta, erros tipográficos propositais, etc).",
  ACTIVE_LISTENING: "Técnicas de escuta ativa: como a assistente valida o que o paciente diz antes de responder.",
  ATTENDANCE_STAGES: "As etapas do fluxo de atendimento que a assistente deve seguir sequencialmente.",
  QUALIFICATION: "Como qualificar leads/pacientes usando perguntas SPIN para entender necessidades e urgência.",
  SLOT_OFFER: "Como oferecer horários disponíveis para agendamento de forma natural.",
  COMMITMENT_CONFIRMATION: "Como confirmar o agendamento e garantir o compromisso do paciente.",
  OPENING: "A abertura padrão da conversa — como a assistente começa cada atendimento.",
  FINAL_OBJECTIVE: "O objetivo final do fluxo: o que a assistente deve ter alcançado ao final da conversa.",
  AUDIO_RULES: "Como a assistente lida com mensagens de áudio enviadas pelo paciente.",
  STATUS_RULES: "Regras sobre quando usar status/disponibilidade (ex: não lido, digitando).",
  HANDOFF: "Quando e como passar a conversa para um atendente humano.",
};

function buildMinimalContext(client: Client): string {
  return [
    `Clínica: ${client.clinicName}`,
    `Assistente: ${client.assistantName}`,
    client.tone ? `Tom: ${{ FORMAL: "semi-formal", INFORMAL_MODERATE: "informal moderado", CASUAL: "bem informal" }[client.tone] ?? client.tone}` : null,
    client.treatmentPronoun ? `Pronome: ${client.treatmentPronoun}` : null,
    client.schedulingMode ? `Modo de agendamento: ${client.schedulingMode}` : null,
    client.attendantName ? `Atendente humano: ${client.attendantName}` : null,
    client.targetAudience ? `Público-alvo: ${client.targetAudience}` : null,
    client.restrictions ? `Restrições: ${client.restrictions}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Sugere uma versão melhorada de um módulo específico.
 * Envia apenas o módulo isolado + contexto mínimo do cliente (regra do CLAUDE.md).
 */
export async function suggestModuleContent(
  client: Client,
  moduleKey: ModuleKey,
  currentContent: string
): Promise<string> {
  const label = MODULE_LABELS[moduleKey];
  const description = MODULE_DESCRIPTIONS[moduleKey];
  const context = buildMinimalContext(client);

  const prompt = `Você é um especialista em criar prompts para assistentes de IA de clínicas odontológicas brasileiras.

CONTEXTO MÍNIMO DO CLIENTE:
${context}

MÓDULO A MELHORAR: ${label}
FUNÇÃO DESTE MÓDULO: ${description}

CONTEÚDO ATUAL:
${currentContent}

Sugira uma versão melhorada deste módulo. Mantenha todas as informações corretas da clínica, melhore a clareza, naturalidade e eficácia.
Responda APENAS com o conteúdo do módulo — sem comentários, sem cabeçalho, sem ###MÓDULO###.`;

  // Haiku: suficiente para sugestões focadas, ~25x mais barato que Sonnet
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({ clientId: client.id, operation: "suggest_module", model: "claude-haiku-4-5-20251001", usage: message.usage });

  return message.content[0].type === "text" ? message.content[0].text.trim() : "";
}

/**
 * Sugere uma correção para um módulo com base em um ticket de problema.
 * Envia apenas o módulo afetado + contexto mínimo (regra do CLAUDE.md).
 */
export async function suggestTicketCorrection(
  client: Client,
  moduleKey: ModuleKey,
  currentContent: string,
  ticketDescription: string,
  transcript?: string | null
): Promise<string> {
  const label = MODULE_LABELS[moduleKey];
  const description = MODULE_DESCRIPTIONS[moduleKey];
  const context = buildMinimalContext(client);

  const prompt = `Você é um especialista em criar prompts para assistentes de IA de clínicas odontológicas brasileiras.

CONTEXTO MÍNIMO DO CLIENTE:
${context}

MÓDULO AFETADO: ${label}
FUNÇÃO DESTE MÓDULO: ${description}

CONTEÚDO ATUAL DO MÓDULO:
${currentContent}

PROBLEMA REPORTADO:
${ticketDescription}
${transcript ? `\nTRANSCRIÇÃO DA CONVERSA:\n${transcript}` : ""}

Com base no problema reportado, sugira uma versão corrigida deste módulo que resolva o problema sem quebrar o que já funciona.
Responda APENAS com o conteúdo corrigido do módulo — sem comentários, sem cabeçalho, sem ###MÓDULO###.`;

  // Haiku: suficiente para correções focadas de módulo, ~25x mais barato que Sonnet
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({ clientId: client.id, operation: "suggest_ticket", model: "claude-haiku-4-5-20251001", usage: message.usage });

  return message.content[0].type === "text" ? message.content[0].text.trim() : "";
}
