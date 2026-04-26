"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { MODULE_LABELS } from "@/lib/prompt-constants";
import type { ModuleKey, TicketPriority, TicketStatus } from "@/generated/prisma";

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

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  CRITICAL: "Crítico",
  NORMAL: "Normal",
  IMPROVEMENT: "Melhoria",
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  CRITICAL: "bg-red-500/10 text-red-400",
  NORMAL: "bg-zinc-500/10 text-zinc-400",
  IMPROVEMENT: "bg-blue-500/10 text-blue-400",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Aberto",
  SUGGESTED: "Sugestão gerada",
  APPROVED: "Aprovado",
  APPLIED: "Aplicado",
  REJECTED: "Rejeitado",
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: "bg-yellow-500/10 text-yellow-400",
  SUGGESTED: "bg-purple-500/10 text-purple-400",
  APPROVED: "bg-blue-500/10 text-blue-400",
  APPLIED: "bg-emerald-500/10 text-emerald-400",
  REJECTED: "bg-zinc-500/10 text-zinc-500",
};

const MODULE_KEYS: ModuleKey[] = [
  "IDENTITY", "ABSOLUTE_RULES", "INJECTION_PROTECTION", "CONVERSATION_STATE",
  "CONVERSATION_RESUME", "PRESENTATION", "COMMUNICATION_STYLE", "HUMAN_BEHAVIOR",
  "ACTIVE_LISTENING", "ATTENDANCE_STAGES", "QUALIFICATION", "SLOT_OFFER",
  "COMMITMENT_CONFIRMATION", "OPENING", "FINAL_OBJECTIVE", "AUDIO_RULES",
  "STATUS_RULES", "HANDOFF",
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TicketsPage() {
  const { id } = useParams<{ id: string }>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulário novo ticket
  const [showForm, setShowForm] = useState(false);
  const [formDesc, setFormDesc] = useState("");
  const [formTranscript, setFormTranscript] = useState("");
  const [formModule, setFormModule] = useState<ModuleKey | "">("");
  const [formPriority, setFormPriority] = useState<TicketPriority>("NORMAL");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Estado por ticket
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<Record<string, string>>({});

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
      setFormDesc(""); setFormTranscript(""); setFormModule(""); setFormPriority("NORMAL");
      setShowForm(false);
      await load();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sugerir");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aplicar correção");
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
    } catch {
      setError("Erro ao rejeitar ticket");
    }
  }

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Carregando tickets...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-zinc-500 text-sm">
          {tickets.length > 0
            ? `${tickets.filter((t) => t.status === "OPEN" || t.status === "SUGGESTED").length} aberto(s) · ${tickets.length} total`
            : "Nenhum ticket"}
        </p>
        <button
          onClick={() => { setShowForm(!showForm); setCreateError(null); }}
          className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-md transition-colors"
        >
          {showForm ? "Cancelar" : "+ Novo ticket"}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Formulário de criação */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 mb-6 space-y-4">
          <h3 className="text-sm font-medium text-white">Novo ticket de correção</h3>

          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Descrição do problema *</label>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={3}
              placeholder="Descreva o que está errado ou o que precisa melhorar..."
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Módulo afetado</label>
              <select
                value={formModule}
                onChange={(e) => setFormModule(e.target.value as ModuleKey | "")}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value="">Selecione (opcional)</option>
                {MODULE_KEYS.map((key) => (
                  <option key={key} value={key}>{MODULE_LABELS[key]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Prioridade</label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as TicketPriority)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value="NORMAL">Normal</option>
                <option value="CRITICAL">Crítico</option>
                <option value="IMPROVEMENT">Melhoria</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Transcrição da conversa (opcional)</label>
            <textarea
              value={formTranscript}
              onChange={(e) => setFormTranscript(e.target.value)}
              rows={4}
              placeholder="Cole aqui a conversa onde o problema ocorreu..."
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>

          {createError && (
            <p className="text-xs text-red-400">{createError}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !formDesc.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-medium px-5 py-2 rounded-md transition-colors"
            >
              {creating ? "Criando..." : "Criar ticket"}
            </button>
          </div>
        </div>
      )}

      {/* Lista de tickets */}
      {tickets.length === 0 && !showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <p className="text-zinc-400 text-sm">Nenhum ticket aberto.</p>
          <p className="text-zinc-600 text-xs mt-1">Crie um ticket para registrar um problema ou melhoria no prompt.</p>
        </div>
      )}

      <div className="space-y-3">
        {tickets.map((ticket) => {
          const expanded = expandedTicket === ticket.id;
          const suggestionContent = editingSuggestion[ticket.id] ?? ticket.aiSuggestion ?? "";
          const canSuggest = ticket.affectedModule && (ticket.status === "OPEN" || ticket.status === "SUGGESTED");
          const canApply = (ticket.status === "SUGGESTED" || ticket.status === "APPROVED") && suggestionContent;

          return (
            <div
              key={ticket.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
            >
              {/* Cabeçalho do ticket */}
              <button
                className="w-full flex items-start justify-between px-5 py-4 text-left hover:bg-zinc-800/30 transition-colors"
                onClick={() => setExpandedTicket(expanded ? null : ticket.id)}
              >
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm text-zinc-200 line-clamp-2">{ticket.description}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[ticket.status]}`}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>
                      {PRIORITY_LABELS[ticket.priority]}
                    </span>
                    {ticket.affectedModule && (
                      <span className="text-xs text-zinc-500 font-mono">{MODULE_LABELS[ticket.affectedModule]}</span>
                    )}
                    <span className="text-xs text-zinc-600">v{ticket.promptVersion.version} · {formatDate(ticket.createdAt)}</span>
                  </div>
                </div>
                <span className="text-zinc-600 text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
              </button>

              {/* Detalhes do ticket */}
              {expanded && (
                <div className="border-t border-zinc-800 px-5 py-4 space-y-4">
                  {ticket.conversationTranscript && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-2">Transcrição</p>
                      <pre className="text-xs text-zinc-400 bg-zinc-800/50 rounded-md p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                        {ticket.conversationTranscript}
                      </pre>
                    </div>
                  )}

                  {/* Sugestão da IA (editável) */}
                  {(ticket.aiSuggestion || editingSuggestion[ticket.id]) && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-2">Sugestão de correção (editável antes de aplicar)</p>
                      <textarea
                        value={suggestionContent}
                        onChange={(e) =>
                          setEditingSuggestion((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                        }
                        rows={8}
                        disabled={ticket.status === "APPLIED" || ticket.status === "REJECTED"}
                        className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs rounded-md px-3 py-2.5 font-mono resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-60"
                      />
                    </div>
                  )}

                  {/* Ações */}
                  {ticket.status !== "APPLIED" && ticket.status !== "REJECTED" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {canSuggest && (
                        <button
                          onClick={() => handleSuggest(ticket.id)}
                          disabled={suggesting === ticket.id || applying === ticket.id}
                          className="flex items-center gap-2 text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-4 py-2 rounded-md transition-colors"
                        >
                          {suggesting === ticket.id ? (
                            <>
                              <span className="animate-spin inline-block w-3 h-3 border-2 border-zinc-500 border-t-white rounded-full" />
                              Sugerindo...
                            </>
                          ) : (
                            "Sugerir com IA ✦"
                          )}
                        </button>
                      )}
                      {!ticket.affectedModule && ticket.status === "OPEN" && (
                        <p className="text-xs text-zinc-600">Defina o módulo afetado para usar sugestão de IA.</p>
                      )}
                      {canApply && (
                        <button
                          onClick={() => handleApply(ticket)}
                          disabled={applying === ticket.id || suggesting === ticket.id}
                          className="text-sm bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-medium px-4 py-2 rounded-md transition-colors"
                        >
                          {applying === ticket.id ? "Aplicando..." : "Aplicar correção"}
                        </button>
                      )}
                      <button
                        onClick={() => handleReject(ticket.id)}
                        className="text-xs text-zinc-500 hover:text-red-400 transition-colors px-3 py-2"
                      >
                        Rejeitar
                      </button>
                    </div>
                  )}

                  {(ticket.status === "APPLIED" || ticket.status === "REJECTED") && (
                    <p className="text-xs text-zinc-600">
                      {ticket.status === "APPLIED"
                        ? "Correção aplicada — uma nova versão do prompt foi criada."
                        : "Ticket rejeitado."}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
