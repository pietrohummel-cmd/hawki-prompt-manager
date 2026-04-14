"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { ModuleKey } from "@/generated/prisma";
import { MODULE_LABELS } from "@/lib/prompt-constants";

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

// Diff linha a linha simples: retorna array de { line, type: 'same'|'added'|'removed' }
function diffLines(
  oldText: string,
  newText: string
): { line: string; type: "same" | "added" | "removed" }[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const result: { line: string; type: "same" | "added" | "removed" }[] = [];

  // Percorre linha por linha com LCS simplificado (índice duplo)
  let i = 0;
  let j = 0;
  while (i < oldLines.length || j < newLines.length) {
    const ol = oldLines[i];
    const nl = newLines[j];

    if (i >= oldLines.length) {
      result.push({ line: nl, type: "added" });
      j++;
    } else if (j >= newLines.length) {
      result.push({ line: ol, type: "removed" });
      i++;
    } else if (ol === nl) {
      result.push({ line: ol, type: "same" });
      i++;
      j++;
    } else if (!newSet.has(ol)) {
      result.push({ line: ol, type: "removed" });
      i++;
    } else if (!oldSet.has(nl)) {
      result.push({ line: nl, type: "added" });
      j++;
    } else {
      result.push({ line: ol, type: "removed" });
      result.push({ line: nl, type: "added" });
      i++;
      j++;
    }
  }
  return result;
}

