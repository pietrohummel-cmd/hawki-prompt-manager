import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runRegressionCase } from "@/lib/regression-runner";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [activeVersion, regressionCases] = await Promise.all([
    prisma.promptVersion.findFirst({
      where: { clientId: id, isActive: true },
      include: { modules: true },
      orderBy: { version: "desc" },
    }),
    prisma.regressionCase.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!activeVersion) {
    return NextResponse.json({ error: "Nenhuma versão ativa encontrada" }, { status: 404 });
  }

  if (regressionCases.length === 0) {
    return NextResponse.json({ total: 0, passed: 0, failed: 0, cases: [] });
  }

  const caseResults: { id: string; name: string; status: string; results: { criterion: string; passed: boolean }[] }[] = [];

  for (const regressionCase of regressionCases) {
    try {
      const run = await runRegressionCase(regressionCase, activeVersion);
      const results = run.results as { criterion: string; passed: boolean }[];
      caseResults.push({ id: regressionCase.id, name: regressionCase.name, status: run.status, results });
    } catch (err) {
      console.error(`[run-all] case ${regressionCase.id} failed:`, err);
      caseResults.push({ id: regressionCase.id, name: regressionCase.name, status: "FAILED", results: [] });
    }
  }

  const passed = caseResults.filter((c) => c.status === "PASSED").length;
  const failed = caseResults.length - passed;

  return NextResponse.json({ total: caseResults.length, passed, failed, cases: caseResults });
}
