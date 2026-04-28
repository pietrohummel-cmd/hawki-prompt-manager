import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { suggestModuleContent } from "@/lib/module-editor";
import { MODULE_ORDER } from "@/lib/prompt-constants";

const schema = z.object({
  moduleKey: z.enum(MODULE_ORDER as [string, ...string[]]),
  currentContent: z.string().min(1),
});

/**
 * POST /api/clients/[id]/modules/suggest
 * Gera uma sugestão de melhoria para um módulo específico via IA.
 * Envia apenas o módulo + contexto mínimo do cliente (nunca o prompt inteiro).
 */
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
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { moduleKey, currentContent } = parsed.data;
  const typedModuleKey = moduleKey as import("@/generated/prisma").ModuleKey;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  try {
    const suggestion = await suggestModuleContent(client, typedModuleKey, currentContent);
    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error("[POST modules/suggest]", err);
    return NextResponse.json({ error: "Erro ao gerar sugestão", detail: String(err) }, { status: 500 });
  }
}
