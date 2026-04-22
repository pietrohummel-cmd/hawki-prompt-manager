"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Copy, Check, Download, GitCompare, X, GitBranch,
} from "lucide-react";
import type { ModuleKey } from "@/generated/prisma";
import { MODULE_LABELS, MODULE_ORDER } from "@/lib/prompt-constants";
import { Toast, useToast } from "@/components/toast";

/* ── Tipos ──────────────────────────────────────────────── */

interface VersionModule {
  moduleKey: ModuleKey;
  content: string;
}

interface PromptVersion {
  id: string;
  version: number;
  isActive: boolean;
  generatedBy: "AI" | "MANUAL";
  changesSummary: string | null;
  systemPrompt: string;
  createdAt: string;
  _count: { modules: number };
  modules: VersionModule[];
}

/* ── Diff utilitário ────────────────────────────────────── */

function diffLines(
  oldText: string,
  newText: string
): { line: string; type: "same" | "added" | "removed" }[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const oldSet   = new Set(oldLines);
  const newSet   = new Set(newLines);
  const result: { line: string; type: "same" | "added" | "removed" }[] = [];

  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    const ol = oldLines[i], nl = newLines[j];
    if      (i >= oldLines.length)        { result.push({ line: nl, type: "added" });   j++; }
    else if (j >= newLines.length)        { result.push({ line: ol, type: "removed" }); i++; }
    else if (ol === nl)                   { result.push({ line: ol, type: "same" });    i++; j++; }
    else if (!newSet.has(ol))             { result.push({ line: ol, type: "removed" }); i++; }
    else if (!oldSet.has(nl))             { result.push({ line: nl, type: "added" });   j++; }
    else {
      result.push({ line: ol, type: "removed" });
      result.push({ line: nl, type: "added" });
      i++; j++;
    }
  }
  return result;
}

