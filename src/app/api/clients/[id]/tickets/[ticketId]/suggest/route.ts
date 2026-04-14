import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestTicketCorrection } from "@/lib/module-editor";

/**
 * POST /api/clients/[id]/tickets/[ticketId]/suggest
 * Gera uma sugestão de correção via IA para o módulo afetado pelo ticket.
 * Salva a sugestão no ticket e muda o status para SUGGESTED.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ticketId } = await params;

  const ticket = await prisma.correctionTicket.findFirst({
    where: { id: ticketId, clientId: id },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  if (!ticket.affectedModule) {
    return NextResponse.json({ error: "Defina o módulo afetado antes de gerar sugestão" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  // Busca o conteúdo atual do módulo afetado na versão ativa
  const activeVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id, isActive: true },
    include: { modules: { where: { moduleKey: ticket.affectedModule } } },
  });

  const currentContent = activeVersion?.modules[0]?.content ?? "";

  try {
    const suggestion = await suggestTicketCorrection(
      client,
      ticket.affectedModule,
      currentContent,
      ticket.description,
      ticket.conversationTranscript
    );

    const updated = await prisma.correctionTicket.update({
      where: { id: ticketId },
      data: { aiSuggestion: suggestion, status: "SUGGESTED" },
      include: { promptVersion: { select: { version: true } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[POST tickets/suggest]", err);
    return NextResponse.json({ error: "Erro ao gerar sugestão", detail: String(err) }, { status: 500 });
  }
}
