"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

type ConvOutcome = "SCHEDULED" | "NOT_SCHEDULED" | "LOST";

interface ConversationSample {
  id: string;
  content: string;
  outcome: ConvOutcome | null;
  notes: string | null;
  source: string | null;
  createdAt: string;
  promptVersion: { version: number; isActive: boolean };
}

const OUTCOME_CONFIG: Record<ConvOutcome, { label: string; className: string }> = {
  SCHEDULED:     { label: "Agendou",       className: "bg-emerald-500/10 text-emerald-400" },
  NOT_SCHEDULED: { label: "Não agendou",   className: "bg-yellow-500/10 text-yellow-400" },
  LOST:          { label: "Perdeu",        className: "bg-red-500/10 text-red-400" },
};

export default function ConversationsPage() {
  const { id } = useParams<{ id: string }>();
  const [conversations, setConversations] = useState<ConversationSample[]>([]);
  const [minConv, setMinConv] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de nova conversa
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newOutcome, setNewOutcome] = useState<ConvOutcome | "">("");
  const [newNotes, setNewNotes] = useState("");
  const [newSource, setNewSource] = useState("whatsapp");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Modal de detalhes/edição
  const [viewing, setViewing] = useState<ConversationSample | null>(null);

  // Edição do mínimo
  const [editingMin, setEditingMin] = useState(false);
  const [minDraft, setMinDraft] = useState(10);
  const [savingMin, setSavingMin] = useState(false);

  // Filtro de versão
  const [filterVersion, setFilterVersion] = useState<"active" | "all">("active");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}/conversations`);
      if (!res.ok) throw new Error("Erro ao carregar conversas");
      const data = await res.json();
      setConversations(data.conversations);
      setMinConv(data.minConversationsPerVersion);
      setMinDraft(data.minConversationsPerVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newContent.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/clients/${id}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newContent,
          outcome: newOutcome || undefined,
          notes: newNotes || undefined,
          source: newSource || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao adicionar");
      setConversations((prev) => [data, ...prev]);
      setShowAdd(false);
      setNewContent("");
      setNewOutcome("");
      setNewNotes("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(convId: string) {
    if (!confirm("Apagar esta conversa?")) return;
    await fetch(`/api/clients/${id}/conversations/${convId}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (viewing?.id === convId) setViewing(null);
  }

  async function handleUpdateOutcome(convId: string, outcome: ConvOutcome | null) {
    const res = await fetch(`/api/clients/${id}/conversations/${convId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    const data = await res.json();
    setConversations((prev) => prev.map((c) => c.id === convId ? data : c));
    if (viewing?.id === convId) setViewing(data);
  }

  async function saveMin() {
    setSavingMin(true);
    try {
      await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minConversationsPerVersion: minDraft }),
      });
      setMinConv(minDraft);
      setEditingMin(false);
    } finally {
      setSavingMin(false);
    }
  }

  const activeVersionConvs = conversations.filter((c) => c.promptVersion.isActive);
  const displayConvs = filterVersion === "active" ? activeVersionConvs : conversations;
  const activeCount = activeVersionConvs.length;
  const deficit = Math.max(0, minConv - activeCount);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) return <div className="text-[var(--text-muted)] text-sm py-8 text-center">Carregando...</div>;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div>
      {/* Status bar */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-lg mb-6 border ${
        deficit > 0 ? "bg-yellow-500/5 border-yellow-500/20" : "bg-emerald-500/5 border-emerald-500/20"
      }`}>
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold ${deficit > 0 ? "text-yellow-400" : "text-emerald-400"}`}>
            {activeCount}
          </span>
          <div>
            <p className="text-sm text-[var(--text-primary)]">
              {deficit > 0
                ? `Faltam ${deficit} conversa${deficit !== 1 ? "s" : ""} para a versão ativa`
                : "Meta atingida para a versão ativa"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Mínimo configurado: {minConv} conversas por versão
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editingMin ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1} max={100}
                value={minDraft}
                onChange={(e) => setMinDraft(Number(e.target.value))}
                className="w-16 bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded px-2 py-1 text-center focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={saveMin}
                disabled={savingMin}
                className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1"
              >
                {savingMin ? "..." : "OK"}
              </button>
              <button onClick={() => setEditingMin(false)} className="text-xs text-[var(--text-muted)] px-2 py-1">
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingMin(true)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-2 py-1"
            >
              Alterar mínimo
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            + Adicionar conversa
          </button>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setFilterVersion("active")}
          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
            filterVersion === "active"
              ? "bg-[var(--accent-subtle)] text-[var(--accent-text)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Versão ativa ({activeCount})
        </button>
        <button
          onClick={() => setFilterVersion("all")}
          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
            filterVersion === "all"
              ? "bg-[var(--accent-subtle)] text-[var(--accent-text)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Todas ({conversations.length})
        </button>
      </div>

      {/* Lista */}
      {displayConvs.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg p-12 text-center">
          <p className="text-[var(--text-muted)] text-sm">Nenhuma conversa registrada ainda.</p>
          <p className="text-[var(--text-disabled)] text-xs mt-1">Clique em "Adicionar conversa" para começar o banco.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayConvs.map((conv) => (
            <div
              key={conv.id}
              className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg px-4 py-3 flex items-start justify-between gap-4 hover:border-[var(--surface-border)] transition-colors"
            >
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewing(conv)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-[var(--text-muted)]">
                    v{conv.promptVersion.version}
                    {conv.promptVersion.isActive && (
                      <span className="ml-1 text-emerald-500">• ativa</span>
                    )}
                  </span>
                  {conv.outcome && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${OUTCOME_CONFIG[conv.outcome].className}`}>
                      {OUTCOME_CONFIG[conv.outcome].label}
                    </span>
                  )}
                  {conv.source && (
                    <span className="text-xs text-[var(--text-disabled)]">{conv.source}</span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-primary)] line-clamp-2 whitespace-pre-line">{conv.content}</p>
                {conv.notes && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">{conv.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[var(--text-disabled)]">{formatDate(conv.createdAt)}</span>
                <button
                  onClick={() => handleDelete(conv.id)}
                  className="text-xs text-[var(--text-disabled)] hover:text-red-400 transition-colors px-1"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de adicionar conversa */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)] shrink-0">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Adicionar conversa</h2>
              <button onClick={() => setShowAdd(false)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-2 block">Conversa <span className="text-red-400">*</span></label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={12}
                  placeholder="Cole aqui o texto da conversa do WhatsApp..."
                  className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-xs rounded-md px-3 py-2.5 font-mono resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 leading-relaxed"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-2 block">Resultado</label>
                  <select
                    value={newOutcome}
                    onChange={(e) => setNewOutcome(e.target.value as ConvOutcome | "")}
                    className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Não informado</option>
                    <option value="SCHEDULED">Agendou</option>
                    <option value="NOT_SCHEDULED">Não agendou</option>
                    <option value="LOST">Perdeu</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-2 block">Origem</label>
                  <input
                    type="text"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    placeholder="whatsapp, interno..."
                    className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-2 block">Observações</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Lead frio, perguntou sobre preço..."
                  className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
              {addError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-md">{addError}</div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--surface-border)] shrink-0">
              <button onClick={() => setShowAdd(false)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-4 py-2">Cancelar</button>
              <button
                onClick={handleAdd}
                disabled={adding || !newContent.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-medium px-5 py-2 rounded-md transition-colors"
              >
                {adding ? "Salvando..." : "Salvar conversa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de visualização */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl w-full max-w-2xl my-8 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">v{viewing.promptVersion.version}</span>
                <span className="text-xs text-[var(--text-disabled)]">·</span>
                <span className="text-xs text-[var(--text-disabled)]">{formatDate(viewing.createdAt)}</span>
              </div>
              <button onClick={() => setViewing(null)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xl leading-none">×</button>
            </div>

            {/* Resultado inline */}
            <div className="px-5 pt-4 flex items-center gap-2">
              {(["SCHEDULED", "NOT_SCHEDULED", "LOST"] as ConvOutcome[]).map((o) => (
                <button
                  key={o}
                  onClick={() => handleUpdateOutcome(viewing.id, viewing.outcome === o ? null : o)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    viewing.outcome === o
                      ? OUTCOME_CONFIG[o].className + " border-current"
                      : "border-[var(--surface-border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {OUTCOME_CONFIG[o].label}
                </button>
              ))}
            </div>

            <div className="p-5">
              <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed font-sans bg-[var(--surface-raised)] rounded-lg px-4 py-4 max-h-[60vh] overflow-y-auto">
                {viewing.content}
              </pre>
              {viewing.notes && (
                <p className="text-xs text-[var(--text-muted)] mt-3">Obs: {viewing.notes}</p>
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--surface-border)]">
              <button
                onClick={() => handleDelete(viewing.id)}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                Apagar conversa
              </button>
              <button onClick={() => setViewing(null)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-4 py-2">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
