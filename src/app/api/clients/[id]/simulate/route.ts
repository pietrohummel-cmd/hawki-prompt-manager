import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";

const anthropic = new Anthropic({ apiKey: process.env.HAWKI_ANTHROPIC_API_KEY });

const schema = z.object({
  message: z.string().min(1),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).default([]),
});

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
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { message, history } = parsed.data;

  const activeVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id, isActive: true },
    include: { modules: true },
    orderBy: { version: "desc" },
  });

  if (!activeVersion) {
    return NextResponse.json({ error: "Nenhuma versão ativa encontrada. Gere o prompt primeiro." }, { status: 404 });
  }

  // Reconstrói o system prompt na ordem canônica
  const systemPrompt = MODULE_ORDER
    .filter((key) => activeVersion.modules.some((m) => m.moduleKey === key))
    .map((key) => {
      const mod = activeVersion.modules.find((m) => m.moduleKey === (key as ModuleKey))!;
      return `###MÓDULO:${mod.moduleKey}###\n${mod.content}`;
    })
    .join("\n\n");

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content }) as Anthropic.MessageParam),
    { role: "user", content: message },
  ];

  // Streaming via ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const response = await anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });

        for await (const chunk of response) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro na simulação";
        controller.enqueue(encoder.encode(`\n\n[ERRO: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Prompt-Version": String(activeVersion.version),
    },
  });
}
