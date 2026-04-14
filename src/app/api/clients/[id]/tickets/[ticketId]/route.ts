import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  status: z.enum(["OPEN", "SUGGESTED", "APPROVED", "APPLIED", "REJECTED"]).optional(),
  finalCorrection: z.string().optional(),
  aiSuggestion: z.string().optional(),
});

/**
 * PATCH /api/clients/[id]/tickets/[ticketId]
 * Atualiza status, sugestão ou correção final de um ticket.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ticketId } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const ticket = await prisma.correctionTicket.findFirst({
    where: { id: ticketId, clientId: id },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });

  const updated = await prisma.correctionTicket.update({
    where: { id: ticketId },
    data: {
      ...parsed.data,
      resolvedAt:
        parsed.data.status === "APPLIED" || parsed.data.status === "REJECTED"
          ? new Date()
          : undefined,
    },
    include: { promptVersion: { select: { version: true } } },
  });

  return NextResponse.json(updated);
}
