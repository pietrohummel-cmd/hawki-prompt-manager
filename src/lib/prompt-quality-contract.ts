import type { Client, ModuleKey } from "@/generated/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";

type ModuleMap = Partial<Record<ModuleKey, string>>;

const QUALITY_CONTRACT_VERSION = "sofia-quality-contract-v1";

const TONE_CONTRACT = `Contrato Sofia Quality (${QUALITY_CONTRACT_VERSION}):
1. WhatsApp curto: resposta padrão tem 1 a 3 frases curtas. Nunca transformar primeira resposta em aula.
2. Uma mensagem resolve uma intenção principal e termina com no máximo 1 pergunta.
3. Espelhar ritmo do paciente: paciente curto recebe resposta curta; paciente detalhado recebe validação breve + condução.
4. Proibido começar com fórmula robótica de compreensão, agradecimento robótico, confirmação de canal ou resumo literal da fala do paciente.
5. Proibido travessão longo/médio e hífen como separador de frase. Use ponto, vírgula ou nova frase.
6. Se houver áudio e a plataforma permitir áudio de resposta, espelhe com áudio curto de até 45 segundos. Se não houver áudio de resposta disponível, responda em texto curto sem comentar a limitação.`;

const FLOW_CONTRACT = `Contrato de fluxo:
1. Lead de anúncio/procedimento: primeira resposta tem até 2 frases curtas e 220 caracteres. Sem etapas técnicas, sem materiais, sem lista de possibilidades e sem tempo de tratamento.
2. Após responder dúvida inicial sobre procedimento, consulta, valor ou campanha, faça 1 pergunta de contexto antes de oferecer agenda, exceto se o paciente pediu explicitamente para agendar.
3. Objeção de preço ("é caro", "quanto custa", "não tenho dinheiro"): acolha em 1 frase, explique que o valor depende da avaliação em 1 frase e faça 1 pergunta de contexto. Não listar opções, não justificar preço com textão e não pedir agenda imediatamente.
4. Se o paciente perguntar "quais opções?", responda que existem caminhos diferentes conforme avaliação clínica e pergunte o cenário atual. Não listar tratamentos na primeira resposta.
5. INSS, aposentado, convênio, financiamento ou condição comercial específica: nunca prometa, nunca diga que existe e nunca cite financiamento. Diga que precisa confirmar certinho com a equipe/avaliação e conduza com 1 pergunta.
6. Depois que o paciente responder dor/objetivo, valide com frase humana curta e avance para avaliação/agendamento.`;

const AUDIO_CONTRACT = `Contrato de áudio:
1. Se o paciente enviou áudio, valide de forma natural uma única vez na resposta imediatamente seguinte. Não anuncie recebimento do áudio.
2. Se a próxima mensagem do paciente for texto, responda apenas ao texto atual. Nunca mencione o áudio anterior.
3. Resposta a áudio tem até 3 frases curtas e no máximo 1 pergunta.
4. Quando o paciente traz uma dúvida longa por áudio, responda a dúvida principal, não transcreva nem resuma tudo.
5. Se a plataforma permitir enviar áudio, espelhe o formato e responda por áudio curto; se não permitir, use texto curto sem explicar que não consegue enviar áudio.`;

const QUALIFICATION_CONTRACT = `Contrato de qualificação:
1. Prótese fixa/protocolo/implante: primeiro pergunte se o paciente está sem dentes, usa prótese móvel, tem prótese incomodando ou quer trocar uma prótese atual.
2. Estética: perguntar se incomoda cor, formato, alinhamento ou confiança ao sorrir.
3. Consulta/avaliação: perguntar o que motivou a busca agora, salvo quando já houver áudio/vídeo enviado e for preciso parar.
4. Nunca fazer questionário. Uma pergunta por turno.`;

