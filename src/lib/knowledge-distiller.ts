/**
 * Destilação de SpecialtyKnowledge a partir de interações aprovadas.
 *
 * Fluxo:
 * 1. Busca as top-20 interações APPROVED para a categoria (ordenadas por scoreQuality desc)
 * 2. Envia as transcrições ao claude-sonnet para extrair 3–5 insights acionáveis
 * 3. Arquiva os insights ACTIVE anteriores da categoria
 * 4. Cria os novos insights como DRAFT (admin ativa via painel no Slice 4)
 * 5. Retorna os insights criados
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CATEGORY_LABELS, MAX_INSIGHTS_PER_INJECTION } from "@/lib/intelligence-constants";
import { logUsage } from "@/lib/usage-logger";
import type { ServiceCategory } from "@/generated/prisma";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.HAWKI_ANTHROPIC_API_KEY });
}

interface RawInsight {
  title: string;
  insight: string;
  examplePhrase?: string;
  exampleResponse?: string;
}

async function extractInsights(
  category: ServiceCategory,
  transcripts: string[]
): Promise<RawInsight[]> {
  const categoryLabel = CATEGORY_LABELS[category];
  const combinedTranscripts = transcripts
    .map((t, i) => `--- Conversa ${i + 1} ---\n${t.slice(0, 1500)}`)
    .join("\n\n");

  const prompt = `Você é um especialista em qualidade de atendimento odontológico com foco em ${categoryLabel}.

Analise as conversas de sucesso abaixo e identifique os padrões que tornaram esse atendimento eficaz.

CONVERSAS (${transcripts.length} casos aprovados):
${combinedTranscripts}

Extraia de 3 a ${MAX_INSIGHTS_PER_INJECTION} insights acionáveis que uma IA de atendimento pode aplicar diretamente.

Critérios para um bom insight:
- Específico para ${categoryLabel} (não genérico)
- Baseado em padrão real observado nas conversas
- Acionável: a Sofia pode incorporar no texto das respostas
- Foco em converter interesse em agendamento

Responda APENAS com JSON válido:
[
  {
    "title": "Título curto (max 60 chars)",
    "insight": "Descrição clara do padrão e como aplicar (2-3 frases)",
    "examplePhrase": "Frase típica do paciente que aciona este padrão (opcional)",
    "exampleResponse": "Resposta modelo que a Sofia deve usar (1-2 frases, opcional)"
  }
]`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({
    operation: "knowledge_distill",
    model: "claude-sonnet-4-6",
    usage: message.usage,
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)?.[0] ?? "[]";
    const raw: RawInsight[] = JSON.parse(jsonMatch);
    return raw.filter((i) => i.title && i.insight).slice(0, MAX_INSIGHTS_PER_INJECTION);
  } catch {
    console.warn("[knowledge-distiller] Failed to parse insights JSON:", text);
    return [];
  }
}

export interface DistillResult {
  category: ServiceCategory;
  sourceCount: number;
  insightsCreated: number;
  insightsArchived: number;
}

/**
 * Destila conhecimento para uma categoria a partir das interações aprovadas.
 * Arquiva insights ACTIVE anteriores e cria novos como DRAFT.
 */
export async function distillKnowledge(category: ServiceCategory): Promise<DistillResult> {
  // 1 — Busca top-20 aprovadas, priorizando as com maior scoreQuality
  const interactions = await prisma.successfulInteraction.findMany({
    where: { category, status: "APPROVED" },
    orderBy: [
      { scoreQuality: { sort: "desc", nulls: "last" } },
      { uploadedAt: "desc" },
    ],
    take: 20,
  });

  if (interactions.length === 0) {
    return { category, sourceCount: 0, insightsCreated: 0, insightsArchived: 0 };
  }

  // 2 — Extrai insights via LLM
  const rawInsights = await extractInsights(
    category,
    interactions.map((i) => i.transcript)
  );

  if (rawInsights.length === 0) {
    return { category, sourceCount: interactions.length, insightsCreated: 0, insightsArchived: 0 };
  }

  // 3 — Arquiva DRAFT anteriores da categoria (gerados por destilações passadas não aprovadas)
  //     Não toca nos ACTIVE — eles continuam injetados até a ativação explícita do novo batch.
  //     A promoção DRAFT→ACTIVE e o arquivamento dos ACTIVE anteriores acontece de forma
  //     atômica no painel de SpecialtyKnowledge (Slice 4), não aqui.
  const { count: draftsArchived } = await prisma.specialtyKnowledge.updateMany({
    where: { category, status: "DRAFT" },
    data: { status: "ARCHIVED" },
  });

  // 4 — Cria novos insights como DRAFT (aguardam ativação humana no Slice 4)
  await prisma.specialtyKnowledge.createMany({
    data: rawInsights.map((ri) => ({
      category,
      title: ri.title,
      insight: ri.insight,
      examplePhrase: ri.examplePhrase ?? null,
      exampleResponse: ri.exampleResponse ?? null,
      status: "DRAFT" as const,
      sourceCount: interactions.length,
    })),
  });

  return {
    category,
    sourceCount: interactions.length,
    insightsCreated: rawInsights.length,
    insightsArchived: draftsArchived, // apenas DRAFTs descartados, não ACTIVEs
  };
}
