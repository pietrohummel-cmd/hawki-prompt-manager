/**
 * GET  /api/intelligence/knowledge  — lista SpecialtyKnowledge (filtrado por categoria/status)
 * POST /api/intelligence/knowledge  — cria insight manualmente
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { INTELLIGENCE_ADMIN_EMAILS, INTELLIGENCE_DEV_BYPASS } from "@/lib/intelligence-constants";
import type { ServiceCategory, KnowledgeStatus } from "@/generated/prisma";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  if (INTELLIGENCE_DEV_BYPASS) return "dev";
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
  return INTELLIGENCE_ADMIN_EMAILS.includes(email) ? email : null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as ServiceCategory | null;
  const status   = searchParams.get("status")   as KnowledgeStatus | null;

  const where = {
    ...(category ? { category } : {}),
    ...(status   ? { status }   : {}),
  };

  try {
    const items = await prisma.specialtyKnowledge.findMany({
      where,
      orderBy: [{ status: "asc" }, { sourceCount: "desc" }, { createdAt: "desc" }],
      include: {
        batch: {
          select: { id: true, status: true, createdAt: true, sourceCount: true },
        },
      },
    });
    return NextResponse.json(items);
  } catch (err) {
    console.error("[GET /api/intelligence/knowledge]", err);
    return NextResponse.json({ error: "Erro interno", detail: String(err) }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

const postSchema = z.object({
  category:        z.enum(["IMPLANTES","ORTODONTIA","ESTETICA","CLINICO_GERAL","PERIODONTIA","ENDODONTIA","PEDIATRIA","PROTESE","CIRURGIA","OUTROS"]),
  title:           z.string().min(1).max(100),
  insight:         z.string().min(1),
  examplePhrase:   z.string().optional(),
  exampleResponse: z.string().optional(),
});

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const item = await prisma.specialtyKnowledge.create({
      data: {
        ...parsed.data,
        category: parsed.data.category as ServiceCategory,
        examplePhrase:   parsed.data.examplePhrase   ?? null,
        exampleResponse: parsed.data.exampleResponse ?? null,
        status: "DRAFT",
        sourceCount: 0,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Erro ao criar insight", detail: String(err) }, { status: 500 });
  }
}
