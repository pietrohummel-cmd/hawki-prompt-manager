/**
 * PATCH  /api/clients/[id]/specific-insights/[insightId]  — atualiza insight
 * DELETE /api/clients/[id]/specific-insights/[insightId]  — remove insight
 *
 * Nota de segurança: veja nota no route.ts pai sobre ownership sistêmico.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ServiceCategory, KnowledgeStatus } from "@/generated/prisma";

type Params = { params: Promise<{ id: string; insightId: string }> };

async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Response("Unauthorized", { status: 401 });
  return userId;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id: clientId, insightId } = await params;

    const existing = await prisma.clientSpecificInsight.findUnique({
      where: { id: insightId },
    });
    if (!existing || existing.clientId !== clientId) {
      return NextResponse.json({ error: "Insight não encontrado" }, { status: 404 });
    }

    const body = await req.json() as {
      title?: string;
      insight?: string;
      category?: ServiceCategory | null;
      example?: string | null;
      status?: KnowledgeStatus;
    };

    // Ativação + arquivamento das demais em uma única transação.
    // Sem a transação, uma janela de corrida entre updateMany e update poderia
    // deixar dois insights ACTIVE simultaneamente para o mesmo (clientId, category).
    const updated = await prisma.$transaction(async (tx) => {
      if (body.status === "ACTIVE" && existing.status !== "ACTIVE") {
        await tx.clientSpecificInsight.updateMany({
          where: {
            clientId,
            category: existing.category,
            status: "ACTIVE",
            id: { not: insightId },
          },
          data: { status: "ARCHIVED" },
        });
      }

      return tx.clientSpecificInsight.update({
        where: { id: insightId },
        data: {
          ...(body.title    !== undefined && { title: body.title.trim() }),
          ...(body.insight  !== undefined && { insight: body.insight.trim() }),
          ...(body.category !== undefined && { category: body.category }),
          ...(body.example  !== undefined && { example: body.example?.trim() || null }),
          ...(body.status   !== undefined && { status: body.status }),
        },
      });
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH specific-insights/:id]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id: clientId, insightId } = await params;

    const existing = await prisma.clientSpecificInsight.findUnique({
      where: { id: insightId },
    });
    if (!existing || existing.clientId !== clientId) {
      return NextResponse.json({ error: "Insight não encontrado" }, { status: 404 });
    }

    await prisma.clientSpecificInsight.delete({ where: { id: insightId } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[DELETE specific-insights/:id]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
