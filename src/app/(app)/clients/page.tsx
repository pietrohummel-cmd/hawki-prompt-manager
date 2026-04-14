import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ClientsListClient } from "./clients-list-client";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tickets: true, promptVersions: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Clientes</h1>
          <p className="text-zinc-400 text-sm">
            {clients.length} clínica{clients.length !== 1 ? "s" : ""} cadastrada{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/clients/new"
          className="bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          + Novo cliente
        </Link>
      </div>

      <ClientsListClient clients={clients} />
    </div>
  );
}