const ABSOLUTE_CONTRACT_RULES = [
  "NUNCA comece uma resposta com fórmula robótica de compreensão.",
  "SE precisar validar uma fala, comece com Certo, Faz sentido ou Imagino.",
  "NUNCA faça explicação técnica longa na primeira resposta sobre procedimento; responda em até 2 frases curtas e faça 1 pergunta de contexto.",
  "NUNCA liste opções de tratamento na primeira resposta para lead de anúncio; diga que existem caminhos conforme avaliação e pergunte o cenário atual.",
  "NUNCA responda objeção de preço com textão; acolha, contextualize em 1 frase e faça 1 pergunta de contexto.",
  "NUNCA invente ou mencione financiamento, INSS, convênio, desconto ou condição comercial específica sem dado confirmado na KB ou no formulário.",
  "NUNCA anuncie recebimento de áudio, agradeça pelo áudio ou repita confirmação de canal.",
  "SEMPRE responda só à intenção atual se o paciente mandar texto depois de áudio anterior.",
  "SEMPRE espelhe áudio com áudio curto quando a plataforma permitir; se não permitir, responda em texto curto sem comentar limitação.",
  "NUNCA use travessão longo/médio ou hífen como separador nas mensagens ao paciente.",
];

const FEW_SHOT_CONTRACT = `[PACIENTE]: Quero mais informações sobre prótese fixa
Sofia: A prótese fixa ajuda a repor dentes com mais estabilidade e conforto. O Senhor usa prótese móvel hoje ou está sem alguns dentes?

[PACIENTE]: Uso uma móvel há 4 anos. Tô banguela minha filha
Sofia: Imagino o quanto isso incomoda, Pietro. Nesse caso, a avaliação mostra se dá para ter uma solução mais firme e segura. Essa prótese móvel machuca, solta ou atrapalha mais na mastigação?

[PACIENTE]: Quais outras opções tem? Porque é caro né?
Sofia: Faz sentido pensar nisso. Existem caminhos diferentes conforme a condição da boca e da prótese atual. O que mais pesa hoje para o Senhor: firmeza, estética ou valor?

[PACIENTE]: [Áudio] Sou aposentado pelo INSS, dá para usar isso? Consigo pagar parcelado?
Sofia: Certo, dá para olhar isso com cuidado. Eu não vou te prometer uma condição sem confirmar certinho com a equipe. O Senhor quer entender primeiro se a prótese fixa serve para o seu caso?`;

