import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma";
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

  // activeVersion, newModules e fullPrompt são lidos DENTRO do loop para que cada
  // tentativa parta do baseline mais recente. Sem isso, um retry após P2002 criaria
  // uma nova versão a partir de conteúdo stale, descartando silenciosamente correções
  // de outros applies concorrentes que já foram aceitos.
  let newVersion: { id: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Lê versão ativa e monta módulos a cada tentativa — garante baseline fresco
      const activeVersion = await prisma.promptVersion.findFirst({
        where: { clientId: id, isActive: true },
        include: { modules: true },
      });

      if (!activeVersion) {
        return NextResponse.json({ error: "Nenhuma versão ativa encontrada" }, { status: 404 });
      }

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

      const lastVersion = await prisma.promptVersion.findFirst({
        where: { clientId: id },
        orderBy: { version: "desc" },
      });
      const nextVersion = (lastVersion?.version ?? 0) + 1;

      const [, created] = await prisma.$transaction([
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
      newVersion = created;
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 4) {
        continue;
      }
      throw e;
    }
  }
  if (!newVersion) throw new Error("Falha ao alocar versão após 5 tentativas");

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
