import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  tag: z.string().min(1).optional(),
  opening: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; originId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, originId } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  if (parsed.data.isDefault) {
    await prisma.leadOriginTag.updateMany({
      where: { clientId: id, isDefault: true, NOT: { id: originId } },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.leadOriginTag.update({
    where: { id: originId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ originId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { originId } = await params;
  const origin = await prisma.leadOriginTag.findUnique({ where: { id: originId } });

  if (origin?.isDefault) {
    return NextResponse.json({ error: "Não é possível apagar a tag padrão" }, { status: 400 });
  }

  await prisma.leadOriginTag.delete({ where: { id: originId } });
  return new NextResponse(null, { status: 204 });
}
