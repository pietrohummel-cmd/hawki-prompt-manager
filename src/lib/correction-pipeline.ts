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
import type { Client, ModuleKey } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER, MODULE_LABELS } from "@/lib/prompt-constants";
import { SOFIA_GUIDELINES_CONDENSED } from "@/lib/sofia-guidelines";
import { logUsage } from "@/lib/usage-logger";
import { runRegressionCase } from "@/lib/regression-runner";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

Reescreva este módulo corrigindo o problema identificado sem perder nenhuma informação válida.
Responda APENAS com o conteúdo corrigido do módulo — sem comentários, sem cabeçalho, sem ###MÓDULO###.`;

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({ clientId: client.id, operation: "pipeline_fix", model: "claude-haiku-4-5-20251001", usage: message.usage });

  return message.content[0].type === "text" ? message.content[0].text.trim() : currentContent;
}

export async function runCorrectionPipeline(
  client: Client,
  modules: Partial<Record<ModuleKey, string>>,
  problemDescription: string
): Promise<{ versionId: string; issueCount: number; regressionTotal: number; regressionPassed: number }> {

  // 1 — Analisar issues
  const issues = await analyzeIssues(modules, problemDescription);

  // 2 — Calcular próxima versão
  const lastVersion = await prisma.promptVersion.findFirst({
    where: { clientId: client.id },
    orderBy: { version: "desc" },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  // 3 — Aplicar correções aos módulos
  const correctedModules = { ...modules };
  for (const issue of issues) {
    const current = correctedModules[issue.module];
    if (!current) continue;
    correctedModules[issue.module] = await applyCorrection(client, issue.module, current, issue.description);
  }

  // 4 — Reconstruir systemPrompt
  const systemPrompt = MODULE_ORDER
    .filter((k) => correctedModules[k])
    .map((k) => `###MÓDULO:${k}###\n${correctedModules[k]}`)
    .join("\n\n");

  // 5 — Criar versão PENDING_REVIEW (não desativa a anterior)
  const draftVersion = await prisma.promptVersion.create({
    data: {
      clientId: client.id,
      version: nextVersion,
      systemPrompt,
      isActive: false,
      status: "PENDING_REVIEW",
      problemDescription,
      generatedBy: "AI",
      changesSummary: `Pipeline automático — ${issues.length} problema${issues.length !== 1 ? "s" : ""} identificado${issues.length !== 1 ? "s" : ""}`,
      modules: {
        create: MODULE_ORDER
          .filter((k) => correctedModules[k])
          .map((k) => ({ moduleKey: k as ModuleKey, content: correctedModules[k]! })),
      },
    },
    include: { modules: true },
  });

  // 6 — Criar tickets para cada issue
  for (const issue of issues) {
    const affectedModule = issue.module as ModuleKey;
    const correctedContent = correctedModules[affectedModule];
    await prisma.correctionTicket.create({
      data: {
        clientId: client.id,
        promptVersionId: draftVersion.id,
        description: issue.description,
        affectedModule,
        priority: issue.priority,
        status: "APPLIED",
        aiSuggestion: correctedContent ?? null,
        finalCorrection: correctedContent ?? null,
        resolvedAt: new Date(),
      },
    });
  }

  // 7 — Rodar regressão contra a versão draft
  const regressionCases = await prisma.regressionCase.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "asc" },
  });

  let regressionPassed = 0;

  if (regressionCases.length > 0) {
    const results = await Promise.allSettled(
      regressionCases.map((c) => runRegressionCase(c, draftVersion))
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
