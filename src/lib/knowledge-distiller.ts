/**
 * Destilação de SpecialtyKnowledge a partir de interações aprovadas.
 *
 * Fluxo (Slice 0.1 — batch atômico):
 * 1. Busca as top-20 interações APPROVED para a categoria (ordenadas por scoreQuality desc)
 * 2. Envia as transcrições ao claude-sonnet para extrair 3–5 insights acionáveis
 * 3. Arquiva os DRAFT batches anteriores da mesma categoria (não toca em ACTIVE)
 * 4. Cria um novo KnowledgeBatch (status=DRAFT) + todos os insights linkados a ele
 * 5. Admin ativa via PATCH /api/intelligence/knowledge/batches/[batchId] (atomicamente)
 *
 * ACTIVE permanece intocado até a ativação explícita do novo batch — sem janela de zero-knowledge.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CATEGORY_LABELS, MAX_INSIGHTS_PER_INJECTION } from "@/lib/intelligence-constants";
import { logUsage } from "@/lib/usage-logger";
import { computeRankingScore } from "@/lib/interaction-scorer";
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
  batchId: string | null;
  sourceCount: number;
  insightsCreated: number;
  draftBatchesArchived: number;
}

/**
 * Destila conhecimento para uma categoria a partir das interações aprovadas.
 * Cria um novo KnowledgeBatch DRAFT com todos os insights extraídos.
 * Arquiva DRAFTs anteriores (não toca em ACTIVE — promoção é atômica via batch endpoint).
 */
export async function distillKnowledge(category: ServiceCategory): Promise<DistillResult> {
  // 1 — Busca aprovadas com outcome incluído. Ordenação inicial por scoreQuality
  //     para o caso degenerado (zero outcome registrado), mas o ranking final
  //     considera outcome real via computeRankingScore (ground truth > LLM).
  const candidates = await prisma.successfulInteraction.findMany({
    where: { category, status: "APPROVED" },
    orderBy: [
      { scoreQuality: { sort: "desc", nulls: "last" } },
      { uploadedAt: "desc" },
    ],
    include: { conversationOutcome: true },
    take: 60,  // pega 3x o limite para reordenar por ranking score
  });

  if (candidates.length === 0) {
    return { category, batchId: null, sourceCount: 0, insightsCreated: 0, draftBatchesArchived: 0 };
  }

  // Reordena por ranking score (LLM + outcome) e pega top-20
  const interactions = candidates
    .map((i) => ({
      interaction: i,
      ranking: computeRankingScore(i.scoreQuality, i.conversationOutcome),
    }))
    .sort((a, b) => b.ranking - a.ranking)
    .slice(0, 20)
    .map((entry) => entry.interaction);

  // 2 — Extrai insights via LLM
  const rawInsights = await extractInsights(
    category,
    interactions.map((i) => i.transcript)
  );

  if (rawInsights.length === 0) {
    return { category, batchId: null, sourceCount: interactions.length, insightsCreated: 0, draftBatchesArchived: 0 };
  }

  // 3 — Cria batch + insights em transação atômica
  //     Arquiva DRAFTs anteriores e seus insights antes (não toca em ACTIVE).
  const result = await prisma.$transaction(async (tx) => {
    // 3a — Arquiva DRAFT batches anteriores da categoria (cascateia para insights via status no UI)
    const archivedBatches = await tx.knowledgeBatch.updateMany({
      where: { category, status: "DRAFT" },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    // Também arquiva DRAFTs órfãos (legacy, sem batchId) e DRAFTs do batch arquivado
    await tx.specialtyKnowledge.updateMany({
      where: { category, status: "DRAFT" },
      data: { status: "ARCHIVED" },
    });

    // 3b — Cria novo batch DRAFT com seus insights
    const batch = await tx.knowledgeBatch.create({
      data: {
        category,
        status: "DRAFT",
        sourceCount: interactions.length,
        insights: {
          create: rawInsights.map((ri) => ({
            category,
            title: ri.title,
            insight: ri.insight,
            examplePhrase: ri.examplePhrase ?? null,
            exampleResponse: ri.exampleResponse ?? null,
            status: "DRAFT" as const,
            sourceCount: interactions.length,
          })),
        },
      },
    });

    return { batchId: batch.id, draftBatchesArchived: archivedBatches.count };
  });

  return {
    category,
    batchId: result.batchId,
    sourceCount: interactions.length,
    insightsCreated: rawInsights.length,
    draftBatchesArchived: result.draftBatchesArchived,
  };
}
