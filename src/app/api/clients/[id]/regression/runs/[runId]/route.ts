import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  results: z.array(z.object({
    criterion: z.string(),
    passed: z.boolean().nullable(),
  })),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { results } = parsed.data;

  // Calcula status baseado nos resultados
  const evaluated = results.filter((r) => r.passed !== null);
  let status: "PENDING" | "PASSED" | "FAILED" = "PENDING";
  if (evaluated.length === results.length) {
    status = results.every((r) => r.passed === true) ? "PASSED" : "FAILED";
  }

  const updated = await prisma.regressionRun.update({
    where: { id: runId },
    data: { results, status },
  });

  return NextResponse.json(updated);
}
