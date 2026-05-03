/**
 * POST /api/intelligence/score
 * Pontua uma interação aprovada via LLM (Haiku).
 * Corpo: { interactionId: string }
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreInteraction } from "@/lib/interaction-scorer";
import { INTELLIGENCE_ADMIN_EMAILS, INTELLIGENCE_DEV_BYPASS } from "@/lib/intelligence-constants";

const schema = z.object({
  interactionId: z.string().min(1),
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

  try {
    const scores = await scoreInteraction(parsed.data.interactionId);
    return NextResponse.json({ success: true, scores });
  } catch (err) {
    console.error("[POST /api/intelligence/score]", err);
    return NextResponse.json({ error: "Erro ao pontuar", detail: String(err) }, { status: 500 });
  }
}
