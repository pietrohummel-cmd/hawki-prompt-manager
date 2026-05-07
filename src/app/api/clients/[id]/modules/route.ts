import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import { applySofiaQualityContract, auditSofiaQualityContract, buildSystemPromptFromModules } from "@/lib/prompt-quality-contract";
import type { ModuleKey } from "@/generated/prisma";

const schema = z.object({
  moduleKey: z.enum(MODULE_ORDER as [string, ...string[]]),
  content: z.string().min(1, "Conteúdo não pode ser vazio"),
  changesSummary: z.string().optional(),
  savedBy: z.string().optional(),
});

/**
 * POST /api/clients/[id]/modules
 * Salva edição de um módulo criando uma nova PromptVersion imutável.
 * Copia todos os módulos da versão ativa e substitui apenas o módulo editado.
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

  const { moduleKey, content, changesSummary, savedBy } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  // Busca a versão ativa com todos os módulos
  const activeVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id, isActive: true },
    include: { modules: true },
    orderBy: { version: "desc" },
  });

  if (!activeVersion) {
    return NextResponse.json({ error: "Nenhuma versão ativa encontrada" }, { status: 404 });
  }

  // Descobre o próximo número de versão
  const lastVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id },
    orderBy: { version: "desc" },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  // Monta os novos módulos: copia todos, substitui o editado
  const moduleMap = Object.fromEntries(
    activeVersion.modules.map((m) => [
      m.moduleKey as ModuleKey,
      m.moduleKey === moduleKey ? content : m.content,
    ])
  ) as Partial<Record<ModuleKey, string>>;
  const contractedModules = applySofiaQualityContract(client, moduleMap);
  const qualityIssues = auditSofiaQualityContract(contractedModules);
  if (qualityIssues.length > 0) {
    return NextResponse.json(
      { error: "Prompt não passou no contrato de qualidade", qualityIssues },
      { status: 422 }
    );
  }

  const newModules = MODULE_ORDER
    .filter((key) => contractedModules[key])
    .map((key) => ({
      moduleKey: key as ModuleKey,
      content: contractedModules[key as ModuleKey]!,
    }));

  // Reconstrói o systemPrompt concatenado
  const fullPrompt = buildSystemPromptFromModules(contractedModules);

  // Transação: desativa versão anterior + cria nova
  const [, newPromptVersion] = await prisma.$transaction([
    prisma.promptVersion.update({
      where: { id: activeVersion.id },
      data: { isActive: false },
    }),
    prisma.promptVersion.create({
      data: {
        clientId: id,
        version: nextVersion,
        systemPrompt: fullPrompt,
        isActive: true,
        generatedBy: "MANUAL",
        changesSummary: changesSummary ?? `Módulo editado: ${moduleKey}`,
        savedBy: savedBy ?? userId,
        modules: {
          create: newModules,
        },
      },
      include: { modules: true },
    }),
  ]);

  return NextResponse.json(newPromptVersion);
}
