"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Plus, X, Sparkles, Check, ChevronDown, ChevronUp,
  AlertCircle, Ticket,
} from "lucide-react";
import { MODULE_LABELS, MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey, TicketPriority, TicketStatus } from "@/generated/prisma";
import { Toast, useToast } from "@/components/toast";

/* ── Constantes ─────────────────────────────────────────── */

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  CRITICAL: "Crítico",
  NORMAL: "Normal",
  IMPROVEMENT: "Melhoria",
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  CRITICAL: "bg-red-500/10 text-red-400",
  NORMAL:   "bg-[var(--surface-raised)] text-[var(--text-muted)]",
  IMPROVEMENT: "bg-blue-500/10 text-blue-400",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN:       "Aberto",
  SUGGESTED:  "Sugestão gerada",
  APPROVED:   "Aprovado",
  APPLIED:    "Aplicado",
  REJECTED:   "Rejeitado",
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN:      "bg-amber-500/10 text-amber-400",
  SUGGESTED: "bg-[var(--accent-subtle)] text-[var(--accent-text)]",
  APPROVED:  "bg-blue-500/10 text-blue-400",
  APPLIED:   "bg-emerald-500/10 text-emerald-400",
  REJECTED:  "bg-[var(--surface-raised)] text-[var(--text-disabled)]",
};

const MODULE_KEYS = MODULE_ORDER as ModuleKey[];

type StatusFilter = TicketStatus | "ALL";

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: "ALL",       label: "Todos" },
  { value: "OPEN",      label: "Abertos" },
  { value: "SUGGESTED", label: "Com sugestão" },
  { value: "APPLIED",   label: "Aplicados" },
  { value: "REJECTED",  label: "Rejeitados" },
];

/* ── Tipos ──────────────────────────────────────────────── */

