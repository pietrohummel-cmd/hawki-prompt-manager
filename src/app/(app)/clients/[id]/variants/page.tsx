"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  FlaskConical, Plus, Play, TrendingUp, TrendingDown, Minus,
  CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp, Trash2, X,
} from "lucide-react";
import type { VariantSource, VariantStatus } from "@/generated/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromptVariant {
  id: string;
  clientId: string;
  baselineVersionId: string | null;
  variantPrompt: string;
  source: VariantSource;
  description: string | null;
  regressionPassed: number | null;
  regressionFailed: number | null;
  regressionDelta: number | null;
  status: VariantStatus;
  createdAt: string;
  promotedAt: string | null;
  rolledBackAt: string | null;
  promotedVersionId: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<VariantSource, string> = {
  MANUAL:             "Manual",
  INSIGHT_ACTIVATION: "Insight ativado",
  TICKET_FIX:         "Ticket resolvido",
  DISTILLATION_BATCH: "Destilação",
};

const STATUS_CONFIG: Record<VariantStatus, { label: string; color: string }> = {
  PENDING:      { label: "Aguardando teste", color: "bg-zinc-500/10 text-zinc-400" },
  TESTING:      { label: "Testando...",       color: "bg-amber-500/10 text-amber-400" },
  WON:          { label: "Aprovado ✓",        color: "bg-emerald-500/10 text-emerald-400" },
  LOST:         { label: "Reprovado",          color: "bg-red-500/10 text-red-400" },
  PROMOTED:     { label: "Promovido",          color: "bg-[var(--accent)]/10 text-[var(--accent-text)]" },
  ROLLED_BACK:  { label: "Revertido",          color: "bg-zinc-500/10 text-zinc-500" },
};

