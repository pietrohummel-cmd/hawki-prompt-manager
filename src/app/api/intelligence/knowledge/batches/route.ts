/**
 * GET /api/intelligence/knowledge/batches
 *   Lista os batches de insights destilados (com seus insights filhos),
 *   filtráveis por category/status. Usado pela UI para mostrar lotes
 *   inteiros como unidade de ativação.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INTELLIGENCE_ADMIN_EMAILS, INTELLIGENCE_DEV_BYPASS } from "@/lib/intelligence-constants";
import type { ServiceCategory, KnowledgeStatus } from "@/generated/prisma";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (INTELLIGENCE_DEV_BYPASS) return true;
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
  return INTELLIGENCE_ADMIN_EMAILS.includes(email);
}

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
    const batches = await prisma.knowledgeBatch.findMany({
      where,
      include: {
        insights: {
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(batches);
  } catch (err) {
    console.error("[GET /api/intelligence/knowledge/batches]", err);
    return NextResponse.json({ error: "Erro interno", detail: String(err) }, { status: 500 });
  }
}
