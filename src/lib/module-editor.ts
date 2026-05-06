import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Client, ModuleKey } from "@/generated/prisma";
import { MODULE_LABELS } from "@/lib/prompt-constants";
import { logUsage } from "@/lib/usage-logger";
import { SOFIA_GUIDELINES_CONDENSED } from "@/lib/sofia-guidelines";

const CORRECTION_MODEL = "gpt-4o";
const AUDIT_MODEL = "claude-haiku-4-5-20251001";

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada. Adicione ao .env.local e reinicie o servidor.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.HAWKI_ANTHROPIC_API_KEY });
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
    client.salesApproach
      ? `Condução: ${{
          DIRECT: "direta ao agendamento",
          BALANCED: "equilibrada com 1 pergunta de contexto",
          CONSULTATIVE_SPIN: "consultiva/SPIN",
          ADAPTIVE: "adaptativa conforme ritmo do paciente",
        }[client.salesApproach] ?? client.salesApproach}`
      : null,
    client.treatmentPronoun ? `Pronome: ${client.treatmentPronoun}` : null,
    client.schedulingMode ? `Modo de agendamento: ${client.schedulingMode}` : null,
    client.attendantName ? `Atendente humano: ${client.attendantName}` : null,
    client.targetAudience ? `Público-alvo: ${client.targetAudience}` : null,
    client.restrictions ? `Restrições: ${client.restrictions}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildHawkiCorrectionBrief(moduleKey: ModuleKey): string {
  const moduleSpecific =
    moduleKey === "TONE_AND_STYLE"
      ? `\nATENÇÃO PARA TOM E TAMANHO:
- Não resolva com "máximo X caracteres"; esse tipo de regra costuma falhar em conversa real.
- Prefira regras comportamentais verificáveis: até 2 frases curtas por mensagem, uma pergunta por turno, sem listas quando o paciente não pediu lista, dividir explicações longas em mensagens menores.
- Escreva gatilhos explícitos, por exemplo: "Se a resposta exigir mais de 2 frases, envie uma síntese e faça uma pergunta de continuidade."
- Se o problema envolver repetição de saudação/apresentação, adicione regra de estado: saudação e apresentação só na primeira mensagem da Sofia; em turnos seguintes responda direto à intenção atual.
- Se o problema envolver vídeo/link/documento, adicione regra: após enviar mídia, pare e aguarde o paciente voltar; não faça pergunta de origem/qualificação no mesmo turno.`
      : moduleKey === "ATTENDANCE_FLOW"
      ? `\nATENÇÃO PARA FLUXO:
- O fluxo NÃO deve mandar iniciar todo turno com saudação/apresentação. Isso pertence ao OPENING e só vale para a primeira mensagem.
- Dúvida concreta do paciente tem prioridade sobre qualificação. Primeiro responda; depois avance.
- Se enviar vídeo, imagem, documento ou link, pare o turno. Não misture mídia com pergunta de origem ou qualificação.`
      : moduleKey === "ABSOLUTE_RULES"
      ? `\nATENÇÃO PARA REGRAS ABSOLUTAS:
- Preserve o limite de aproximadamente 5 regras absolutas.
- Use NUNCA/SEMPRE só quando a regra realmente for crítica.
- Cada regra precisa dizer o que fazer no lugar, não apenas proibir.`
      : moduleKey === "FEW_SHOT_EXAMPLES"
      ? `\nATENÇÃO PARA EXEMPLOS:
- Se o operador descreveu um output esperado, transforme isso em exemplo curto no formato do módulo.
- Exemplo bom demonstra comportamento; não explique a regra em texto solto.`
      : "";

  return `PADRÃO HAWKI PARA CORREÇÕES:
- Faça mudança mínima: corrija o padrão reportado sem reescrever informações válidas desnecessariamente.
- Regra forte = gatilho + ação + forma. Evite regra vaga como "seja breve"; use "Quando X acontecer, faça Y em Z formato".
- Se o problema é comportamento repetido, adicione uma regra operacional no módulo certo e, quando útil, um exemplo curto.
- Preserve estado conversacional: não repita saudação/apresentação em turnos seguintes; responda a última intenção do paciente antes de avançar no funil.
- Preserve a condução configurada do cliente: direto, equilibrado, consultivo/SPIN ou adaptativo. Se ajustar SPIN, use 1 pergunta por mensagem e conecte dor/objetivo ao agendamento sem pressão.
- Se o problema for falta de condução, transforme em critério de saída da mensagem: resposta informativa sem mídia deve terminar com 1 pergunta consultiva ou próximo passo de agenda, não apenas com informação.
- Uma mensagem deve ter uma ação principal. Quando houver envio de mídia/link/documento, a correção deve instruir a parar e aguardar a resposta do paciente.
- Se o problema envolver campanha, ação sazonal, condição temporária, preço, condição comercial, pagamento ou parcelamento, a correção deve obrigar consulta à KB/search_knowledge quando disponível e proibir inferências comerciais.
- Para clínicas premium/boutique, nunca transformar "campanha" em "promoção", "oferta", "desconto", "facilidade" ou "parcelamento" se a KB não usar literalmente esses termos.
- Posicione conteúdo crítico de forma clara dentro do módulo. Regras críticas devem ser fáceis de auditar.
- Não invente preço, endereço, procedimento, profissional, horário, ferramenta ou política da clínica.
- Não adicione comentários sobre a sua alteração. A saída final deve ser apenas o módulo corrigido.${moduleSpecific}`;
}

interface CorrectionAudit {
  passes: boolean;
  critique: string;
}

async function auditCorrectionWithAnthropic(params: {
  clientId?: string;
  moduleKey: ModuleKey;
  currentContent: string;
  problemDescription: string;
  proposedContent: string;
  expectedOutput?: string | null;
}): Promise<CorrectionAudit> {
  if (!process.env.HAWKI_ANTHROPIC_API_KEY) {
    return { passes: true, critique: "Auditoria Anthropic ignorada: HAWKI_ANTHROPIC_API_KEY não configurada." };
  }

  const prompt = `Você é um auditor independente de qualidade de prompts Hawki.

Sua tarefa é avaliar uma correção de módulo que foi escrita por outro modelo. Não reescreva o módulo.

MÓDULO: ${MODULE_LABELS[params.moduleKey]}

PROBLEMA QUE A CORREÇÃO PRECISA RESOLVER:
${params.problemDescription}
${params.expectedOutput ? `\nOUTPUT ESPERADO / FEEDBACK DO OPERADOR:\n${params.expectedOutput}` : ""}

CONTEÚDO ORIGINAL:
${params.currentContent}

CORREÇÃO PROPOSTA:
${params.proposedContent}

Critérios:
- A correção resolve diretamente o problema reportado?
- Usa regra forte com gatilho, ação e forma quando for regra?
- Evita regra vaga como "seja breve" sem dizer como agir?
- Preserva informações válidas e não inventa dados da clínica?
- Se o problema for tamanho/tom, usa comportamento verificável em vez de depender só de limite de caracteres?
- Se o problema envolver repetição de saudação, a correção proíbe saudação/apresentação após a primeira mensagem da Sofia?
- Se o problema envolver envio de vídeo/link/documento, a correção manda parar após a mídia e não misturar pergunta de origem/qualificação no mesmo turno?
- Se o problema envolver campanha/preço/pagamento, a correção proíbe inventar parcelamento, facilidade, promoção ou desconto e manda consultar KB/search_knowledge?
- A correção preserva o posicionamento premium/boutique quando o cliente for premium?

Responda APENAS em JSON válido:
{
  "passes": true,
  "critique": "Se passes=false, explique em até 3 bullets curtos o que precisa mudar. Se passes=true, escreva uma frase curta."
}`;

  const message = await getAnthropic().messages.create({
    model: AUDIT_MODEL,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({
    clientId: params.clientId,
    operation: "audit_prompt_correction",
    model: AUDIT_MODEL,
    usage: message.usage,
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  try {
    const raw = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
    const parsed = JSON.parse(raw) as Partial<CorrectionAudit>;
    return {
      passes: parsed.passes === true,
      critique: typeof parsed.critique === "string" ? parsed.critique : "Auditoria sem crítica estruturada.",
    };
  } catch {
    return {
      passes: true,
      critique: "Auditoria Anthropic não retornou JSON válido; mantendo correção OpenAI para não bloquear o fluxo.",
    };
  }
}

async function refineWithOpenAIAudit(params: {
  clientId: string;
  moduleKey: ModuleKey;
  currentContent: string;
  problemDescription: string;
  proposedContent: string;
  auditCritique: string;
  expectedOutput?: string | null;
}): Promise<string> {
  const prompt = `Você é um especialista em criar prompts para assistentes de IA de clínicas odontológicas brasileiras.

Uma correção inicial foi auditada e precisa ser ajustada. Reescreva a correção final considerando a crítica.

MÓDULO: ${MODULE_LABELS[params.moduleKey]}

