"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface CalibrationGap {
  axis: string;
  description: string;
  promptSuggestion: string;
  affectedModule?: string;
}

interface CalibrationViolation {
  rule: string;
  evidence: string;
  severity: "error" | "warning" | "info";
}

interface CalibrationData {
  gaps: CalibrationGap[];
  violations: CalibrationViolation[];
}

interface Calibration {
  id: string;
  humanConversation: string;
  sofiaConversation: string;
  gaps: CalibrationData | CalibrationGap[]; // suporte ao formato antigo
  appliedToPrompt: boolean;
  createdAt: string;
}

function parseCalibration(c: Calibration): CalibrationData {
  if (Array.isArray(c.gaps)) return { gaps: c.gaps, violations: [] };
  return c.gaps as CalibrationData;
}

const SEVERITY_CONFIG = {
  error:   { label: "Erro",    className: "bg-red-500/10 text-red-400 border-red-500/20" },
  warning: { label: "Atenção", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  info:    { label: "Info",    className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
};

export default function CalibrationPage() {
  const { id } = useParams<{ id: string }>();
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [humanConv, setHumanConv] = useState("");
  const [sofiaConv, setSofiaConv] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Resultado atual — não some ao navegar no histórico
  const [result, setResult] = useState<Calibration | null>(null);

  // Histórico
  const [showHistory, setShowHistory] = useState(false);
  const [viewingCalib, setViewingCalib] = useState<Calibration | null>(null);

  // Modal de criação de ticket a partir de um gap
  const [ticketModal, setTicketModal] = useState<{ gap: CalibrationGap; calibId: string } | null>(null);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}/calibrations`);
      if (!res.ok) throw new Error();
      setCalibrations(await res.json());
    } catch { /* silencioso */ }
    finally { setLoadingHistory(false); }
  }, [id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handleAnalyze() {
    if (!humanConv.trim() || !sofiaConv.trim()) {
      setAnalyzeError("Cole as duas conversas antes de analisar.");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch(`/api/clients/${id}/calibrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanConversation: humanConv, sofiaConversation: sofiaConv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao analisar");
      setResult(data);
      setCalibrations((prev) => [data, ...prev]);
      setViewingCalib(null); // volta para o resultado novo
      setShowHistory(false);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Erro ao analisar");
    } finally {
      setAnalyzing(false);
    }
  }

  async function createTicketFromGap(gap: CalibrationGap, calibId: string) {
    setCreatingTicket(true);
    setTicketSuccess(false);
    try {
      // Busca a versão ativa para obter o promptVersionId
      const clientRes = await fetch(`/api/clients/${id}`);
      const clientData = await clientRes.json();
      const activeVersion = clientData.promptVersions?.find((v: { isActive: boolean }) => v.isActive)
        ?? clientData.promptVersions?.[0];

      if (!activeVersion) throw new Error("Nenhuma versão ativa encontrada");

      const ticketRes = await fetch(`/api/clients/${id}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: `[Calibração] ${gap.axis}: ${gap.description}${gap.promptSuggestion ? `\n\nContexto de melhoria: ${gap.promptSuggestion}` : ""}`,
          affectedModule: gap.affectedModule || undefined,
          priority: "NORMAL",
        }),
      });
      if (!ticketRes.ok) {
        const err = await ticketRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao criar ticket");
      }

      // Marca calibração como aplicada
      fetch(`/api/clients/${id}/calibrations/${calibId}`, { method: "PATCH" });
      setCalibrations((prev) => prev.map((c) => c.id === calibId ? { ...c, appliedToPrompt: true } : c));
      if (result?.id === calibId) setResult((prev) => prev ? { ...prev, appliedToPrompt: true } : prev);

      setTicketSuccess(true);
      setTimeout(() => { setTicketModal(null); setTicketSuccess(false); }, 1500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar ticket");
    } finally {
      setCreatingTicket(false);
    }
  }

  async function handleDeleteCalib(calibId: string) {
    if (!confirm("Apagar esta calibração?")) return;
    await fetch(`/api/clients/${id}/calibrations/${calibId}`, { method: "DELETE" });
    setCalibrations((prev) => prev.filter((c) => c.id !== calibId));
    if (result?.id === calibId) setResult(null);
    if (viewingCalib?.id === calibId) setViewingCalib(null);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  const activeCalib = viewingCalib ?? result;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">Compare a conversa do atendente humano com a da Sofia e identifique gaps.</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">O Claude analisa nos 5 eixos, detecta violações de boas práticas e sugere tickets de correção.</p>
        </div>
        {calibrations.length > 0 && (
          <button
            onClick={() => { setShowHistory(!showHistory); if (showHistory) setViewingCalib(null); }}
            className={`text-xs px-3 py-1.5 border border-[var(--surface-border)] rounded-md transition-colors shrink-0 ${
              showHistory ? "text-[var(--accent-text)] bg-[var(--accent-subtle)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            Histórico ({calibrations.length})
          </button>
        )}
      </div>

      <div className={`grid gap-6 ${activeCalib ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* Coluna esquerda — formulário */}
        <div className="space-y-4">
          {/* Histórico (colapsável) */}
          {showHistory && (
            <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">Calibrações anteriores</p>
              </div>
              {loadingHistory ? (
                <div className="px-4 py-4 text-xs text-[var(--text-muted)]">Carregando...</div>
              ) : (
                <div className="divide-y divide-[var(--surface-border)] max-h-48 overflow-y-auto">
                  {calibrations.map((c) => {
                    const data = parseCalibration(c);
                    return (
                      <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--surface-raised)] transition-colors">
                        <button
                          className="flex items-center gap-3 flex-1 text-left"
                          onClick={() => { setViewingCalib(c); setShowHistory(false); }}
                        >
                          <span className="text-xs text-[var(--text-muted)]">{formatDate(c.createdAt)}</span>
                          <span className="text-xs text-[var(--text-primary)]">{data.gaps.length} gap{data.gaps.length !== 1 ? "s" : ""}</span>
                          {data.violations.length > 0 && (
                            <span className="text-xs text-red-400">{data.violations.length} violação{data.violations.length !== 1 ? "ões" : ""}</span>
                          )}
                          {c.appliedToPrompt && (
                            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">Ticketado</span>
                          )}
                        </button>
                        <button onClick={() => handleDeleteCalib(c.id)} className="text-[var(--text-disabled)] hover:text-red-400 text-xs px-1">×</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Formulário */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-2 block">Conversa do atendente humano</label>
              <textarea
                value={humanConv}
                onChange={(e) => setHumanConv(e.target.value)}
                rows={12}
                placeholder="Cole aqui a conversa do WhatsApp com o atendente humano..."
                className="w-full bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-3 font-mono resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 leading-relaxed"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-2 block">Conversa da Sofia</label>
              <textarea
                value={sofiaConv}
                onChange={(e) => setSofiaConv(e.target.value)}
                rows={12}
                placeholder="Cole aqui a conversa da Sofia (IA)..."
                className="w-full bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-3 font-mono resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 leading-relaxed"
              />
            </div>
          </div>

          {analyzeError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-md">{analyzeError}</div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-muted)]">Analisa em 5 eixos + verifica boas práticas do prompt</p>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-medium text-sm px-5 py-2 rounded-md transition-colors"
            >
              {analyzing ? (
                <><span className="animate-spin inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full" />Analisando...</>
              ) : "Analisar ✦"}
            </button>
          </div>
        </div>

        {/* Coluna direita — resultado */}
        {activeCalib && (
          <div className="space-y-4">
            {viewingCalib && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewingCalib(null)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  ← Voltar ao resultado atual
                </button>
                <span className="text-xs text-[var(--text-disabled)]">{formatDate(viewingCalib.createdAt)}</span>
              </div>
            )}

            <GapResults
              calibration={activeCalib}
              onOpenTicket={(gap) => setTicketModal({ gap, calibId: activeCalib.id })}
            />
          </div>
        )}
      </div>

      {/* Modal de criar ticket */}
      {ticketModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Abrir ticket de correção</h2>
              <button onClick={() => setTicketModal(null)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Gap identificado</p>
                <div className="bg-[var(--surface-raised)] rounded-lg px-3 py-2.5">
                  <p className="text-xs font-medium text-yellow-400 mb-1">{ticketModal.gap.axis}</p>
                  <p className="text-sm text-[var(--text-primary)]">{ticketModal.gap.description}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Contexto de melhoria (adicionado à descrição do ticket)</p>
                <p className="text-sm text-[var(--text-secondary)] bg-[var(--surface-raised)] rounded-lg px-3 py-2.5 leading-relaxed">{ticketModal.gap.promptSuggestion}</p>
                <p className="text-xs text-[var(--text-disabled)] mt-1.5">Após criar o ticket, use "Sugerir com IA" para gerar o conteúdo corrigido do módulo.</p>
              </div>
              {ticketModal.gap.affectedModule && (
                <p className="text-xs text-[var(--text-muted)]">
                  Módulo identificado: <span className="text-[var(--text-secondary)] font-mono">{ticketModal.gap.affectedModule}</span>
                </p>
              )}
              {ticketSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-2 rounded-md">
                  Ticket criado com sucesso!
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--surface-border)]">
              <button onClick={() => setTicketModal(null)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-4 py-2">Cancelar</button>
              <button
                onClick={() => createTicketFromGap(ticketModal.gap, ticketModal.calibId)}
                disabled={creatingTicket || ticketSuccess}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-medium px-5 py-2 rounded-md transition-colors"
              >
                {creatingTicket ? "Criando..." : "Criar ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GapResults({
  calibration,
  onOpenTicket,
}: {
  calibration: Calibration;
  onOpenTicket: (gap: CalibrationGap) => void;
}) {
  const [expandedGap, setExpandedGap] = useState<string | null>(null);
  const data = parseCalibration(calibration);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        {data.gaps.length === 0 ? (
          <span className="text-sm font-medium text-emerald-400">Nenhum gap identificado</span>
        ) : (
          <span className="text-sm font-medium text-[var(--text-primary)]">{data.gaps.length} gap{data.gaps.length !== 1 ? "s" : ""}</span>
        )}
        {data.violations.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
            {data.violations.length} violação{data.violations.length !== 1 ? "ões" : ""} de boas práticas
          </span>
        )}
        {calibration.appliedToPrompt && (
          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">Ticketado</span>
        )}
      </div>

      {/* Violações de boas práticas */}
      {data.violations.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">Pontos de atenção no prompt</p>
          {data.violations.map((v, i) => {
            const cfg = SEVERITY_CONFIG[v.severity] ?? SEVERITY_CONFIG.info;
            return (
              <div key={i} className={`border rounded-lg px-3 py-2.5 ${cfg.className}`}>
                <div className="flex items-start gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5 border ${cfg.className}`}>{cfg.label}</span>
                  <div>
                    <p className="text-xs font-medium">{v.rule}</p>
                    {v.evidence && <p className="text-xs opacity-80 mt-0.5">"{v.evidence}"</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gaps */}
      {data.gaps.length === 0 ? (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 text-center">
          <p className="text-xs text-emerald-400">A Sofia está performando bem em relação ao atendente humano nesta conversa.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">Gaps identificados</p>
          {data.gaps.map((gap) => (
            <div key={gap.axis} className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface-raised)] transition-colors"
                onClick={() => setExpandedGap(expandedGap === gap.axis ? null : gap.axis)}
              >
                <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">{gap.axis}</span>
                <span className="text-[var(--text-disabled)] text-xs">{expandedGap === gap.axis ? "▲" : "▼"}</span>
              </button>
              {expandedGap === gap.axis && (
                <div className="border-t border-[var(--surface-border)] px-4 py-4 space-y-3">
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">Gap</p>
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed">{gap.description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">Sugestão para o prompt</p>
                    <p className="text-sm text-[var(--text-secondary)] bg-[var(--surface-raised)] rounded-lg px-3 py-3 leading-relaxed">{gap.promptSuggestion}</p>
                  </div>
                  {gap.affectedModule && (
                    <p className="text-xs text-[var(--text-muted)]">Módulo: <span className="font-mono text-[var(--text-secondary)]">{gap.affectedModule}</span></p>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => onOpenTicket(gap)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1.5 border border-emerald-500/30 hover:border-emerald-500/60 rounded-md transition-colors"
                    >
                      Abrir ticket →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
