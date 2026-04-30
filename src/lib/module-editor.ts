import Anthropic from "@anthropic-ai/sdk";
import type { Client, ModuleKey } from "@/generated/prisma";
import { MODULE_LABELS } from "@/lib/prompt-constants";
import { logUsage } from "@/lib/usage-logger";
import { SOFIA_GUIDELINES_CONDENSED } from "@/lib/sofia-guidelines";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Descrição funcional de cada módulo — guia a IA na sugestão de melhoria
const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  IDENTITY: "Define quem é a assistente: nome, clínica, cidade e função. Máx. 60 palavras.",
  INJECTION_PROTECTION: "1 instrução com script exato para responder a tentativas de manipulação de prompt. Máx. 60 palavras.",
  TONE_AND_STYLE: "Tom verificável (linhas por mensagem, emojis, bullets) + 3 comportamentos anti-robô + 2 regras de escuta: parafrasear antes de responder e nunca pedir dados já fornecidos. Máx. 120 palavras.",
  OPENING: "Mensagem padrão de primeiro contato (1 linha) + 4 variações por período (manhã/tarde/noite/urgência), 1 linha cada. Máx. 80 palavras.",
  ATTENDANCE_FLOW: "5 passos numerados do fluxo (1 linha cada) + 1 frase sobre retomada de conversa. Máx. 100 palavras.",
  QUALIFICATION: "Perguntas SPIN por cenário (dor/estética/prevenção/tratamento) + tabela de especialistas com disponibilidade. Máx. 200 palavras.",
  OBJECTION_HANDLING: "3 scripts de objeção diretos: medo/ansiedade, falta de tempo, indecisão. Sem cabeçalho descritivo. Máx. 100 palavras.",
  FEW_SHOT_EXAMPLES: "2 exemplos de conversa completa no formato [PACIENTE]: / [Nome]: — (1) agendamento completo 8–10 turnos com dados reais da clínica, (2) urgência 3 turnos com telefone imediato.",
  AUDIO_AND_HANDOFF: "4 regras de áudio completas (incluindo instrução para áudio incompreensível) + quando/como passar para humano. Máx. 80 palavras.",
  ABSOLUTE_RULES: "EXATAMENTE 5 regras invioláveis, cada uma começando com NUNCA ou SEMPRE. Fica sempre por último.",
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

${SOFIA_GUIDELINES_CONDENSED}

CONTEXTO MÍNIMO DO CLIENTE:
${context}

MÓDULO A MELHORAR: ${label}
FUNÇÃO DESTE MÓDULO: ${description}

CONTEÚDO ATUAL:
${currentContent}

Sugira uma versão melhorada deste módulo. Siga rigorosamente as diretrizes acima — evite antipadrões, use tom operacional verificável, regras com gatilho claro.
Mantenha todas as informações corretas da clínica. Responda APENAS com o conteúdo do módulo — sem comentários, sem cabeçalho, sem ###MÓDULO###.`;

  // Haiku: suficiente para sugestões focadas, ~25x mais barato que Sonnet
  const message = await getAnthropic().messages.create({
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
  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({ clientId: client.id, operation: "suggest_ticket", model: "claude-haiku-4-5-20251001", usage: message.usage });

  return message.content[0].type === "text" ? message.content[0].text.trim() : "";
}