function assemblePrompt(modules: VersionModule[]): string {
  return MODULE_ORDER
    .map((key) => modules.find((m) => m.moduleKey === key))
    .filter(Boolean)
    .map((m) => `###MÓDULO:${m!.moduleKey}###\n${m!.content}`)
    .join("\n\n");
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Componente principal ───────────────────────────────── */

export default function VersionsPage() {
  const { id }   = useParams<{ id: string }>();
  const { toast, showToast, dismiss } = useToast();

  const [versions, setVersions]     = useState<PromptVersion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Diff modal
  const [diffVersion, setDiffVersion] = useState<PromptVersion | null>(null);

  // Ativar confirmação por versão
  const [confirmActivate, setConfirmActivate] = useState<string | null>(null);
  const [activating, setActivating]           = useState<string | null>(null);

  // Copiar por versão
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}/versions`);
      if (!res.ok) throw new Error("Erro ao carregar versões");
      setVersions(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Fechar diff com Escape
  useEffect(() => {
    if (!diffVersion) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setDiffVersion(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [diffVersion]);

  async function handleActivate(versionId: string) {
    setActivating(versionId);
    try {
      const res = await fetch(`/api/clients/${id}/versions/${versionId}/activate`, { method: "PATCH" });
      if (!res.ok) throw new Error("Erro ao ativar versão");
      await load();
      setConfirmActivate(null);
      showToast({ type: "success", message: "Versão ativada com sucesso." });
    } catch (err) {
      showToast({ type: "error", message: err instanceof Error ? err.message : "Erro ao ativar" });
    } finally {
      setActivating(null);
    }
  }

  function handleExport(v: PromptVersion) {
    const blob = new Blob([v.systemPrompt], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `prompt-v${v.version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ type: "success", message: `Versão ${v.version} exportada como .txt` });
  }

  async function handleCopy(v: PromptVersion) {
    const text = assemblePrompt(v.modules);
    await navigator.clipboard.writeText(text);
    setCopiedId(v.id);
    showToast({ type: "success", message: `Prompt v${v.version} copiado para a área de transferência.` });
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="card h-20" />)}
      </div>
    );
  }

  if (error) return <div className="text-red-400 text-[13px]">{error}</div>;

  if (versions.length === 0) {
    return (
      <div className="card p-12 text-center">
        <GitBranch size={28} className="text-[var(--text-disabled)] mx-auto mb-3" />
        <p className="text-[var(--text-secondary)] text-[13px]">Nenhuma versão gerada ainda.</p>
        <p className="text-[var(--text-disabled)] text-[12px] mt-1">
          Vá até a aba Prompt e clique em "Gerar prompt".
        </p>
      </div>
    );
  }

  const prevVersion = diffVersion
    ? versions.find((v) => v.version === diffVersion.version - 1) ?? null
    : null;

  return (
    <>
      <div>
        <p className="text-[13px] text-[var(--text-muted)] mb-5 tabular-nums">
          {versions.length} versã{versions.length !== 1 ? "ões" : "o"} — da mais recente para a mais antiga
        </p>

        <div className="space-y-2">
          {versions.map((v, i) => (
            <div
              key={v.id}
              style={{ animationDelay: `${i * 30}ms` }}
              className={`animate-fade-up card px-4 py-3.5 ${
                v.isActive ? "border-[var(--accent)]/40" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">
                      Versão {v.version}
                    </span>
                    {v.isActive && (
                      <span className="text-[11px] bg-[var(--accent-subtle)] text-[var(--accent-text)] px-2 py-0.5 rounded-full font-medium">
                        Ativa
                      </span>
                    )}
                    <span className="text-[11px] text-[var(--text-disabled)]">
                      {v.generatedBy === "AI" ? "Gerada por IA" : "Edição manual"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] tabular-nums mb-1">
                    {formatDate(v.createdAt)}
                  </p>
                  {v.changesSummary && (
                    <p className="text-[12px] text-[var(--text-secondary)] truncate">{v.changesSummary}</p>
                  )}
                  <p className="text-[11px] text-[var(--text-disabled)] mt-0.5 tabular-nums">
                    {v._count.modules} módulos
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Copiar */}
                  <button
                    onClick={() => handleCopy(v)}
                    className={`press flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border transition-all duration-150 ${
                      copiedId === v.id
                        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                        : "border-[var(--surface-border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--accent)]/30"
                    }`}
                  >
                    {copiedId === v.id ? <Check size={12} /> : <Copy size={12} />}
                    {copiedId === v.id ? "Copiado" : "Copiar"}
                  </button>

                  {/* Diff */}
                  {v.version > 1 && (
                    <button
                      onClick={() => setDiffVersion(v)}
                      className="press flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5 border border-[var(--surface-border)] hover:border-[var(--accent)]/30 rounded-md transition-all duration-150"
                    >
                      <GitCompare size={12} />
                      Diff
                    </button>
                  )}

                  {/* Exportar */}
                  <button
                    onClick={() => handleExport(v)}
                    className="press flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5 border border-[var(--surface-border)] hover:border-[var(--accent)]/30 rounded-md transition-all duration-150"
                    title="Exportar como .txt"
                  >
                    <Download size={12} />
                    .txt
                  </button>

                  {/* Ativar — com confirmação */}
                  {!v.isActive && (
                    confirmActivate === v.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[var(--text-secondary)]">Confirmar?</span>
                        <button
                          onClick={() => handleActivate(v.id)}
                          disabled={activating === v.id}
                          className="press text-[12px] font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                        >
                          {activating === v.id ? (
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                          ) : "Sim"}
                        </button>
                        <button
                          onClick={() => setConfirmActivate(null)}
                          disabled={activating === v.id}
                          className="press text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-2 py-1.5 rounded-md transition-colors"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmActivate(v.id)}
                        className="press text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] bg-[var(--surface-raised)] hover:bg-[var(--surface-border)] border border-[var(--surface-border)] px-3 py-1.5 rounded-md transition-all duration-150"
                      >
                        Ativar
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de diff */}
      {diffVersion && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setDiffVersion(null); }}
        >
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl w-full max-w-4xl my-8 shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--surface-border)]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-disabled)] mb-0.5">
                  Comparação
                </p>
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  Versão {prevVersion?.version ?? "?"} → Versão {diffVersion.version}
                </h2>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                  Módulos alterados em relação à versão anterior
                </p>
              </div>
              <button
                onClick={() => setDiffVersion(null)}
                className="press text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-md hover:bg-[var(--surface-raised)] transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!prevVersion ? (
                <p className="text-[var(--text-muted)] text-[13px]">Versão anterior não encontrada.</p>
              ) : (
                (() => {
                  const allKeys = new Set([
                    ...prevVersion.modules.map((m) => m.moduleKey),
                    ...diffVersion.modules.map((m) => m.moduleKey),
                  ]);

                  const changedModules:  { key: ModuleKey; old: string; new: string }[] = [];
                  const addedModules:    { key: ModuleKey; content: string }[] = [];
                  const removedModules:  { key: ModuleKey }[] = [];

                  allKeys.forEach((key) => {
                    const oldMod = prevVersion.modules.find((m) => m.moduleKey === key);
                    const newMod = diffVersion.modules.find((m) => m.moduleKey === key);
                    if (oldMod && newMod && oldMod.content !== newMod.content)
                      changedModules.push({ key, old: oldMod.content, new: newMod.content });
                    else if (!oldMod && newMod)
                      addedModules.push({ key, content: newMod.content });
                    else if (oldMod && !newMod)
                      removedModules.push({ key });
                  });

                  const totalChanges = changedModules.length + addedModules.length + removedModules.length;

                  if (totalChanges === 0)
                    return <div className="text-center py-8 text-[var(--text-muted)] text-[13px]">Nenhuma diferença encontrada.</div>;

                  return (
                    <div className="space-y-4">
                      <p className="text-[12px] text-[var(--text-muted)] tabular-nums">
                        {totalChanges} módulo{totalChanges !== 1 ? "s" : ""} alterado{totalChanges !== 1 ? "s" : ""}
                        {changedModules.length > 0 && ` · ${changedModules.length} modificado${changedModules.length !== 1 ? "s" : ""}`}
                        {addedModules.length > 0 && ` · ${addedModules.length} adicionado${addedModules.length !== 1 ? "s" : ""}`}
                        {removedModules.length > 0 && ` · ${removedModules.length} removido${removedModules.length !== 1 ? "s" : ""}`}
                      </p>
                      {addedModules.map(({ key, content }) => (
                        <DiffModule key={key} moduleKey={key} type="added" newContent={content} />
                      ))}
                      {removedModules.map(({ key }) => (
                        <DiffModule key={key} moduleKey={key} type="removed" />
                      ))}
                      {changedModules.map(({ key, old, new: newContent }) => (
                        <DiffModule key={key} moduleKey={key} type="changed" oldContent={old} newContent={newContent} />
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={dismiss} />
    </>
  );
}

/* ── DiffModule ─────────────────────────────────────────── */

function DiffModule({
  moduleKey, type, oldContent = "", newContent = "",
}: {
  moduleKey: ModuleKey;
  type: "added" | "removed" | "changed";
  oldContent?: string;
  newContent?: string;
}) {
  const label = MODULE_LABELS[moduleKey] ?? moduleKey;
  const [showFull, setShowFull] = useState(false);

  const cfg = {
    added:   { badge: "Adicionado", badgeClass: "bg-emerald-500/10 text-emerald-400", borderClass: "border-emerald-500/20" },
    removed: { badge: "Removido",   badgeClass: "bg-red-500/10 text-red-400",         borderClass: "border-red-500/20" },
    changed: { badge: "Modificado", badgeClass: "bg-[var(--accent-subtle)] text-[var(--accent-text)]", borderClass: "border-[var(--accent)]/20" },
  }[type];

  const lines = type === "changed" ? diffLines(oldContent, newContent) : [];

  return (
    <div className={`border rounded-lg overflow-hidden ${cfg.borderClass}`}>
      <div className="flex items-center justify-between bg-[var(--surface-raised)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[var(--text-muted)]">{moduleKey}</span>
          <span className="text-[var(--text-disabled)]">·</span>
          <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${cfg.badgeClass}`}>
            {cfg.badge}
          </span>
          {type === "changed" && (
            <button
              onClick={() => setShowFull(!showFull)}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {showFull ? "Ver diff" : "Ver completo"}
            </button>
          )}
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {type === "added" && (
          <pre className="text-[12px] text-emerald-300 bg-emerald-500/5 px-4 py-3 whitespace-pre-wrap font-mono leading-relaxed">
            {newContent}
          </pre>
        )}
        {type === "removed" && (
          <pre className="text-[12px] text-red-300 bg-red-500/5 px-4 py-3 whitespace-pre-wrap font-mono leading-relaxed line-through opacity-60">
            {oldContent}
          </pre>
        )}
        {type === "changed" && !showFull && (
          <div className="font-mono text-[12px] leading-relaxed">
            {lines.map((l, i) => (
              <div key={i} className={
                l.type === "added"
                  ? "bg-emerald-500/10 text-emerald-300 px-4 py-0.5"
                  : l.type === "removed"
                  ? "bg-red-500/10 text-red-300 px-4 py-0.5 line-through opacity-60"
                  : "text-[var(--text-disabled)] px-4 py-0.5"
              }>
                <span className="select-none mr-2 opacity-40">
                  {l.type === "added" ? "+" : l.type === "removed" ? "−" : " "}
                </span>
                <span className="whitespace-pre-wrap">{l.line || " "}</span>
              </div>
            ))}
          </div>
        )}
        {type === "changed" && showFull && (
          <div className="grid grid-cols-2 divide-x divide-[var(--surface-border)]">
            <div>
              <p className="text-[11px] text-[var(--text-disabled)] px-4 pt-2 pb-1">Versão anterior</p>
              <pre className="text-[12px] text-[var(--text-muted)] px-4 pb-3 whitespace-pre-wrap font-mono leading-relaxed">
                {oldContent}
              </pre>
            </div>
            <div>
              <p className="text-[11px] text-[var(--text-disabled)] px-4 pt-2 pb-1">Versão nova</p>
              <pre className="text-[12px] text-[var(--text-secondary)] px-4 pb-3 whitespace-pre-wrap font-mono leading-relaxed">
                {newContent}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
