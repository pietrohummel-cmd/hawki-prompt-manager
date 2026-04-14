import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateClientPrompt, MODULE_ORDER } from "@/lib/generate-prompt";
import type { ModuleKey } from "@/generated/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  try {
    // Gera o prompt via Anthropic
    const { systemPrompt, modules } = await generateClientPrompt(client);

    // Descobre o próximo número de versão
    const lastVersion = await prisma.promptVersion.findFirst({
      where: { clientId: id },
      orderBy: { version: "desc" },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    // Desativa a versão anterior
    await prisma.promptVersion.updateMany({
      where: { clientId: id, isActive: true },
      data: { isActive: false },
    });

    // Cria nova versão com todos os módulos
    const version = await prisma.promptVersion.create({
      data: {
        clientId: id,
        version: nextVersion,
        systemPrompt,
        isActive: true,
        generatedBy: "AI",
        modules: {
          create: MODULE_ORDER
            .filter((key) => modules[key as ModuleKey])
            .map((key) => ({
              moduleKey: key as ModuleKey,
              content: modules[key as ModuleKey]!,
            })),
        },
      },
      include: { modules: true },
    });

    // Atualiza status do cliente para ACTIVE
    await prisma.client.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    return NextResponse.json(version);
  } catch (err) {
    console.error("[POST generate-prompt]", err);
    return NextResponse.json(
      { error: "Erro ao gerar prompt", detail: String(err) },
      { status: 500 }
    );
  }
}
