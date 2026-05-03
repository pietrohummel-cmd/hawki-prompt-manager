/**
 * GET /api/intelligence/impact
 *   Métricas agregadas de impacto da Inteligência Hawki:
 *   - Por categoria: cobertura de outcome, distribuição de funil, receita
 *   - Globalmente: total de interações, % com outcome, receita acumulada
 *
 *   Restrito a admins. Em dev (INTELLIGENCE_DEV_BYPASS), aberto.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATEGORY_KEYS, INTELLIGENCE_ADMIN_EMAILS, INTELLIGENCE_DEV_BYPASS } from "@/lib/intelligence-constants";
import { computeRankingScore } from "@/lib/interaction-scorer";
import type { ServiceCategory } from "@/generated/prisma";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (INTELLIGENCE_DEV_BYPASS) return true;
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
  return INTELLIGENCE_ADMIN_EMAILS.includes(email);
}

interface CategoryStats {
  category: ServiceCategory;
  totalApproved: number;
  withOutcome: number;
  outcomeCoveragePct: number;
  scheduled: number;
  showedUp: number;
  noShow: number;
  closed: number;
  notClosed: number;
  totalRevenueCents: number;
  avgRevenueClosedCents: number;
  activeInsights: number;
  activeBatches: number;
  avgRankingScore: number | null;     // média do ranking ajustado entre interações com outcome
  avgRawScoreQuality: number | null;  // média do scoreQuality bruto LLM
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });
  }

  try {
    // Carrega tudo de uma vez — a base é pequena nesta fase, otimização vem depois
    const [interactions, activeInsights, activeBatches] = await Promise.all([
      prisma.successfulInteraction.findMany({
        where: { status: "APPROVED" },
        include: { conversationOutcome: true },
      }),
      prisma.specialtyKnowledge.findMany({
        where: { status: "ACTIVE" },
        select: { category: true },
      }),
      prisma.knowledgeBatch.findMany({
        where: { status: "ACTIVE" },
        select: { category: true },
      }),
    ]);

    // Agrupa por categoria
    const byCategory = new Map<ServiceCategory, CategoryStats>();
    for (const cat of CATEGORY_KEYS) {
      byCategory.set(cat, {
        category: cat,
        totalApproved: 0,
        withOutcome: 0,
        outcomeCoveragePct: 0,
        scheduled: 0,
        showedUp: 0,
        noShow: 0,
        closed: 0,
        notClosed: 0,
        totalRevenueCents: 0,
        avgRevenueClosedCents: 0,
        activeInsights: 0,
        activeBatches: 0,
        avgRankingScore: null,
        avgRawScoreQuality: null,
      });
    }

    for (const insight of activeInsights) {
      const cat = byCategory.get(insight.category);
      if (cat) cat.activeInsights += 1;
    }
    for (const batch of activeBatches) {
      const cat = byCategory.get(batch.category);
      if (cat) cat.activeBatches += 1;
    }

    // Acumuladores para médias
    const rankingSum = new Map<ServiceCategory, { sum: number; count: number }>();
    const rawSum = new Map<ServiceCategory, { sum: number; count: number }>();
    const closedRevenueSum = new Map<ServiceCategory, { sum: number; count: number }>();

    for (const interaction of interactions) {
      const stats = byCategory.get(interaction.category);
      if (!stats) continue;
      stats.totalApproved += 1;

      if (interaction.scoreQuality !== null) {
        const r = rawSum.get(interaction.category) ?? { sum: 0, count: 0 };
        r.sum += interaction.scoreQuality;
        r.count += 1;
        rawSum.set(interaction.category, r);
      }

      const o = interaction.conversationOutcome;
      if (!o) continue;

      stats.withOutcome += 1;
      if (o.scheduledAt)         stats.scheduled += 1;
      if (o.showedUp === true)   stats.showedUp += 1;
      if (o.showedUp === false)  stats.noShow += 1;
      if (o.treatmentClosed === true)  stats.closed += 1;
      if (o.treatmentClosed === false) stats.notClosed += 1;
      if (o.revenueCents && o.revenueCents > 0) {
        stats.totalRevenueCents += o.revenueCents;
        if (o.treatmentClosed === true) {
          const c = closedRevenueSum.get(interaction.category) ?? { sum: 0, count: 0 };
          c.sum += o.revenueCents;
          c.count += 1;
          closedRevenueSum.set(interaction.category, c);
        }
      }

      const ranking = computeRankingScore(interaction.scoreQuality, o);
      const r = rankingSum.get(interaction.category) ?? { sum: 0, count: 0 };
      r.sum += ranking;
      r.count += 1;
      rankingSum.set(interaction.category, r);
    }

    // Finaliza derivados
    for (const stats of byCategory.values()) {
      stats.outcomeCoveragePct = stats.totalApproved > 0
        ? Math.round((stats.withOutcome / stats.totalApproved) * 100)
        : 0;
      const closedRev = closedRevenueSum.get(stats.category);
      stats.avgRevenueClosedCents = closedRev && closedRev.count > 0
        ? Math.round(closedRev.sum / closedRev.count)
        : 0;
      const ranking = rankingSum.get(stats.category);
      stats.avgRankingScore = ranking && ranking.count > 0
        ? ranking.sum / ranking.count
        : null;
      const raw = rawSum.get(stats.category);
      stats.avgRawScoreQuality = raw && raw.count > 0
        ? raw.sum / raw.count
        : null;
    }

    // Totais globais
    const allStats = Array.from(byCategory.values());
    const totalApproved      = allStats.reduce((a, s) => a + s.totalApproved, 0);
    const totalWithOutcome   = allStats.reduce((a, s) => a + s.withOutcome, 0);
    const totalRevenueCents  = allStats.reduce((a, s) => a + s.totalRevenueCents, 0);
    const totalScheduled     = allStats.reduce((a, s) => a + s.scheduled, 0);
    const totalShowedUp      = allStats.reduce((a, s) => a + s.showedUp, 0);
    const totalClosed        = allStats.reduce((a, s) => a + s.closed, 0);
    const totalActiveInsights = allStats.reduce((a, s) => a + s.activeInsights, 0);
    const totalActiveBatches  = allStats.reduce((a, s) => a + s.activeBatches, 0);

    return NextResponse.json({
      global: {
        totalApproved,
        totalWithOutcome,
        outcomeCoveragePct: totalApproved > 0
          ? Math.round((totalWithOutcome / totalApproved) * 100)
          : 0,
        totalRevenueCents,
        avgRevenueClosedCents: totalClosed > 0
          ? Math.round(totalRevenueCents / totalClosed)
          : 0,
        scheduled: totalScheduled,
        showedUp:  totalShowedUp,
        closed:    totalClosed,
        activeInsights: totalActiveInsights,
        activeBatches:  totalActiveBatches,
      },
      // Apenas categorias com pelo menos 1 interação
      categories: allStats.filter((s) => s.totalApproved > 0 || s.activeInsights > 0),
    });
  } catch (err) {
    console.error("[GET /api/intelligence/impact]", err);
    return NextResponse.json({ error: "Erro ao calcular impacto", detail: String(err) }, { status: 500 });
  }
}
