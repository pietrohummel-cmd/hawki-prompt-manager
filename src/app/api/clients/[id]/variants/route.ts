/**
 * GET  /api/clients/[id]/variants  — lista variantes da clínica
 * POST /api/clients/[id]/variants  — cria nova variante manual
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { VariantSource } from "@/generated/prisma";

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

    const variants = await prisma.promptVariant.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(variants);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET variants]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id: clientId } = await params;

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const body = await req.json() as {
      variantPrompt: string;
      source?: VariantSource;
      description?: string;
    };

    if (!body.variantPrompt?.trim()) {
      return NextResponse.json({ error: "variantPrompt é obrigatório" }, { status: 400 });
    }

    // Captura a versão ativa agora como baseline de comparação
    const baselineVersion = await prisma.promptVersion.findFirst({
      where: { clientId, isActive: true },
      orderBy: { version: "desc" },
    });

    const variant = await prisma.promptVariant.create({
      data: {
        clientId,
        variantPrompt: body.variantPrompt.trim(),
        source: body.source ?? "MANUAL",
        description: body.description?.trim() || null,
        baselineVersionId: baselineVersion?.id ?? null,
      },
    });

    return NextResponse.json(variant, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST variants]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
