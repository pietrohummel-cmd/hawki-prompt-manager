"use client";

import { useEffect, useState, useCallback } from "react";
import { Upload, CheckCircle, XCircle, Clock, Filter, ChevronDown, ChevronUp, Sparkles, Zap, FlaskConical, Files, FileText } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_KEYS } from "@/lib/intelligence-constants";
import type { ServiceCategory, InteractionStatus, ConvOutcome } from "@/generated/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Interaction {
  id: string;
  category: ServiceCategory;
  transcript: string;
  outcome: ConvOutcome;
  status: InteractionStatus;
  reviewNote: string | null;
  scoreQuality:   number | null;
  scoreTone:      number | null;
  scoreObjection: number | null;
  uploadedAt: string;
  reviewedAt: string | null;
}

interface DistillResult {
  category: ServiceCategory;
  batchId: string | null;
  sourceCount: number;
  insightsCreated: number;
  draftBatchesArchived: number;
}

// ─── Score bar helper ─────────────────────────────────────────────────────────

function ScoreBar({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[10px] text-[var(--text-disabled)] shrink-0 w-14 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--border)]">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-[var(--text-muted)] shrink-0 w-6 text-right">{pct}%</span>
    </div>
  );
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InteractionStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDING_REVIEW: { label: "Pendente", color: "text-amber-500",  icon: Clock },
  APPROVED:       { label: "Aprovada", color: "text-green-500",  icon: CheckCircle },
  REJECTED:       { label: "Rejeitada",color: "text-red-400",    icon: XCircle },
};

