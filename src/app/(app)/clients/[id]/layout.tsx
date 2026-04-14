import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ClientNav } from "@/components/client-nav";

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, clinicName: true, assistantName: true, status: true },
  });

  if (!client) notFound();

  return (
    <div>
      <ClientNav client={client} />
      {children}
    </div>
  );
}
