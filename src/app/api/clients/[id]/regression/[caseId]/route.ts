import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  input: z.string().min(1).optional(),
  criteria: z.array(z.string().min(1)).min(1).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const updated = await prisma.regressionCase.update({
    where: { id: caseId },
    data: parsed.data,
    include: { runs: { orderBy: { runAt: "desc" }, take: 1 } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId } = await params;
  await prisma.regressionCase.delete({ where: { id: caseId } });
  return new NextResponse(null, { status: 204 });
}
