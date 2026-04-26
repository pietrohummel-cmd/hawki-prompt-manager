import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

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

  const prompt = `Você é um especialista em treinamento de assistentes de IA para clínicas odontológicas.

Analise as duas conversas abaixo e identifique os gaps nos seguintes eixos:
${CALIBRATION_AXES.map((a, i) => `${i + 1}. ${a}`).join("\n")}

CONVERSA DO ATENDENTE HUMANO:
${humanConversation}

CONVERSA DA SOFIA (IA):
${sofiaConversation}

Responda SOMENTE em JSON válido, neste formato exato (sem markdown, sem explicações fora do JSON):
{
  "gaps": [
    {
      "axis": "nome do eixo",
      "description": "descrição do gap identificado",
      "promptSuggestion": "sugestão concreta de como melhorar o prompt para corrigir este gap"
    }
  ]
}

Se não houver gap em um eixo, não inclua esse eixo no array.
Seja específico e prático nas sugestões de prompt.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  let gaps: { axis: string; description: string; promptSuggestion: string }[] = [];
  try {
    const parsed = JSON.parse(text.trim());
    gaps = parsed.gaps ?? [];
  } catch {
    // Tenta extrair JSON do texto caso haja ruído
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { gaps = JSON.parse(match[0]).gaps ?? []; } catch { gaps = []; }
    }
  }

  const calibration = await prisma.calibration.create({
    data: {
      clientId: id,
      humanConversation,
      sofiaConversation,
      gaps,
    },
  });

  return NextResponse.json(calibration, { status: 201 });
}