const OUTCOME_LABELS: Record<ConvOutcome, string> = {
  SCHEDULED:     "Agendou",
  NOT_SCHEDULED: "Não agendou",
  LOST:          "Perdido",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function InteligenciaPage() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<InteractionStatus | "">("");
  const [filterCategory, setFilterCategory] = useState<ServiceCategory | "">("");
  const [page, setPage] = useState(1);

  // Upload form — tabs: "single" | "bulk"
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTab, setUploadTab] = useState<"single" | "bulk">("single");
  const [rawTranscript, setRawTranscript] = useState("");
  const [uploadCategory, setUploadCategory] = useState<ServiceCategory>("IMPLANTES");
  const [uploadOutcome, setUploadOutcome] = useState<ConvOutcome | "">("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Bulk upload
  const [bulkText, setBulkText] = useState("");
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = useState<ServiceCategory>("IMPLANTES");
  const [bulkOutcome, setBulkOutcome] = useState<ConvOutcome | "">("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ conversationsFound: number; created: number; failed: number } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Review
  const [reviewing, setReviewing] = useState<string | null>(null);

  // Distill
  const [distilling, setDistilling] = useState<ServiceCategory | null>(null);
  const [distillResult, setDistillResult] = useState<DistillResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filterStatus)   params.set("status",   filterStatus);
      if (filterCategory) params.set("category", filterCategory);
      const res = await fetch(`/api/intelligence/interactions?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setInteractions(data.items);
      setTotal(data.total);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterCategory]);

  useEffect(() => { load(); }, [load]);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [filterStatus, filterCategory]);

  // ─── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/intelligence/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawTranscript,
          category: uploadCategory,
          outcome: uploadOutcome || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao enviar");
      }
      setShowUpload(false);
      setRawTranscript("");
      setUploadOutcome("");
      load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setUploading(false);
    }
  }

  // ─── Review ────────────────────────────────────────────────────────────────

  async function review(id: string, status: "APPROVED" | "REJECTED") {
    setReviewing(id);
    try {
      await fetch(`/api/intelligence/interactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      load();
    } finally {
      setReviewing(null);
    }
  }

  async function distill(category: ServiceCategory) {
    setDistilling(category);
    setDistillResult(null);
    try {
      const res = await fetch("/api/intelligence/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `HTTP ${res.status}`);
      setDistillResult(data as DistillResult);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao destilar");
    } finally {
      setDistilling(null);
    }
  }

  // ─── Bulk upload ──────────────────────────────────────────────────────────

  async function handleBulkUpload(e: React.FormEvent) {
    e.preventDefault();
    setBulkError(null);
    setBulkResult(null);
    setBulkUploading(true);
    try {
      const res = await fetch("/api/intelligence/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: bulkText,
          category: bulkCategory,
          outcome: bulkOutcome || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no upload em lote");
      setBulkResult(data);
      setBulkText("");
      setBulkFileName(null);
      load();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setBulkUploading(false);
    }
  }

  function handleBulkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkError(null);
    setBulkResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => setBulkText((ev.target?.result as string) ?? "");
    reader.onerror = () => setBulkError("Não foi possível ler o arquivo.");
    reader.readAsText(file, "utf-8");
    // Reset so the same file can be re-selected after clearing
    e.target.value = "";
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const pageCount = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-[var(--accent)]" />
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Inteligência Hawki</h1>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Conversas aprovadas alimentam o conhecimento cross-tenant da Sofia.
          </p>
        </div>
        <button
          onClick={() => { setShowUpload((v) => !v); setBulkResult(null); }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition press shrink-0"
        >
          <Upload size={14} />
          Enviar conversa
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[var(--border)] pb-3">
            <button
              onClick={() => setUploadTab("single")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${uploadTab === "single" ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}
            >
              <Upload size={12} /> Transcrição manual
            </button>
            <button
              onClick={() => setUploadTab("bulk")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${uploadTab === "bulk" ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}
            >
              <Files size={12} /> Upload em lote (WhatsApp)
            </button>
          </div>

          {/* Bulk result banner */}
          {bulkResult && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-2.5 text-sm text-green-500 flex items-center gap-2">
              <CheckCircle size={14} />
              {bulkResult.conversationsFound} conversa{bulkResult.conversationsFound !== 1 ? "s" : ""} encontrada{bulkResult.conversationsFound !== 1 ? "s" : ""} — {bulkResult.created} criada{bulkResult.created !== 1 ? "s" : ""}
              {bulkResult.failed > 0 && ` · ${bulkResult.failed} falhou`}
            </div>
          )}

          {uploadTab === "bulk" ? (
            /* ── Bulk upload form ── */
            <form onSubmit={handleBulkUpload} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-muted)]">Categoria</label>
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value as ServiceCategory)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {CATEGORY_KEYS.map((k) => (
                      <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-muted)]">Desfecho (opcional)</label>
                  <select
                    value={bulkOutcome}
                    onChange={(e) => setBulkOutcome(e.target.value as ConvOutcome | "")}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    <option value="">Inferir automaticamente</option>
                    <option value="SCHEDULED">Agendou</option>
                    <option value="NOT_SCHEDULED">Não agendou</option>
                    <option value="LOST">Perdido</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-medium text-[var(--text-muted)]">
                  Exportação do WhatsApp
                </label>

                {/* File picker zone */}
                <label
                  htmlFor="bulk-file-input"
                  className="group relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-5 cursor-pointer hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 transition"
                >
                  <input
                    id="bulk-file-input"
                    type="file"
                    accept=".txt"
                    onChange={handleBulkFile}
                    className="sr-only"
                  />
                  {bulkFileName ? (
                    <div className="flex items-center gap-2.5">
                      <FileText size={16} className="text-[var(--accent)] shrink-0" />
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-xs">{bulkFileName}</span>
                      <span className="text-xs text-[var(--text-disabled)] shrink-0">
                        · {bulkText.length.toLocaleString("pt-BR")} caracteres
                      </span>
                      <button
                        type="button"
                        title="Remover arquivo"
                        onClick={(e) => { e.preventDefault(); setBulkFileName(null); setBulkText(""); }}
                        className="ml-1 text-[var(--text-disabled)] hover:text-red-400 transition shrink-0"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={20} className="text-[var(--text-disabled)] group-hover:text-[var(--accent)] transition" />
                      <div className="text-center">
                        <p className="text-sm text-[var(--text-muted)]">
                          Clique para selecionar o arquivo <span className="font-mono text-xs text-[var(--accent)]">.txt</span>
                        </p>
                        <p className="text-[11px] text-[var(--text-disabled)] mt-0.5">
                          Exportação do WhatsApp (Android ou iOS) · conversas com +4h de silêncio são separadas
                        </p>
                      </div>
                    </>
                  )}
                </label>

                {/* Divider */}
                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-disabled)]">ou cole o texto</span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>

                {/* Textarea fallback */}
                <textarea
                  value={bulkText}
                  onChange={(e) => { setBulkText(e.target.value); setBulkFileName(null); }}
                  placeholder={"27/04/2024 14:32 - Paciente: Boa tarde, gostaria de informações sobre implantes\n27/04/2024 14:33 - Atendente: Olá! Claro, posso te ajudar..."}
                  rows={6}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-mono text-[var(--text-secondary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                />
              </div>
              {bulkError && (
                <p className="text-xs text-red-500">{bulkError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={bulkUploading || !bulkText.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition"
                >
                  <Files size={14} />
                  {bulkUploading ? "Processando..." : "Processar lote"}
                </button>
              </div>
            </form>
          ) : (
            /* ── Single transcript form (original) ── */
            <><h2 className="text-sm font-semibold text-[var(--text-primary)]">Nova transcrição</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-muted)]">Categoria</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as ServiceCategory)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {CATEGORY_KEYS.map((k) => (
                    <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-muted)]">Desfecho</label>
                <select
                  value={uploadOutcome}
                  onChange={(e) => setUploadOutcome(e.target.value as ConvOutcome | "")}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Inferir automaticamente</option>
                  <option value="SCHEDULED">Agendou</option>
                  <option value="NOT_SCHEDULED">Não agendou</option>
                  <option value="LOST">Perdido</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-muted)]">
                Transcrição bruta
                <span className="ml-1 text-[var(--text-disabled)]">(será anonimizada automaticamente)</span>
              </label>
              <textarea
                value={rawTranscript}
                onChange={(e) => setRawTranscript(e.target.value)}
                required
                minLength={50}
                rows={10}
                placeholder={"[18/04/2025 14:30] Sofia: Olá! Como posso ajudar?\n[18/04/2025 14:31] Paciente: Quero saber sobre implante..."}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y"
              />
            </div>

            {uploadError && (
              <p className="text-xs text-red-500">{uploadError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition press"
              >
                {uploading ? "Enviando..." : "Enviar e anonimizar"}
              </button>
            </div>
          </form>
          </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Filter size={12} />
          <span>Filtros:</span>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as InteractionStatus | "")}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="">Todos os status</option>
          <option value="PENDING_REVIEW">Pendentes</option>
          <option value="APPROVED">Aprovadas</option>
          <option value="REJECTED">Rejeitadas</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as ServiceCategory | "")}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="">Todas as categorias</option>
          {CATEGORY_KEYS.map((k) => (
            <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
          ))}
        </select>
        <span className="text-xs text-[var(--text-disabled)] ml-auto">{total} conversa{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Distill controls */}
      {filterCategory && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => distill(filterCategory as ServiceCategory)}
            disabled={distilling !== null}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-50 transition press"
          >
            <FlaskConical size={12} />
            {distilling === filterCategory ? "Destilando..." : `Destilar insights — ${CATEGORY_LABELS[filterCategory as ServiceCategory]}`}
          </button>
          {distillResult?.category === filterCategory && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <Zap size={11} />
              Lote criado com {distillResult.insightsCreated} insight{distillResult.insightsCreated !== 1 ? "s" : ""} a partir de {distillResult.sourceCount} conversas
              {distillResult.draftBatchesArchived > 0 && ` (${distillResult.draftBatchesArchived} rascunho${distillResult.draftBatchesArchived !== 1 ? "s" : ""} anterior${distillResult.draftBatchesArchived !== 1 ? "es" : ""} arquivado${distillResult.draftBatchesArchived !== 1 ? "s" : ""})`}
              {distillResult.batchId && " · ative o lote em Base de Conhecimento"}
            </span>
          )}
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">
          <span className="font-medium">Erro ao carregar:</span> {loadError}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-[var(--surface)] animate-pulse" />
          ))}
        </div>
      ) : interactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">Nenhuma conversa encontrada.</p>
          <p className="text-xs text-[var(--text-disabled)] mt-1">
            Envie transcrições reais para começar a construir a base de inteligência.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {interactions.map((item) => {
            const cfg = STATUS_CONFIG[item.status];
            const StatusIcon = cfg.icon;
            const expanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
              >
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <StatusIcon size={14} className={`shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                        item.outcome === "SCHEDULED"
                          ? "border-green-500/30 bg-green-500/10 text-green-500"
                          : item.outcome === "LOST"
                          ? "border-red-400/30 bg-red-400/10 text-red-400"
                          : "border-[var(--border)] text-[var(--text-muted)]"
                      }`}>
                        {OUTCOME_LABELS[item.outcome]}
                      </span>
                      <span className="text-xs text-[var(--text-disabled)]">
                        {new Date(item.uploadedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.status === "PENDING_REVIEW" && (
                      <>
                        <button
                          onClick={() => review(item.id, "APPROVED")}
                          disabled={reviewing === item.id}
                          title="Aprovar"
                          className="p-1.5 rounded-lg text-green-500 hover:bg-green-500/10 disabled:opacity-40 transition press"
                        >
                          <CheckCircle size={15} />
                        </button>
                        <button
                          onClick={() => review(item.id, "REJECTED")}
                          disabled={reviewing === item.id}
                          title="Rejeitar"
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 disabled:opacity-40 transition press"
                        >
                          <XCircle size={15} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-raised)] transition"
                    >
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Transcript preview */}
                {expanded && (
                  <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--background)] space-y-3">
                    {/* Scores (só para aprovadas com score) */}
                    {item.status === "APPROVED" && (item.scoreQuality !== null || item.scoreTone !== null) && (
                      <div className="space-y-1.5 pb-2 border-b border-[var(--border)]">
                        <p className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-wide">Score automático</p>
                        <ScoreBar value={item.scoreQuality}   label="Qualidade" />
                        <ScoreBar value={item.scoreTone}      label="Tom" />
                        <ScoreBar value={item.scoreObjection} label="Objeções" />
                      </div>
                    )}
                    {item.status === "APPROVED" && item.scoreQuality === null && (
                      <p className="text-[10px] text-[var(--text-disabled)] italic">Score sendo calculado...</p>
                    )}
                    <p className="text-xs font-mono whitespace-pre-wrap text-[var(--text-secondary)] leading-relaxed max-h-72 overflow-y-auto">
                      {item.transcript}
                    </p>
                    {item.reviewNote && (
                      <p className="text-xs text-[var(--text-muted)] italic">
                        Nota: {item.reviewNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40 transition"
          >
            Anterior
          </button>
          <span className="px-3 py-1.5 text-xs text-[var(--text-muted)]">
            {page} / {pageCount}
          </span>
          <button
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40 transition"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
