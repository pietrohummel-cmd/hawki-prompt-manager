import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createTicketSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  conversationTranscript: z.string().optional(),
  affectedModule: z
    .enum([
      "IDENTITY", "ABSOLUTE_RULES", "INJECTION_PROTECTION", "CONVERSATION_STATE",
      "CONVERSATION_RESUME", "PRESENTATION", "COMMUNICATION_STYLE", "HUMAN_BEHAVIOR",
      "ACTIVE_LISTENING", "ATTENDANCE_STAGES", "QUALIFICATION", "SLOT_OFFER",
      "COMMITMENT_CONFIRMATION", "OPENING", "FINAL_OBJECTIVE", "AUDIO_RULES",
      "STATUS_RULES", "HANDOFF",
    ] as const)
    .optional(),
  priority: z.enum(["CRITICAL", "NORMAL", "IMPROVEMENT"]).default("NORMAL"),
});

/**
 * GET /api/clients/[id]/tickets
 * Lista todos os tickets de correção de um cliente.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const tickets = await prisma.correctionTicket.findMany({
    where: { clientId: id },
    orderBy: { createdAt: "desc" },
    include: {
      promptVersion: { select: { version: true } },
    },
  });

  return NextResponse.json(tickets);
}

/**
 * POST /api/clients/[id]/tickets
 * Cria um novo ticket de correção vinculado à versão ativa atual.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = createTicketSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  // Pega a versão ativa para vincular o ticket
  const activeVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id, isActive: true },
    orderBy: { version: "desc" },
  });

  if (!activeVersion) {
    return NextResponse.json({ error: "Nenhuma versão ativa encontrada. Gere um prompt primeiro." }, { status: 400 });
  }

  const ticket = await prisma.correctionTicket.create({
    data: {
      clientId: id,
      promptVersionId: activeVersion.id,
      description: parsed.data.description,
      conversationTranscript: parsed.data.conversationTranscript,
      affectedModule: parsed.data.affectedModule,
      priority: parsed.data.priority,
    },
    include: { promptVersion: { select: { version: true } } },
  });

  return NextResponse.json(ticket, { status: 201 });
}
