/**
 * POST /api/clients/[id]/variants/[variantId]/test
 *
 * Roda todos os casos de regressão do cliente contra:
 *   - Baseline: PromptVersion isActive (ou baselineVersionId da variante)
 *   - Variante: variantPrompt armazenado
 *
 * Calcula regressionDelta (pontos percentuais) e persiste na variante.
 * Se delta >= THRESHOLD_AUTO_PROMOTE (env, padrão 5pp), muda status para WON.
 *
 * Nota: sincronous — pode levar 30-90s dependendo do número de casos.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateWithPrompt, buildSystemPromptFromVersion } from "@/lib/regression-runner";
import type { PromptModule } from "@/generated/prisma";

type Params = { params: Promise<{ id: string; variantId: string }> };

const THRESHOLD = parseFloat(process.env.THRESHOLD_AUTO_PROMOTE ?? "5");

async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Response("Unauthorized", { status: 401 });
  return userId;
}

export async function POST(_req: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id: clientId, variantId } = await params;

    const variant = await prisma.promptVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.clientId !== clientId) {
      return NextResponse.json({ error: "Variante não encontrada" }, { status: 404 });
    }
    if (variant.status === "PROMOTED" || variant.status === "ROLLED_BACK") {
      return NextResponse.json({ error: "Variante já finalizada — não pode retestar" }, { status: 409 });
    }

    // Marca como TESTING
    await prisma.promptVariant.update({ where: { id: variantId }, data: { status: "TESTING" } });

    // Carrega casos de regressão
    const regressionCases = await prisma.regressionCase.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
    });

    if (regressionCases.length === 0) {
      await prisma.promptVariant.update({ where: { id: variantId }, data: { status: "PENDING" } });
      return NextResponse.json(
        { error: "Nenhum caso de regressão cadastrado — adicione casos na aba Regressão antes de testar" },
        { status: 422 }
      );
    }

    // Carrega baseline
    const baselineVersion = variant.baselineVersionId
      ? await prisma.promptVersion.findUnique({
          where: { id: variant.baselineVersionId },
          include: { modules: true },
        })
      : await prisma.promptVersion.findFirst({
          where: { clientId, isActive: true },
          include: { modules: true },
          orderBy: { version: "desc" },
        });

    const baselinePrompt = baselineVersion
      ? buildSystemPromptFromVersion(baselineVersion as typeof baselineVersion & { modules: PromptModule[] })
      : null;

    // Roda regressão em paralelo (3 pares por vez) para não explodir rate limits
    const CONCURRENCY = 3;
    type CasePair = {
      baselinePassed: number;
      variantPassed: number;
    };
    const pairResults: CasePair[] = [];

    for (let i = 0; i < regressionCases.length; i += CONCURRENCY) {
      const chunk = regressionCases.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (rc) => {
          const [baselineResult, variantResult] = await Promise.all([
            baselinePrompt
              ? evaluateWithPrompt(rc as typeof rc & { criteria: string[] }, baselinePrompt)
              : Promise.resolve(null),
            evaluateWithPrompt(rc as typeof rc & { criteria: string[] }, variant.variantPrompt),
          ]);
          return {
            baselinePassed: baselineResult?.status === "PASSED" ? 1 : 0,
            variantPassed: variantResult.status === "PASSED" ? 1 : 0,
          };
        })
      );
      pairResults.push(...chunkResults);
    }

    const total = pairResults.length;
    const baselinePassed = pairResults.reduce((s, r) => s + r.baselinePassed, 0);
    const variantPassed  = pairResults.reduce((s, r) => s + r.variantPassed, 0);

    // Delta em pontos percentuais: variant% - baseline%
    const baselinePct = total > 0 ? (baselinePassed / total) * 100 : 0;
    const variantPct  = total > 0 ? (variantPassed  / total) * 100 : 0;
    const delta = parseFloat((variantPct - baselinePct).toFixed(2));

    // Auto-status: WON se passou no threshold, LOST caso contrário
    const newStatus = delta >= THRESHOLD ? "WON" : "LOST";

    const updated = await prisma.promptVariant.update({
      where: { id: variantId },
      data: {
        status: newStatus,
        regressionPassed: variantPassed,
        regressionFailed: total - variantPassed,
        regressionDelta: delta,
      },
    });

    return NextResponse.json({
      status: newStatus,
      total,
      baselinePassed,
      variantPassed,
      baselinePct: parseFloat(baselinePct.toFixed(1)),
      variantPct:  parseFloat(variantPct.toFixed(1)),
      delta,
      threshold: THRESHOLD,
      variant: updated,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST variants/test]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
