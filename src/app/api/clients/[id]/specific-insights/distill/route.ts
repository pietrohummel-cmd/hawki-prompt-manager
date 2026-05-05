/**
 * GET  /api/clients/[id]/specific-insights/distill
 *   Retorna elegibilidade para destilação: { count, eligible, threshold }
 *   Elegibilidade: ≥ 20 ConversationSample registrados para o cliente.
 *
 * POST /api/clients/[id]/specific-insights/distill
 *   Destila 3-5 insights per-clinic a partir do histórico de conversas aprovadas.
 *   Usa GPT-4o (mesmo modelo de geração de prompt) e cria ClientSpecificInsight
 *   com source = DISTILLED_FROM_OWN_HISTORY.
 *   Retorna: { insights: ClientSpecificInsight[], count: number }
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { logUsage } from "@/lib/usage-logger";
import type { ServiceCategory } from "@/generated/prisma";

const DISTILL_MODEL     = "gpt-4o";
const MIN_CONVERSATIONS = 20;
const MAX_SAMPLES_USED  = 40; // máx. de conversas enviadas ao modelo

type Params = { params: Promise<{ id: string }> };

const VALID_CATEGORIES: ServiceCategory[] = [
  "IMPLANTES","ORTODONTIA","ESTETICA","CLINICO_GERAL",
  "PERIODONTIA","ENDODONTIA","PEDIATRIA","PROTESE","CIRURGIA","OUTROS",
];

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Response("Unauthorized", { status: 401 });
  return userId;
}

// ─── GET — verificação de elegibilidade ───────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id: clientId } = await params;

    const count = await prisma.conversationSample.count({ where: { clientId } });

    return NextResponse.json({
      count,
      eligible: count >= MIN_CONVERSATIONS,
      threshold: MIN_CONVERSATIONS,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── POST — destilação ────────────────────────────────────────────────────────

export async function POST(_req: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id: clientId } = await params;

    // Busca cliente e conta conversas
    const [client, count] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.conversationSample.count({ where: { clientId } }),
    ]);

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    if (count < MIN_CONVERSATIONS) {
      return NextResponse.json(
        { error: `Esta clínica precisa de pelo menos ${MIN_CONVERSATIONS} conversas para destilar. Atualmente: ${count}.` },
        { status: 400 }
      );
    }

    // Busca amostras — prioriza as com outcome SCHEDULED, depois mais recentes
    const samples = await prisma.conversationSample.findMany({
      where:   { clientId },
      orderBy: [{ outcome: "asc" }, { createdAt: "desc" }],
      take:    MAX_SAMPLES_USED,
      select:  { content: true, outcome: true },
    });

    // Monta bloco de conversas para o modelo — cada uma numerada e separada
    const transcriptBlock = samples
      .map((s, i) => {
        const tag = s.outcome === "SCHEDULED"
          ? "[AGENDOU]"
          : s.outcome === "NOT_SCHEDULED"
          ? "[NÃO AGENDOU]"
          : "[DESCONHECIDO]";
        return `--- Conversa ${i + 1} ${tag} ---\n${s.content.slice(0, 1500)}`;
      })
      .join("\n\n");

    const prompt = `Você é um especialista em comunicação humanizada para assistentes de IA de clínicas odontológicas brasileiras.

Analise as conversas reais abaixo do atendimento da Sofia para a clínica "${client.clinicName}" e identifique APENAS padrões ESPECÍFICOS desta clínica — não padrões genéricos de atendimento odontológico.

Foque em:
- Objeções que aparecem com frequência específica nesta clientela
- Tom, vocabulário e ritmo de resposta que gerou melhores resultados com este público
- Perguntas de qualificação que funcionaram especialmente bem para os serviços desta clínica
- Padrões de retomada ou reengajamento eficazes neste contexto específico

Retorne APENAS um array JSON com 3 a 5 insights. Use null para category se o insight se aplica a todas as especialidades.

Formato obrigatório (sem markdown, apenas JSON):
[
  {
    "title": "Título do insight (máx. 8 palavras)",
    "insight": "Descrição do padrão identificado (2-4 frases concretas)",
    "example": "Exemplo real ou adaptado das conversas (1-2 linhas, formato Paciente/Sofia)",
    "category": "IMPLANTES" | "ORTODONTIA" | "ESTETICA" | "CLINICO_GERAL" | "PERIODONTIA" | "ENDODONTIA" | "PEDIATRIA" | "PROTESE" | "CIRURGIA" | "OUTROS" | null
  }
]

CONVERSAS ANALISADAS (${samples.length} amostras):

${transcriptBlock}`;

    const completion = await getOpenAI().chat.completions.create({
      model:      DISTILL_MODEL,
      max_tokens: 2048,
      messages:   [{ role: "user", content: prompt }],
    });

    await logUsage({
      clientId,
      operation: "distill_client_insights",
      model:     DISTILL_MODEL,
      usage: {
        input_tokens:  completion.usage?.prompt_tokens     ?? 0,
        output_tokens: completion.usage?.completion_tokens ?? 0,
      },
    });

    const raw  = completion.choices[0]?.message.content ?? "";
    const start = raw.indexOf("[");
    const end   = raw.lastIndexOf("]");

    if (start === -1 || end <= start) {
      console.error("[distill] Resposta não contém array JSON:", raw.slice(0, 200));
      return NextResponse.json(
        { error: "O modelo não retornou insights válidos. Tente novamente." },
        { status: 422 }
      );
    }

    let parsed: Array<{
      title: string;
      insight: string;
      example?: string | null;
      category?: string | null;
    }>;

    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return NextResponse.json(
        { error: "Erro ao processar resposta do modelo. Tente novamente." },
        { status: 422 }
      );
    }

    // Cria os insights em transação — todos como DRAFT para revisão humana antes de ativar
    const created = await prisma.$transaction(
      parsed
        .filter((item) => item.title?.trim() && item.insight?.trim())
        .slice(0, 5)
        .map((item) =>
          prisma.clientSpecificInsight.create({
            data: {
              clientId,
              title:   item.title.trim(),
              insight: item.insight.trim(),
              example: item.example?.trim() || null,
              category: VALID_CATEGORIES.includes(item.category as ServiceCategory)
                ? (item.category as ServiceCategory)
                : null,
              status: "DRAFT",
              source: "DISTILLED_FROM_OWN_HISTORY",
            },
          })
        )
    );

    return NextResponse.json({ insights: created, count: created.length }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST distill]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
