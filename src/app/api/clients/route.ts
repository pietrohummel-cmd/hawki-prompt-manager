import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createClientSchema = z.object({
  name: z.string().min(1, "Nome do responsável é obrigatório"),
  clinicName: z.string().min(1, "Nome da clínica é obrigatório"),
  assistantName: z.string().default("Sofia"),
  email: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  neighborhood: z.string().optional(),
  address: z.string().optional(),
  reference: z.string().optional(),
  phone: z.string().optional(),
  instagram: z.string().optional(),
  website: z.string().optional(),
  attendantName: z.string().optional(),
  schedulingSystem: z
    .enum(["CLINICORP", "CONTROLE_ODONTO", "SIMPLES_DENTAL", "GOOGLE_AGENDA"])
    .optional(),
  schedulingMode: z.enum(["DIRECT", "HANDOFF", "LINK"]).optional(),
  tone: z.enum(["FORMAL", "INFORMAL_MODERATE", "CASUAL"]).optional(),
  targetAudience: z.string().optional(),
  ageRange: z.string().optional(),
  restrictions: z.string().optional(),
  mandatoryPhrases: z.string().optional(),
  consultationInfo: z.string().optional(),
  schedulingRequirements: z.string().optional(),
  paymentInfo: z.string().optional(),
  urgencyHandling: z.string().optional(),
  urgencyProcedure: z.string().optional(),
  specialists: z.string().optional(),
  certifications: z.string().optional(),
  technologies: z.string().optional(),
  differentials: z.string().optional(),
  businessHours: z.string().optional(),
  emojiUsage: z.string().optional(),
  treatmentPronoun: z.string().optional(),
  procedureType: z.string().optional(),
  clinicPositioning: z.string().optional(),
  serviceCategories: z.array(z.enum([
    "IMPLANTES","ORTODONTIA","ESTETICA","CLINICO_GERAL",
    "PERIODONTIA","ENDODONTIA","PEDIATRIA","PROTESE","CIRURGIA","OUTROS",
  ])).optional().default([]),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createClientSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const client = await prisma.client.create({ data: parsed.data });
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    console.error("[POST /api/clients]", err);
    return NextResponse.json(
      { error: "Erro ao salvar cliente", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tickets: true, promptVersions: true } },
    },
  });

  return NextResponse.json(clients);
}