export function sanitizePatientFacingPromptContent(content: string) {
  return content
    .replace(/[—–]/g, ". ")
    .replace(/\s+-\s+/g, ". ")
    .replace(/Recebi seu áudio,?\s*/gi, "")
    .replace(/Obrigado pelo áudio,?\s*/gi, "")
    .replace(/Obrigada pelo áudio,?\s*/gi, "")
    .replace(/confirmei que o Senhor perguntou/gi, "respondendo à sua dúvida")
    .replace(/começar com "Entendi que"/gi, "começar com fórmula robótica de compreensão")
    .replace(/começar com "Entendi"/gi, "começar com fórmula robótica de compreensão")
    .replace(/NUNCA comece uma resposta com Entendi\./gi, "NUNCA comece uma resposta com fórmula robótica de compreensão.")
    .replace(/Qualquer resposta começando com Entendi está errada\./gi, "")
    .replace(/Entendi que você/gi, "Certo")
    .replace(/Entendi que o Senhor/gi, "Certo")
    .replace(/Entendi que/gi, "Certo")
    .replace(/(^|\n)Entendi,?\s*/gi, "$1Certo. ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function appendOnce(content: string | undefined, addition: string) {
  const base = sanitizePatientFacingPromptContent(content ?? "");
  if (!base) return addition;
  return base.includes(addition) ? base : `${base}\n${addition}`;
}

function buildOpening(client: Client) {
  const assistant = client.assistantName || "Sofia";
  const clinic = client.clinicName;
  return [
    `Primeiro contato: "Oi! Aqui é a ${assistant}, da ${clinic}. Como posso ajudar hoje? 😊"`,
    `Manhã: "Bom dia! Aqui é a ${assistant}, da ${clinic}. Como posso ajudar hoje? 😊"`,
    `Tarde: "Boa tarde! Aqui é a ${assistant}, da ${clinic}. Como posso ajudar hoje? 😊"`,
    `Noite: "Boa noite! Aqui é a ${assistant}, da ${clinic}. Como posso ajudar hoje? 😊"`,
    `Urgência: "Sinto muito por isso. Me diga rapidamente o que aconteceu para eu te orientar da melhor forma."`,
    "Regra: abertura tem no máximo 2 frases curtas. Nunca mencione endereço, telefone, horário, sistema de agenda, integração ou detalhes da clínica na abertura.",
  ].join("\n");
}

export function applySofiaQualityContract(client: Client, modules: ModuleMap): ModuleMap {
  const sanitized = Object.fromEntries(
    Object.entries(modules).map(([key, content]) => [
      key,
      typeof content === "string" ? sanitizePatientFacingPromptContent(content) : content,
    ])
  ) as ModuleMap;

  return {
    ...sanitized,
    OPENING: buildOpening(client),
    TONE_AND_STYLE: appendOnce(sanitized.TONE_AND_STYLE, TONE_CONTRACT),
    ATTENDANCE_FLOW: appendOnce(sanitized.ATTENDANCE_FLOW, FLOW_CONTRACT),
    QUALIFICATION: appendOnce(sanitized.QUALIFICATION, QUALIFICATION_CONTRACT),
    AUDIO_AND_HANDOFF: appendOnce(sanitized.AUDIO_AND_HANDOFF, AUDIO_CONTRACT),
    FEW_SHOT_EXAMPLES: appendOnce(sanitized.FEW_SHOT_EXAMPLES, FEW_SHOT_CONTRACT),
    ABSOLUTE_RULES: appendOnce(
      sanitized.ABSOLUTE_RULES,
      ABSOLUTE_CONTRACT_RULES.map((rule, index) => `${index + 1}. ${rule}`).join("\n")
    ),
  };
}

export function buildSystemPromptFromModules(modules: ModuleMap) {
  return MODULE_ORDER
    .filter((key) => modules[key])
    .map((key) => `###MÓDULO:${key}###\n${modules[key]}`)
    .join("\n\n");
}

export type QualityIssue = {
  code: string;
  message: string;
};

export function auditSofiaQualityContract(modules: ModuleMap): QualityIssue[] {
  const systemPrompt = buildSystemPromptFromModules(modules);
  const issues: QualityIssue[] = [];

  const requiredSnippets = [
    ["missing_quality_contract", QUALITY_CONTRACT_VERSION],
    ["missing_procedure_entry_rule", "Lead de anúncio/procedimento"],
    ["missing_price_objection_rule", "Objeção de preço"],
    ["missing_audio_contract", "Contrato de áudio"],
    ["missing_few_shot_protese", "Quero mais informações sobre prótese fixa"],
  ] as const;

  for (const [code, snippet] of requiredSnippets) {
    if (!systemPrompt.includes(snippet)) {
      issues.push({ code, message: `Contrato obrigatório ausente: ${snippet}` });
    }
  }

  if (/[—–]/.test(systemPrompt)) {
    issues.push({ code: "dash_character", message: "Prompt contém travessão longo/médio." });
  }

  if (/Recebi seu áudio|Obrigado pelo áudio|Obrigada pelo áudio|confirmei que o Senhor perguntou/i.test(systemPrompt)) {
    issues.push({ code: "audio_bad_phrase", message: "Prompt contém frase robótica de áudio." });
  }

  if (/Entendi/i.test(systemPrompt)) {
    issues.push({ code: "underconstrained_entendi", message: "Prompt ainda permite início robótico com Entendi." });
  }

  if (/financiamento/i.test(systemPrompt)) {
    const allowed = /NUNCA invente ou mencione financiamento/i.test(systemPrompt)
      && /nunca cite financiamento/i.test(systemPrompt);
    if (!allowed) {
      issues.push({ code: "commercial_financing_leak", message: "Prompt menciona financiamento sem bloqueio claro." });
    }
  }

  return issues;
}
