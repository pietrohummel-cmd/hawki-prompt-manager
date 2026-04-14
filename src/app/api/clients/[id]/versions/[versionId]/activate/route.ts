import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/clients/[id]/versions/[versionId]/activate
 * Ativa uma versão anterior, desativando a atual.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionId } = await params;

  // Verifica que a versão pertence a este cliente
  const version = await prisma.promptVersion.findFirst({
    where: { id: versionId, clientId: id },
  });

  if (!version) return NextResponse.json({ error: "Versão não encontrada" }, { status: 404 });

  // Transação: desativa todas as versões do cliente, ativa a solicitada
  await prisma.$transaction([
    prisma.promptVersion.updateMany({
      where: { clientId: id },
      data: { isActive: false },
    }),
    prisma.promptVersion.update({
      where: { id: versionId },
      data: { isActive: true },
    }),
  ]);

  return NextResponse.json({ success: true });
}
