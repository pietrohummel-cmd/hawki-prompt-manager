import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { ESTIMATED_FULL_REGEN_COST_USD } from "@/lib/usage-logger";

type RecentClient = Prisma.ClientGetPayload<{
  include: {
    promptVersions: { select: { version: true; createdAt: true }; take: 1 };
    tickets: { select: { id: true } };
  };
}>;

export const dynamic = "force-dynamic";

function fmtUsd(value: number): string {
  if (value < 0.01) return `$${(value * 100).toFixed(3)}¢`;
  return `$${value.toFixed(3)}`;
}

export default async function DashboardPage() {
  let dbError = false;
  let activeClients = 0, openTickets = 0, recentVersions = 0;
  let recentActivity: RecentClient[] = [];
  let usageTotal = { _sum: { costUsd: null as number | null, inputTokens: null as number | null, outputTokens: null as number | null } };
  let usageByClient: { clientId: string | null; _sum: { costUsd: number | null } }[] = [];
  let usageByOperation: { operation: string; _sum: { costUsd: number | null }; _count: { id: number } }[] = [];
  let suggestCount = 0;

  try {
  [
    activeClients,
    openTickets,
    recentVersions,
    recentActivity,
    usageTotal,
    usageByClient,
    usageByOperation,
    suggestCount,
  ] = await Promise.all([
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
  } catch {
    dbError = true;
  }

  const topClientIds = usageByClient
    .map((r) => r.clientId)
    .filter((id): id is string => id !== null);
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
  const estimatedSavings = Math.max(
    0,
    suggestCount * ESTIMATED_FULL_REGEN_COST_USD - suggestCost
  );

  const operationLabels: Record<string, string> = {
    generate_prompt:    "Gerar prompt",
    suggest_module:     "Sugerir módulo",
    suggest_ticket:     "Sugerir ticket",
    import_restructure: "Importar/reorganizar",
  };

  return (
    <div>
      {/* Banner de erro de BD */}
      {dbError && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-500 text-[13px] flex items-center gap-2 animate-fade-up">
          <span>⚠</span>
          Não foi possível conectar ao banco de dados. Verifique se o projeto Supabase está ativo.
        </div>
      )}

      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <h1
          className="text-2xl font-bold text-[var(--text-primary)] mb-1 tracking-tight"
          
        >
          Dashboard
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Visão geral dos clientes e prompts ativos.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3 mb-8 animate-fade-up delay-50">
        <StatCard
          label="Clientes ativos"
          value={String(activeClients)}
          accent="#655cb1"
        />
        <StatCard
          label="Tickets abertos"
          value={String(openTickets)}
          accent={openTickets > 0 ? "#ef4444" : "#655cb1"}
          highlight={openTickets > 0}
        />
        <StatCard
          label="Versões esta semana"
          value={String(recentVersions)}
          accent="#5dd6d5"
        />
      </div>

      {/* Custos API */}
      <div className="mb-8 animate-fade-up delay-100">
        <SectionLabel>Uso da API Anthropic</SectionLabel>

        {totalCostUsd === 0 ? (
          <div className="card p-5 text-[var(--text-disabled)] text-sm">
            Nenhuma chamada registrada ainda.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <CostCard
                label="Custo total"
                value={fmtUsd(totalCostUsd)}
                sub={`${(totalInputTokens + totalOutputTokens).toLocaleString("pt-BR")} tokens`}
                valueClass="text-[var(--accent-text)]"
              />
              <CostCard
                label="Economia estimada"
                value={fmtUsd(estimatedSavings)}
                sub={`${suggestCount} sugestões vs. regerações`}
                valueClass="text-[#5dd6d5]"
              />
              <CostCard
                label="Custo / geração"
                value={fmtUsd(ESTIMATED_FULL_REGEN_COST_USD)}
                sub="estimativa média (Sonnet)"
                valueClass="text-[var(--text-secondary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-disabled)] mb-3">
                  Por operação
                </p>
                <div className="space-y-2.5">
                  {usageByOperation
                    .sort((a, b) => (b._sum.costUsd ?? 0) - (a._sum.costUsd ?? 0))
                    .map((op) => (
                      <div key={op.operation} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[13px] text-[var(--text-secondary)] truncate">
                            {operationLabels[op.operation] ?? op.operation}
                          </span>
                          <span className="text-[11px] text-[var(--text-disabled)] ml-1.5">
                            ({op._count.id}×)
                          </span>
                        </div>
                        <span className="text-[13px] text-[var(--accent-text)] font-mono tabular-nums shrink-0">
                          {fmtUsd(op._sum.costUsd ?? 0)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-disabled)] mb-3">
                  Top clientes
                </p>
                {usageByClient.length === 0 ? (
                  <p className="text-[var(--text-disabled)] text-sm">
                    Sem dados por cliente ainda.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {usageByClient.map((r) => (
                      <div
                        key={r.clientId ?? "null"}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-[13px] text-[var(--text-secondary)] truncate">
                          {r.clientId
                            ? (clientMap[r.clientId] ?? "Cliente removido")
                            : "Sem cliente"}
                        </span>
                        <span className="text-[13px] text-[var(--accent-text)] font-mono tabular-nums shrink-0">
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
      <div className="animate-fade-up delay-150">
        <SectionLabel>Atividade recente</SectionLabel>

        {recentActivity.length === 0 ? (
          <div className="text-[var(--text-disabled)] text-sm">
            Nenhum cliente ainda.{" "}
            <Link
              href="/clients/new"
              className="text-[var(--accent-text)] hover:underline underline-offset-2 transition-colors"
            >
              Cadastrar primeiro cliente →
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentActivity.map((client, i) => {
              const activeVersion = client.promptVersions[0];
              const openCount = client.tickets.length;
              const initials = client.clinicName
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase();

              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}/prompt`}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="animate-fade-up flex items-center justify-between card hover:border-[var(--accent)]/40 hover:bg-[var(--surface-raised)]/50 px-4 py-3 transition-all duration-150 group press"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar inicial */}
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 text-white/80"
                      style={{ background: "linear-gradient(135deg, #655cb1, #5dd6d5)" }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors truncate">
                        {client.clinicName}
                      </p>
                      {activeVersion ? (
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 tabular-nums">
                          v{activeVersion.version} ·{" "}
                          {new Date(activeVersion.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      ) : (
                        <p className="text-[11px] text-[var(--text-disabled)] mt-0.5">
                          Sem prompt gerado
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {openCount > 0 && (
                      <span className="text-[11px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium">
                        {openCount} ticket{openCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="text-[var(--text-disabled)] text-xs group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all duration-150">
                      →
                    </span>
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

/* ── Subcomponentes ────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-disabled)] mb-3"
    >
      {children}
    </p>
  );
}

function StatCard({
  label,
  value,
  accent,
  highlight = false,
}: {
  label: string;
  value: string;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="relative card p-5 overflow-hidden"
      style={{ borderTopColor: accent, borderTopWidth: "2px" }}
    >
      <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1">
        {label}
      </p>
      <p
        className={`text-3xl font-bold tabular-nums tracking-tight ${
          highlight ? "text-red-400" : "text-[var(--text-primary)]"
        }`}
        
      >
        {value}
      </p>
      {/* Subtle glow */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-[0.06] pointer-events-none"
        style={{ background: accent }}
      />
    </div>
  );
}

function CostCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </p>
      <p className="text-[11px] text-[var(--text-disabled)] mt-1">{sub}</p>
    </div>
  );
}
