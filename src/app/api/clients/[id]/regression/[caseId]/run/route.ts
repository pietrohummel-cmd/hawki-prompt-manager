import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runRegressionCase } from "@/lib/regression-runner";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, caseId } = await params;

  const [activeVersion, regressionCase] = await Promise.all([
    prisma.promptVersion.findFirst({
      where: { clientId: id, isActive: true },
      include: { modules: true },
      orderBy: { version: "desc" },
    }),
    prisma.regressionCase.findUnique({ where: { id: caseId } }),
  ]);

  if (!activeVersion) {
    return NextResponse.json({ error: "Nenhuma versão ativa encontrada" }, { status: 404 });
  }
  if (!regressionCase) {
    return NextResponse.json({ error: "Caso de teste não encontrado" }, { status: 404 });
  }

  try {
    const run = await runRegressionCase(regressionCase, activeVersion);
    return NextResponse.json(run, { status: 201 });
  } catch (err) {
    console.error("[POST regression run]", err);
    return NextResponse.json({ error: "Erro ao rodar caso", detail: String(err) }, { status: 500 });
  }
}
