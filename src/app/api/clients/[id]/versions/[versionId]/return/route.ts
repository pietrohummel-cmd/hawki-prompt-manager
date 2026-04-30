import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runCorrectionPipeline } from "@/lib/correction-pipeline";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";

const schema = z.object({
  feedback: z.string().min(10, "Descreva o problema para o pipeline corrigir"),
});

/**
 * POST /api/clients/[id]/versions/[versionId]/return
 * Rejeita uma versão PENDING_REVIEW e dispara o pipeline novamente com feedback adicional.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionId } = await params;

  const version = await prisma.promptVersion.findFirst({
    where: { id: versionId, clientId: id, status: "PENDING_REVIEW" },
    include: { modules: true },
  });

  if (!version) {
    return NextResponse.json({ error: "Versão não encontrada ou não está em PENDING_REVIEW" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { feedback } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  // Reconstrói o mapa de módulos da versão rejeitada
  const modules: Partial<Record<ModuleKey, string>> = {};
  for (const mod of version.modules) {
    if (MODULE_ORDER.includes(mod.moduleKey as ModuleKey)) {
      modules[mod.moduleKey as ModuleKey] = mod.content;
    }
  }

  const combinedDescription = version.problemDescription
    ? `${version.problemDescription}\n\nFeedback adicional: ${feedback}`
    : feedback;

  // Roda o pipeline ANTES de arquivar — se falhar, o draft original é preservado
  const result = await runCorrectionPipeline(client, modules, combinedDescription);

  // Só arquiva a versão rejeitada após o substituto ter sido criado com sucesso
  await prisma.promptVersion.update({
    where: { id: versionId },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json({
    versionId: result.versionId,
    issueCount: result.issueCount,
    regressionTotal: result.regressionTotal,
    regressionPassed: result.regressionPassed,
  });
}
