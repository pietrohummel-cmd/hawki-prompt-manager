import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";

const SIMULATION_MODEL = process.env.HAWKI_SIMULATION_MODEL ?? process.env.SOFIA_RUNTIME_MODEL ?? "gpt-4o-mini";

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

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
  const modulesPrompt = MODULE_ORDER
    .filter((key) => activeVersion.modules.some((m) => m.moduleKey === key))
    .map((key) => {
      const mod = activeVersion.modules.find((m) => m.moduleKey === (key as ModuleKey))!;
      return `###MÓDULO:${mod.moduleKey}###\n${mod.content}`;
    })
    .join("\n\n");

  const systemPrompt = activeVersion.ragDocument
    ? `${modulesPrompt}\n\n###BASE_DE_CONHECIMENTO_ATIVA###\n${activeVersion.ragDocument}\n\nREGRA DE USO DA BASE: Para campanhas, valores, condições comerciais, pagamentos, parcelamentos, convênios, procedimentos ou detalhes específicos da clínica, use somente dados da BASE_DE_CONHECIMENTO_ATIVA. Se o dado não estiver nela nem no prompt, diga que vai verificar a condição certinha para o paciente.`
    : modulesPrompt;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
    { role: "user", content: message },
  ];

  // Streaming via ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const response = await getOpenAI().chat.completions.create({
          model: SIMULATION_MODEL,
          max_tokens: 1024,
          temperature: 0.2,
          messages,
          stream: true,
        });

        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) controller.enqueue(encoder.encode(text));
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
