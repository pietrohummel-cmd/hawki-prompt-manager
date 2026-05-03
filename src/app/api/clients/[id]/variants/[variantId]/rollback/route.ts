/**
 * POST /api/clients/[id]/variants/[variantId]/rollback
 *
 * Reverte uma variante PROMOTED:
 * 1. Desativa a PromptVersion criada na promoção
 * 2. Reativa a PromptVersion que era baseline
 * 3. Marca variante como ROLLED_BACK
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; variantId: string }> };

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
    if (variant.status !== "PROMOTED") {
      return NextResponse.json(
        { error: "Apenas variantes com status PROMOTED podem ser revertidas" },
        { status: 409 }
      );
    }
    if (!variant.promotedVersionId) {
      return NextResponse.json({ error: "Variante sem versão promovida registrada" }, { status: 422 });
    }

    await prisma.$transaction(async (tx) => {
      // Desativa a versão promovida
      await tx.promptVersion.update({
        where: { id: variant.promotedVersionId! },
        data: { isActive: false },
      });

      // Reativa o baseline (se ainda existir)
      if (variant.baselineVersionId) {
        await tx.promptVersion.update({
          where: { id: variant.baselineVersionId },
          data: { isActive: true },
        });
      }

      await tx.promptVariant.update({
        where: { id: variantId },
        data: { status: "ROLLED_BACK", rolledBackAt: new Date() },
      });
    });

    return NextResponse.json({ rolledBack: true, baselineVersionId: variant.baselineVersionId });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST variants/rollback]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
