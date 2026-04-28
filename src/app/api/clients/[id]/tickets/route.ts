import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";

const createTicketSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  conversationTranscript: z.string().optional().nullable(),
  affectedModule: z
    .enum(MODULE_ORDER as [string, ...string[]])
    .optional()
    .nullable(),
  aiSuggestion: z.string().optional().nullable(),
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
      conversationTranscript: parsed.data.conversationTranscript ?? null,
      affectedModule: (parsed.data.affectedModule ?? null) as import("@/generated/prisma").ModuleKey | null,
      aiSuggestion: parsed.data.aiSuggestion ?? null,
      // Se já vem com sugestão da IA (ex: criado via calibração), vai direto para SUGGESTED
      status: parsed.data.aiSuggestion ? "SUGGESTED" : "OPEN",
      priority: parsed.data.priority,
    },
    include: { promptVersion: { select: { version: true } } },
  });

  return NextResponse.json(ticket, { status: 201 });
}
