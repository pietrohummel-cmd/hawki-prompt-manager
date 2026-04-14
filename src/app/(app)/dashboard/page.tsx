import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ESTIMATED_FULL_REGEN_COST_USD } from "@/lib/usage-logger";

export const dynamic = "force-dynamic";

// Superfícies reutilizáveis (tokens de tema)
const card = "bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg";
const labelCls = "text-xs text-[var(--text-muted)] uppercase tracking-wide";
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-4";

function fmtUsd(value: number): string {
  if (value < 0.01) return `$${(value * 100).toFixed(3)}¢`;
  return `$${value.toFixed(3)}`;
}

export default async function DashboardPage() {
  const [activeClients, openTickets, recentVersions, recentActivity, usageTotal, usageByClient, usageByOperation, suggestCount] =
    await Promise.all([
      prisma.client.count({ where: { status: "ACTIVE" } }),
      prisma.correctionTicket.count({ where: { status: { in: ["OPEN", "SUGGESTED"] } } }),
      prisma.promptVersion.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.client.findMany({
        take: 8,
        orderBy: { updatedAt: "desc" },
        include: {
          promptVersions: {
            where: { isActive: true },
            select: { version: true, createdAt: true },
            take: 1,
          },
          tickets: {
            where: { status: { in: ["OPEN", "SUGGESTED"] } },
            select: { id: true },
          },
        },
      }),
      prisma.apiUsageLog.aggregate({
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      }),
      prisma.apiUsageLog.groupBy({
        by: ["clientId"],
        _sum: { costUsd: true },
        orderBy: { _sum: { costUsd: "desc" } },
        take: 5,
      }),
      prisma.apiUsageLog.groupBy({
        by: ["operation"],
        _sum: { costUsd: true },
        _count: { id: true },
      }),
      prisma.apiUsageLog.count({
        where: { operation: { in: ["suggest_module", "suggest_ticket"] } },
      }),
    ]);

  const topClientIds = usageByClient.map((r) => r.clientId).filter((id): id is string => id !== null);
  const topClients = topClientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: topClientIds } },
        select: { id: true, clinicName: true },
      })
    : [];
  const clientMap = Object.fromEntries(topClients.map((c) => [c.id, c.clinicName]));

  const totalCostUsd = usageTotal._sum.costUsd ?? 0;
  const totalInputTokens = usageTotal._sum.inputTokens ?? 0;
  const totalOutputTokens = usageTotal._sum.outputTokens ?? 0;

  const suggestCost = usageByOperation
    .filter((o) => ["suggest_module", "suggest_ticket"].includes(o.operation))
    .reduce((sum, o) => sum + (o._sum.costUsd ?? 0), 0);
  const estimatedSavings = Math.max(0, suggestCount * ESTIMATED_FULL_REGEN_COST_USD - suggestCost);

  const operationLabels: Record<string, string> = {
    generate_prompt:   "Gerar prompt",
    suggest_module:    "Sugerir módulo",
    suggest_ticket:    "Sugerir ticket",
    import_restructure:"Importar/reorganizar",
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-1">Dashboard</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">Visão geral dos clientes e prompts ativos.</p>

      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="Clientes ativos"   value={String(activeClients)} />
        <StatCard label="Tickets abertos"   value={String(openTickets)} highlight={openTickets > 0} />
        <StatCard label="Versões esta semana" value={String(recentVersions)} />
      </div>

      {/* Custos API */}
      <div className="mb-10">
        <h2 className={sectionLabel}>Uso da API Anthropic</h2>

        {totalCostUsd === 0 ? (
          <div className={`${card} p-5 text-[var(--text-disabled)] text-sm`}>
            Nenhuma chamada registrada ainda.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className={`${card} p-5`}>
                <p className={labelCls}>Custo total</p>
                <p className="text-2xl font-semibold text-[var(--accent-text)] mt-1">{fmtUsd(totalCostUsd)}</p>
                <p className="text-xs text-[var(--text-disabled)] mt-1">
                  {(totalInputTokens + totalOutputTokens).toLocaleString("pt-BR")} tokens
                </p>
              </div>
              <div className={`${card} p-5`}>
                <p className={labelCls}>Economia estimada</p>
                <p className="text-2xl font-semibold text-[#659fcf] mt-1">{fmtUsd(estimatedSavings)}</p>
                <p className="text-xs text-[var(--text-disabled)] mt-1">
                  {suggestCount} sugestões vs. regerações completas
                </p>
              </div>
              <div className={`${card} p-5`}>
                <p className={labelCls}>Custo p/ geração completa</p>
                <p className="text-2xl font-semibold text-[var(--text-secondary)] mt-1">{fmtUsd(ESTIMATED_FULL_REGEN_COST_USD)}</p>
                <p className="text-xs text-[var(--text-disabled)] mt-1">estimativa média (Sonnet)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`${card} p-5`}>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Por operação</p>
                <div className="space-y-2">
                  {usageByOperation
                    .sort((a, b) => (b._sum.costUsd ?? 0) - (a._sum.costUsd ?? 0))
                    .map((op) => (
                      <div key={op.operation} className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-[var(--text-secondary)]">
                            {operationLabels[op.operation] ?? op.operation}
                          </span>
                          <span className="text-xs text-[var(--text-disabled)] ml-2">({op._count.id}x)</span>
                        </div>
                        <span className="text-sm text-[var(--accent-text)] font-mono">
                          {fmtUsd(op._sum.costUsd ?? 0)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className={`${card} p-5`}>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Top clientes</p>
                {usageByClient.length === 0 ? (
                  <p className="text-[var(--text-disabled)] text-sm">Sem dados por cliente ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {usageByClient.map((r) => (
                      <div key={r.clientId ?? "null"} className="flex items-center justify-between">
                        <span className="text-sm text-[var(--text-secondary)] truncate max-w-[180px]">
                          {r.clientId ? (clientMap[r.clientId] ?? "Cliente removido") : "Sem cliente"}
                        </span>
                        <span className="text-sm text-[var(--accent-text)] font-mono">
                          {fmtUsd(r._sum.costUsd ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Atividade recente */}
      <div>
        <h2 className={sectionLabel}>Atividade recente</h2>

        {recentActivity.length === 0 ? (
          <div className="text-[var(--text-disabled)] text-sm">
            Nenhum cliente ainda.{" "}
            <Link href="/clients/new" className="text-[var(--accent-text)] hover:underline">
              Cadastrar primeiro cliente →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((client) => {
              const activeVersion = client.promptVersions[0];
              const openCount = client.tickets.length;
              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}/prompt`}
                  className={`flex items-center justify-between ${card} hover:border-[var(--accent)]/40 px-5 py-3.5 transition-all group`}
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                      {client.clinicName}
                    </p>
                    {activeVersion ? (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Versão {activeVersion.version} · {new Date(activeVersion.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--text-disabled)] mt-0.5">Sem prompt gerado</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {openCount > 0 && (
                      <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">
                        {openCount} ticket{openCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="text-[var(--text-disabled)] text-xs">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg p-5">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-semibold mt-1 ${highlight ? "text-red-400" : "text-[var(--text-primary)]"}`}>
        {value}
      </p>
    </div>
  );
}
