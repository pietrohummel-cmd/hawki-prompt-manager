/**
 * GET  /api/clients/[id]/specific-insights  — lista insights da clínica
 * POST /api/clients/[id]/specific-insights  — cria novo insight
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ServiceCategory, KnowledgeStatus } from "@/generated/prisma";

type Params = { params: Promise<{ id: string }> };

async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Response("Unauthorized", { status: 401 });
  return userId;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id: clientId } = await params;

    const insights = await prisma.clientSpecificInsight.findMany({
      where: { clientId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(insights);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET specific-insights]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const userId = await requireAuth();
    const { id: clientId } = await params;

    // Verify client exists and belongs to this user's org
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const body = await req.json() as {
      title: string;
      insight: string;
      category?: ServiceCategory | null;
      example?: string | null;
      status?: KnowledgeStatus;
    };

    if (!body.title?.trim() || !body.insight?.trim()) {
      return NextResponse.json({ error: "title e insight são obrigatórios" }, { status: 400 });
    }

    const created = await prisma.clientSpecificInsight.create({
      data: {
        clientId,
        title: body.title.trim(),
        insight: body.insight.trim(),
        category: body.category ?? null,
        example: body.example?.trim() || null,
        status: body.status ?? "DRAFT",
        source: "MANUAL",
      },
    });

    void userId; // recorded via Clerk session; future: add createdBy field
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST specific-insights]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
