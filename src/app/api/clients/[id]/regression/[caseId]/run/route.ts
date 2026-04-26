import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, caseId } = await params;

  const [activeVersion, regressionCase] = await Promise.all([
    prisma.promptVersion.findFirst({
      where: { clientId: id, isActive: true },
      include: { modules: true },
      orderBy: { version: "desc" },
    }),
    prisma.regressionCase.findUnique({ where: { id: caseId } }),
  ]);

  if (!activeVersion) {
    return NextResponse.json({ error: "Nenhuma versão ativa encontrada" }, { status: 404 });
  }
  if (!regressionCase) {
    return NextResponse.json({ error: "Caso de teste não encontrado" }, { status: 404 });
  }

  const systemPrompt = MODULE_ORDER
    .filter((key) => activeVersion.modules.some((m) => m.moduleKey === key))
    .map((key) => {
      const mod = activeVersion.modules.find((m) => m.moduleKey === (key as ModuleKey))!;
      return `###MÓDULO:${mod.moduleKey}###\n${mod.content}`;
    })
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: regressionCase.input }],
  });

  const responseText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Inicializa todos os critérios como não avaliados
  const results = regressionCase.criteria.map((criterion) => ({
    criterion,
    passed: null,
  }));

  const run = await prisma.regressionRun.create({
    data: {
      caseId,
      response: responseText,
      results,
      status: "PENDING",
    },
  });

  return NextResponse.json(run, { status: 201 });
}
