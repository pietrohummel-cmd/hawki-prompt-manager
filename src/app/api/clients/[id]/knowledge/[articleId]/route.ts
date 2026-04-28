import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  content: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/clients/[id]/knowledge/[articleId]
 * Atualiza conteúdo, título ou status de um artigo de KB.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { articleId } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.clientKnowledgeArticle.update({
    where: { id: articleId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/clients/[id]/knowledge/[articleId]
 * Desativa (soft delete via isActive = false) um artigo de KB.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { articleId } = await params;

  const updated = await prisma.clientKnowledgeArticle.update({
    where: { id: articleId },
    data: { isActive: false },
  });

  return NextResponse.json(updated);
}
