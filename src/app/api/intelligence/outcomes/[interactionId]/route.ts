/**
 * GET    /api/intelligence/outcomes/[interactionId] — busca outcome de uma interação
 * PUT    /api/intelligence/outcomes/[interactionId] — upsert (cria ou atualiza)
 * DELETE /api/intelligence/outcomes/[interactionId] — remove (admin only)
 *
 * Modelagem de evento: PUT é idempotente. Curador pode ir preenchendo
 * scheduledAt → showedUp → treatmentClosed → revenueCents conforme o
 * outcome se materializa no mundo real.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { INTELLIGENCE_ADMIN_EMAILS, INTELLIGENCE_DEV_BYPASS } from "@/lib/intelligence-constants";

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false }> {
  const { userId } = await auth();
  if (!userId) return { ok: false };
  if (INTELLIGENCE_DEV_BYPASS) return { ok: true, userId };
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
  if (!INTELLIGENCE_ADMIN_EMAILS.includes(email)) return { ok: false };
  return { ok: true, userId };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ interactionId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });

  const { interactionId } = await params;
  const outcome = await prisma.conversationOutcome.findUnique({ where: { interactionId } });
  if (!outcome) return NextResponse.json(null, { status: 200 });
  return NextResponse.json(outcome);
}

// ─── PUT (upsert) ─────────────────────────────────────────────────────────────

const putSchema = z.object({
  scheduledAt:     z.string().datetime().nullable().optional(),
  appointmentDate: z.string().datetime().nullable().optional(),
  showedUp:        z.boolean().nullable().optional(),
  treatmentClosed: z.boolean().nullable().optional(),
  revenueCents:    z.number().int().min(0).nullable().optional(),
  source: z
    .enum(["MANUAL", "CRM_DENTAL_OFFICE", "CRM_CLINICORP", "CRM_EAI_DOCTOR", "CRM_OTHER", "API_WEBHOOK"])
    .default("MANUAL"),
  notes: z.string().nullable().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ interactionId: string }> }
) {
  const a = await requireAdmin();
  if (!a.ok) return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });

  const { interactionId } = await params;
  const body = await request.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verifica que a interação existe (FK enforcement gracioso)
  const interaction = await prisma.successfulInteraction.findUnique({ where: { id: interactionId } });
  if (!interaction) {
    return NextResponse.json({ error: "Interação não encontrada" }, { status: 404 });
  }

  const data = parsed.data;
  const writePayload = {
    scheduledAt:     data.scheduledAt     ? new Date(data.scheduledAt)     : data.scheduledAt === null     ? null : undefined,
    appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : data.appointmentDate === null ? null : undefined,
    showedUp:        data.showedUp        === undefined ? undefined : data.showedUp,
    treatmentClosed: data.treatmentClosed === undefined ? undefined : data.treatmentClosed,
    revenueCents:    data.revenueCents    === undefined ? undefined : data.revenueCents,
    notes:           data.notes           === undefined ? undefined : data.notes,
    source:          data.source,
  };

  const outcome = await prisma.conversationOutcome.upsert({
    where:  { interactionId },
    create: {
      interactionId,
      enteredBy: a.userId,
      updatedBy: a.userId,
      ...writePayload,
    },
    update: {
      updatedBy: a.userId,
      ...writePayload,
    },
  });

  return NextResponse.json(outcome);
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ interactionId: string }> }
) {
  const a = await requireAdmin();
  if (!a.ok) return NextResponse.json({ error: "Acesso restrito à equipe Hawki" }, { status: 403 });

  const { interactionId } = await params;
  try {
    await prisma.conversationOutcome.delete({ where: { interactionId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Outcome não encontrado" }, { status: 404 });
  }
}
