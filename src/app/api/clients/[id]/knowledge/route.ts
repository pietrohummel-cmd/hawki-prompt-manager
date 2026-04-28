import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateClientKB, KB_TOPICS } from "@/lib/generate-kb";

/**
 * GET /api/clients/[id]/knowledge
 * Lista todos os artigos de KB do cliente, na ordem canônica dos tópicos.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const articles = await prisma.clientKnowledgeArticle.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "asc" },
    });

    const ordered = KB_TOPICS.map((t) =>
      articles.find((a) => a.topic === t.key) ?? null
    );

    return NextResponse.json(ordered);
  } catch (err) {
    console.error("[GET knowledge]", err);
    return NextResponse.json({ error: "Erro ao carregar artigos", detail: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/clients/[id]/knowledge/generate
 * Gera (ou regenera) todos os 8 artigos de KB usando IA.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  try {
    const articles = await generateClientKB(client);

    // Upsert todos os artigos (cria se não existe, atualiza se existe)
    const upserted = await Promise.all(
      articles.map((article) =>
        prisma.clientKnowledgeArticle.upsert({
          where: { clientId_topic: { clientId: id, topic: article.topic } },
          create: {
            clientId: id,
            topic: article.topic,
            title: article.title,
            content: article.content,
            isActive: true,
          },
          update: {
            title: article.title,
            content: article.content,
            isActive: true,
          },
        })
      )
    );

    return NextResponse.json(upserted, { status: 201 });
  } catch (err) {
    console.error("[POST knowledge]", err);
    return NextResponse.json({ error: "Erro ao gerar KB", detail: String(err) }, { status: 500 });
  }
}
