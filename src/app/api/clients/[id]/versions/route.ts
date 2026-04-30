import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/clients/[id]/versions
 * Lista todas as versões de prompt de um cliente, da mais recente para a mais antiga.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const versions = await prisma.promptVersion.findMany({
    where: { clientId: id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      isActive: true,
      status: true,
      generatedBy: true,
      changesSummary: true,
      problemDescription: true,
      systemPrompt: true,
      createdAt: true,
      _count: { select: { modules: true } },
      modules: {
        select: { moduleKey: true, content: true },
        orderBy: { moduleKey: "asc" },
      },
    },
  });

  return NextResponse.json(versions);
}
