/**
 * POST /api/intelligence/bulk-upload
 *
 * Recebe o texto bruto de uma exportação do WhatsApp, parseia em conversas individuais,
 * anonimiza cada uma e cria SuccessfulInteraction em batch.
 *
 * Corpo (JSON):
 *   rawText:               string                  — texto completo da exportação
 *   category:              ServiceCategory
 *   outcome?:              ConvOutcome             — aplicado a todas as conversas do lote
 *   operatorIdentifiers?:  string[]                — nomes que correspondem ao operador da
 *                                                    clínica. Marcados como [SOFIA] no parser;
 *                                                    demais ficam como [PACIENTE].
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseWhatsAppExport } from "@/lib/whatsapp-parser";
import { anonymizeWithNer, inferOutcome } from "@/lib/transcript-parser";
import { INTELLIGENCE_ADMIN_EMAILS, INTELLIGENCE_DEV_BYPASS } from "@/lib/intelligence-constants";
import type { ServiceCategory, ConvOutcome } from "@/generated/prisma";

const schema = z.object({
  rawText:  z.string().min(50, "Texto muito curto — cole o conteúdo completo da exportação"),
  category: z.enum([
    "IMPLANTES","ORTODONTIA","ESTETICA","CLINICO_GERAL",
    "PERIODONTIA","ENDODONTIA","PEDIATRIA","PROTESE","CIRURGIA","OUTROS",
  ]),
  outcome: z.enum(["SCHEDULED","NOT_SCHEDULED","LOST"]).optional(),
  operatorIdentifiers: z.array(z.string().min(1)).optional(),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!INTELLIGENCE_DEV_BYPASS) {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    if (!INTELLIGENCE_ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });
    }
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { rawText, category, outcome, operatorIdentifiers } = parsed.data;

  // Parseia em conversas individuais; se operatorIdentifiers presente, papéis
  // são marcados explicitamente (resolve achado do Codex sobre inversão de papel)
  const conversations = parseWhatsAppExport(rawText, operatorIdentifiers);

  if (conversations.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma conversa encontrada no texto. Verifique se o formato é de exportação do WhatsApp." },
      { status: 422 }
    );
  }

  // Cria interações sequencialmente em chunks pequenos.
  // Razão: anonymizeWithNer pode chamar Haiku — paralelismo descontrolado
  // estoura rate limit. Chunk de 3 mantém throughput sem riscos.
  const CONCURRENCY = 3;
  const results: PromiseSettledResult<unknown>[] = [];
  for (let i = 0; i < conversations.length; i += CONCURRENCY) {
    const chunk = conversations.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (conv) => {
        const { text: transcript } = await anonymizeWithNer(conv.raw);
        const finalOutcome: ConvOutcome =
          outcome ?? inferOutcome(conv.raw) ?? "NOT_SCHEDULED";

        return prisma.successfulInteraction.create({
          data: {
            category: category as ServiceCategory,
            transcript,
            outcome: finalOutcome,
            status: "PENDING_REVIEW",
          },
        });
      })
    );
    results.push(...chunkResults);
  }

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed    = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    conversationsFound: conversations.length,
    created: succeeded,
    failed,
  }, { status: 201 });
}