export default function VersionsPage() {
  const { id } = useParams<{ id: string }>();
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diffVersion, setDiffVersion] = useState<PromptVersion | null>(null);

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

  async function handleActivate(versionId: string) {
    setActivating(versionId);
    try {
      const res = await fetch(`/api/clients/${id}/versions/${versionId}/activate`, { method: "PATCH" });
      if (!res.ok) throw new Error("Erro ao ativar versão");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ativar");
    } finally {
      setActivating(null);
    }
  }

  function handleExport(version: PromptVersion) {
    const blob = new Blob([version.systemPrompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompt-v${version.version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Carregando versões...</div>;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;
  if (versions.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
        <p className="text-zinc-400 text-sm">Nenhuma versão gerada ainda.</p>
        <p className="text-zinc-600 text-xs mt-1">Vá até a aba Prompt e clique em "Gerar prompt".</p>
      </div>
    );
  }

  // Versão anterior à que está em diff (para comparar)
  const prevVersion = diffVersion
    ? versions.find((v) => v.version === diffVersion.version - 1) ?? null
    : null;

  return (
    <div>
      <p className="text-zinc-500 text-sm mb-6">
        {versions.length} versã{versions.length !== 1 ? "ões" : "o"} — da mais recente para a mais antiga
      </p>

      <div className="space-y-3">
        {versions.map((v) => (
          <div
            key={v.id}
            className={`bg-zinc-900 border rounded-lg px-5 py-4 ${
              v.isActive ? "border-emerald-500/30" : "border-zinc-800"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">Versão {v.version}</span>
                  {v.isActive && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                      Ativa
                    </span>
                  )}
                  <span className="text-xs text-zinc-600">
                    {v.generatedBy === "AI" ? "Gerada por IA" : "Edição manual"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mb-1">{formatDate(v.createdAt)}</p>
                {v.changesSummary && (
                  <p className="text-xs text-zinc-400 truncate">{v.changesSummary}</p>
                )}
                <p className="text-xs text-zinc-600 mt-1">{v._count.modules} módulos</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {v.version > 1 && (
                  <button
                    onClick={() => setDiffVersion(v)}
                    className="text-xs text-sky-400 hover:text-sky-300 px-3 py-1.5 border border-sky-500/30 hover:border-sky-500/60 rounded-md transition-colors"
                  >
                    Ver diff
                  </button>
                )}
                <button
                  onClick={() => handleExport(v)}
                  className="text-xs text-zinc-500 hover:text-zinc-200 px-3 py-1.5 border border-zinc-700 hover:border-zinc-600 rounded-md transition-colors"
                >
                  .txt
                </button>
                {!v.isActive && (
                  <button
                    onClick={() => handleActivate(v.id)}
                    disabled={activating === v.id}
                    className="text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-1.5 rounded-md transition-colors"
                  >
                    {activating === v.id ? "Ativando..." : "Ativar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de diff */}
      {diffVersion && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl my-8 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Diff — Versão {prevVersion?.version ?? "?"} → Versão {diffVersion.version}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Módulos alterados em relação à versão anterior
                </p>
              </div>
              <button
                onClick={() => setDiffVersion(null)}
                className="text-zinc-500 hover:text-zinc-300 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!prevVersion ? (
                <p className="text-zinc-500 text-sm">Versão anterior não encontrada.</p>
              ) : (
                (() => {
                  const allKeys = new Set([
                    ...prevVersion.modules.map((m) => m.moduleKey),
                    ...diffVersion.modules.map((m) => m.moduleKey),
                  ]);

                  const changedModules: { key: ModuleKey; old: string; new: string }[] = [];
                  const addedModules: { key: ModuleKey; content: string }[] = [];
                  const removedModules: { key: ModuleKey }[] = [];

                  allKeys.forEach((key) => {
                    const oldMod = prevVersion.modules.find((m) => m.moduleKey === key);
                    const newMod = diffVersion.modules.find((m) => m.moduleKey === key);
                    if (oldMod && newMod && oldMod.content !== newMod.content) {
                      changedModules.push({ key, old: oldMod.content, new: newMod.content });
                    } else if (!oldMod && newMod) {
                      addedModules.push({ key, content: newMod.content });
                    } else if (oldMod && !newMod) {
                      removedModules.push({ key });
                    }
                  });

                  const totalChanges = changedModules.length + addedModules.length + removedModules.length;

                  if (totalChanges === 0) {
                    return (
                      <div className="text-center py-8 text-zinc-500 text-sm">
                        Nenhuma diferença encontrada entre as versões.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      <p className="text-xs text-zinc-500">
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
    </div>
  );
}

function DiffModule({
  moduleKey,
  type,
  oldContent = "",
  newContent = "",
}: {
  moduleKey: ModuleKey;
  type: "added" | "removed" | "changed";
  oldContent?: string;
  newContent?: string;
}) {
  const label = MODULE_LABELS[moduleKey] ?? moduleKey;
  const [showFull, setShowFull] = useState(false);

  const typeConfig = {
    added: { badge: "Adicionado", badgeClass: "bg-emerald-500/10 text-emerald-400", borderClass: "border-emerald-500/20" },
    removed: { badge: "Removido", badgeClass: "bg-red-500/10 text-red-400", borderClass: "border-red-500/20" },
    changed: { badge: "Modificado", badgeClass: "bg-sky-500/10 text-sky-400", borderClass: "border-sky-500/20" },
  }[type];

  const lines = type === "changed" ? diffLines(oldContent, newContent) : [];

  return (
    <div className={`border rounded-lg overflow-hidden ${typeConfig.borderClass}`}>
      <div className="flex items-center justify-between bg-zinc-800/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">{moduleKey}</span>
          <span className="text-xs text-zinc-600">·</span>
          <span className="text-xs text-zinc-300">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${typeConfig.badgeClass}`}>
            {typeConfig.badge}
          </span>
          {type === "changed" && (
            <button
              onClick={() => setShowFull(!showFull)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {showFull ? "Ver diff" : "Ver completo"}
            </button>
          )}
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {type === "added" && (
          <pre className="text-xs text-emerald-300 bg-emerald-500/5 px-4 py-3 whitespace-pre-wrap font-mono leading-relaxed">
            {newContent}
          </pre>
        )}
        {type === "removed" && (
          <pre className="text-xs text-red-300 bg-red-500/5 px-4 py-3 whitespace-pre-wrap font-mono leading-relaxed line-through opacity-60">
            {oldContent}
          </pre>
        )}
        {type === "changed" && !showFull && (
          <div className="font-mono text-xs leading-relaxed">
            {lines.map((l, i) => (
              <div
                key={i}
                className={
                  l.type === "added"
                    ? "bg-emerald-500/10 text-emerald-300 px-4 py-0.5"
                    : l.type === "removed"
                    ? "bg-red-500/10 text-red-300 px-4 py-0.5 line-through opacity-60"
                    : "text-zinc-500 px-4 py-0.5"
                }
              >
                <span className="select-none mr-2 opacity-40">
                  {l.type === "added" ? "+" : l.type === "removed" ? "−" : " "}
                </span>
                <span className="whitespace-pre-wrap">{l.line || " "}</span>
              </div>
            ))}
          </div>
        )}
        {type === "changed" && showFull && (
          <div className="grid grid-cols-2 divide-x divide-zinc-800">
            <div>
              <p className="text-xs text-zinc-600 px-4 pt-2 pb-1">Versão anterior</p>
              <pre className="text-xs text-zinc-400 px-4 pb-3 whitespace-pre-wrap font-mono leading-relaxed">
                {oldContent}
              </pre>
            </div>
            <div>
              <p className="text-xs text-zinc-600 px-4 pt-2 pb-1">Versão nova</p>
              <pre className="text-xs text-zinc-300 px-4 pb-3 whitespace-pre-wrap font-mono leading-relaxed">
                {newContent}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
