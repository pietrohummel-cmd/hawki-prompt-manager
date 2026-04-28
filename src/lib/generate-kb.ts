import Anthropic from "@anthropic-ai/sdk";
import type { Client } from "@/generated/prisma";
import { logUsage } from "@/lib/usage-logger";
import { buildClientContext } from "@/lib/generate-prompt";
import { KB_TOPICS, type KbTopicKey } from "@/lib/kb-topics";

export { KB_TOPICS, type KbTopicKey };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface KbArticle {
  topic: KbTopicKey;
  title: string;
  content: string;
}

function parseKbArticles(text: string): KbArticle[] {
  const result: KbArticle[] = [];
  const regex = /###KB:(\w+)###([\s\S]*?)(?=###KB:|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1] as KbTopicKey;
    const content = match[2].trim();
    const topicDef = KB_TOPICS.find((t) => t.key === key);
    if (topicDef && content) {
      result.push({ topic: key, title: topicDef.title, content });
    }
  }
  return result;
}

export async function generateClientKB(client: Client): Promise<KbArticle[]> {
  const context = buildClientContext(client);

  const prompt = `Você é um especialista em criar bases de conhecimento para assistentes de IA de clínicas odontológicas brasileiras.

Você vai gerar 9 artigos de Knowledge Base (KB) para a clínica "${client.clinicName}".

DADOS DA CLÍNICA:
${context}

REGRA GERAL:
KB responde perguntas do paciente com informações factuais. KB não instrui comportamento da IA.
Cada artigo deve ter 150–300 palavras em português brasileiro natural — narrativo direto ou Q&A.
NUNCA invente informações. Se o dado não estiver nos dados acima, escreva: "Para confirmar, entre em contato com a clínica."

ANTI-PADRÕES — NUNCA inclua nas KBs (exceto onde indicado):
1. Telefone/WhatsApp como canal de contato — EXCETO na KB de urgências, onde é obrigatório
   ❌ "Para mais informações, entre em contato pelo WhatsApp (XX) XXXXX-XXXX"
   ❌ "Ligue para nós", "Mande uma mensagem para o número..."
   Motivo: o paciente JÁ está na conversa — redirecionar interrompe o fluxo.

2. Instrução de como agendar
   ❌ "Basta enviar uma mensagem com seus dados que a assistente vai verificar"
   ❌ "O agendamento é feito pelo WhatsApp"

3. Prazos clínicos absolutos sem ressalva
   ❌ "recuperação em 3 dias", "período de 90 dias", "tratamento de 6 meses"
   ✅ "recuperação varia conforme o caso — geralmente alguns dias"
   ✅ "prazo definido pelo especialista na avaliação"
   REGRA: qualquer número + (dias/semanas/meses) DEVE ter "varia conforme o caso" ou similar.

4. Instruções de comportamento para a IA
   ❌ "A assistente vai verificar a disponibilidade"
   ❌ "O sistema confirma automaticamente"

5. Linguagem corporativa/robótica
   ❌ "Além disso", "No entanto", "Sendo assim", "É fundamental que", "Não hesite em contatar"
   ✅ "E também", "Mas", "Então", "O que importa é"

INSTRUÇÕES POR TÓPICO:

1. localizacao — Endereço completo, ponto de referência, horários formatados como lista por dia.
   NÃO incluir: telefone para dúvidas, Instagram, e-mail, instrução de agendamento.

2. primeira_consulta — Como funciona a avaliação, o que trazer, o que esperar.
   NÃO incluir: instrução de como agendar ("ligue", "mande mensagem", "a assistente vai verificar").

3. procedimentos — Blocos por especialidade disponível na clínica, 2-3 frases cada em linguagem natural.
   OBRIGATÓRIO: qualquer prazo em dias/semanas/meses deve ter ressalva "varia conforme o caso".

4. precos_pagamento — Política de orçamento personalizado (não existe tabela fixa), formas de pagamento, parcelamento.
   NÃO citar valores fixos de procedimentos.

5. convenios — Convênios confirmados nos dados. Se não informado: "Para verificar convênios aceitos, consulte a clínica."

6. diferenciais — Apenas diferenciais reais presentes nos dados. Nada genérico inventado.
   OBRIGATÓRIO: qualquer prazo em dias/semanas/meses deve ter ressalva "varia conforme o caso".

7. urgencias — Protocolo de urgência.
   ATENÇÃO: esta é a ÚNICA KB onde incluir telefone como ação primária é CORRETO E OBRIGATÓRIO.
   Incluir: exemplos de situações de urgência, o que fazer, como contatar (telefone/WhatsApp dos dados).

8. pos_procedimento — Cuidados gerais após procedimentos odontológicos. Tom acolhedor.
   NÃO mencionar prazos absolutos sem ressalva.

9. faq_clinico — FAQ com 4–6 perguntas respondidas, derivadas das especialidades listadas nos dados.
   Mapeamento de perguntas por especialidade (use as aplicáveis à clínica):
   - Implantodontia: "Implante dói durante o procedimento?" / "É possível colocar implante no mesmo dia da extração?"
   - Endodontia: "Canal em uma sessão é tão eficaz quanto em múltiplas?"
   - Ortodontia / Alinhadores: "Alinhadores invisíveis funcionam para casos complexos?"
   - HOF / Harmonização Orofacial: "O que é HOF e quais procedimentos inclui?"
   - Pediatria: "A partir de qual idade a clínica atende crianças?"
   - Periodontia / PSI: "O que é PSI e quando é indicado?"
   - Estética / Facetas: "Quanto tempo duram as facetas? O procedimento é reversível?"
   - Clínico geral: "Vocês atendem dente quebrado ou restauração caída urgência?"
   Se não identificar especialidades nos dados, gerar perguntas gerais sobre odontologia.
   NUNCA inventar especialidades que não estejam nos dados.

FORMATO OBRIGATÓRIO (use exatamente — 9 blocos):
###KB:localizacao###
[conteúdo]
###KB:primeira_consulta###
[conteúdo]
###KB:procedimentos###
[conteúdo]
###KB:precos_pagamento###
[conteúdo]
###KB:convenios###
[conteúdo]
###KB:diferenciais###
[conteúdo]
###KB:urgencias###
[conteúdo]
###KB:pos_procedimento###
[conteúdo]
###KB:faq_clinico###
[conteúdo]

Não adicione texto fora dos blocos ###KB:###.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({
    clientId: client.id,
    operation: "generate_kb",
    model: "claude-sonnet-4-6",
    usage: message.usage,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return parseKbArticles(text);
}
