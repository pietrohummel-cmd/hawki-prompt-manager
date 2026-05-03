"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Target, DollarSign, Users, Calendar, CheckCircle, Layers, Sparkles } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/intelligence-constants";
import type { ServiceCategory } from "@/generated/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryStats {
  category: ServiceCategory;
  totalApproved: number;
  withOutcome: number;
  outcomeCoveragePct: number;
  scheduled: number;
  showedUp: number;
  noShow: number;
  closed: number;
  notClosed: number;
  totalRevenueCents: number;
  avgRevenueClosedCents: number;
  activeInsights: number;
  activeBatches: number;
  avgRankingScore: number | null;
  avgRawScoreQuality: number | null;
}

interface ImpactData {
  global: {
    totalApproved: number;
    totalWithOutcome: number;
    outcomeCoveragePct: number;
    totalRevenueCents: number;
    avgRevenueClosedCents: number;
    scheduled: number;
    showedUp: number;
    closed: number;
    activeInsights: number;
    activeBatches: number;
  };
  categories: CategoryStats[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRL = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const PCT = (n: number): string => `${n}%`;

// ─── Components ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border ${accent ? "border-[var(--accent)]/30 bg-[var(--accent)]/5" : "border-[var(--border)] bg-[var(--surface)]"} p-4 space-y-1`}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-disabled)] uppercase tracking-wide">
        <Icon size={11} />
        {label}
      </div>
      <p className={`text-2xl font-semibold ${accent ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>{value}</p>
      {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

function FunnelBar({
  total,
  scheduled,
  showedUp,
  closed,
}: {
  total: number;
  scheduled: number;
  showedUp: number;
  closed: number;
}) {
  if (total === 0) return null;
  const pct = (n: number) => Math.round((n / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-[var(--text-disabled)]">
        <span>Funil de conversão</span>
        <span>{closed} de {total}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-[var(--border)]">
        {/* Closed (mais escuro/forte) */}
        <div className="bg-[var(--accent)]" style={{ width: `${pct(closed)}%` }} title={`Fechou: ${closed}`} />
        {/* Showed up but not closed (médio) */}
        <div className="bg-green-500/60" style={{ width: `${pct(Math.max(0, showedUp - closed))}%` }} title={`Apareceu sem fechar: ${Math.max(0, showedUp - closed)}`} />
        {/* Scheduled but didn't show */}
        <div className="bg-amber-400/50" style={{ width: `${pct(Math.max(0, scheduled - showedUp))}%` }} title={`Agendou e não apareceu: ${Math.max(0, scheduled - showedUp)}`} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--text-muted)]">
        <span>📅 {scheduled} ag.</span>
        <span>✅ {showedUp} ap.</span>
        <span className="text-[var(--accent)]">💰 {closed} fec.</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImpactoPage() {
  const [data, setData] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/intelligence/impact");
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail ?? d.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as ImpactData;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div className="h-7 w-48 rounded bg-[var(--surface)] animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--surface)] animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-[var(--surface)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">
          <span className="font-medium">Erro:</span> {error}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { global, categories } = data;

  // Ordena categorias por receita (maior primeiro), depois por outcome coverage
  const sortedCategories = [...categories].sort(
    (a, b) =>
      b.totalRevenueCents - a.totalRevenueCents ||
      b.outcomeCoveragePct - a.outcomeCoveragePct
  );

  const hasAnyData = global.totalApproved > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={18} className="text-[var(--accent)]" />
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Impacto da Inteligência</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Métricas de outcome real cruzadas com cobertura de conhecimento por categoria.
        </p>
      </div>

      {/* Empty state */}
      {!hasAnyData && (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center space-y-2">
          <p className="text-sm text-[var(--text-muted)]">
            Nenhuma interação aprovada ainda — o painel ganha vida quando começar a curar conversas e registrar outcomes.
          </p>
        </div>
      )}

      {hasAnyData && (
        <>
          {/* Global KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={Users}
              label="Conversas aprovadas"
              value={String(global.totalApproved)}
              hint={`${global.activeInsights} insights · ${global.activeBatches} lotes ativos`}
            />
            <StatCard
              icon={Target}
              label="Cobertura de outcome"
              value={PCT(global.outcomeCoveragePct)}
              hint={`${global.totalWithOutcome} com ground truth`}
              accent={global.outcomeCoveragePct >= 70}
            />
            <StatCard
              icon={DollarSign}
              label="Receita atribuída"
              value={BRL(global.totalRevenueCents)}
              hint={global.closed > 0 ? `Média ${BRL(global.avgRevenueClosedCents)} por fechamento` : undefined}
              accent={global.totalRevenueCents > 0}
            />
            <StatCard
              icon={CheckCircle}
              label="Tratamentos fechados"
              value={String(global.closed)}
              hint={`${global.scheduled} agendaram · ${global.showedUp} apareceram`}
            />
          </div>

          {/* Coverage health */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-[var(--text-muted)] font-medium">Cobertura geral de outcome</span>
              <span className={`font-semibold ${
                global.outcomeCoveragePct >= 70 ? "text-green-500"
                : global.outcomeCoveragePct >= 30 ? "text-amber-500"
                : "text-red-400"
              }`}>
                {PCT(global.outcomeCoveragePct)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className={
                  global.outcomeCoveragePct >= 70 ? "h-full bg-green-500"
                  : global.outcomeCoveragePct >= 30 ? "h-full bg-amber-400"
                  : "h-full bg-red-400"
                }
                style={{ width: `${global.outcomeCoveragePct}%` }}
              />
            </div>
            <p className="text-[10px] text-[var(--text-disabled)] mt-1.5">
              Meta da Fase 2: ≥70% das aprovadas com outcome real registrado.
            </p>
          </div>

          {/* Per-category breakdown */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-[var(--text-disabled)] uppercase tracking-wide flex items-center gap-1.5">
              <Layers size={12} />
              Por categoria
            </h2>
            {sortedCategories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--text-muted)]">
                Nenhuma categoria com dados ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {sortedCategories.map((cat) => (
                  <div
                    key={cat.category}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
                  >
                    {/* Header da categoria */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                          {CATEGORY_LABELS[cat.category]}
                        </h3>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          {cat.totalApproved} aprovada{cat.totalApproved !== 1 ? "s" : ""}
                          {cat.activeInsights > 0 && ` · ${cat.activeInsights} insight${cat.activeInsights !== 1 ? "s" : ""} ativo${cat.activeInsights !== 1 ? "s" : ""}`}
                          {cat.activeBatches > 0 && ` · ${cat.activeBatches} lote${cat.activeBatches !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                      {cat.totalRevenueCents > 0 && (
                        <div className="text-right">
                          <p className="text-base font-semibold text-[var(--accent)]">
                            {BRL(cat.totalRevenueCents)}
                          </p>
                          {cat.avgRevenueClosedCents > 0 && (
                            <p className="text-[10px] text-[var(--text-disabled)]">
                              média {BRL(cat.avgRevenueClosedCents)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                      <div>
                        <p className="text-[var(--text-disabled)]">Cobertura</p>
                        <p className={`font-medium ${cat.outcomeCoveragePct >= 70 ? "text-green-500" : cat.outcomeCoveragePct >= 30 ? "text-amber-500" : "text-[var(--text-muted)]"}`}>
                          {PCT(cat.outcomeCoveragePct)} <span className="text-[10px] text-[var(--text-disabled)]">({cat.withOutcome}/{cat.totalApproved})</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-disabled)]">Score raw (LLM)</p>
                        <p className="font-medium text-[var(--text-primary)]">
                          {cat.avgRawScoreQuality !== null ? `${Math.round(cat.avgRawScoreQuality * 100)}%` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-disabled)]">Ranking ajustado</p>
                        <p className="font-medium text-[var(--text-primary)]">
                          {cat.avgRankingScore !== null ? `${Math.round(cat.avgRankingScore * 100)}%` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-disabled)]">Fechamento</p>
                        <p className="font-medium text-[var(--text-primary)]">
                          {cat.scheduled > 0 ? `${Math.round((cat.closed / cat.scheduled) * 100)}%` : "—"}
                          <span className="text-[10px] text-[var(--text-disabled)] ml-1">de agendados</span>
                        </p>
                      </div>
                    </div>

                    {/* Funil */}
                    {cat.withOutcome > 0 && (
                      <FunnelBar
                        total={cat.withOutcome}
                        scheduled={cat.scheduled}
                        showedUp={cat.showedUp}
                        closed={cat.closed}
                      />
                    )}

                    {/* Sem outcome ainda */}
                    {cat.withOutcome === 0 && cat.totalApproved > 0 && (
                      <p className="text-[11px] text-amber-500/80 flex items-center gap-1">
                        <Calendar size={10} />
                        Nenhum outcome registrado — adicione ground truth para começar a medir conversão
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footnote */}
          <div className="rounded-xl border border-[var(--border)]/50 bg-[var(--background)] p-3 text-[11px] text-[var(--text-muted)] flex gap-2">
            <Sparkles size={12} className="text-[var(--accent)] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[var(--text-primary)]">Próximo nível:</strong> quando integrações CRM
              estiverem ativas (Slice 5), outcome será preenchido automaticamente. Por enquanto, registre
              manualmente clicando no ícone <Target size={9} className="inline" /> em cada conversa aprovada.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
