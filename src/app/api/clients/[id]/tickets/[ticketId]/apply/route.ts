import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";

const schema = z.object({
  finalCorrection: z.string().min(1, "Conteúdo da correção é obrigatório"),
});

/**
 * POST /api/clients/[id]/tickets/[ticketId]/apply
 * Aplica a correção do ticket: cria nova versão com o módulo corrigido e marca o ticket como APPLIED.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ticketId } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { finalCorrection } = parsed.data;

  const ticket = await prisma.correctionTicket.findFirst({
    where: { id: ticketId, clientId: id },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  if (!ticket.affectedModule) {
    return NextResponse.json({ error: "Módulo afetado não definido no ticket" }, { status: 400 });
  }

  // Busca a versão ativa com todos os módulos
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

  // Monta os novos módulos: copia todos, substitui o afetado
  const newModules = activeVersion.modules.map((m) => ({
    moduleKey: m.moduleKey as ModuleKey,
    content: m.moduleKey === ticket.affectedModule ? finalCorrection : m.content,
  }));

  const fullPrompt = MODULE_ORDER
    .filter((key) => newModules.some((m) => m.moduleKey === key))
    .map((key) => {
      const m = newModules.find((m) => m.moduleKey === key)!;
      return `###MÓDULO:${m.moduleKey}###\n${m.content}`;
    })
    .join("\n\n");

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
        changesSummary: `Correção aplicada via ticket: ${ticket.description.slice(0, 60)}`,
        modules: { create: newModules },
      },
    }),
  ]);

  await prisma.correctionTicket.update({
    where: { id: ticketId },
    data: {
      status: "APPLIED",
      finalCorrection,
      resolvedInVersionId: newVersion.id,
      resolvedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, newVersionId: newVersion.id });
}
