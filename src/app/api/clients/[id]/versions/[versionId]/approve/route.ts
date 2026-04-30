import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/clients/[id]/versions/[versionId]/approve
 * Aprova uma versão PENDING_REVIEW, tornando-a a versão ACTIVE do cliente.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionId } = await params;

  const version = await prisma.promptVersion.findFirst({
    where: { id: versionId, clientId: id, status: "PENDING_REVIEW" },
  });

  if (!version) {
    return NextResponse.json({ error: "Versão não encontrada ou não está em PENDING_REVIEW" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.promptVersion.updateMany({
      where: { clientId: id, isActive: true },
      data: { isActive: false, status: "ARCHIVED" },
    }),
    prisma.promptVersion.update({
      where: { id: versionId },
      data: { isActive: true, status: "ACTIVE" },
    }),
  ]);

  return NextResponse.json({ success: true });
}
