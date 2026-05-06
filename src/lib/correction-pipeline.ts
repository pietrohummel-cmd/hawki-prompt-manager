/**
 * Pipeline de correção automática de prompts.
 *
 * Fluxo:
 * 1. Analisa o prompt + descrição do problema → lista de issues por módulo
 * 2. Cria versão PENDING_REVIEW com os módulos reestruturados
 * 3. Para cada issue: cria ticket + gera correção + aplica ao módulo
 * 4. Roda regressão automática contra a nova versão
 * 5. Retorna a versão PENDING_REVIEW para aprovação humana
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { Prisma } from "@/generated/prisma";
import type { Client, ModuleKey } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER, MODULE_LABELS } from "@/lib/prompt-constants";
import { SOFIA_GUIDELINES_CONDENSED } from "@/lib/sofia-guidelines";
import { logUsage } from "@/lib/usage-logger";
import { evaluateRegressionCase } from "@/lib/regression-runner";
import { auditAndRefinePromptCorrection } from "@/lib/module-editor";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.HAWKI_ANTHROPIC_API_KEY });
}

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada. Adicione ao .env.local e reinicie o servidor.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

interface Issue {
  module: ModuleKey;
  description: string;
  priority: "CRITICAL" | "NORMAL" | "IMPROVEMENT";
}

async function analyzeIssues(
  modules: Partial<Record<ModuleKey, string>>,
  problemDescription: string
): Promise<Issue[]> {
  const modulesText = MODULE_ORDER
    .filter((k) => modules[k])
    .map((k) => `###MÓDULO:${k}###\n${modules[k]}`)
    .join("\n\n");

  const prompt = `Você é um especialista em qualidade de prompts para assistentes de IA de clínicas odontológicas brasileiras.

DIRETRIZES DE QUALIDADE:
${SOFIA_GUIDELINES_CONDENSED}

PROMPT A ANALISAR:
${modulesText}

PROBLEMA RELATADO PELO OPERADOR:
${problemDescription}

Identifique todos os problemas presentes neste prompt que causam o comportamento descrito acima, além de outros antipadrões evidentes com base nas diretrizes.

Para cada problema encontrado, responda em JSON com este formato exato:
[
  {
    "module": "NOME_DO_MODULO",
    "description": "Descrição clara do problema e por que está errado",
    "priority": "CRITICAL" | "NORMAL" | "IMPROVEMENT"
  }
]

Regras:
- "module" deve ser exatamente um dos valores: ${MODULE_ORDER.join(", ")}
- CRITICAL = causa falha direta no atendimento ou viola regra absoluta
- NORMAL = degradação de qualidade ou comportamento incorreto
- IMPROVEMENT = melhoria opcional mas recomendável
- Máximo 8 issues no total
- Responda APENAS com o JSON, sem texto adicional`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({ operation: "pipeline_analyze", model: "claude-sonnet-4-6", usage: message.usage });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const issues: Issue[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return issues.filter((i) => MODULE_ORDER.includes(i.module as ModuleKey));
  } catch {
    console.warn("[pipeline] Failed to parse issues JSON:", text);
    return [];
  }
}

async function applyCorrection(
  client: Client,
  moduleKey: ModuleKey,
  currentContent: string,
  issueDescription: string
): Promise<string> {
  const moduleLabel = MODULE_LABELS[moduleKey];

  const prompt = `Você é um especialista em criar prompts para assistentes de IA de clínicas odontológicas.

CONTEXTO:
Clínica: ${client.clinicName}
Assistente: ${client.assistantName}

MÓDULO A CORRIGIR: ${moduleLabel}

CONTEÚDO ATUAL:
${currentContent}

PROBLEMA IDENTIFICADO:
${issueDescription}

PADRÃO HAWKI PARA CORREÇÃO:
- Faça mudança mínima: corrija o problema identificado sem perder nenhuma informação válida.
- Regra forte tem gatilho, ação e forma. Evite regra vaga que apenas proíbe.
- Se o problema for tom/tamanho de mensagem, prefira comportamento verificável: até 2 frases curtas, uma pergunta por turno, dividir explicações longas. Não dependa de limite de caracteres.
- Se o problema envolver repetição de saudação/apresentação, corrija o estado conversacional: saudação e apresentação só na primeira mensagem da Sofia.
- Se o problema envolver falta de condução para agendamento, preserve o modo do cliente: direto, equilibrado, consultivo/SPIN ou adaptativo; use 1 pergunta por mensagem e conecte dor/objetivo ao agendamento sem pressão.
- Se o problema mostrar respostas "secas" só informativas, obrigue uma regra de saída: resposta informativa sem mídia termina com 1 pergunta consultiva ou próximo passo de agenda.
- Se o problema envolver envio de vídeo, link, imagem ou documento, instrua a parar após a mídia e aguardar o paciente voltar; não misture mídia com pergunta de origem/qualificação no mesmo turno.
- Se o problema envolver campanha, ação sazonal, condição temporária, preço, condição comercial, pagamento ou parcelamento, obrigue consulta à KB/search_knowledge quando disponível e proíba inferir parcelamento, facilidade, promoção, desconto ou benefício.
- Para clínicas premium/boutique, preserve o termo "campanha" ou "condição especial"; não use "promoção" se a KB não usar esse termo.
- Não invente preço, endereço, horário, profissional, ferramenta ou política.

Reescreva este módulo corrigindo o problema identificado.
Responda APENAS com o conteúdo corrigido do módulo — sem comentários, sem cabeçalho, sem ###MÓDULO###.`;

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2048,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({
    clientId: client.id,
    operation: "pipeline_fix",
    model: "gpt-4o",
    usage: {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
    },
  });

  const proposedContent = completion.choices[0]?.message.content?.trim() ?? currentContent;
  if (!proposedContent || proposedContent === currentContent) return proposedContent;

  return auditAndRefinePromptCorrection({
    clientId: client.id,
    moduleKey,
    currentContent,
    problemDescription: issueDescription,
    proposedContent,
  });
}

export async function runCorrectionPipeline(
  client: Client,
  modules: Partial<Record<ModuleKey, string>>,
  problemDescription: string
): Promise<{ versionId: string; issueCount: number; regressionTotal: number; regressionPassed: number }> {

  // 1 — Analisar issues
  const issues = await analyzeIssues(modules, problemDescription);

  // 2 — Aplicar correções aos módulos (LLM work — feito ANTES da transação)
  const correctedModules = { ...modules };
  for (const issue of issues) {
    const current = correctedModules[issue.module];
    if (!current) continue;
    correctedModules[issue.module] = await applyCorrection(client, issue.module, current, issue.description);
  }

  // 3 — Reconstruir systemPrompt
  const systemPrompt = MODULE_ORDER
    .filter((k) => correctedModules[k])
    .map((k) => `###MÓDULO:${k}###\n${correctedModules[k]}`)
    .join("\n\n");

  const changesSummary = `Pipeline automático — ${issues.length} problema${issues.length !== 1 ? "s" : ""} identificado${issues.length !== 1 ? "s" : ""}`;

  // 4 — Alocar versão e criar o draft com retry em P2002.
  // READ COMMITTED (padrão do PostgreSQL) não impede que dois pipelines simultâneos
  // leiam o mesmo max version antes do create. O retry garante que o segundo tentará
  // novamente com o número correto após a colisão no @@unique([clientId, version]).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let draftVersion: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      draftVersion = await prisma.$transaction(async (tx) => {
        const lastVersion = await tx.promptVersion.findFirst({
          where: { clientId: client.id },
          orderBy: { version: "desc" },
        });
        const nextVersion = (lastVersion?.version ?? 0) + 1;

        return tx.promptVersion.create({
          data: {
            clientId: client.id,
            version: nextVersion,
            systemPrompt,
            isActive: false,
            status: "PENDING_REVIEW",
            problemDescription,
            generatedBy: "AI",
            changesSummary,
            modules: {
              create: MODULE_ORDER
                .filter((k) => correctedModules[k])
                .map((k) => ({ moduleKey: k as ModuleKey, content: correctedModules[k]! })),
            },
          },
          include: { modules: true },
        });
      });
      break; // sucesso — sair do loop
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 4) {
        continue; // colisão de versão — tentar novamente
      }
      throw e;
    }
  }
  if (!draftVersion) throw new Error("Falha ao alocar versão após 5 tentativas");

  // 6 — Criar tickets para cada issue
  for (const issue of issues) {
    const affectedModule = issue.module as ModuleKey;
    const correctedContent = correctedModules[affectedModule];
    // Status SUGGESTED (não APPLIED) — a versão ainda é PENDING_REVIEW.
    // O ticket só deve transitar para APPLIED quando a versão for efetivamente ativada.
    // Marcar como APPLIED agora corromperia o audit trail se o draft for rejeitado.
    await prisma.correctionTicket.create({
      data: {
        clientId: client.id,
        promptVersionId: draftVersion.id,
        description: issue.description,
        affectedModule,
        priority: issue.priority,
        status: "SUGGESTED",
        aiSuggestion: correctedContent ?? null,
        finalCorrection: null,
        resolvedAt: null,
      },
    });
  }

  // 7 — Rodar regressão contra a versão draft
  const regressionCases = await prisma.regressionCase.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "asc" },
  });

  let regressionPassed = 0;

  // Usa evaluateRegressionCase (sem persistência) — runs de draft não devem
  // poluir o histórico canônico da aba de Regressão.
  if (regressionCases.length > 0) {
    const results = await Promise.allSettled(
      regressionCases.map((c) => evaluateRegressionCase(c, draftVersion))
    );
    regressionPassed = results.filter(
      (r) => r.status === "fulfilled" && r.value.status === "PASSED"
    ).length;
  }

  return {
    versionId: draftVersion.id,
    issueCount: issues.length,
    regressionTotal: regressionCases.length,
    regressionPassed,
  };
}
