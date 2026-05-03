/**
 * PATCH /api/intelligence/interactions/[id]
 * Aprova ou rejeita uma interação pendente (curadoria humana).
 * Restrito a INTELLIGENCE_ADMIN_EMAILS.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { INTELLIGENCE_ADMIN_EMAILS, INTELLIGENCE_DEV_BYPASS } from "@/lib/intelligence-constants";
import { scoreInteraction } from "@/lib/interaction-scorer";

const schema = z.object({
  status:     z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!INTELLIGENCE_DEV_BYPASS) {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    if (!INTELLIGENCE_ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });
    }
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { status, reviewNote } = parsed.data;

  try {
    const updated = await prisma.successfulInteraction.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewNote: reviewNote ?? null,
      },
    });

    // Dispara scoring automaticamente ao aprovar — fire-and-forget
    if (status === "APPROVED") {
      scoreInteraction(id).catch((err) =>
        console.error("[PATCH interaction] auto-score failed:", err)
      );
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Interação não encontrada" }, { status: 404 });
  }
}
