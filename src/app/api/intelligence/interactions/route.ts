/**
 * GET  /api/intelligence/interactions  — lista interações (paginado, filtrado por status/categoria)
 * POST /api/intelligence/interactions  — cria nova interação a partir de transcrição bruta
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { anonymizeWithNer, inferOutcome } from "@/lib/transcript-parser";
import { INTELLIGENCE_ADMIN_EMAILS, INTELLIGENCE_DEV_BYPASS } from "@/lib/intelligence-constants";
import type { ServiceCategory, InteractionStatus, ConvOutcome } from "@/generated/prisma";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Corpus cross-tenant — restrito à equipe Hawki em produção
  if (!INTELLIGENCE_DEV_BYPASS) {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    if (!INTELLIGENCE_ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const status   = searchParams.get("status")   as InteractionStatus | null;
  const category = searchParams.get("category") as ServiceCategory | null;
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 20;

  const where = {
    ...(status   ? { status }   : {}),
    ...(category ? { category } : {}),
  };

  try {
    const [items, total] = await Promise.all([
      prisma.successfulInteraction.findMany({
        where,
        orderBy: { uploadedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { conversationOutcome: true },
      }),
      prisma.successfulInteraction.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (err) {
    console.error("[GET /api/intelligence/interactions]", err);
    return NextResponse.json(
      { error: "Erro interno", detail: String(err) },
      { status: 500 }
    );
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

const postSchema = z.object({
  rawTranscript: z.string().min(50, "Transcrição muito curta (mínimo 50 caracteres)"),
  category:      z.enum([
    "IMPLANTES","ORTODONTIA","ESTETICA","CLINICO_GERAL",
    "PERIODONTIA","ENDODONTIA","PEDIATRIA","PROTESE","CIRURGIA","OUTROS",
  ]),
  outcome: z.enum(["SCHEDULED","NOT_SCHEDULED","LOST"]).optional(),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apenas admins podem fazer upload — bypass em dev
  if (!INTELLIGENCE_DEV_BYPASS) {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    if (!INTELLIGENCE_ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });
    }
  }

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { rawTranscript, category, outcome } = parsed.data;

  // Anonimiza (regex + Haiku NER conforme ANONYMIZATION_LEVEL)
  const { text: transcript } = await anonymizeWithNer(rawTranscript);

  // Tenta inferir outcome se não foi fornecido (no texto bruto, mais sinal)
  const finalOutcome: ConvOutcome = outcome ?? inferOutcome(rawTranscript) ?? "NOT_SCHEDULED";

  const interaction = await prisma.successfulInteraction.create({
    data: {
      category: category as ServiceCategory,
      transcript,
      outcome: finalOutcome,
      status: "PENDING_REVIEW",
    },
  });

  return NextResponse.json(interaction, { status: 201 });
}
