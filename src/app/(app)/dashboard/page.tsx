export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Dashboard</h1>
      <p className="text-zinc-400 text-sm">Visão geral dos clientes e prompts ativos.</p>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <StatCard label="Clientes ativos" value="0" />
        <StatCard label="Tickets abertos" value="0" />
        <StatCard label="Versões esta semana" value="0" />
      </div>

      <div className="mt-8 text-zinc-600 text-sm">
        Nenhum cliente cadastrado ainda.{" "}
        <a href="/clients/new" className="text-emerald-400 hover:underline">
          Cadastrar primeiro cliente →
        </a>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-semibold text-white mt-1">{value}</p>
    </div>
  );
}
