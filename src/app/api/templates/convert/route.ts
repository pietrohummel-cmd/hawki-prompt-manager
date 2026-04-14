import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { restructurePromptToModules } from "@/lib/generate-prompt";
import { MODULE_ORDER } from "@/lib/prompt-constants";

const schema = z.object({
  rawText: z.string().min(10, "Cole o conteúdo do template"),
});

/**
 * POST /api/templates/convert
 * Converte um prompt em formato livre (XML, texto corrido, etc.)
 * para o formato padrão ###MÓDULO:KEY### usando IA (Sonnet).
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const modules = await restructurePromptToModules(parsed.data.rawText);
    const formatted = MODULE_ORDER
      .filter((key) => modules[key])
      .map((key) => `###MÓDULO:${key}###\n${modules[key]}`)
      .join("\n\n");

    return NextResponse.json({ content: formatted, modulesFound: Object.keys(modules).length });
  } catch (err) {
    console.error("[templates/convert] Erro:", err);
    return NextResponse.json(
      { error: "Não foi possível converter o template. Tente novamente." },
      { status: 422 }
    );
  }
}
