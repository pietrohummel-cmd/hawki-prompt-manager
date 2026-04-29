import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ClientsListClient } from "./clients-list-client";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { promptVersions: true, tickets: true } },
      tickets: {
        where: { status: { in: ["OPEN", "SUGGESTED"] } },
        select: { priority: true },
      },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 animate-fade-up">
        <div>
          <h1
            className="text-2xl font-bold text-[var(--text-primary)] mb-1 tracking-tight"
            
          >
            Clientes
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {clients.length} clínica{clients.length !== 1 ? "s" : ""} cadastrada
            {clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/clients/new"
          className="press bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-medium px-4 py-2 rounded-md transition-colors duration-150"
        >
          + Novo cliente
        </Link>
      </div>

      <div className="animate-fade-up delay-50">
        <ClientsListClient clients={clients} />
      </div>
    </div>
  );
}
