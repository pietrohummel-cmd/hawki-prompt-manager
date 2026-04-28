import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { SOFIA_GUIDELINES_FULL } from "@/lib/sofia-guidelines";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const createSchema = z.object({
  humanConversation: z.string().min(1),
  sofiaConversation: z.string().min(1),
});

const CALIBRATION_AXES = [
  "Tom e naturalidade",
  "Acolhimento emocional",
  "Qualificação (SPIN)",
  "Condução para agendamento",
  "Confirmação final",
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const calibrations = await prisma.calibration.findMany({
    where: { clientId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(calibrations);
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

  const { humanConversation, sofiaConversation } = parsed.data;

  // Busca o prompt ativo para incluir no contexto da análise
  const activeVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id, isActive: true },
    include: { modules: true },
    orderBy: { version: "desc" },
  });

  const activePromptContext = activeVersion
    ? `\nPROMPT ATIVO (v${activeVersion.version}):\n` +
      MODULE_ORDER
        .filter((key) => activeVersion.modules.some((m) => m.moduleKey === key))
        .map((key) => {
          const mod = activeVersion.modules.find((m) => m.moduleKey === (key as ModuleKey))!;
          return `###MÓDULO:${mod.moduleKey}###\n${mod.content}`;
        })
        .join("\n\n")
    : "";

  const prompt = `Você é um especialista em treinamento de assistentes de IA para clínicas odontológicas.

${SOFIA_GUIDELINES_FULL}

---

Analise as duas conversas abaixo e retorne um JSON com:
1. "gaps": gaps nos eixos de comparação Sofia vs Humano
2. "violations": violações das boas práticas identificadas NA CONVERSA DA SOFIA

EIXOS DE COMPARAÇÃO:
${CALIBRATION_AXES.map((a, i) => `${i + 1}. ${a}`).join("\n")}
${activePromptContext}

CONVERSA DO ATENDENTE HUMANO:
${humanConversation}

CONVERSA DA SOFIA (IA):
${sofiaConversation}

Responda SOMENTE em JSON válido, sem markdown:
{
  "gaps": [
    {
      "axis": "nome do eixo",
      "description": "descrição do gap — o que o humano fez que a Sofia não fez",
      "promptSuggestion": "sugestão concreta e específica de como melhorar o prompt para corrigir este gap",
      "affectedModule": "ModuleKey mais relevante (ex: COMMUNICATION_STYLE, QUALIFICATION, ACTIVE_LISTENING)"
    }
  ],
  "violations": [
    {
      "rule": "descrição da boa prática violada",
      "evidence": "trecho ou comportamento da Sofia que evidencia a violação",
      "severity": "error | warning | info"
    }
  ]
}

Se não houver gap em um eixo, não inclua. Se não houver violações, retorne "violations": [].`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  let gaps: { axis: string; description: string; promptSuggestion: string; affectedModule?: string }[] = [];
  let violations: { rule: string; evidence: string; severity: string }[] = [];

  try {
    const parsed = JSON.parse(text.trim());
    gaps = parsed.gaps ?? [];
    violations = parsed.violations ?? [];
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        gaps = parsed.gaps ?? [];
        violations = parsed.violations ?? [];
      } catch { /* mantém vazios */ }
    }
  }

  const calibration = await prisma.calibration.create({
    data: {
      clientId: id,
      humanConversation,
      sofiaConversation,
      gaps: { gaps, violations } as object,
    },
  });

  return NextResponse.json(calibration, { status: 201 });
}