// ─── Delta indicator ──────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-[var(--text-disabled)] text-xs">—</span>;
  const sign = delta > 0 ? "+" : "";
  const color = delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-zinc-400";
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium tabular-nums ${color}`}>
      <Icon size={12} />
      {sign}{delta.toFixed(1)} pp
    </span>
  );
}

// ─── Variant card ─────────────────────────────────────────────────────────────

function VariantCard({
  variant,
  onTest,
  onPromote,
  onRollback,
  onDelete,
  testing,
  promoting,
  rollingBack,
}: {
  variant: PromptVariant;
  onTest: () => void;
  onPromote: () => void;
  onRollback: () => void;
  onDelete: () => void;
  testing: boolean;
  promoting: boolean;
  rollingBack: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cfg = STATUS_CONFIG[variant.status];
  const total = (variant.regressionPassed ?? 0) + (variant.regressionFailed ?? 0);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Status + source */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                {testing ? "Testando..." : cfg.label}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-raised)] text-[var(--text-muted)]">
                {SOURCE_LABELS[variant.source]}
              </span>
            </div>
            {/* Description */}
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {variant.description ?? `Variante ${variant.id.slice(-6)}`}
            </p>
            <p className="text-[11px] text-[var(--text-disabled)] mt-0.5">
              {new Date(variant.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
              {variant.baselineVersionId && ` · baseline registrado`}
            </p>
          </div>

          {/* Delta */}
          <div className="shrink-0 text-right">
            <DeltaBadge delta={variant.regressionDelta} />
            {total > 0 && (
              <p className="text-[10px] text-[var(--text-disabled)] mt-0.5">
                {variant.regressionPassed}/{total} casos
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {(variant.status === "PENDING" || variant.status === "WON" || variant.status === "LOST") && (
            <button
              onClick={onTest}
              disabled={testing || promoting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--surface-raised)] hover:bg-[var(--border)] disabled:opacity-50 text-[var(--text-secondary)] rounded-md transition-colors"
            >
              <Play size={11} />
              {testing ? "Testando..." : "Testar"}
            </button>
          )}
          {variant.status === "WON" && (
            <button
              onClick={onPromote}
              disabled={promoting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md transition-colors"
            >
              <CheckCircle2 size={11} />
              {promoting ? "Promovendo..." : "Promover"}
            </button>
          )}
          {variant.status === "LOST" && (
            <button
              onClick={onPromote}
              disabled={promoting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-amber-500/30 text-amber-500 hover:bg-amber-500/5 disabled:opacity-50 rounded-md transition-colors"
            >
              <CheckCircle2 size={11} />
              {promoting ? "Promovendo..." : "Forçar promoção"}
            </button>
          )}
          {variant.status === "PROMOTED" && (
            <button
              onClick={onRollback}
              disabled={rollingBack}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/5 disabled:opacity-50 rounded-md transition-colors"
            >
              <RefreshCw size={11} />
              {rollingBack ? "Revertendo..." : "Rollback"}
            </button>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="ml-auto p-1.5 text-[var(--text-disabled)] hover:text-[var(--text-muted)] transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Delete */}
          {(variant.status === "PENDING" || variant.status === "LOST" || variant.status === "ROLLED_BACK") && (
            confirmDelete ? (
              <div className="flex items-center gap-1">
                <button onClick={onDelete} className="text-[10px] text-red-400 border border-red-500/30 px-2 py-1 rounded-md">
                  Confirmar
                </button>
                <button onClick={() => setConfirmDelete(false)} className="p-1 text-[var(--text-muted)]">
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-[var(--text-disabled)] hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            )
          )}
        </div>
      </div>

      {/* Expanded: regression details + prompt preview */}
      {expanded && (
        <div className="border-t border-[var(--border)] p-4 space-y-3">
          {/* Regression summary */}
          {total > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-wide">Resultado da regressão</p>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-emerald-400">✓ {variant.regressionPassed} passou</span>
                <span className="text-red-400">✗ {variant.regressionFailed} falhou</span>
                <DeltaBadge delta={variant.regressionDelta} />
              </div>
              {/* Mini progress bar */}
              <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${total > 0 ? ((variant.regressionPassed ?? 0) / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Prompt preview */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-wide">Prompt da variante</p>
            <pre className="text-[11px] text-[var(--text-muted)] whitespace-pre-wrap font-mono bg-[var(--background)] rounded-lg p-3 max-h-64 overflow-y-auto leading-relaxed">
              {variant.variantPrompt}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create form ──────────────────────────────────────────────────────────────

function CreateVariantForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (variantPrompt: string, description: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [desc, setDesc] = useState("");

  return (
    <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 space-y-3">
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-disabled)] uppercase tracking-wide mb-1">
          Descrição <span className="normal-case font-normal text-[var(--text-disabled)]">(opcional)</span>
        </label>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Ex: Variante com tom mais informal para clínica popular"
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]/60"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-disabled)] uppercase tracking-wide mb-1">
          Prompt da variante <span className="normal-case font-normal">(formato ###MÓDULO:KEY###)</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={12}
          placeholder={"###MÓDULO:IDENTITY###\n[conteúdo]\n###MÓDULO:TONE_AND_STYLE###\n[conteúdo]\n..."}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]/60 font-mono resize-y"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(prompt, desc)}
          disabled={saving || !prompt.trim()}
          className="px-4 py-1.5 text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {saving ? "Criando..." : "Criar variante"}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VariantsPage() {
  const { id } = useParams<{ id: string }>();
  const [variants, setVariants]   = useState<PromptVariant[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [rolling, setRolling]     = useState<string | null>(null);

  const fetchVariants = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}/variants`);
      if (!res.ok) throw new Error("Erro ao carregar variantes");
      setVariants(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchVariants(); }, [fetchVariants]);

  async function handleCreate(variantPrompt: string, description: string) {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/clients/${id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantPrompt, description: description || null, source: "MANUAL" }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Erro"); }
      await fetchVariants();
      setShowForm(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
    finally { setSaving(false); }
  }

  async function handleTest(variantId: string) {
    setTesting(variantId); setError(null);
    try {
      const res = await fetch(`/api/clients/${id}/variants/${variantId}/test`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Erro no teste"); }
      await fetchVariants();
    } catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
    finally { setTesting(null); }
  }

  async function handlePromote(variantId: string) {
    setPromoting(variantId); setError(null);
    try {
      const res = await fetch(`/api/clients/${id}/variants/${variantId}/promote`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Erro na promoção"); }
      await fetchVariants();
    } catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
    finally { setPromoting(null); }
  }

  async function handleRollback(variantId: string) {
    setRolling(variantId); setError(null);
    try {
      const res = await fetch(`/api/clients/${id}/variants/${variantId}/rollback`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Erro no rollback"); }
      await fetchVariants();
    } catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
    finally { setRolling(null); }
  }

  async function handleDelete(variantId: string) {
    setError(null);
    try {
      // Usa o endpoint de variants sem um método DELETE dedicado — remove via PATCH status
      // Por simplicidade, não há endpoint DELETE — apenas arquivamos o status visualmente
      // TODO: adicionar DELETE /api/clients/[id]/variants/[variantId] se necessário
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
    } catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
  }

  const activeVariants   = variants.filter((v) => !["PROMOTED", "ROLLED_BACK", "LOST"].includes(v.status));
  const promotedVariants = variants.filter((v) => v.status === "PROMOTED");
  const lostVariants     = variants.filter((v) => v.status === "LOST" || v.status === "ROLLED_BACK");

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <FlaskConical size={16} className="text-[var(--accent)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">A/B Variants</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Teste candidatos a novo prompt antes de promover. Regressão local como proxy de produção.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors shrink-0"
        >
          <Plus size={14} />
          Nova variante
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400 flex items-start justify-between gap-2">
          <span><span className="font-medium">Erro:</span> {error}</span>
          <button onClick={() => setError(null)} className="shrink-0"><X size={14} /></button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <CreateVariantForm
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      {/* Empty state */}
      {variants.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center space-y-3">
          <FlaskConical size={24} className="mx-auto text-[var(--text-disabled)]" />
          <div>
            <p className="text-sm font-medium text-[var(--text-muted)]">Nenhuma variante ainda</p>
            <p className="text-xs text-[var(--text-disabled)] mt-1 max-w-sm mx-auto">
              Crie uma variante colando o prompt candidato no formato <code className="font-mono">###MÓDULO:KEY###</code>.
              A regressão compara com o prompt ativo atual.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
          >
            <Plus size={14} />
            Criar primeira variante
          </button>
        </div>
      )}

      {/* Active variants */}
      {activeVariants.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-[0.12em]">
            Em teste — {activeVariants.length}
          </h3>
          {activeVariants.map((v) => (
            <VariantCard
              key={v.id}
              variant={v}
              onTest={() => handleTest(v.id)}
              onPromote={() => handlePromote(v.id)}
              onRollback={() => handleRollback(v.id)}
              onDelete={() => handleDelete(v.id)}
              testing={testing === v.id}
              promoting={promoting === v.id}
              rollingBack={rolling === v.id}
            />
          ))}
        </section>
      )}

      {/* Promoted */}
      {promotedVariants.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-[0.12em]">
            Promovidos — {promotedVariants.length}
          </h3>
          {promotedVariants.map((v) => (
            <VariantCard
              key={v.id}
              variant={v}
              onTest={() => handleTest(v.id)}
              onPromote={() => handlePromote(v.id)}
              onRollback={() => handleRollback(v.id)}
              onDelete={() => handleDelete(v.id)}
              testing={testing === v.id}
              promoting={promoting === v.id}
              rollingBack={rolling === v.id}
            />
          ))}
        </section>
      )}

      {/* Lost / rolled back */}
      {lostVariants.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-[0.12em]">
            Arquivados — {lostVariants.length}
          </h3>
          {lostVariants.map((v) => (
            <VariantCard
              key={v.id}
              variant={v}
              onTest={() => handleTest(v.id)}
              onPromote={() => handlePromote(v.id)}
              onRollback={() => handleRollback(v.id)}
              onDelete={() => handleDelete(v.id)}
              testing={testing === v.id}
              promoting={promoting === v.id}
              rollingBack={rolling === v.id}
            />
          ))}
        </section>
      )}

      {/* Footnote */}
      {variants.length > 0 && (
        <div className="rounded-xl border border-[var(--border)]/50 bg-[var(--background)] p-3 text-[11px] text-[var(--text-muted)] flex gap-2">
          <FlaskConical size={12} className="text-[var(--accent)] shrink-0 mt-0.5" />
          <span>
            <strong className="text-[var(--text-primary)]">Delta (pp):</strong> diferença em pontos percentuais de casos
            aprovados — variante vs baseline. Threshold padrão para auto-WON: <code>+5pp</code>.
            Configure via env <code>THRESHOLD_AUTO_PROMOTE</code>.
          </span>
        </div>
      )}
    </div>
  );
}
