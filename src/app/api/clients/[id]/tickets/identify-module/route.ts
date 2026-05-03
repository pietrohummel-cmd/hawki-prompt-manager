import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { MODULE_LABELS, MODULE_ORDER } from "@/lib/prompt-constants";
import { logUsage } from "@/lib/usage-logger";
import type { ModuleKey } from "@/generated/prisma";

const anthropic = new Anthropic({ apiKey: process.env.HAWKI_ANTHROPIC_API_KEY });

const schema = z.object({
  description: z.string().min(1),
  transcript: z.string().optional(),
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

  const { description, transcript } = parsed.data;

  // Busca o prompt ativo para contexto
  const activeVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id, isActive: true },
    include: { modules: true },
    orderBy: { version: "desc" },
  });

  const moduleList = MODULE_ORDER.map(
    (key) => `- ${key}: ${MODULE_LABELS[key as ModuleKey]}`
  ).join("\n");

  const activeModulesContext = activeVersion
    ? `\nMÓDULOS ATIVOS NO PROMPT (v${activeVersion.version}):\n` +
      MODULE_ORDER
        .filter((key) => activeVersion.modules.some((m) => m.moduleKey === key))
        .map((key) => {
          const mod = activeVersion.modules.find((m) => m.moduleKey === key)!;
          return `### ${key} — ${MODULE_LABELS[key as ModuleKey]}\n${mod.content.slice(0, 300)}${mod.content.length > 300 ? "..." : ""}`;
        })
        .join("\n\n")
    : "";

  const prompt = `Você é um especialista em prompts de IA para clínicas odontológicas.

Dado um problema reportado em um prompt de assistente, identifique qual dos 18 módulos é o mais afetado.

MÓDULOS DISPONÍVEIS:
${moduleList}
${activeModulesContext}

PROBLEMA REPORTADO:
${description}
${transcript ? `\nTRANSCRIÇÃO DA CONVERSA:\n${transcript}` : ""}

Responda SOMENTE em JSON válido:
{
  "moduleKey": "KEY_DO_MÓDULO",
  "reasoning": "explicação curta (1-2 frases) de por que este módulo é o mais relevante"
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({ clientId: id, operation: "identify_module", model: "claude-haiku-4-5-20251001", usage: message.usage });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  try {
    const result = JSON.parse(text);
    const moduleKey = result.moduleKey as ModuleKey;
    if (!MODULE_ORDER.includes(moduleKey)) {
      return NextResponse.json({ error: "Módulo inválido retornado pela IA" }, { status: 500 });
    }
    return NextResponse.json({ moduleKey, reasoning: result.reasoning ?? "" });
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const result = JSON.parse(match[0]);
        const moduleKey = result.moduleKey as ModuleKey;
        if (MODULE_ORDER.includes(moduleKey)) {
          return NextResponse.json({ moduleKey, reasoning: result.reasoning ?? "" });
        }
      } catch { /* fallthrough */ }
    }
    return NextResponse.json({ error: "Não foi possível identificar o módulo" }, { status: 500 });
  }
}
