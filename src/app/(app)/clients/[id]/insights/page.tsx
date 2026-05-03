"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Sparkles, Pencil, Trash2, CheckCircle, Circle, X, ChevronDown } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/intelligence-constants";
import type { ServiceCategory, KnowledgeStatus, ClientInsightSource } from "@/generated/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientInsight {
  id: string;
  clientId: string;
  category: ServiceCategory | null;
  title: string;
  insight: string;
  example: string | null;
  status: KnowledgeStatus;
  appearedInConversations: number;
  attributedRevenueCents: number;
  source: ClientInsightSource;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  DRAFT:    "Rascunho",
  ACTIVE:   "Ativo",
  ARCHIVED: "Arquivado",
};

const STATUS_COLORS: Record<KnowledgeStatus, string> = {
  DRAFT:    "bg-amber-500/10 text-amber-500",
  ACTIVE:   "bg-emerald-500/10 text-emerald-500",
  ARCHIVED: "bg-[var(--border)] text-[var(--text-disabled)]",
};

const CATEGORY_OPTIONS: Array<{ value: ServiceCategory | ""; label: string }> = [
  { value: "", label: "Todas as especialidades" },
  ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({
    value: k as ServiceCategory,
    label: v,
  })),
];

const BRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Form ─────────────────────────────────────────────────────────────────────

interface InsightFormData {
  title: string;
  insight: string;
  category: ServiceCategory | "";
  example: string;
  status: KnowledgeStatus;
}

const EMPTY_FORM: InsightFormData = {
  title: "",
  insight: "",
  category: "",
  example: "",
  status: "DRAFT",
};

function InsightForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<InsightFormData>;
  onSave: (data: InsightFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<InsightFormData>({ ...EMPTY_FORM, ...initial });

  function set<K extends keyof InsightFormData>(key: K, value: InsightFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Título */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-medium text-[var(--text-disabled)] uppercase tracking-wide mb-1">
            Título
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex: Objeção de preço em implante"
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]/60"
          />
        </div>

        {/* Categoria */}
        <div>
          <label className="block text-[11px] font-medium text-[var(--text-disabled)] uppercase tracking-wide mb-1">
            Categoria
          </label>
          <div className="relative">
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value as ServiceCategory | "")}
              className="w-full appearance-none bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/60 pr-8"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-disabled)] pointer-events-none" />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-[11px] font-medium text-[var(--text-disabled)] uppercase tracking-wide mb-1">
            Status
          </label>
          <div className="relative">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as KnowledgeStatus)}
              className="w-full appearance-none bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/60 pr-8"
            >
              <option value="DRAFT">Rascunho</option>
              <option value="ACTIVE">Ativo</option>
              <option value="ARCHIVED">Arquivado</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-disabled)] pointer-events-none" />
          </div>
        </div>

        {/* Insight */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-medium text-[var(--text-disabled)] uppercase tracking-wide mb-1">
            Insight
          </label>
          <textarea
            value={form.insight}
            onChange={(e) => set("insight", e.target.value)}
            rows={3}
            placeholder="Descreva o padrão ou comportamento específico desta clínica que a Sofia deve incorporar..."
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]/60 resize-y"
          />
        </div>

        {/* Exemplo */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-medium text-[var(--text-disabled)] uppercase tracking-wide mb-1">
            Exemplo <span className="text-[var(--text-disabled)] normal-case font-normal">(opcional)</span>
          </label>
          <textarea
            value={form.example}
            onChange={(e) => set("example", e.target.value)}
            rows={2}
            placeholder='Paciente: "..." → Sofia: "..."'
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]/60 resize-y"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.title.trim() || !form.insight.trim()}
          className="px-4 py-1.5 text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {saving ? "Salvando..." : "Salvar insight"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function InsightRow({
  insight,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  insight: ClientInsight;
  onEdit: () => void;
  onStatusChange: (status: KnowledgeStatus) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={`rounded-xl border bg-[var(--surface)] p-4 space-y-2 transition-opacity ${
      insight.status === "ARCHIVED" ? "opacity-50 border-[var(--border)]" : "border-[var(--border)]"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--text-primary)]">{insight.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[insight.status]}`}>
              {STATUS_LABELS[insight.status]}
            </span>
            {insight.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-raised)] text-[var(--text-muted)]">
                {CATEGORY_LABELS[insight.category]}
              </span>
            )}
            {!insight.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-raised)] text-[var(--text-muted)]">
                Todas
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{insight.insight}</p>
          {insight.example && (
            <p className="text-xs text-[var(--text-disabled)] mt-1 italic">{insight.example}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {insight.status === "ACTIVE" ? (
            <button
              onClick={() => onStatusChange("ARCHIVED")}
              title="Arquivar"
              className="p-1.5 rounded-md text-[var(--text-disabled)] hover:text-amber-500 hover:bg-amber-500/5 transition-all"
            >
              <CheckCircle size={14} />
            </button>
          ) : (
            <button
              onClick={() => onStatusChange("ACTIVE")}
              title="Ativar"
              className="p-1.5 rounded-md text-[var(--text-disabled)] hover:text-emerald-500 hover:bg-emerald-500/5 transition-all"
            >
              <Circle size={14} />
            </button>
          )}
          <button
            onClick={onEdit}
            title="Editar"
            className="p-1.5 rounded-md text-[var(--text-disabled)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-all"
          >
            <Pencil size={13} />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onDelete}
                className="text-[11px] text-red-400 hover:text-red-300 border border-red-500/30 px-2 py-1 rounded-md transition-colors"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Apagar"
              className="p-1.5 rounded-md text-[var(--text-disabled)] hover:text-red-400 hover:bg-red-500/5 transition-all"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Metrics (shown only when non-zero) */}
      {(insight.appearedInConversations > 0 || insight.attributedRevenueCents > 0) && (
        <div className="flex items-center gap-4 pt-1 border-t border-[var(--border)]/50 text-[10px] text-[var(--text-disabled)]">
          {insight.appearedInConversations > 0 && (
            <span>{insight.appearedInConversations} conversa{insight.appearedInConversations !== 1 ? "s" : ""}</span>
          )}
          {insight.attributedRevenueCents > 0 && (
            <span className="text-emerald-500">{BRL(insight.attributedRevenueCents)} atribuídos</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { id } = useParams<{ id: string }>();
  const [insights, setInsights] = useState<ClientInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}/specific-insights`);
      if (!res.ok) throw new Error("Erro ao carregar insights");
      setInsights(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  async function handleCreate(data: InsightFormData) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${id}/specific-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          category: data.category || null,
          example: data.example.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      await fetchInsights();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(insightId: string, data: Partial<InsightFormData>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${id}/specific-insights/${insightId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          category: data.category !== undefined ? (data.category || null) : undefined,
          example: data.example !== undefined ? (data.example?.trim() || null) : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      await fetchInsights();
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(insightId: string) {
    try {
      const res = await fetch(`/api/clients/${id}/specific-insights/${insightId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao apagar");
      await fetchInsights();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  const activeInsights   = insights.filter((i) => i.status === "ACTIVE");
  const draftInsights    = insights.filter((i) => i.status === "DRAFT");
  const archivedInsights = insights.filter((i) => i.status === "ARCHIVED");

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Insights da Clínica</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Conhecimento específico desta clínica — tom, objeções e posicionamento únicos.
            Injetado na camada 2 do prompt de geração.
          </p>
          {activeInsights.length > 0 && (
            <p className="text-xs text-emerald-500 mt-1">
              {activeInsights.length} insight{activeInsights.length !== 1 ? "s" : ""} ativo{activeInsights.length !== 1 ? "s" : ""} — sendo injetado{activeInsights.length !== 1 ? "s" : ""} na próxima geração
            </p>
          )}
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors shrink-0"
        >
          <Plus size={14} />
          Novo insight
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <span className="font-medium">Erro:</span> {error}
        </div>
      )}

      {/* New form */}
      {showForm && (
        <InsightForm
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      {/* Empty state */}
      {insights.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center space-y-3">
          <Sparkles size={24} className="mx-auto text-[var(--text-disabled)]" />
          <div>
            <p className="text-sm font-medium text-[var(--text-muted)]">Nenhum insight cadastrado</p>
            <p className="text-xs text-[var(--text-disabled)] mt-1">
              Adicione padrões de tom, objeções e posicionamento únicos desta clínica.
              Eles serão injetados no próximo prompt gerado.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
          >
            <Plus size={14} />
            Criar primeiro insight
          </button>
        </div>
      )}

      {/* Insights by status */}
      {insights.length > 0 && (
        <div className="space-y-6">
          {/* Active */}
          {activeInsights.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-[0.12em] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Ativos — {activeInsights.length}
              </h3>
              {activeInsights.map((insight) =>
                editingId === insight.id ? (
                  <InsightForm
                    key={insight.id}
                    initial={{
                      title: insight.title,
                      insight: insight.insight,
                      category: insight.category ?? "",
                      example: insight.example ?? "",
                      status: insight.status,
                    }}
                    onSave={(data) => handleUpdate(insight.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                ) : (
                  <InsightRow
                    key={insight.id}
                    insight={insight}
                    onEdit={() => setEditingId(insight.id)}
                    onStatusChange={(status) => handleUpdate(insight.id, { status })}
                    onDelete={() => handleDelete(insight.id)}
                  />
                )
              )}
            </section>
          )}

          {/* Draft */}
          {draftInsights.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-[0.12em] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                Rascunho — {draftInsights.length}
              </h3>
              {draftInsights.map((insight) =>
                editingId === insight.id ? (
                  <InsightForm
                    key={insight.id}
                    initial={{
                      title: insight.title,
                      insight: insight.insight,
                      category: insight.category ?? "",
                      example: insight.example ?? "",
                      status: insight.status,
                    }}
                    onSave={(data) => handleUpdate(insight.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                ) : (
                  <InsightRow
                    key={insight.id}
                    insight={insight}
                    onEdit={() => setEditingId(insight.id)}
                    onStatusChange={(status) => handleUpdate(insight.id, { status })}
                    onDelete={() => handleDelete(insight.id)}
                  />
                )
              )}
            </section>
          )}

          {/* Archived */}
          {archivedInsights.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-[0.12em] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 inline-block" />
                Arquivados — {archivedInsights.length}
              </h3>
              {archivedInsights.map((insight) =>
                editingId === insight.id ? (
                  <InsightForm
                    key={insight.id}
                    initial={{
                      title: insight.title,
                      insight: insight.insight,
                      category: insight.category ?? "",
                      example: insight.example ?? "",
                      status: insight.status,
                    }}
                    onSave={(data) => handleUpdate(insight.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                ) : (
                  <InsightRow
                    key={insight.id}
                    insight={insight}
                    onEdit={() => setEditingId(insight.id)}
                    onStatusChange={(status) => handleUpdate(insight.id, { status })}
                    onDelete={() => handleDelete(insight.id)}
                  />
                )
              )}
            </section>
          )}
        </div>
      )}

      {/* Footnote */}
      <div className="rounded-xl border border-[var(--border)]/50 bg-[var(--background)] p-3 text-[11px] text-[var(--text-muted)] flex gap-2">
        <Sparkles size={12} className="text-[var(--accent)] shrink-0 mt-0.5" />
        <span>
          <strong className="text-[var(--text-primary)]">Como funciona:</strong> insights ativos desta clínica são injetados na
          seção <em>&ldquo;Tom e Posicionamento desta Clínica&rdquo;</em> do prompt, após os padrões cross-tenant da categoria.
          Isso cria um segundo nível de personalização — o switching cost real.
        </span>
      </div>
    </div>
  );
}
