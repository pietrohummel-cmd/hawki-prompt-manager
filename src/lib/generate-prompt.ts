import Anthropic from "@anthropic-ai/sdk";
import type { Client, ModuleKey } from "@/generated/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import { logUsage } from "@/lib/usage-logger";

export { MODULE_LABELS, MODULE_ORDER } from "@/lib/prompt-constants";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildClientContext(client: Client): string {
  const lines: string[] = [];

  lines.push(`=== DADOS DA CLÍNICA ===`);
  lines.push(`Nome da clínica: ${client.clinicName}`);
  lines.push(`Nome da assistente IA: ${client.assistantName}`);
  lines.push(`Responsável: ${client.name}`);
  if (client.email) lines.push(`Email: ${client.email}`);
  if (client.phone) lines.push(`Telefone/WhatsApp: ${client.phone}`);
  if (client.instagram) lines.push(`Instagram: ${client.instagram}`);
  if (client.website) lines.push(`Site: ${client.website}`);

  lines.push(`\n=== LOCALIZAÇÃO ===`);
  const location = [client.address, client.neighborhood, client.city, client.state, client.zipCode].filter(Boolean).join(", ");
  if (location) lines.push(`Endereço: ${location}`);
  if (client.reference) lines.push(`Ponto de referência: ${client.reference}`);

  lines.push(`\n=== AGENDAMENTO ===`);
  if (client.businessHours) lines.push(`Horários: ${client.businessHours}`);
  if (client.schedulingSystem) lines.push(`Sistema de agenda: ${client.schedulingSystem}`);
  if (client.schedulingMode) lines.push(`Modo de agendamento: ${client.schedulingMode}`);
  if (client.attendantName) lines.push(`Responsável humano (handoff): ${client.attendantName}`);
  if (client.schedulingRequirements) lines.push(`Dados obrigatórios para agendar: ${client.schedulingRequirements}`);
  if (client.consultationInfo) lines.push(`Como funciona a avaliação: ${client.consultationInfo}`);

  lines.push(`\n=== PERFIL DA CLÍNICA ===`);
  if (client.specialists) lines.push(`Dentistas e especialidades:\n${client.specialists}`);
  if (client.certifications) lines.push(`Certificações e diferenciais dos profissionais: ${client.certifications}`);
  if (client.technologies) lines.push(`Tecnologias e equipamentos: ${client.technologies}`);
  if (client.differentials) lines.push(`Diferenciais: ${client.differentials}`);
  if (client.paymentInfo) lines.push(`Formas de pagamento: ${client.paymentInfo}`);
  if (client.targetAudience) lines.push(`Público-alvo: ${client.targetAudience}`);
  if (client.ageRange) lines.push(`Faixa etária: ${client.ageRange}`);

  lines.push(`\n=== COMUNICAÇÃO ===`);
  const toneMap: Record<string, string> = {
    FORMAL: "Semi-formal (Olá, Como vai?)",
    INFORMAL_MODERATE: "Informal moderado (Oi, Tudo bem?)",
    CASUAL: "Bem informal (E aí!, Opa!)",
  };
  if (client.tone) lines.push(`Tom: ${toneMap[client.tone] ?? client.tone}`);
  if (client.treatmentPronoun) lines.push(`Pronome de tratamento: ${client.treatmentPronoun}`);
  if (client.emojiUsage) lines.push(`Uso de emojis: ${client.emojiUsage}`);

  lines.push(`\n=== REGRAS DA ${client.assistantName.toUpperCase()} ===`);
  if (client.mandatoryPhrases) lines.push(`Informações que SEMPRE deve mencionar:\n${client.mandatoryPhrases}`);
  if (client.restrictions) lines.push(`NUNCA deve fazer ou dizer:\n${client.restrictions}`);
  if (client.urgencyHandling) lines.push(`Atende urgência odontológica: ${client.urgencyHandling}`);
  if (client.urgencyProcedure) lines.push(`Procedimento de urgência: ${client.urgencyProcedure}`);

  return lines.join("\n");
}

