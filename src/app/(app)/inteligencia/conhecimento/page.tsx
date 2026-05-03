"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, Archive, Trash2, ChevronDown, ChevronUp, Plus, Zap, Filter } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_KEYS } from "@/lib/intelligence-constants";
import type { ServiceCategory, KnowledgeStatus } from "@/generated/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KnowledgeItem {
  id: string;
  category: ServiceCategory;
  title: string;
  insight: string;
  examplePhrase: string | null;
  exampleResponse: string | null;
  status: KnowledgeStatus;
  sourceCount: number;
  createdAt: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<KnowledgeStatus, { label: string; color: string; dot: string }> = {
  ACTIVE:   { label: "Ativo",    color: "text-green-500",  dot: "bg-green-500" },
  DRAFT:    { label: "Rascunho", color: "text-amber-400",  dot: "bg-amber-400" },
  ARCHIVED: { label: "Arquivado",color: "text-[var(--text-disabled)]", dot: "bg-[var(--text-disabled)]" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConhecimentoPage() {
  const [items, setItems]             = useState<KnowledgeItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<ServiceCategory | "">("");
  const [filterStatus, setFilterStatus]     = useState<KnowledgeStatus | "">("");
  const [acting, setActing]           = useState<string | null>(null); // id in flight

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

  async function patch(id: string, body: Record<string, unknown>) {
    setActing(id);
    try {
      const res = await fetch(`/api/intelligence/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Erro ao atualizar");
        return;
      }
      load();
    } finally {
      setActing(null);
    }
  }

  async function remove(id: string) {
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

  // Agrupa por categoria para exibição
  const grouped = items.reduce<Record<string, KnowledgeItem[]>>((acc, item) => {
    const key = item.category;
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});

  const draftCount  = items.filter((i) => i.status === "DRAFT").length;
  const activeCount = items.filter((i) => i.status === "ACTIVE").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Base de Conhecimento</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Insights destilados de conversas reais — injetados automaticamente na geração de prompts.
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
      {draftCount > 0 && !filterStatus && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-500 flex items-center gap-2">
          <Zap size={14} className="shrink-0" />
          {draftCount} insight{draftCount !== 1 ? "s" : ""} aguardando ativação. Ao ativar, os insights ativos anteriores da mesma categoria serão arquivados automaticamente.
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl bg-[var(--surface)] animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Nenhum insight encontrado. Use a aba de conversas para destilar conhecimento.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} className="space-y-2">
              {/* Category header */}
              <p className="text-xs font-semibold text-[var(--text-disabled)] uppercase tracking-wide px-1">
                {CATEGORY_LABELS[cat as ServiceCategory]} — {catItems.length} insight{catItems.length !== 1 ? "s" : ""}
              </p>

              {catItems.map((item) => {
                const cfg = STATUS_CONFIG[item.status];
                const expanded = expandedId === item.id;
                const busy = acting === item.id;

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
                  >
                    {/* Row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Status dot */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

                      {/* Title + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.title}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                          <span className={cfg.color}>{cfg.label}</span>
                          {item.sourceCount > 0 && (
                            <> · {item.sourceCount} conversa{item.sourceCount !== 1 ? "s" : ""}</>
                          )}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {item.status === "DRAFT" && (
                          <button
                            onClick={() => patch(item.id, { status: "ACTIVE" })}
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
                            onClick={() => patch(item.id, { status: "ARCHIVED" })}
                            disabled={busy}
                            title="Arquivar insight"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition"
                          >
                            <Archive size={12} />
                            {busy ? "..." : "Arquivar"}
                          </button>
                        )}
                        {item.status === "ARCHIVED" && (
                          <button
                            onClick={() => remove(item.id)}
                            disabled={busy}
                            title="Deletar insight"
                            className="p-1.5 rounded-lg text-[var(--text-disabled)] hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedId(expanded ? null : item.id)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition"
                        >
                          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {expanded && (
                      <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--background)] space-y-3">
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.insight}</p>
                        {(item.examplePhrase || item.exampleResponse) && (
                          <div className="space-y-1 border-l-2 border-[var(--accent)]/30 pl-3">
                            {item.examplePhrase && (
                              <p className="text-xs text-[var(--text-muted)]">
                                <span className="font-medium">Paciente:</span> "{item.examplePhrase}"
                              </p>
                            )}
                            {item.exampleResponse && (
                              <p className="text-xs text-[var(--text-muted)]">
                                <span className="font-medium">Resposta modelo:</span> "{item.exampleResponse}"
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
          ))}
        </div>
      )}
    </div>
  );
}
