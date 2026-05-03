"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { CheckCircle, Archive, Trash2, ChevronDown, ChevronUp, Zap, Filter, Layers, FileText } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_KEYS } from "@/lib/intelligence-constants";
import type { ServiceCategory, KnowledgeStatus } from "@/generated/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatchSummary {
  id: string;
  status: KnowledgeStatus;
  sourceCount: number;
  createdAt: string;
}

interface KnowledgeItem {
  id: string;
  category: ServiceCategory;
  title: string;
  insight: string;
  examplePhrase: string | null;
  exampleResponse: string | null;
  status: KnowledgeStatus;
  sourceCount: number;
  batchId: string | null;
  batch: BatchSummary | null;
  createdAt: string;
}

interface BatchGroup {
  batch: BatchSummary;
  insights: KnowledgeItem[];
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<KnowledgeStatus, { label: string; color: string; dot: string }> = {
  ACTIVE:   { label: "Ativo",    color: "text-green-500",  dot: "bg-green-500" },
  DRAFT:    { label: "Rascunho", color: "text-amber-400",  dot: "bg-amber-400" },
  ARCHIVED: { label: "Arquivado",color: "text-[var(--text-disabled)]", dot: "bg-[var(--text-disabled)]" },
};

const BR_DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConhecimentoPage() {
  const [items, setItems]                   = useState<KnowledgeItem[]>([]);
  const [loading, setLoading]               = useState(true);
  const [loadError, setLoadError]           = useState<string | null>(null);
  const [expandedBatch, setExpandedBatch]   = useState<string | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<ServiceCategory | "">("");
  const [filterStatus, setFilterStatus]     = useState<KnowledgeStatus | "">("");
  const [acting, setActing]                 = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (filterStatus)   params.set("status",   filterStatus);
      const res = await fetch(`/api/intelligence/knowledge?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? data.error ?? `HTTP ${res.status}`);
      }
      setItems(await res.json());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function patchBatch(batchId: string, status: "ACTIVE" | "ARCHIVED") {
    setActing(batchId);
    try {
      const res = await fetch(`/api/intelligence/knowledge/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Erro ao atualizar lote");
        return;
      }
      load();
    } finally {
      setActing(null);
    }
  }

  async function deleteBatch(batchId: string) {
    if (!confirm("Deletar este lote inteiro (incluindo todos os insights)? Ação permanente.")) return;
    setActing(batchId);
    try {
      const res = await fetch(`/api/intelligence/knowledge/batches/${batchId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Erro ao deletar lote");
        return;
      }
      load();
    } finally {
      setActing(null);
    }
  }

  async function patchInsight(id: string, body: Record<string, unknown>) {
    setActing(id);
    try {
      const res = await fetch(`/api/intelligence/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Erro ao atualizar insight");
        return;
      }
      load();
    } finally {
      setActing(null);
    }
  }

  async function deleteInsight(id: string) {
    if (!confirm("Deletar este insight permanentemente?")) return;
    setActing(id);
    try {
      const res = await fetch(`/api/intelligence/knowledge/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Erro ao deletar");
        return;
      }
      load();
    } finally {
      setActing(null);
    }
  }

  // ─── Group items by category, then within each category split into batches + manuals ──
  const grouped = useMemo(() => {
    type CategoryBucket = { batches: Map<string, BatchGroup>; manuals: KnowledgeItem[] };
    const byCategory = new Map<ServiceCategory, CategoryBucket>();
    for (const item of items) {
      const bucket: CategoryBucket = byCategory.get(item.category) ?? { batches: new Map(), manuals: [] };
      if (item.batchId && item.batch) {
        const existing = bucket.batches.get(item.batchId);
        if (existing) {
          existing.insights.push(item);
        } else {
          bucket.batches.set(item.batchId, { batch: item.batch, insights: [item] });
        }
      } else {
        bucket.manuals.push(item);
      }
      byCategory.set(item.category, bucket);
    }
    return byCategory;
  }, [items]);

  // ─── Counters ──────────────────────────────────────────────────────────────
  const activeCount = items.filter((i) => i.status === "ACTIVE").length;
  const draftCount  = items.filter((i) => i.status === "DRAFT").length;
  const draftBatchCount = useMemo(() => {
    const seen = new Set<string>();
    items.forEach((i) => { if (i.batch?.status === "DRAFT") seen.add(i.batchId!); });
    return seen.size;
  }, [items]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Base de Conhecimento</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Insights destilados de conversas reais — agrupados em lotes e injetados na geração de prompts.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {activeCount} ativo{activeCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {draftCount} rascunho{draftCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-[var(--text-muted)]" />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as ServiceCategory | "")}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="">Todas as categorias</option>
          {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as KnowledgeStatus | "")}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="DRAFT">Rascunhos</option>
          <option value="ARCHIVED">Arquivados</option>
        </select>
      </div>

      {/* Error */}
      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">
          <span className="font-medium">Erro:</span> {loadError}
        </div>
      )}

      {/* Draft activation hint */}
      {draftBatchCount > 0 && !filterStatus && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-500 flex items-center gap-2">
          <Zap size={14} className="shrink-0" />
          {draftBatchCount} lote{draftBatchCount !== 1 ? "s" : ""} aguardando ativação. Ativar um lote arquiva os outros lotes ativos da mesma categoria automaticamente.
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl bg-[var(--surface)] animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Nenhum insight encontrado. Use a aba de conversas para destilar conhecimento.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([cat, bucket]) => {
            const totalForCat = bucket.manuals.length + Array.from(bucket.batches.values()).reduce((acc, b) => acc + b.insights.length, 0);
            return (
              <div key={cat} className="space-y-3">
                {/* Category header */}
                <p className="text-xs font-semibold text-[var(--text-disabled)] uppercase tracking-wide px-1">
                  {CATEGORY_LABELS[cat as ServiceCategory]} — {totalForCat} insight{totalForCat !== 1 ? "s" : ""}
                </p>

                {/* Batches */}
                {Array.from(bucket.batches.values())
                  .sort((a, b) => +new Date(b.batch.createdAt) - +new Date(a.batch.createdAt))
                  .map((group) => {
                  const cfg = STATUS_CONFIG[group.batch.status];
                  const expanded = expandedBatch === group.batch.id;
                  const busy = acting === group.batch.id;
                  const insightsActive = group.insights.filter((i) => i.status === "ACTIVE").length;

                  return (
                    <div
                      key={group.batch.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
                    >
                      {/* Batch row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Layers size={15} className="text-[var(--accent)] shrink-0" />
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            Lote destilado — {BR_DATE.format(new Date(group.batch.createdAt))}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                            <span className={cfg.color}>{cfg.label}</span>
                            {" · "}
                            {group.insights.length} insight{group.insights.length !== 1 ? "s" : ""}
                            {group.batch.status === "ACTIVE" && insightsActive < group.insights.length && (
                              <span className="text-[var(--text-disabled)]"> ({insightsActive} ativos)</span>
                            )}
                            {group.batch.sourceCount > 0 && (
                              <> · {group.batch.sourceCount} conversa{group.batch.sourceCount !== 1 ? "s" : ""}</>
                            )}
                          </p>
                        </div>

                        {/* Batch actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {group.batch.status === "DRAFT" && (
                            <button
                              onClick={() => patchBatch(group.batch.id, "ACTIVE")}
                              disabled={busy}
                              title="Ativar lote inteiro"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-green-500 border border-green-500/30 hover:bg-green-500/10 disabled:opacity-50 transition"
                            >
                              <CheckCircle size={12} />
                              {busy ? "..." : "Ativar lote"}
                            </button>
                          )}
                          {group.batch.status === "ACTIVE" && (
                            <button
                              onClick={() => patchBatch(group.batch.id, "ARCHIVED")}
                              disabled={busy}
                              title="Arquivar lote inteiro"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition"
                            >
                              <Archive size={12} />
                              {busy ? "..." : "Arquivar"}
                            </button>
                          )}
                          {group.batch.status === "ARCHIVED" && (
                            <button
                              onClick={() => deleteBatch(group.batch.id)}
                              disabled={busy}
                              title="Deletar lote permanentemente"
                              className="p-1.5 rounded-lg text-[var(--text-disabled)] hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedBatch(expanded ? null : group.batch.id)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition"
                          >
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded: insights inside batch */}
                      {expanded && (
                        <div className="border-t border-[var(--border)] bg-[var(--background)] divide-y divide-[var(--border)]">
                          {group.insights.map((item) => {
                            const itemExpanded = expandedInsight === item.id;
                            const itemBusy = acting === item.id;
                            const itemCfg = STATUS_CONFIG[item.status];
                            return (
                              <div key={item.id} className="px-5 py-3">
                                <div className="flex items-start gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-2 ${itemCfg.dot}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{item.insight}</p>
                                    {itemExpanded && (item.examplePhrase || item.exampleResponse) && (
                                      <div className="space-y-1 border-l-2 border-[var(--accent)]/30 pl-3 mt-2">
                                        {item.examplePhrase && (
                                          <p className="text-xs text-[var(--text-muted)]">
                                            <span className="font-medium">Paciente:</span> &quot;{item.examplePhrase}&quot;
                                          </p>
                                        )}
                                        {item.exampleResponse && (
                                          <p className="text-xs text-[var(--text-muted)]">
                                            <span className="font-medium">Resposta modelo:</span> &quot;{item.exampleResponse}&quot;
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Insight individual: pode arquivar 1 só dentro de batch ACTIVE */}
                                    {group.batch.status === "ACTIVE" && item.status === "ACTIVE" && (
                                      <button
                                        onClick={() => patchInsight(item.id, { status: "ARCHIVED" })}
                                        disabled={itemBusy}
                                        title="Arquivar este insight (mantém o lote ativo)"
                                        className="p-1 rounded text-[var(--text-disabled)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition"
                                      >
                                        <Archive size={11} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setExpandedInsight(itemExpanded ? null : item.id)}
                                      className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition"
                                    >
                                      {itemExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Manual insights (no batch) */}
                {bucket.manuals.length > 0 && (
                  <div className="space-y-2">
                    {bucket.batches.size > 0 && (
                      <p className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-wider pl-1 pt-1 flex items-center gap-1.5">
                        <FileText size={10} />
                        Insights avulsos
                      </p>
                    )}
                    {bucket.manuals.map((item) => {
                      const cfg = STATUS_CONFIG[item.status];
                      const expanded = expandedInsight === item.id;
                      const busy = acting === item.id;

                      return (
                        <div
                          key={item.id}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
                        >
                          <div className="flex items-center gap-3 px-4 py-3">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.title}</p>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                                <span className={cfg.color}>{cfg.label}</span>
                                <span className="text-[var(--text-disabled)]"> · manual</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {item.status === "DRAFT" && (
                                <button
                                  onClick={() => patchInsight(item.id, { status: "ACTIVE" })}
                                  disabled={busy}
                                  title="Ativar insight"
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-green-500 border border-green-500/30 hover:bg-green-500/10 disabled:opacity-50 transition"
                                >
                                  <CheckCircle size={12} />
                                  {busy ? "..." : "Ativar"}
                                </button>
                              )}
                              {item.status === "ACTIVE" && (
                                <button
                                  onClick={() => patchInsight(item.id, { status: "ARCHIVED" })}
                                  disabled={busy}
                                  title="Arquivar"
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition"
                                >
                                  <Archive size={12} />
                                  {busy ? "..." : "Arquivar"}
                                </button>
                              )}
                              {item.status === "ARCHIVED" && (
                                <button
                                  onClick={() => deleteInsight(item.id)}
                                  disabled={busy}
                                  title="Deletar"
                                  className="p-1.5 rounded-lg text-[var(--text-disabled)] hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                              <button
                                onClick={() => setExpandedInsight(expanded ? null : item.id)}
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition"
                              >
                                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </div>
                          </div>

                          {expanded && (
                            <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--background)] space-y-3">
                              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.insight}</p>
                              {(item.examplePhrase || item.exampleResponse) && (
                                <div className="space-y-1 border-l-2 border-[var(--accent)]/30 pl-3">
                                  {item.examplePhrase && (
                                    <p className="text-xs text-[var(--text-muted)]">
                                      <span className="font-medium">Paciente:</span> &quot;{item.examplePhrase}&quot;
                                    </p>
                                  )}
                                  {item.exampleResponse && (
                                    <p className="text-xs text-[var(--text-muted)]">
                                      <span className="font-medium">Resposta modelo:</span> &quot;{item.exampleResponse}&quot;
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