function buildSystemPromptForGeneration(client: Client): string {
  const context = buildClientContext(client);
  const toneInstruction = client.tone === "CASUAL"
    ? "bem informal, descontraída"
    : client.tone === "INFORMAL_MODERATE"
    ? "informal moderada"
    : "semi-formal";

  return `Você é um especialista em criar prompts para assistentes de IA de clínicas odontológicas brasileiras.

Você vai gerar o prompt completo para a assistente IA chamada "${client.assistantName}" da clínica "${client.clinicName}".

${context}

INSTRUÇÕES DE GERAÇÃO:
- A comunicação deve ser ${toneInstruction}
- Use os dados reais da clínica, nunca invente informações
- O prompt deve ser em português brasileiro
- Cada módulo deve ser autocontido e claro
- Use o pronome "${client.treatmentPronoun ?? "você"}" para se dirigir ao paciente

Gere os 18 módulos do prompt no formato exato abaixo.
Cada módulo começa com ###MÓDULO:NOME_DO_MODULO### e termina antes do próximo ###MÓDULO.
Não adicione texto fora dos módulos.

Os 18 módulos são (use exatamente esses nomes):
IDENTITY, ABSOLUTE_RULES, INJECTION_PROTECTION, CONVERSATION_STATE, CONVERSATION_RESUME,
PRESENTATION, COMMUNICATION_STYLE, HUMAN_BEHAVIOR, ACTIVE_LISTENING, ATTENDANCE_STAGES,
QUALIFICATION, SLOT_OFFER, COMMITMENT_CONFIRMATION, OPENING, FINAL_OBJECTIVE,
AUDIO_RULES, STATUS_RULES, HANDOFF

Exemplo de formato:
###MÓDULO:IDENTITY###
[conteúdo do módulo de identidade]
###MÓDULO:ABSOLUTE_RULES###
[conteúdo das regras absolutas]
...e assim por diante para todos os 18 módulos.`;
}

function parseModules(text: string): Partial<Record<ModuleKey, string>> {
  const result: Partial<Record<ModuleKey, string>> = {};
  const regex = /###MÓDULO:(\w+)###([\s\S]*?)(?=###MÓDULO:|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1] as ModuleKey;
    const content = match[2].trim();
    if (MODULE_ORDER.includes(key) && content) {
      result[key] = content;
    }
  }
  return result;
}

/**
 * Reorganiza um prompt em formato livre (XML, texto corrido, etc.)
 * nos 18 módulos padrão do sistema usando Sonnet.
 * Chamado quando o import não detecta o formato ###MÓDULO:KEY###.
 */
