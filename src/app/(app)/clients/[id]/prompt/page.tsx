"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { MODULE_LABELS, MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";

interface PromptModule {
  id: string;
  moduleKey: ModuleKey;
  content: string;
}

interface PromptVersion {
  id: string;
  version: number;
  isActive: boolean;
  generatedBy: string;
  createdAt: string;
  modules: PromptModule[];
}

interface ClientData {
  id: string;
  clinicName: string;
  assistantName: string;
  name: string;
  status: string;
  promptVersions: PromptVersion[];
}

export default function PromptPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientData | null>(null);
  const [activeVersion, setActiveVersion] = useState<PromptVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<ModuleKey | null>(null);

  // Estado do modal de edição por módulo
  const [editingModule, setEditingModule] = useState<PromptModule | null>(null);
  const [editContent, setEditContent] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Estado do modal de importação
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const loadClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error("Erro ao carregar cliente");
      const data: ClientData = await res.json();
      setClient(data);
      const active = data.promptVersions.find((v) => v.isActive) ?? data.promptVersions[0] ?? null;
      setActiveVersion(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${id}/generate-prompt`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "Erro ao gerar");
      setActiveVersion(data);
      await loadClient();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar prompt");
    } finally {
      setGenerating(false);
    }
  }

  async function handleImport() {
    if (!importText.trim()) return;
    setImporting(true);
    setImportError(null);
    setImportStatus(null);
    try {
      const res = await fetch(`/api/clients/${id}/import-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: importText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao importar");
      setShowImport(false);
      setImportText("");
      setImportStatus(null);
      await loadClient();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Erro ao importar");
    } finally {
      setImporting(false);
    }
  }

  function openEditModal(mod: PromptModule) {
    setEditingModule(mod);
    setEditContent(mod.content);
    setSuggestion(null);
    setSaveError(null);
  }

  function closeEditModal() {
    setEditingModule(null);
    setEditContent("");
    setSuggestion(null);
    setSaveError(null);
  }

  async function handleSuggest() {
    if (!editingModule) return;
    setSuggesting(true);
    setSuggestion(null);
    try {
      const res = await fetch(`/api/clients/${id}/modules/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey: editingModule.moduleKey, currentContent: editContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar sugestão");
      setSuggestion(data.suggestion);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao gerar sugestão");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSaveModule() {
    if (!editingModule) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/clients/${id}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey: editingModule.moduleKey, content: editContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar módulo");
      closeEditModal();
      await loadClient();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500 text-sm">Carregando...</div>
      </div>
    );
  }

  if (!client) {
    return <div className="text-red-400 text-sm">Cliente não encontrado.</div>;
  }

  const sortedModules = activeVersion
    ? MODULE_ORDER.map((key) => activeVersion.modules.find((m) => m.moduleKey === key)).filter(Boolean) as PromptModule[]
    : [];

  return (
    <>
      {/* Header da versão + botão regenerar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-zinc-500">
          {activeVersion
            ? `Versão ${activeVersion.version} · gerado por ${activeVersion.generatedBy === "AI" ? "IA" : "edição manual"}`
            : "Nenhum prompt gerado"}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(true); setImportError(null); }}
            className="text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 px-4 py-2 rounded-md transition-colors"
          >
            Importar prompt ↑
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-medium text-sm px-4 py-2 rounded-md transition-colors"
          >
            {generating ? (
              <>
                <span className="animate-spin inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full" />
                Gerando...
              </>
            ) : activeVersion ? (
              "Regenerar ↺"
            ) : (
              "Gerar prompt →"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Estado vazio */}
      {!activeVersion && !generating && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <div className="text-zinc-600 text-4xl mb-4">✦</div>
          <p className="text-zinc-400 text-sm mb-1">Nenhum prompt gerado ainda.</p>
          <p className="text-zinc-600 text-xs">Clique em "Gerar prompt" para criar a primeira versão.</p>
        </div>
      )}

      {/* Skeleton durante geração */}
      {generating && (
        <div className="space-y-3">
          {MODULE_ORDER.map((key) => (
            <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-pulse">
              <div className="h-3 w-40 bg-zinc-800 rounded mb-2" />
              <div className="h-2 w-full bg-zinc-800/60 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Lista de módulos */}
      {activeVersion && !generating && (
        <div className="space-y-2">
          {sortedModules.map((mod, i) => (
            <div key={mod.moduleKey} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                  onClick={() => setExpandedModule(expandedModule === mod.moduleKey ? null : mod.moduleKey)}
                >
                  <span className="text-xs text-zinc-600 w-5 text-right">{i + 1}</span>
                  <span className="text-sm font-medium text-zinc-200">{MODULE_LABELS[mod.moduleKey]}</span>
                  <span className="text-xs text-zinc-600 font-mono">{mod.moduleKey}</span>
                </button>
                <div className="flex items-center gap-3 ml-4">
                  <button
                    onClick={() => openEditModal(mod)}
                    className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
                  >
                    Editar
                  </button>
                  <span className="text-zinc-700 text-xs">
                    {expandedModule === mod.moduleKey ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {expandedModule === mod.moduleKey && (
                <div className="border-t border-zinc-800 px-4 py-4">
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {mod.content}
                  </pre>
                </div>
              )}
            </div>
          ))}

          {/* Prompt bruto completo */}
          <details className="mt-6">
            <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400 py-2">
              Ver prompt completo (texto bruto)
            </summary>
            <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
                {activeVersion.modules
                  .sort((a, b) => MODULE_ORDER.indexOf(a.moduleKey) - MODULE_ORDER.indexOf(b.moduleKey))
                  .map((m) => `###MÓDULO:${m.moduleKey}###\n${m.content}`)
                  .join("\n\n")}
              </pre>
            </div>
          </details>
        </div>
      )}

      {/* Modal de importação de prompt existente */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-0.5">Importar prompt existente</p>
                <h2 className="text-sm font-semibold text-white">Cole o texto do prompt abaixo</h2>
              </div>
              <button onClick={() => setShowImport(false)} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-md px-4 py-3 text-xs text-zinc-400 leading-relaxed">
                <p className="font-medium text-zinc-300 mb-1">Cole qualquer formato de prompt — a IA reorganiza automaticamente.</p>
                <p className="text-zinc-500">Suporta: formato XML <code className="text-zinc-400">&lt;your_identity&gt;</code>, texto corrido, ou o formato nativo <code className="text-emerald-400">###MÓDULO:KEY###</code>.</p>
                <p className="mt-1.5 text-zinc-600">Quando o formato não for reconhecido automaticamente, o Sonnet reorganiza o conteúdo nos 18 módulos.</p>
              </div>

              {importing && (
                <div className="bg-zinc-800/80 border border-zinc-700 rounded-md px-4 py-3 text-xs text-zinc-300 flex items-center gap-2">
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-zinc-500 border-t-emerald-400 rounded-full shrink-0" />
                  Processando... Se o formato não for padrão, a IA está reorganizando o prompt nos 18 módulos. Pode levar até 30s.
                </div>
              )}

              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Texto do prompt</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={18}
                  placeholder="Cole aqui o conteúdo completo do prompt..."
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs rounded-md px-3 py-2.5 font-mono resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 leading-relaxed"
                />
              </div>

              {importError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-md">
                  {importError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800 shrink-0">
              <button onClick={() => setShowImport(false)} className="text-sm text-zinc-400 hover:text-zinc-200 px-4 py-2">Cancelar</button>
              <button
                onClick={handleImport}
                disabled={importing || !importText.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-medium px-5 py-2 rounded-md transition-colors"
              >
                {importing ? "Importando..." : "Importar prompt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edição de módulo */}
      {editingModule && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Header do modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-0.5">Editando módulo</p>
                <h2 className="text-sm font-semibold text-white">{MODULE_LABELS[editingModule.moduleKey]}</h2>
              </div>
              <button
                onClick={closeEditModal}
                className="text-zinc-500 hover:text-zinc-300 text-xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            {/* Corpo do modal */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Conteúdo</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={12}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs rounded-md px-3 py-2.5 font-mono resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors leading-relaxed"
                />
              </div>

              {suggestion && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-emerald-400 font-medium">Sugestão da IA</label>
                    <button
                      onClick={() => { setEditContent(suggestion); setSuggestion(null); }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 underline transition-colors"
                    >
                      Usar esta sugestão ↑
                    </button>
                  </div>
                  <pre className="text-xs text-zinc-400 bg-zinc-800/60 border border-emerald-500/20 rounded-md px-3 py-3 whitespace-pre-wrap font-mono leading-relaxed">
                    {suggestion}
                  </pre>
                </div>
              )}

              {saveError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-md">
                  {saveError}
                </div>
              )}
            </div>

            {/* Footer do modal */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800 shrink-0">
              <button
                onClick={handleSuggest}
                disabled={suggesting || saving}
                className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-md transition-colors disabled:opacity-40"
              >
                {suggesting ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-zinc-500 border-t-white rounded-full" />
                    Sugerindo...
                  </>
                ) : (
                  "Sugerir com IA ✦"
                )}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeEditModal}
                  disabled={saving}
                  className="text-sm text-zinc-400 hover:text-zinc-200 px-4 py-2 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveModule}
                  disabled={saving || suggesting}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-medium px-5 py-2 rounded-md transition-colors"
                >
                  {saving ? "Salvando..." : "Salvar módulo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
