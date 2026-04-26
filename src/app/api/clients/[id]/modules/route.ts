import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";

const schema = z.object({
  moduleKey: z.enum([
    "IDENTITY", "ABSOLUTE_RULES", "INJECTION_PROTECTION", "CONVERSATION_STATE",
    "CONVERSATION_RESUME", "PRESENTATION", "COMMUNICATION_STYLE", "HUMAN_BEHAVIOR",
    "ACTIVE_LISTENING", "ATTENDANCE_STAGES", "QUALIFICATION", "SLOT_OFFER",
    "COMMITMENT_CONFIRMATION", "OPENING", "FINAL_OBJECTIVE", "AUDIO_RULES",
    "STATUS_RULES", "HANDOFF",
  ] as const),
  content: z.string().min(1, "Conteúdo não pode ser vazio"),
  changesSummary: z.string().optional(),
  savedBy: z.string().optional(),
});

/**
 * POST /api/clients/[id]/modules
 * Salva edição de um módulo criando uma nova PromptVersion imutável.
 * Copia todos os módulos da versão ativa e substitui apenas o módulo editado.
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

  const { moduleKey, content, changesSummary, savedBy } = parsed.data;

  // Busca a versão ativa com todos os módulos
  const activeVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id, isActive: true },
    include: { modules: true },
    orderBy: { version: "desc" },
  });

  if (!activeVersion) {
    return NextResponse.json({ error: "Nenhuma versão ativa encontrada" }, { status: 404 });
  }

  // Descobre o próximo número de versão
  const lastVersion = await prisma.promptVersion.findFirst({
    where: { clientId: id },
    orderBy: { version: "desc" },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  // Monta os novos módulos: copia todos, substitui o editado
  const newModules = activeVersion.modules.map((m) => ({
    moduleKey: m.moduleKey as ModuleKey,
    content: m.moduleKey === moduleKey ? content : m.content,
  }));

  // Reconstrói o systemPrompt concatenado
  const fullPrompt = MODULE_ORDER
    .filter((key) => newModules.some((m) => m.moduleKey === key))
    .map((key) => {
      const m = newModules.find((m) => m.moduleKey === key)!;
      return `###MÓDULO:${m.moduleKey}###\n${m.content}`;
    })
    .join("\n\n");

  // Transação: desativa versão anterior + cria nova
  const [, newPromptVersion] = await prisma.$transaction([
    prisma.promptVersion.update({
      where: { id: activeVersion.id },
      data: { isActive: false },
    }),
    prisma.promptVersion.create({
      data: {
        clientId: id,
        version: nextVersion,
        systemPrompt: fullPrompt,
        isActive: true,
        generatedBy: "MANUAL",
        changesSummary: changesSummary ?? `Módulo editado: ${moduleKey}`,
        savedBy: savedBy ?? userId,
        modules: {
          create: newModules,
        },
      },
      include: { modules: true },
    }),
  ]);

  return NextResponse.json(newPromptVersion);
}
