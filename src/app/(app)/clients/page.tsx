import Link from "next/link";

export default function ClientsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Clientes</h1>
          <p className="text-zinc-400 text-sm">Todas as clínicas cadastradas.</p>
        </div>
        <Link
          href="/clients/new"
          className="bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          + Novo cliente
        </Link>
      </div>

      <div className="text-zinc-600 text-sm mt-8">
        Nenhum cliente cadastrado ainda.
      </div>
    </div>
  );
}
