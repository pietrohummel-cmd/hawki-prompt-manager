/**
 * PATCH  /api/clients/[id]/specific-insights/[insightId]  — atualiza insight
 * DELETE /api/clients/[id]/specific-insights/[insightId]  — remove insight
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

    // Activating: deactivate other ACTIVE insights for the same client+category
    if (body.status === "ACTIVE" && existing.status !== "ACTIVE") {
      await prisma.clientSpecificInsight.updateMany({
        where: {
          clientId,
          category: existing.category,
          status: "ACTIVE",
          id: { not: insightId },
        },
        data: { status: "ARCHIVED" },
      });
    }

    const updated = await prisma.clientSpecificInsight.update({
      where: { id: insightId },
      data: {
        ...(body.title   !== undefined && { title: body.title.trim() }),
        ...(body.insight !== undefined && { insight: body.insight.trim() }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.example  !== undefined && { example: body.example?.trim() || null }),
        ...(body.status   !== undefined && { status: body.status }),
      },
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
