/**
 * POST /api/clients/[id]/variants/[variantId]/promote
 *
 * Promove a variante:
 * 1. Parseia variantPrompt nos módulos ###MÓDULO:KEY###
 * 2. Cria novo PromptVersion com esses módulos
 * 3. Seta isActive=true na nova versão, false em todas as outras
 * 4. Marca variante como PROMOTED
 *
 * Disponível para qualquer status exceto PROMOTED/ROLLED_BACK.
 * Não exige ter passado no teste — promoção manual sempre funciona.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";

type Params = { params: Promise<{ id: string; variantId: string }> };

async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Response("Unauthorized", { status: 401 });
  return userId;
}

function parseVariantModules(text: string): Partial<Record<ModuleKey, string>> {
  const result: Partial<Record<ModuleKey, string>> = {};
  const regex = /###MÓDULO:(\w+)###([\s\S]*?)(?=###MÓDULO:|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1] as ModuleKey;
    const content = match[2].trim();
    if (MODULE_ORDER.includes(key) && content) {
      result[key] = content;
    }
  }
  return result;
}

export async function POST(_req: Request, { params }: Params) {
  try {
    const userId = await requireAuth();
    const { id: clientId, variantId } = await params;

    const variant = await prisma.promptVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.clientId !== clientId) {
      return NextResponse.json({ error: "Variante não encontrada" }, { status: 404 });
    }
    if (variant.status === "PROMOTED" || variant.status === "ROLLED_BACK") {
      return NextResponse.json({ error: "Variante já finalizada" }, { status: 409 });
    }

    const modules = parseVariantModules(variant.variantPrompt);
    const parsedKeys = Object.keys(modules) as ModuleKey[];
    if (parsedKeys.length === 0) {
      return NextResponse.json(
        { error: "Não foi possível parsear módulos do variantPrompt — use o formato ###MÓDULO:KEY###" },
        { status: 422 }
      );
    }

    // Versão sequencial
    const lastVersion = await prisma.promptVersion.findFirst({
      where: { clientId },
      orderBy: { version: "desc" },
    });
    const nextVersionNumber = (lastVersion?.version ?? 0) + 1;

    // Cria nova versão + desativa todas as anteriores (transação)
    const newVersion = await prisma.$transaction(async (tx) => {
      await tx.promptVersion.updateMany({
        where: { clientId, isActive: true },
        data: { isActive: false },
      });

      const created = await tx.promptVersion.create({
        data: {
          clientId,
          version: nextVersionNumber,
          systemPrompt: variant.variantPrompt,
          isActive: true,
          generatedBy: "AI",
          savedBy: userId,
          changesSummary: `Promovido da variante ${variantId}${variant.description ? ` — ${variant.description}` : ""}`,
          modules: {
            create: parsedKeys.map((key) => ({
              moduleKey: key,
              content: modules[key]!,
            })),
          },
        },
        include: { modules: true },
      });

      await tx.promptVariant.update({
        where: { id: variantId },
        data: {
          status: "PROMOTED",
          promotedAt: new Date(),
          promotedVersionId: created.id,
        },
      });

      return created;
    });

    return NextResponse.json({ promoted: true, versionId: newVersion.id, version: newVersion.version });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST variants/promote]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
