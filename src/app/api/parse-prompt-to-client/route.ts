/**
 * POST /api/parse-prompt-to-client
 *
 * Recebe um prompt de assistente odontológico em texto livre e usa IA para
 * extrair os campos cadastrais da clínica (nome, telefone, tom, horários, etc.).
 *
 * Uso principal: migração de clientes existentes — cola o prompt atual e
 * preenche o formulário automaticamente em vez de digitar tudo na mão.
 *
 * Retorna: { fields: Partial<ClientFormData>, count: number }
 * - `fields` contém apenas os campos identificados (sem nulos)
 * - `count` é o número de campos extraídos
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { logUsage } from "@/lib/usage-logger";

const bodySchema = z.object({
  rawText: z.string().min(50, "O prompt deve ter pelo menos 50 caracteres"),
});

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.HAWKI_ANTHROPIC_API_KEY });
}

const VALID_TONES       = ["FORMAL", "INFORMAL_MODERATE", "CASUAL"] as const;
const VALID_MODES       = ["DIRECT", "HANDOFF", "LINK"] as const;
const VALID_SYSTEMS     = ["CLINICORP", "CONTROLE_ODONTO", "SIMPLES_DENTAL", "GOOGLE_AGENDA"] as const;
const VALID_CATEGORIES  = [
  "IMPLANTES", "ORTODONTIA", "ESTETICA", "CLINICO_GERAL",
  "PERIODONTIA", "ENDODONTIA", "PEDIATRIA", "PROTESE", "CIRURGIA", "OUTROS",
] as const;

const STRING_FIELDS = [
  "clinicName", "assistantName", "name", "phone", "email",
  "city", "state", "zipCode", "neighborhood", "address", "reference",
  "instagram", "website", "attendantName", "businessHours",
  "specialists", "certifications", "technologies", "differentials", "paymentInfo",
  "targetAudience", "ageRange", "emojiUsage", "treatmentPronoun",
  "restrictions", "mandatoryPhrases", "consultationInfo", "schedulingRequirements",
  "urgencyHandling", "urgencyProcedure", "procedureType", "clinicPositioning",
] as const;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const { rawText } = parsed.data;

  const systemPrompt =
    "Você é um parser especializado em prompts de assistentes para clínicas odontológicas brasileiras. " +
    "Analise o prompt fornecido e extraia os dados cadastrais da clínica. " +
    "Retorne APENAS JSON válido sem markdown, sem explicação, sem texto adicional.";

  const userPrompt = `Extraia os dados cadastrais deste prompt de assistente odontológico.

Retorne APENAS um objeto JSON (sem markdown) com estes campos. Use null para campos não encontrados no prompt.

{
  "clinicName": string | null,
  "assistantName": string | null,
  "name": string | null,
  "phone": string | null,
  "email": string | null,
  "city": string | null,
  "state": string | null,
  "zipCode": string | null,
  "neighborhood": string | null,
  "address": string | null,
  "reference": string | null,
  "instagram": string | null,
  "website": string | null,
  "tone": "FORMAL" | "INFORMAL_MODERATE" | "CASUAL" | null,
  "attendantName": string | null,
  "schedulingMode": "DIRECT" | "HANDOFF" | "LINK" | null,
  "schedulingSystem": "CLINICORP" | "CONTROLE_ODONTO" | "SIMPLES_DENTAL" | "GOOGLE_AGENDA" | null,
  "businessHours": string | null,
  "specialists": string | null,
  "certifications": string | null,
  "technologies": string | null,
  "differentials": string | null,
  "paymentInfo": string | null,
  "targetAudience": string | null,
  "ageRange": string | null,
  "emojiUsage": string | null,
  "treatmentPronoun": string | null,
  "restrictions": string | null,
  "mandatoryPhrases": string | null,
  "consultationInfo": string | null,
  "schedulingRequirements": string | null,
  "urgencyHandling": "Sim" | "Não" | null,
  "urgencyProcedure": string | null,
  "procedureType": string | null,
  "clinicPositioning": string | null,
  "serviceCategories": string[]
}

Regras de mapeamento:
- tone: FORMAL="Olá/Como posso ajudar/linguagem formal", INFORMAL_MODERATE="Oi/Tudo bem/informal moderado", CASUAL="E aí/Opa/gírias"
- schedulingMode: DIRECT=IA agenda no sistema diretamente, HANDOFF=IA passa para humano finalizar, LINK=IA envia link de agendamento
- schedulingSystem: apenas se mencionado explicitamente (Clinicorp, Controle Odonto, Simples Dental, Google Agenda)
- serviceCategories: array com as categorias identificadas — use apenas: IMPLANTES, ORTODONTIA, ESTETICA, CLINICO_GERAL, PERIODONTIA, ENDODONTIA, PEDIATRIA, PROTESE, CIRURGIA, OUTROS

PROMPT A ANALISAR:
---
${rawText}
---`;

  try {
    const message = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    await logUsage({
      operation: "parse_prompt_to_client",
      model: "claude-sonnet-4-6",
      usage: message.usage,
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    // Extrai o objeto JSON localizando o primeiro '{' e o último '}'.
    // Essa estratégia é robusta contra markdown (```json ... ```), texto
    // introdutório ("Aqui está o JSON:") e qualquer outro envoltório que
    // o modelo possa adicionar mesmo com a instrução "sem markdown".
    const firstBrace = raw.indexOf("{");
    const lastBrace  = raw.lastIndexOf("}");
    const jsonText   = firstBrace !== -1 && lastBrace > firstBrace
      ? raw.slice(firstBrace, lastBrace + 1)
      : raw.trim();

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(jsonText);
    } catch {
      console.error("[parse-prompt-to-client] JSON parse error. Raw:", raw.slice(0, 400));
      return NextResponse.json(
        { error: "Não foi possível extrair os dados do prompt. Tente novamente ou preencha o formulário manualmente." },
        { status: 422 }
      );
    }

    // Sanitiza: aceita apenas strings não-nulas para campos textuais
    const fields: Record<string, unknown> = {};

    for (const field of STRING_FIELDS) {
      const val = extracted[field];
      if (typeof val === "string" && val.trim()) {
        fields[field] = val.trim();
      }
    }

    // Valida campos de enum
    const tone = extracted.tone as string;
    if (VALID_TONES.includes(tone as typeof VALID_TONES[number])) {
      fields.tone = tone;
    }

    const schedulingMode = extracted.schedulingMode as string;
    if (VALID_MODES.includes(schedulingMode as typeof VALID_MODES[number])) {
      fields.schedulingMode = schedulingMode;
    }

    const schedulingSystem = extracted.schedulingSystem as string;
    if (VALID_SYSTEMS.includes(schedulingSystem as typeof VALID_SYSTEMS[number])) {
      fields.schedulingSystem = schedulingSystem;
    }

    // serviceCategories: filtra para valores válidos
    if (Array.isArray(extracted.serviceCategories)) {
      const validCats = (extracted.serviceCategories as string[]).filter(
        (c) => VALID_CATEGORIES.includes(c as typeof VALID_CATEGORIES[number])
      );
      if (validCats.length) fields.serviceCategories = validCats;
    }

    return NextResponse.json({ fields, count: Object.keys(fields).length });
  } catch (err) {
    console.error("[parse-prompt-to-client]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
