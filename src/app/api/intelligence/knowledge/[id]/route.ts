/**
 * PATCH /api/intelligence/knowledge/[id]  — atualiza status ou conteúdo de um insight
 * DELETE /api/intelligence/knowledge/[id] — remove um insight (apenas DRAFT/ARCHIVED)
 *
 * Ativar um insight (DRAFT → ACTIVE) é uma operação atômica:
 * arquiva os ACTIVE anteriores da mesma categoria e promove este para ACTIVE.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { INTELLIGENCE_ADMIN_EMAILS, INTELLIGENCE_DEV_BYPASS } from "@/lib/intelligence-constants";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  if (INTELLIGENCE_DEV_BYPASS) return true;
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
  return INTELLIGENCE_ADMIN_EMAILS.includes(email);
}

const patchSchema = z.object({
  status:          z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  title:           z.string().min(1).max(100).optional(),
  insight:         z.string().min(1).optional(),
  examplePhrase:   z.string().nullable().optional(),
  exampleResponse: z.string().nullable().optional(),
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { status, ...rest } = parsed.data;

  try {
    // Ativação atômica: arquiva ACTIVEs da mesma categoria antes de promover
    if (status === "ACTIVE") {
      const target = await prisma.specialtyKnowledge.findUnique({ where: { id } });
      if (!target) return NextResponse.json({ error: "Insight não encontrado" }, { status: 404 });

      const updated = await prisma.$transaction(async (tx) => {
        // Arquiva todos os ACTIVE da mesma categoria (exceto o próprio)
        await tx.specialtyKnowledge.updateMany({
          where: { category: target.category, status: "ACTIVE", id: { not: id } },
          data: { status: "ARCHIVED" },
        });
        // Promove este para ACTIVE
        return tx.specialtyKnowledge.update({
          where: { id },
          data: { status: "ACTIVE", ...rest },
        });
      });

      return NextResponse.json(updated);
    }

    // Demais mudanças de status ou edição de conteúdo
    const updated = await prisma.specialtyKnowledge.update({
      where: { id },
      data: { ...(status ? { status } : {}), ...rest },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Insight não encontrado" }, { status: 404 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const target = await prisma.specialtyKnowledge.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Insight não encontrado" }, { status: 404 });
    if (target.status === "ACTIVE") {
      return NextResponse.json({ error: "Não é possível deletar um insight ACTIVE. Arquive-o primeiro." }, { status: 400 });
    }
    await prisma.specialtyKnowledge.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao deletar insight" }, { status: 500 });
  }
}