CONTEÚDO ORIGINAL:
${params.currentContent}

PROBLEMA:
${params.problemDescription}
${params.expectedOutput ? `\nOUTPUT ESPERADO / FEEDBACK DO OPERADOR:\n${params.expectedOutput}` : ""}

CORREÇÃO INICIAL:
${params.proposedContent}

CRÍTICA DO AUDITOR:
${params.auditCritique}

Regras para a versão final:
- Corrija somente o necessário.
- Use regra forte com gatilho, ação e forma.
- Não invente dados da clínica.
- Não explique a alteração.

Responda APENAS com o conteúdo final do módulo — sem comentários, sem cabeçalho, sem ###MÓDULO###.`;

  const completion = await getOpenAI().chat.completions.create({
    model: CORRECTION_MODEL,
    max_tokens: 2048,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({
    clientId: params.clientId,
    operation: "suggest_ticket",
    model: CORRECTION_MODEL,
    usage: {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
    },
  });

  return completion.choices[0]?.message.content?.trim() || params.proposedContent;
}

export async function auditAndRefinePromptCorrection(params: {
  clientId: string;
  moduleKey: ModuleKey;
  currentContent: string;
  problemDescription: string;
  proposedContent: string;
  expectedOutput?: string | null;
}): Promise<string> {
  const audit = await auditCorrectionWithAnthropic(params);
  if (audit.passes) return params.proposedContent;

  return refineWithOpenAIAudit({
    clientId: params.clientId,
    moduleKey: params.moduleKey,
    currentContent: params.currentContent,
    problemDescription: params.problemDescription,
    proposedContent: params.proposedContent,
    expectedOutput: params.expectedOutput,
    auditCritique: audit.critique,
  });
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

  const completion = await getOpenAI().chat.completions.create({
    model: CORRECTION_MODEL,
    max_tokens: 2048,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({
    clientId: client.id,
    operation: "suggest_module",
    model: CORRECTION_MODEL,
    usage: {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
    },
  });

  const proposedContent = completion.choices[0]?.message.content?.trim() ?? "";
  if (!proposedContent) return "";

  return auditAndRefinePromptCorrection({
    clientId: client.id,
    moduleKey,
    currentContent,
    problemDescription: "Melhorar o módulo seguindo as diretrizes Hawki e preservando informações válidas.",
    proposedContent,
  });
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
  transcript?: string | null,
  regenerationFeedback?: string | null
): Promise<string> {
  const label = MODULE_LABELS[moduleKey];
  const description = MODULE_DESCRIPTIONS[moduleKey];
  const context = buildMinimalContext(client);
  const correctionBrief = buildHawkiCorrectionBrief(moduleKey);

  const prompt = `Você é um especialista em criar prompts para assistentes de IA de clínicas odontológicas brasileiras.

CONTEXTO MÍNIMO DO CLIENTE:
${context}

${correctionBrief}

MÓDULO AFETADO: ${label}
FUNÇÃO DESTE MÓDULO: ${description}

CONTEÚDO ATUAL DO MÓDULO:
${currentContent}

PROBLEMA REPORTADO:
${ticketDescription}
${transcript ? `\nTRANSCRIÇÃO DA CONVERSA:\n${transcript}` : ""}
${regenerationFeedback ? `\nFEEDBACK SOBRE A SUGESTÃO ANTERIOR / OUTPUT ESPERADO:\n${regenerationFeedback}` : ""}

Com base no problema reportado, sugira uma versão corrigida deste módulo que resolva o problema sem quebrar o que já funciona.
Antes de escrever a resposta final, confira mentalmente:
1. A correção tem gatilho, ação e forma?
2. Ela evita proibições vagas?
3. Ela preserva dados corretos da clínica?
4. Se o operador informou output esperado, a versão corrigida torna esse output mais provável?

Responda APENAS com o conteúdo corrigido do módulo — sem comentários, sem cabeçalho, sem ###MÓDULO###.`;

  const completion = await getOpenAI().chat.completions.create({
    model: CORRECTION_MODEL,
    max_tokens: 2048,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({
    clientId: client.id,
    operation: "suggest_ticket",
    model: CORRECTION_MODEL,
    usage: {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
    },
  });

  const proposedContent = completion.choices[0]?.message.content?.trim() ?? "";
  if (!proposedContent) return "";

  return auditAndRefinePromptCorrection({
    clientId: client.id,
    moduleKey,
    currentContent,
    problemDescription: ticketDescription,
    proposedContent,
    expectedOutput: regenerationFeedback,
  });
}
