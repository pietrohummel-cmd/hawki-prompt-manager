/**
 * POST /api/intelligence/distill
 * Destila SpecialtyKnowledge a partir das interações aprovadas de uma categoria.
 * Corpo: { category: ServiceCategory }
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { distillKnowledge } from "@/lib/knowledge-distiller";
import { INTELLIGENCE_ADMIN_EMAILS, INTELLIGENCE_DEV_BYPASS } from "@/lib/intelligence-constants";

const schema = z.object({
  category: z.enum([
    "IMPLANTES","ORTODONTIA","ESTETICA","CLINICO_GERAL",
    "PERIODONTIA","ENDODONTIA","PEDIATRIA","PROTESE","CIRURGIA","OUTROS",
  ]),
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
    const result = await distillKnowledge(parsed.data.category);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/intelligence/distill]", err);
    return NextResponse.json({ error: "Erro ao destilar", detail: String(err) }, { status: 500 });
  }
}