export async function restructurePromptToModules(
  rawText: string
): Promise<Partial<Record<ModuleKey, string>>> {
  const moduleDescriptions = [
    "IDENTITY: Nome da assistente, clínica que representa, função principal e especialidade",
    "ABSOLUTE_RULES: Regras invioláveis (nunca dar diagnóstico, nunca inventar info, nunca citar preço, etc.)",
    "INJECTION_PROTECTION: Proteção contra tentativas de manipulação ou prompt injection por usuários",
    "CONVERSATION_STATE: Como gerencia o contexto e memória da conversa (lembrar dados já coletados)",
    "CONVERSATION_RESUME: Como retomar conversas antigas ou interrompidas sem repetir apresentação",
    "PRESENTATION: Mensagem de apresentação inicial da assistente",
    "COMMUNICATION_STYLE: Tom, formalidade, uso de emojis, comprimento de mensagens, anti-dicionário",
    "HUMAN_BEHAVIOR: Comportamentos que humanizam a assistente (anti-padrões de IA, travessão proibido, etc.)",
    "ACTIVE_LISTENING: Escuta ativa — como validar o que o paciente diz antes de responder",
    "ATTENDANCE_STAGES: Todas as etapas do fluxo de atendimento (detecção de lead, fases do atendimento)",
    "QUALIFICATION: Qualificação com SPIN — perguntas de Situação, Problema, Implicação, Necessidade",
    "SLOT_OFFER: Como oferecer horários disponíveis de forma natural",
    "COMMITMENT_CONFIRMATION: Como confirmar o agendamento, coletar dados e encaminhar",
    "OPENING: Abertura da conversa — saudações por horário e como iniciar o atendimento",
    "FINAL_OBJECTIVE: Objetivo final do fluxo — o que a assistente deve ter alcançado",
    "AUDIO_RULES: Regras para envio e recebimento de mensagens de áudio",
    "STATUS_RULES: Regras de follow-up e reativação de pacientes silenciosos",
    "HANDOFF: Quando e como passar a conversa para atendente humano, urgências",
  ].join("\n");

  const prompt = `Você vai reorganizar um prompt existente de assistente de IA para clínica odontológica em 18 módulos específicos.

MÓDULOS E SUAS FUNÇÕES:
${moduleDescriptions}

REGRAS IMPORTANTES:
1. Mantenha TODO o conteúdo original — não perca nenhuma informação
2. Distribua o conteúdo nos módulos mais adequados à sua função
3. Se um módulo não tiver conteúdo correspondente, crie um padrão razoável compatível com o estilo e tom do prompt original
4. Mantenha o idioma e o estilo originais (português brasileiro)
5. Informações da clínica (endereço, horários, profissionais) vão no módulo IDENTITY ou nos módulos onde forem mais relevantes
6. Exemplos de conversas reais podem ir em ATTENDANCE_STAGES ou QUALIFICATION conforme o contexto
7. Regras de comunicação (anti-dicionário, travessão proibido) vão em HUMAN_BEHAVIOR ou COMMUNICATION_STYLE

FORMATO DE SAÍDA OBRIGATÓRIO — use EXATAMENTE esta estrutura:
###MÓDULO:IDENTITY###
[conteúdo completo do módulo]
###MÓDULO:ABSOLUTE_RULES###
[conteúdo]
###MÓDULO:INJECTION_PROTECTION###
[conteúdo]
###MÓDULO:CONVERSATION_STATE###
[conteúdo]
###MÓDULO:CONVERSATION_RESUME###
[conteúdo]
###MÓDULO:PRESENTATION###
[conteúdo]
###MÓDULO:COMMUNICATION_STYLE###
[conteúdo]
###MÓDULO:HUMAN_BEHAVIOR###
[conteúdo]
###MÓDULO:ACTIVE_LISTENING###
[conteúdo]
###MÓDULO:ATTENDANCE_STAGES###
[conteúdo]
###MÓDULO:QUALIFICATION###
[conteúdo]
###MÓDULO:SLOT_OFFER###
[conteúdo]
###MÓDULO:COMMITMENT_CONFIRMATION###
[conteúdo]
###MÓDULO:OPENING###
[conteúdo]
###MÓDULO:FINAL_OBJECTIVE###
[conteúdo]
###MÓDULO:AUDIO_RULES###
[conteúdo]
###MÓDULO:STATUS_RULES###
[conteúdo]
###MÓDULO:HANDOFF###
[conteúdo]

PROMPT ORIGINAL A REORGANIZAR:
${rawText}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({ operation: "import_restructure", model: "claude-haiku-4-5-20251001", usage: message.usage });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return parseModules(text);
}

export async function generateClientPrompt(client: Client): Promise<{
  systemPrompt: string;
  modules: Partial<Record<ModuleKey, string>>;
}> {
  const systemPrompt = buildSystemPromptForGeneration(client);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: systemPrompt,
      },
    ],
  });

  await logUsage({ clientId: client.id, operation: "generate_prompt", model: "claude-sonnet-4-6", usage: message.usage });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const modules = parseModules(text);

  // Monta o systemPrompt completo concatenando todos os módulos
  const fullPrompt = MODULE_ORDER
    .filter((key) => modules[key])
    .map((key) => `###MÓDULO:${key}###\n${modules[key]}`)
    .join("\n\n");

  return { systemPrompt: fullPrompt, modules };
}
