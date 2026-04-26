import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  tag: z.string().min(1),
  opening: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const origins = await prisma.leadOriginTag.findMany({
    where: { clientId: id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(origins);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  // Só pode ter uma tag padrão por cliente
  if (parsed.data.isDefault) {
    await prisma.leadOriginTag.updateMany({
      where: { clientId: id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const origin = await prisma.leadOriginTag.create({
    data: { clientId: id, ...parsed.data },
  });

  return NextResponse.json(origin, { status: 201 });
}
