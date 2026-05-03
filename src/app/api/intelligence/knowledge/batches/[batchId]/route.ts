/**
 * PATCH  /api/intelligence/knowledge/batches/[batchId] — ativa ou arquiva um lote inteiro
 * DELETE /api/intelligence/knowledge/batches/[batchId] — remove um lote ARCHIVED (com seus insights)
 *
 * Ativação atômica em transação: arquiva todos os outros batches ACTIVE da mesma categoria
 * (e seus insights) antes de promover este. Garante até 1 batch ACTIVE por categoria sem janela
 * de zero-knowledge.
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
  status: z.enum(["ACTIVE", "ARCHIVED"]),
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });
  }

  const { batchId } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { status } = parsed.data;

  const batch = await prisma.knowledgeBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return NextResponse.json({ error: "Batch não encontrado" }, { status: 404 });
  }

  // ── ARCHIVED: arquiva batch + insights atomicamente ───────────────────────
  if (status === "ARCHIVED") {
    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.knowledgeBatch.update({
        where: { id: batchId },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      await tx.specialtyKnowledge.updateMany({
        where: { batchId },
        data: { status: "ARCHIVED" },
      });
      return b;
    });
    return NextResponse.json(updated);
  }

  // ── ACTIVE: arquiva outros ACTIVE da mesma categoria + promove este ───────
  if (batch.status === "ACTIVE") {
    return NextResponse.json({ error: "Batch já está ativo" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    // 1 — Arquiva outros batches ACTIVE da mesma categoria
    const otherActiveBatches = await tx.knowledgeBatch.findMany({
      where: { category: batch.category, status: "ACTIVE", id: { not: batchId } },
      select: { id: true },
    });
    const otherIds = otherActiveBatches.map((b) => b.id);

    if (otherIds.length > 0) {
      await tx.knowledgeBatch.updateMany({
        where: { id: { in: otherIds } },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      await tx.specialtyKnowledge.updateMany({
        where: { batchId: { in: otherIds } },
        data: { status: "ARCHIVED" },
      });
    }

    // 2 — Arquiva também ACTIVEs órfãos (legacy, sem batchId) da mesma categoria
    //     para garantir que o novo batch seja a única fonte ACTIVE.
    await tx.specialtyKnowledge.updateMany({
      where: { category: batch.category, status: "ACTIVE", batchId: null },
      data: { status: "ARCHIVED" },
    });

    // 3 — Promove este batch + seus insights para ACTIVE
    const promoted = await tx.knowledgeBatch.update({
      where: { id: batchId },
      data: { status: "ACTIVE", activatedAt: new Date() },
    });
    await tx.specialtyKnowledge.updateMany({
      where: { batchId },
      data: { status: "ACTIVE" },
    });

    return promoted;
  });

  return NextResponse.json(updated);
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });
  }

  const { batchId } = await params;
  const batch = await prisma.knowledgeBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return NextResponse.json({ error: "Batch não encontrado" }, { status: 404 });
  }
  if (batch.status === "ACTIVE") {
    return NextResponse.json(
      { error: "Não é possível deletar batch ACTIVE. Arquive-o primeiro." },
      { status: 400 }
    );
  }

  // Cascade configurado no schema deleta os insights vinculados
  await prisma.knowledgeBatch.delete({ where: { id: batchId } });
  return NextResponse.json({ success: true });
}