interface Ticket {
  id: string;
  description: string;
  conversationTranscript: string | null;
  affectedModule: ModuleKey | null;
  priority: TicketPriority;
  status: TicketStatus;
  aiSuggestion: string | null;
  finalCorrection: string | null;
  createdAt: string;
  promptVersion: { version: number };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Componente principal ───────────────────────────────── */

export default function TicketsPage() {
  const { id } = useParams<{ id: string }>();
  const { toast, showToast, dismiss } = useToast();

  const [tickets, setTickets]   = useState<Ticket[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // Modal novo ticket
  const [showForm, setShowForm]         = useState(false);
  const [formDesc, setFormDesc]         = useState("");
  const [formTranscript, setFormTranscript] = useState("");
  const [formModule, setFormModule]     = useState<ModuleKey | "">("");
  const [formPriority, setFormPriority] = useState<TicketPriority>("NORMAL");
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState<string | null>(null);

  // Estado por ticket
  const [suggesting, setSuggesting]       = useState<string | null>(null);
  const [applying, setApplying]           = useState<string | null>(null);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<Record<string, string>>({});
  const [editingModule, setEditingModule] = useState<Record<string, ModuleKey | "">>({});
  const [savingModule, setSavingModule]   = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}/tickets`);
      if (!res.ok) throw new Error("Erro ao carregar tickets");
      setTickets(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Fechar modal com Escape
  useEffect(() => {
    if (!showForm) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeForm(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showForm]);

  function closeForm() {
    setShowForm(false);
    setFormDesc(""); setFormTranscript(""); setFormModule(""); setFormPriority("NORMAL");
    setCreateError(null);
  }

  async function handleCreate() {
    if (!formDesc.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`/api/clients/${id}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formDesc,
          conversationTranscript: formTranscript || undefined,
          affectedModule: formModule || undefined,
          priority: formPriority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar ticket");
      closeForm();
      await load();
      showToast({ type: "success", message: "Ticket criado com sucesso." });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao criar");
    } finally {
      setCreating(false);
    }
  }

  async function handleSuggest(ticketId: string) {
    setSuggesting(ticketId);
    try {
      const res = await fetch(`/api/clients/${id}/tickets/${ticketId}/suggest`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar sugestão");
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? data : t)));
      setEditingSuggestion((prev) => ({ ...prev, [ticketId]: data.aiSuggestion ?? "" }));
      setExpandedTicket(ticketId);
      showToast({ type: "success", message: "Sugestão da IA gerada." });
    } catch (err) {
      showToast({ type: "error", message: err instanceof Error ? err.message : "Erro ao sugerir" });
    } finally {
      setSuggesting(null);
    }
  }

  async function handleApply(ticket: Ticket) {
    const content = editingSuggestion[ticket.id] ?? ticket.aiSuggestion ?? "";
    if (!content) return;
    setApplying(ticket.id);
    try {
      const res = await fetch(`/api/clients/${id}/tickets/${ticket.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalCorrection: content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao aplicar");
      await load();
      setExpandedTicket(null);
      showToast({
        type: "success",
        message: "Correção aplicada. Nova versão criada.",
        action: {
          label: "Ver prompt",
          onClick: () => {
            // Dispara o botão "Ver prompt completo" no ClientNav
            const btn = document.querySelector<HTMLButtonElement>("[data-prompt-modal]");
            btn?.click();
          },
        },
      });
    } catch (err) {
      showToast({ type: "error", message: err instanceof Error ? err.message : "Erro ao aplicar" });
    } finally {
      setApplying(null);
    }
  }

  async function handleReject(ticketId: string) {
    try {
      await fetch(`/api/clients/${id}/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      await load();
      showToast({ type: "success", message: "Ticket rejeitado." });
    } catch {
      showToast({ type: "error", message: "Erro ao rejeitar ticket." });
    }
  }

  async function handleSaveModule(ticketId: string) {
    const newModule = editingModule[ticketId];
    if (newModule === undefined) return;
    setSavingModule(ticketId);
    try {
      const res = await fetch(`/api/clients/${id}/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affectedModule: newModule || null }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar módulo");
      const updated = await res.json();
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
      setEditingModule((prev) => { const n = { ...prev }; delete n[ticketId]; return n; });
      showToast({ type: "success", message: "Módulo atualizado." });
    } catch (err) {
      showToast({ type: "error", message: err instanceof Error ? err.message : "Erro ao salvar" });
    } finally {
      setSavingModule(null);
    }
  }

  // Filtros
  const filtered = tickets.filter((t) =>
    statusFilter === "ALL" ? true : t.status === statusFilter
  );

  const countByStatus = (s: TicketStatus) => tickets.filter((t) => t.status === s).length;
  const openCount = countByStatus("OPEN") + countByStatus("SUGGESTED");

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-16" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[13px] text-[var(--text-muted)]">
            {openCount > 0
              ? <><span className="text-amber-400 font-medium">{openCount} pendente{openCount !== 1 ? "s" : ""}</span> · {tickets.length} total</>
              : `${tickets.length} ticket${tickets.length !== 1 ? "s" : ""}`}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="press flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors duration-150"
          >
            <Plus size={13} />
            Novo ticket
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-[13px] px-4 py-3 rounded-lg mb-4">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Filtro por status */}
        {tickets.length > 0 && (
          <div className="flex gap-1 mb-4 flex-wrap">
            {FILTER_TABS.map(({ value, label }) => {
              const count = value === "ALL" ? tickets.length : countByStatus(value as TicketStatus);
              if (value !== "ALL" && count === 0) return null;
              return (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`press text-[12px] px-3 py-1.5 rounded-md border transition-all duration-150 flex items-center gap-1.5 ${
                    statusFilter === value
                      ? "border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-subtle)]"
                      : "border-[var(--surface-border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                      statusFilter === value
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface-raised)] text-[var(--text-disabled)]"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Estado vazio */}
        {tickets.length === 0 && (
          <div className="card p-12 text-center">
            <Ticket size={28} className="text-[var(--text-disabled)] mx-auto mb-3" />
            <p className="text-[var(--text-secondary)] text-[13px]">Nenhum ticket ainda.</p>
            <p className="text-[var(--text-disabled)] text-[12px] mt-1">
              Crie um ticket para registrar um problema ou melhoria no prompt.
            </p>
          </div>
        )}

        {filtered.length === 0 && tickets.length > 0 && (
          <div className="card p-8 text-center">
            <p className="text-[var(--text-muted)] text-[13px]">
              Nenhum ticket com status "{STATUS_LABELS[statusFilter as TicketStatus]}".
            </p>
          </div>
        )}

        {/* Lista de tickets */}
        <div className="space-y-2">
          {filtered.map((ticket, i) => {
            const expanded = expandedTicket === ticket.id;
            const suggestionContent = editingSuggestion[ticket.id] ?? ticket.aiSuggestion ?? "";
            const currentModule = editingModule[ticket.id] !== undefined
              ? editingModule[ticket.id]
              : (ticket.affectedModule ?? "");
            const canSuggest = currentModule && (ticket.status === "OPEN" || ticket.status === "SUGGESTED");
            const canApply = (ticket.status === "SUGGESTED" || ticket.status === "APPROVED") && suggestionContent;
            const isDone = ticket.status === "APPLIED" || ticket.status === "REJECTED";

            return (
              <div
                key={ticket.id}
                style={{ animationDelay: `${i * 30}ms` }}
                className="animate-fade-up card overflow-hidden"
              >
                {/* Cabeçalho do ticket */}
                <button
                  className="w-full flex items-start justify-between px-4 py-3.5 text-left hover:bg-[var(--surface-raised)]/50 transition-colors duration-150"
                  onClick={() => setExpandedTicket(expanded ? null : ticket.id)}
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-[13px] text-[var(--text-primary)] line-clamp-2 text-left">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ticket.status]}`}>
                        {STATUS_LABELS[ticket.status]}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                        {PRIORITY_LABELS[ticket.priority]}
                      </span>
                      {ticket.affectedModule && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {MODULE_LABELS[ticket.affectedModule]}
                        </span>
                      )}
                      <span className="text-[11px] text-[var(--text-disabled)] tabular-nums">
                        v{ticket.promptVersion.version} · {formatDate(ticket.createdAt)}
                      </span>
                    </div>
                  </div>
                  {expanded
                    ? <ChevronUp size={14} className="text-[var(--text-disabled)] shrink-0 mt-0.5" />
                    : <ChevronDown size={14} className="text-[var(--text-disabled)] shrink-0 mt-0.5" />}
                </button>

                {/* Detalhes do ticket */}
                {expanded && (
                  <div className="border-t border-[var(--surface-border)] px-4 py-4 space-y-4">

                    {/* Módulo afetado — editável */}
                    <div>
                      <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1.5 block">
                        Módulo afetado
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={currentModule}
                          onChange={(e) =>
                            setEditingModule((prev) => ({ ...prev, [ticket.id]: e.target.value as ModuleKey | "" }))
                          }
                          disabled={isDone}
                          className="flex-1 bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[13px] rounded-md px-3 py-2 focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
                        >
                          <option value="">Não especificado</option>
                          {MODULE_KEYS.map((key) => (
                            <option key={key} value={key}>{MODULE_LABELS[key]}</option>
                          ))}
                        </select>
                        {editingModule[ticket.id] !== undefined && (
                          <button
                            onClick={() => handleSaveModule(ticket.id)}
                            disabled={savingModule === ticket.id}
                            className="press flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50"
                          >
                            {savingModule === ticket.id ? (
                              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            Salvar
                          </button>
                        )}
                      </div>
                      {!currentModule && !isDone && (
                        <p className="text-[11px] text-amber-500/80 mt-1.5 flex items-center gap-1">
                          <AlertCircle size={11} />
                          Selecione um módulo para habilitar sugestão de IA.
                        </p>
                      )}
                    </div>

                    {/* Transcrição */}
                    {ticket.conversationTranscript && (
                      <div>
                        <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1.5">
                          Transcrição
                        </p>
                        <pre className="text-[12px] text-[var(--text-secondary)] bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-md p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-36 overflow-y-auto">
                          {ticket.conversationTranscript}
                        </pre>
                      </div>
                    )}

                    {/* Sugestão da IA */}
                    {(ticket.aiSuggestion || editingSuggestion[ticket.id]) && (
                      <div>
                        <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1.5">
                          Sugestão da IA{" "}
                          <span className="normal-case text-[var(--text-disabled)] tracking-normal">
                            — editável antes de aplicar
                          </span>
                        </p>
                        <textarea
                          value={suggestionContent}
                          onChange={(e) =>
                            setEditingSuggestion((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                          }
                          rows={8}
                          disabled={isDone}
                          className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[12px] rounded-md px-3 py-2.5 font-mono resize-none focus:outline-none focus:border-[var(--accent)] transition-colors leading-relaxed disabled:opacity-60"
                        />
                      </div>
                    )}

                    {/* Ações */}
                    {!isDone && (
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {canSuggest && (
                          <button
                            onClick={() => handleSuggest(ticket.id)}
                            disabled={suggesting === ticket.id || applying === ticket.id}
                            className="press flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] bg-[var(--surface-raised)] hover:bg-[var(--surface-border)] border border-[var(--surface-border)] disabled:opacity-50 px-4 py-2 rounded-md transition-colors duration-150"
                          >
                            {suggesting === ticket.id ? (
                              <span className="w-3 h-3 border-2 border-[var(--text-disabled)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                            ) : (
                              <Sparkles size={13} className="text-[var(--accent)]" />
                            )}
                            {suggesting === ticket.id ? "Gerando sugestão..." : "Sugerir com IA"}
                          </button>
                        )}

                        {canApply && (
                          <button
                            onClick={() => handleApply(ticket)}
                            disabled={applying === ticket.id || suggesting === ticket.id}
                            className="press flex items-center gap-1.5 text-[13px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-medium px-4 py-2 rounded-md transition-colors duration-150"
                          >
                            {applying === ticket.id ? (
                              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Check size={13} />
                            )}
                            {applying === ticket.id ? "Aplicando..." : "Aplicar correção"}
                          </button>
                        )}

                        {/* Rejeitar — separado visualmente */}
                        <button
                          onClick={() => handleReject(ticket.id)}
                          className="press text-[12px] text-[var(--text-disabled)] hover:text-red-400 transition-colors ml-auto px-3 py-2 rounded-md hover:bg-red-500/5"
                        >
                          Rejeitar
                        </button>
                      </div>
                    )}

                    {isDone && (
                      <p className="text-[12px] text-[var(--text-disabled)] flex items-center gap-1.5">
                        {ticket.status === "APPLIED" ? (
                          <>
                            <Check size={12} className="text-emerald-400" />
                            Correção aplicada — uma nova versão do prompt foi criada.
                          </>
                        ) : "Ticket rejeitado."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal novo ticket */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl w-full max-w-lg shadow-2xl animate-fade-up">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-disabled)] mb-0.5">
                  Novo ticket
                </p>
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  Registrar problema ou melhoria
                </h2>
              </div>
              <button
                onClick={closeForm}
                className="press text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-md hover:bg-[var(--surface-raised)] transition-all"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1.5 block">
                  Descrição do problema <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Descreva o que está errado ou o que precisa melhorar..."
                  className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[13px] rounded-md px-3 py-2.5 resize-none focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-disabled)] transition-colors leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1.5 block">
                    Módulo afetado
                  </label>
                  <select
                    value={formModule}
                    onChange={(e) => setFormModule(e.target.value as ModuleKey | "")}
                    className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[13px] rounded-md px-3 py-2 focus:outline-none focus:border-[var(--accent)] transition-colors"
                  >
                    <option value="">Não especificado</option>
                    {MODULE_KEYS.map((key) => (
                      <option key={key} value={key}>{MODULE_LABELS[key]}</option>
                    ))}
                  </select>
                  {!formModule && (
                    <p className="text-[10px] text-[var(--text-disabled)] mt-1">
                      Selecione para habilitar sugestão de IA
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1.5 block">
                    Prioridade
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TicketPriority)}
                    className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[13px] rounded-md px-3 py-2 focus:outline-none focus:border-[var(--accent)] transition-colors"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="CRITICAL">Crítico</option>
                    <option value="IMPROVEMENT">Melhoria</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1.5 block">
                  Transcrição da conversa <span className="text-[var(--text-disabled)] normal-case tracking-normal">(opcional)</span>
                </label>
                <textarea
                  value={formTranscript}
                  onChange={(e) => setFormTranscript(e.target.value)}
                  rows={4}
                  placeholder="Cole aqui a conversa onde o problema ocorreu..."
                  className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[13px] rounded-md px-3 py-2.5 resize-none focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-disabled)] transition-colors leading-relaxed"
                />
              </div>

              {createError && (
                <p className="text-[12px] text-red-400 flex items-center gap-1.5">
                  <AlertCircle size={12} />
                  {createError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--surface-border)]">
              <button
                onClick={closeForm}
                className="press text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-4 py-2 rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formDesc.trim()}
                className="press flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[13px] font-medium px-5 py-2 rounded-md transition-colors duration-150"
              >
                {creating ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus size={13} />
                )}
                {creating ? "Criando..." : "Criar ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={dismiss} />
    </>
  );
}
