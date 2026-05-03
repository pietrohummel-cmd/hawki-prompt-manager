import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runCorrectionPipeline } from "@/lib/correction-pipeline";
import { evaluateRegressionCase } from "@/lib/regression-runner";
import type { ModuleKey } from "@/generated/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId, caseId } = await params;

  // Load the regression case
  const regressionCase = await prisma.regressionCase.findUnique({
    where: { id: caseId },
    include: { runs: { orderBy: { runAt: "desc" }, take: 1 } },
  });

  if (!regressionCase || regressionCase.clientId !== clientId) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const lastRun = regressionCase.runs[0];
  if (!lastRun) {
    return NextResponse.json({ error: "Rode o caso primeiro para ter um resultado" }, { status: 400 });
  }
  if (lastRun.status === "PASSED") {
    return NextResponse.json({ error: "Este caso já está passando" }, { status: 400 });
  }

  // Load the active prompt version for this client
  const activeVersion = await prisma.promptVersion.findFirst({
    where: { clientId, isActive: true },
    include: { modules: true },
  });

  if (!activeVersion) {
    return NextResponse.json({ error: "Nenhuma versão ativa encontrada" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  // Build the problem description from the failing run
  const results = lastRun.results as { criterion: string; passed: boolean | null }[];
  const failedCriteria = results.filter((r) => r.passed === false).map((r) => r.criterion);

  const problemLines = [
    `Caso de teste: "${regressionCase.name}"`,
    ``,
    `Mensagem enviada pelo paciente:`,
    regressionCase.input,
    ``,
    `Resposta gerada pela Sofia:`,
    lastRun.response,
  ];

  if (regressionCase.expectedResponse) {
    problemLines.push(``, `Resposta ideal esperada:`, regressionCase.expectedResponse);
  }

  problemLines.push(
    ``,
    `Critérios que FALHARAM (${failedCriteria.length} de ${results.length}):`,
    ...failedCriteria.map((c, i) => `${i + 1}. ${c}`)
  );

  const problemDescription = problemLines.join("\n");

  // Build modules map from the active version
  const modules: Partial<Record<ModuleKey, string>> = {};
  for (const mod of activeVersion.modules) {
    modules[mod.moduleKey] = mod.content;
  }

  // Run correction pipeline
  const pipelineResult = await runCorrectionPipeline(client, modules, problemDescription);

  // Re-run the regression case against the new draft to show improvement
  const draftVersion = await prisma.promptVersion.findUnique({
    where: { id: pipelineResult.versionId },
    include: { modules: true },
  });

  let caseRerun: { status: string; results: { criterion: string; passed: boolean | null }[] } | null = null;

  // evaluateRegressionCase: preview sem persistência — não polui o histórico canônico
  if (draftVersion) {
    try {
      const rerun = await evaluateRegressionCase(regressionCase, draftVersion);
      caseRerun = {
        status: rerun.status,
        results: rerun.results,
      };
    } catch (err) {
      console.warn("[fix] Rerun after fix failed:", err);
    }
  }

  return NextResponse.json({
    versionId: pipelineResult.versionId,
    issueCount: pipelineResult.issueCount,
    regressionTotal: pipelineResult.regressionTotal,
    regressionPassed: pipelineResult.regressionPassed,
    caseRerun,
  });
}
