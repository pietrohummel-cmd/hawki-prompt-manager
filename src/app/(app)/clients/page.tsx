import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { type ClientStatus } from "@/generated/prisma";

const STATUS_LABELS: Record<ClientStatus, string> = {
  ONBOARDING: "Onboarding",
  ACTIVE: "Ativo",
  ARCHIVED: "Arquivado",
};

const STATUS_COLORS: Record<ClientStatus, string> = {
  ONBOARDING: "bg-yellow-500/10 text-yellow-400",
  ACTIVE: "bg-emerald-500/10 text-emerald-400",
  ARCHIVED: "bg-zinc-500/10 text-zinc-500",
};

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

      {clients.length === 0 ? (
        <div className="text-zinc-600 text-sm mt-8">
          Nenhum cliente cadastrado ainda.{" "}
          <Link href="/clients/new" className="text-emerald-400 hover:underline">
            Cadastrar primeiro cliente →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}/prompt`}
              className="flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg px-5 py-4 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
                  {client.clinicName}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {[client.city, client.neighborhood].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-zinc-500">
                  {client._count.promptVersions} versão{client._count.promptVersions !== 1 ? "ões" : ""}
                </span>
                {client._count.tickets > 0 && (
                  <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">
                    {client._count.tickets} ticket{client._count.tickets !== 1 ? "s" : ""}
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[client.status]}`}
                >
                  {STATUS_LABELS[client.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
