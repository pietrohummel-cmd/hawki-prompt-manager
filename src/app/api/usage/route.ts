import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ESTIMATED_FULL_REGEN_COST_USD } from "@/lib/usage-logger";

/**
 * GET /api/usage
 * Retorna estatísticas agregadas de uso da API Anthropic:
 * - Custo total
 * - Custo por cliente (top 10)
 * - Custo por operação
 * - Economia estimada (edições modulares vs. regenerações completas)
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [totalAgg, byClient, byOperation, suggestCount] = await Promise.all([
    // Total geral
    prisma.apiUsageLog.aggregate({
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    }),

    // Por cliente (top 10 por custo)
    prisma.apiUsageLog.groupBy({
      by: ["clientId"],
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      orderBy: { _sum: { costUsd: "desc" } },
      take: 10,
    }),

    // Por operação
    prisma.apiUsageLog.groupBy({
      by: ["operation"],
      _sum: { costUsd: true },
      _count: { id: true },
    }),

    // Contagem de suggest_module + suggest_ticket para calcular economia
    prisma.apiUsageLog.count({
      where: { operation: { in: ["suggest_module", "suggest_ticket"] } },
    }),
  ]);

  // Enriquece os dados por cliente com nome da clínica
  const clientIds = byClient
    .map((r) => r.clientId)
    .filter((id): id is string => id !== null);

  const clients = clientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, clinicName: true, assistantName: true },
      })
    : [];

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  const byClientEnriched = byClient.map((r) => ({
    clientId: r.clientId,
    clinicName: r.clientId ? (clientMap[r.clientId]?.clinicName ?? "Cliente removido") : "Sem cliente",
    assistantName: r.clientId ? (clientMap[r.clientId]?.assistantName ?? null) : null,
    costUsd: r._sum.costUsd ?? 0,
    inputTokens: r._sum.inputTokens ?? 0,
    outputTokens: r._sum.outputTokens ?? 0,
  }));

  // Economia: cada vez que usamos suggest_module/suggest_ticket ao invés de gerar
  // o prompt completo, economizamos (ESTIMATED_FULL_REGEN_COST_USD - custo real da sugestão)
  const suggestCost = byOperation
    .filter((o) => ["suggest_module", "suggest_ticket"].includes(o.operation))
    .reduce((sum, o) => sum + (o._sum.costUsd ?? 0), 0);

  const estimatedSavings = suggestCount * ESTIMATED_FULL_REGEN_COST_USD - suggestCost;

  return NextResponse.json({
    total: {
      costUsd: totalAgg._sum.costUsd ?? 0,
      inputTokens: totalAgg._sum.inputTokens ?? 0,
      outputTokens: totalAgg._sum.outputTokens ?? 0,
    },
    byClient: byClientEnriched,
    byOperation: byOperation.map((o) => ({
      operation: o.operation,
      count: o._count.id,
      costUsd: o._sum.costUsd ?? 0,
    })),
    savings: {
      suggestionsCount: suggestCount,
      estimatedSavingsUsd: Math.max(0, estimatedSavings),
      estimatedFullRegenCostUsd: ESTIMATED_FULL_REGEN_COST_USD,
    },
  });
}
