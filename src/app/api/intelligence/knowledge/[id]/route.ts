/**
 * PATCH /api/intelligence/knowledge/[id]  — atualiza status ou conteúdo de um insight
 * DELETE /api/intelligence/knowledge/[id] — remove um insight (apenas DRAFT/ARCHIVED)
 *
 * Insights que pertencem a um batch (distillados) não podem ser ativados individualmente
 * — usar PATCH /api/intelligence/knowledge/batches/[batchId] para ativar o lote inteiro.
 * Insights manuais (sem batchId) podem ser ativados individualmente; ao ativar, ACTIVEs
 * órfãos da mesma categoria são arquivados (mas batches ACTIVE permanecem intactos —
 * eles coexistem como camadas de conhecimento).
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
    const target = await prisma.specialtyKnowledge.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Insight não encontrado" }, { status: 404 });

    // Ativação requer regras especiais
    if (status === "ACTIVE") {
      // Insights distillados (com batchId) só podem ser ativados via batch endpoint
      if (target.batchId) {
        return NextResponse.json(
          {
            error: "Insight distillado — ative o lote inteiro",
            detail: `Use PATCH /api/intelligence/knowledge/batches/${target.batchId} para promoção atômica.`,
            batchId: target.batchId,
          },
          { status: 409 }
        );
      }

      // Insights manuais: arquiva apenas outros manuais ACTIVE (não toca em batches)
      const updated = await prisma.$transaction(async (tx) => {
        await tx.specialtyKnowledge.updateMany({
          where: {
            category: target.category,
            status: "ACTIVE",
            batchId: null,        // só toca em manuais — batches são gerenciados pelo endpoint próprio
            id: { not: id },
          },
          data: { status: "ARCHIVED" },
        });
        return tx.specialtyKnowledge.update({
          where: { id },
          data: { status: "ACTIVE", ...rest },
        });
      });
      return NextResponse.json(updated);
    }

    // Demais mudanças (DRAFT/ARCHIVED ou edição de conteúdo) — sem efeito colateral
    const updated = await prisma.specialtyKnowledge.update({
      where: { id },
      data: { ...(status ? { status } : {}), ...rest },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH knowledge/:id]", err);
    return NextResponse.json({ error: "Erro ao atualizar insight" }, { status: 500 });
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
