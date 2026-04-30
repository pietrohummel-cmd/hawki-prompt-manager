import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import { restructurePromptToModules } from "@/lib/generate-prompt";
import { runCorrectionPipeline } from "@/lib/correction-pipeline";
import type { ModuleKey } from "@/generated/prisma";

const schema = z.object({
  rawText: z.string().min(10, "Cole o conteúdo do prompt"),
  changesSummary: z.string().optional(),
  problemDescription: z.string().optional(),
});

function parseModules(text: string): Partial<Record<ModuleKey, string>> {
  const result: Partial<Record<ModuleKey, string>> = {};
  const regex = /###MÓDULO:(\w+)###([\s\S]*?)(?=###MÓDULO:|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1] as ModuleKey;
    const content = match[2].trim();
    if (MODULE_ORDER.includes(key) && content) {
      result[key] = content;
    }
  }
  return result;
}

/**
 * POST /api/clients/[id]/import-prompt
 * Importa um prompt existente colado como texto puro.
 * Suporta o formato ###MÓDULO:KEY### para extração modular.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const { rawText, changesSummary, problemDescription } = parsed.data;
  let modules = parseModules(rawText);
  let foundKeys = Object.keys(modules) as ModuleKey[];
  let usedAI = false;

  // Se menos de 6 módulos foram detectados, o formato é diferente do padrão ###MÓDULO:KEY###.
  // Usa IA (Sonnet) para reorganizar o prompt no formato correto automaticamente.
  if (foundKeys.length < 6) {
    try {
      modules = await restructurePromptToModules(rawText);
      foundKeys = Object.keys(modules) as ModuleKey[];
      usedAI = true;
    } catch (err) {
      console.error("[import-prompt] Erro ao reorganizar com IA:", err);
      return NextResponse.json(
        { error: "Não foi possível interpretar o prompt. Tente novamente ou use o formato ###MÓDULO:KEY###." },
        { status: 422 }
      );
    }
  }

  if (foundKeys.length === 0) {
    return NextResponse.json(
      { error: "Nenhum módulo foi identificado no texto colado." },
      { status: 422 }
    );
  }

  // Se o operador descreveu um problema, dispara o pipeline automático de correção.
  // O pipeline cria uma versão PENDING_REVIEW com correções + tickets + regressão.
  if (problemDescription?.trim()) {
    const result = await runCorrectionPipeline(client, modules, problemDescription.trim());

    await prisma.client.update({ where: { id }, data: { status: "ACTIVE" } });

    return NextResponse.json({
      pipeline: true,
      versionId: result.versionId,
      issueCount: result.issueCount,
      regressionTotal: result.regressionTotal,
      regressionPassed: result.regressionPassed,
      modulesFound: foundKeys.length,
      usedAI,
    });
  }

  // Sem descrição de problema: importação direta como versão ACTIVE.
  const lastVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id },
    orderBy: { version: "desc" },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  const fullPrompt = MODULE_ORDER
    .filter((key) => modules[key])
    .map((key) => `###MÓDULO:${key}###\n${modules[key]}`)
    .join("\n\n");

  await prisma.promptVersion.updateMany({
    where: { clientId: id, isActive: true },
    data: { isActive: false },
  });

  const version = await prisma.promptVersion.create({
    data: {
      clientId: id,
      version: nextVersion,
      systemPrompt: fullPrompt,
      isActive: true,
      generatedBy: "MANUAL",
      changesSummary: changesSummary ?? (usedAI
        ? `Importado e reorganizado por IA (${foundKeys.length} módulos extraídos)`
        : `Importado manualmente (${foundKeys.length} módulos)`),
      modules: {
        create: MODULE_ORDER
          .filter((key) => modules[key])
          .map((key) => ({ moduleKey: key, content: modules[key]! })),
      },
    },
    include: { modules: true },
  });

  await prisma.client.update({ where: { id }, data: { status: "ACTIVE" } });

  return NextResponse.json({ pipeline: false, version, modulesFound: foundKeys.length, usedAI });
}
