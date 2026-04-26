"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface CalibrationGap {
  axis: string;
  description: string;
  promptSuggestion: string;
}

interface Calibration {
  id: string;
  humanConversation: string;
  sofiaConversation: string;
  gaps: CalibrationGap[];
  appliedToPrompt: boolean;
  createdAt: string;
}

export default function CalibrationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Nova calibração
  const [humanConv, setHumanConv] = useState("");
  const [sofiaConv, setSofiaConv] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Resultado atual
  const [result, setResult] = useState<Calibration | null>(null);

  // Histórico
  const [showHistory, setShowHistory] = useState(false);
  const [viewingCalib, setViewingCalib] = useState<Calibration | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}/calibrations`);
      if (!res.ok) throw new Error();
      setCalibrations(await res.json());
    } catch {
      // silencioso
    } finally {
      setLoadingHistory(false);
    }
  }, [id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handleAnalyze() {
    if (!humanConv.trim() || !sofiaConv.trim()) {
      setAnalyzeError("Cole as duas conversas antes de analisar.");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    setResult(null);
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
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Erro ao analisar");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleApply(gap: CalibrationGap, calibId: string) {
    // Marca como aplicado e navega para a aba de prompt com o contexto
    fetch(`/api/clients/${id}/calibrations/${calibId}`, { method: "PATCH" });
    setCalibrations((prev) => prev.map((c) => c.id === calibId ? { ...c, appliedToPrompt: true } : c));
    if (result?.id === calibId) setResult((prev) => prev ? { ...prev, appliedToPrompt: true } : prev);
    // Navega para o prompt com a sugestão pré-copiada no clipboard
    navigator.clipboard.writeText(gap.promptSuggestion).catch(() => {});
    router.push(`/clients/${id}/prompt`);
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

  const displayCalib = viewingCalib ?? result;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">Compare a conversa do atendente humano com a da Sofia e identifique gaps.</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">O Claude analisa nos 5 eixos e sugere correções diretas para o prompt.</p>
        </div>
        {calibrations.length > 0 && (
          <button
            onClick={() => { setShowHistory(!showHistory); setViewingCalib(null); }}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5 border border-[var(--surface-border)] rounded-md transition-colors shrink-0"
          >
            Histórico ({calibrations.length})
          </button>
        )}
      </div>

      {/* Histórico */}
      {showHistory && !viewingCalib && (
        <div className="mb-6 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--surface-border)]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">Calibrações anteriores</p>
          </div>
          {loadingHistory ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">Carregando...</div>
          ) : (
            <div className="divide-y divide-[var(--surface-border)]">
              {calibrations.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-raised)] transition-colors">
                  <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => { setViewingCalib(c); setShowHistory(false); }}>
                    <span className="text-xs text-[var(--text-muted)]">{formatDate(c.createdAt)}</span>
                    <span className="text-sm text-[var(--text-primary)]">{c.gaps.length} gap{c.gaps.length !== 1 ? "s" : ""}</span>
                    {c.appliedToPrompt && (
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">Aplicado</span>
                    )}
                  </div>
                  <button onClick={() => handleDeleteCalib(c.id)} className="text-xs text-[var(--text-disabled)] hover:text-red-400 transition-colors px-1">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Visualização de calibração do histórico */}
      {viewingCalib && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => { setViewingCalib(null); setShowHistory(true); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">← Histórico</button>
            <span className="text-xs text-[var(--text-disabled)]">{formatDate(viewingCalib.createdAt)}</span>
          </div>
          <GapResults
            calibration={viewingCalib}
            onApply={(gap) => handleApply(gap, viewingCalib.id)}
          />
        </div>
      )}

      {/* Formulário de nova calibração */}
      {!viewingCalib && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-2 block">Conversa do atendente humano</label>
              <textarea
                value={humanConv}
                onChange={(e) => setHumanConv(e.target.value)}
                rows={14}
                placeholder="Cole aqui a conversa do WhatsApp com o atendente humano..."
                className="w-full bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-3 font-mono resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 leading-relaxed"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-2 block">Conversa da Sofia</label>
              <textarea
                value={sofiaConv}
                onChange={(e) => setSofiaConv(e.target.value)}
                rows={14}
                placeholder="Cole aqui a conversa da Sofia (IA)..."
                className="w-full bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-3 font-mono resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 leading-relaxed"
              />
            </div>
          </div>

          {analyzeError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-md mb-4">{analyzeError}</div>
          )}

          <div className="flex items-center justify-between mb-6">
            <p className="text-xs text-[var(--text-muted)]">
              Analisa nos eixos: Tom, Acolhimento, SPIN, Condução ao agendamento, Confirmação
            </p>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-medium text-sm px-5 py-2 rounded-md transition-colors"
            >
              {analyzing ? (
                <><span className="animate-spin inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full" />Analisando...</>
              ) : "Analisar gaps ✦"}
            </button>
          </div>

          {/* Resultado */}
          {result && (
            <GapResults
              calibration={result}
              onApply={(gap) => handleApply(gap, result.id)}
            />
          )}
        </>
      )}
    </div>
  );
}

function GapResults({ calibration, onApply }: { calibration: Calibration; onApply: (gap: CalibrationGap) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (calibration.gaps.length === 0) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-6 text-center">
        <p className="text-emerald-400 font-medium text-sm">Nenhum gap identificado</p>
        <p className="text-[var(--text-muted)] text-xs mt-1">A Sofia está performando bem em relação ao atendente humano nesta conversa.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">{calibration.gaps.length} gap{calibration.gaps.length !== 1 ? "s" : ""} identificado{calibration.gaps.length !== 1 ? "s" : ""}</p>
        {calibration.appliedToPrompt && (
          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">Aplicado ao prompt</span>
        )}
      </div>
      <div className="space-y-2">
        {calibration.gaps.map((gap) => (
          <div key={gap.axis} className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface-raised)] transition-colors"
              onClick={() => setExpanded(expanded === gap.axis ? null : gap.axis)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">{gap.axis}</span>
              </div>
              <span className="text-[var(--text-disabled)] text-xs">{expanded === gap.axis ? "▲" : "▼"}</span>
            </button>
            {expanded === gap.axis && (
              <div className="border-t border-[var(--surface-border)] px-4 py-4 space-y-3">
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-1">Gap identificado</p>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">{gap.description}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-1">Sugestão para o prompt</p>
                  <p className="text-sm text-[var(--text-secondary)] bg-[var(--surface-raised)] rounded-lg px-3 py-3 leading-relaxed">{gap.promptSuggestion}</p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => onApply(gap)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1.5 border border-emerald-500/30 hover:border-emerald-500/60 rounded-md transition-colors"
                  >
                    Aplicar ao prompt → (copia sugestão)
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
