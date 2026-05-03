/**
 * POST /api/clients/[id]/tickets/[ticketId]/process
 *
 * Pipeline automático para tickets:
 * 1. Identifica qual módulo é afetado pelo problema (Haiku)
 * 2. Salva o módulo identificado no ticket
 * 3. Gera uma sugestão de correção para esse módulo (Haiku)
 * 4. Salva a sugestão e move o ticket para SUGGESTED
 *
 * Pode ser chamado para qualquer ticket com status OPEN ou SUGGESTED.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { MODULE_LABELS, MODULE_ORDER } from "@/lib/prompt-constants";
import { suggestTicketCorrection } from "@/lib/module-editor";
import { logUsage } from "@/lib/usage-logger";
import type { ModuleKey } from "@/generated/prisma";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.HAWKI_ANTHROPIC_API_KEY });
}

async function identifyModule(
  clientId: string,
  description: string,
  transcript: string | null,
  activeModulesContext: string
): Promise<ModuleKey | null> {
  const moduleList = MODULE_ORDER
    .map((key) => `- ${key}: ${MODULE_LABELS[key as ModuleKey]}`)
    .join("\n");

  const prompt = `Você é um especialista em prompts de IA para clínicas odontológicas.

Dado um problema reportado em um prompt de assistente, identifique qual módulo é o mais afetado.

MÓDULOS DISPONÍVEIS:
${moduleList}
${activeModulesContext}

PROBLEMA REPORTADO:
${description}
${transcript ? `\nTRANSCRIÇÃO DA CONVERSA:\n${transcript}` : ""}

Responda SOMENTE em JSON válido:
{
  "moduleKey": "KEY_DO_MÓDULO",
  "reasoning": "1-2 frases explicando por que este módulo é o mais relevante"
}`;

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({ clientId, operation: "identify_module", model: "claude-haiku-4-5-20251001", usage: message.usage });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  try {
    const raw = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
    const result = JSON.parse(raw);
    const moduleKey = result.moduleKey as ModuleKey;
    return MODULE_ORDER.includes(moduleKey) ? moduleKey : null;
  } catch {
    return null;
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clientId, ticketId } = await params;

  const ticket = await prisma.correctionTicket.findFirst({
    where: { id: ticketId, clientId },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  if (ticket.status === "APPLIED" || ticket.status === "REJECTED") {
    return NextResponse.json({ error: "Ticket já encerrado" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  // Load the current active version — generation and apply must use the same baseline so the
  // suggestion is always patched onto the exact content it was derived from.
  const activeVersion = await prisma.promptVersion.findFirst({
    where: { clientId, isActive: true },
    include: { modules: true },
    orderBy: { version: "desc" },
  });

  if (!activeVersion) {
    return NextResponse.json({ error: "Nenhuma versão ativa encontrada" }, { status: 400 });
  }

  // Build modules context (first 300 chars per module, for identification only)
  const activeModulesContext =
    `\nMÓDULOS ATIVOS NO PROMPT (v${activeVersion.version}):\n` +
    MODULE_ORDER
      .filter((key) => activeVersion.modules.some((m) => m.moduleKey === key))
      .map((key) => {
        const mod = activeVersion.modules.find((m) => m.moduleKey === key)!;
        return `### ${key} — ${MODULE_LABELS[key as ModuleKey]}\n${mod.content.slice(0, 300)}${mod.content.length > 300 ? "..." : ""}`;
      })
      .join("\n\n");

  // Step 1: identify module (use ticket's existing module if already set)
  const identified = ticket.affectedModule
    ?? await identifyModule(clientId, ticket.description, ticket.conversationTranscript, activeModulesContext);

  if (!identified) {
    return NextResponse.json(
      { error: "Não foi possível identificar o módulo automaticamente. Selecione o módulo manualmente e tente novamente." },
      { status: 422 }
    );
  }

  const affectedModule: ModuleKey = identified;

  // Garante que o módulo identificado realmente existe na versão ativa
  const currentContent = activeVersion.modules.find((m) => m.moduleKey === affectedModule)?.content;
  if (!currentContent) {
    return NextResponse.json(
      { error: `Módulo "${affectedModule}" não encontrado na versão ativa. Selecione outro módulo.` },
      { status: 422 }
    );
  }

  // Step 2: generate suggestion
  const suggestion = await suggestTicketCorrection(
    client,
    affectedModule,
    currentContent,
    ticket.description,
    ticket.conversationTranscript
  );

  // Step 3: persist — conditional on ticket still being in a processable state
  // (guards against concurrent apply/reject that happened while LLM was running)
  let updated;
  try {
    updated = await prisma.correctionTicket.update({
      where: { id: ticketId, status: { in: ["OPEN", "SUGGESTED"] } },
      data: {
        affectedModule,
        aiSuggestion: suggestion,
        status: "SUGGESTED",
      },
      include: { promptVersion: { select: { version: true } } },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json(
        { error: "Ticket foi encerrado enquanto a IA processava. Atualize a página." },
        { status: 409 }
      );
    }
    throw e;
  }

  return NextResponse.json(updated);
}
