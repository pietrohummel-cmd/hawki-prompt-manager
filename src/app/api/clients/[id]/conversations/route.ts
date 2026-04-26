import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  content: z.string().min(1, "Conteúdo da conversa não pode ser vazio"),
  outcome: z.enum(["SCHEDULED", "NOT_SCHEDULED", "LOST"]).optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [client, conversations] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      select: { minConversationsPerVersion: true },
    }),
    prisma.conversationSample.findMany({
      where: { clientId: id },
      include: { promptVersion: { select: { version: true, isActive: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  return NextResponse.json({ conversations, minConversationsPerVersion: client.minConversationsPerVersion });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const activeVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id, isActive: true },
    orderBy: { version: "desc" },
  });

  if (!activeVersion) {
    return NextResponse.json({ error: "Nenhuma versão ativa. Gere o prompt primeiro." }, { status: 400 });
  }

  const conversation = await prisma.conversationSample.create({
    data: {
      clientId: id,
      promptVersionId: activeVersion.id,
      ...parsed.data,
    },
    include: { promptVersion: { select: { version: true, isActive: true } } },
  });

  return NextResponse.json(conversation, { status: 201 });
}
