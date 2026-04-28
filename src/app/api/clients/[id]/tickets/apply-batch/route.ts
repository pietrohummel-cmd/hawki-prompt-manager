import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";

/**
 * POST /api/clients/[id]/tickets/apply-batch
 * Aplica todos os tickets SUGGESTED com affectedModule + aiSuggestion de uma vez.
 * Cria 1 nova PromptVersion com todos os módulos corrigidos e marca os tickets como APPLIED.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Busca tickets elegíveis: SUGGESTED + módulo definido + sugestão preenchida
  const tickets = await prisma.correctionTicket.findMany({
    where: {
      clientId: id,
      status: { in: ["OPEN", "SUGGESTED"] },
      affectedModule: { not: null },
      aiSuggestion: { not: null },
    },
  });

  if (tickets.length === 0) {
    return NextResponse.json({ error: "Nenhum ticket elegível encontrado" }, { status: 400 });
  }

  const activeVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id, isActive: true },
    include: { modules: true },
  });

  if (!activeVersion) {
    return NextResponse.json({ error: "Nenhuma versão ativa encontrada" }, { status: 404 });
  }

  const lastVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id },
    orderBy: { version: "desc" },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  // Aplica cada sugestão no módulo correspondente (último ticket para um mesmo módulo vence)
  const corrections = new Map<ModuleKey, string>();
  for (const t of tickets) {
    corrections.set(t.affectedModule as ModuleKey, t.aiSuggestion!);
  }

  const newModules = activeVersion.modules.map((m) => ({
    moduleKey: m.moduleKey as ModuleKey,
    content: corrections.has(m.moduleKey as ModuleKey)
      ? corrections.get(m.moduleKey as ModuleKey)!
      : m.content,
  }));

  const fullPrompt = MODULE_ORDER
    .filter((key) => newModules.some((m) => m.moduleKey === key))
    .map((key) => {
      const m = newModules.find((m) => m.moduleKey === key)!;
      return `###MÓDULO:${m.moduleKey}###\n${m.content}`;
    })
    .join("\n\n");

  const summary = `Lote: ${tickets.length} ticket${tickets.length !== 1 ? "s" : ""} aplicado${tickets.length !== 1 ? "s" : ""} (${[...corrections.keys()].join(", ")})`;

  const [, newVersion] = await prisma.$transaction([
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
        changesSummary: summary,
        modules: { create: newModules },
      },
    }),
  ]);

  // Marca todos os tickets como APPLIED
  await prisma.correctionTicket.updateMany({
    where: { id: { in: tickets.map((t) => t.id) } },
    data: {
      status: "APPLIED",
      resolvedInVersionId: newVersion.id,
      resolvedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    appliedCount: tickets.length,
    newVersionId: newVersion.id,
    newVersion: nextVersion,
  });
}
