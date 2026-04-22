"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  RefreshCw, Upload, ChevronDown, ChevronUp, Pencil, Sparkles, X,
} from "lucide-react";
import { MODULE_LABELS, MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";
import { Toast, useToast } from "@/components/toast";

/* ── Tipos ──────────────────────────────────────────────── */

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

/* ── Componente principal ───────────────────────────────── */

export default function PromptPage() {
  const { id } = useParams<{ id: string }>();
  const { toast, showToast, dismiss } = useToast();

  const [client, setClient]               = useState<ClientData | null>(null);
  const [activeVersion, setActiveVersion] = useState<PromptVersion | null>(null);
  const [loading, setLoading]             = useState(true);
  const [generating, setGenerating]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<ModuleKey | null>(null);

  // Modal de edição por módulo
  const [editingModule, setEditingModule] = useState<PromptModule | null>(null);
  const [editContent, setEditContent]     = useState("");
  const [suggestion, setSuggestion]       = useState<string | null>(null);
  const [suggesting, setSuggesting]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState<string | null>(null);

  // Modal de importação
  const [showImport, setShowImport]     = useState(false);
  const [importText, setImportText]     = useState("");
  const [importing, setImporting]       = useState(false);
  const [importError, setImportError]   = useState<string | null>(null);

  const loadClient = useCallback(async () => {
    try {
      const res  = await fetch(`/api/clients/${id}`);
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

  useEffect(() => { loadClient(); }, [loadClient]);

  // Fechar modais com Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingModule) closeEditModal();
        if (showImport) closeImport();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [editingModule, showImport]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res  = await fetch(`/api/clients/${id}/generate-prompt`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "Erro ao gerar");
      setActiveVersion(data);
      await loadClient();
      showToast({
        type: "success",
        message: `Prompt gerado — versão ${data.version}.`,
        action: {
          label: "Ver prompt",
          onClick: () => document.querySelector<HTMLButtonElement>("[data-prompt-modal]")?.click(),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar prompt");
    } finally {
      setGenerating(false);
    }
  }

  function closeImport() {
    setShowImport(false);
    setImportText("");
    setImportError(null);
  }

  async function handleImport() {
    if (!importText.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const res  = await fetch(`/api/clients/${id}/import-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: importText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao importar");
      closeImport();
      await loadClient();
      showToast({ type: "success", message: "Prompt importado e organizado em módulos." });
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
      const res  = await fetch(`/api/clients/${id}/modules/suggest`, {
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
      const res  = await fetch(`/api/clients/${id}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey: editingModule.moduleKey, content: editContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar módulo");
      closeEditModal();
      await loadClient();
      showToast({ type: "success", message: `Módulo "${MODULE_LABELS[editingModule.moduleKey]}" salvo.` });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {MODULE_ORDER.slice(0, 6).map((k) => (
          <div key={k} className="card h-12" />
        ))}
      </div>
    );
  }

  if (!client) return <div className="text-red-400 text-[13px]">Cliente não encontrado.</div>;

  const sortedModules = activeVersion
    ? (MODULE_ORDER.map((key) => activeVersion.modules.find((m) => m.moduleKey === key)).filter(Boolean) as PromptModule[])
    : [];

  return (
    <>
      {/* Header da versão + ações */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-[var(--text-muted)]">
          {activeVersion
            ? `Versão ${activeVersion.version} · ${activeVersion.generatedBy === "AI" ? "Gerada por IA" : "Edição manual"}`
            : "Nenhum prompt gerado"}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(true); setImportError(null); }}
            className="press flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] border border-[var(--surface-border)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)] px-3 py-1.5 rounded-md transition-all duration-150"
          >
            <Upload size={13} />
            Importar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="press flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-medium text-[13px] px-4 py-1.5 rounded-md transition-colors duration-150"
          >
            {generating ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            {generating ? "Gerando..." : activeVersion ? "Regenerar" : "Gerar prompt"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[13px] px-4 py-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      {/* Estado vazio */}
      {!activeVersion && !generating && (
        <div className="card p-12 text-center">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center mx-auto mb-4">
            <Sparkles size={18} className="text-[var(--accent)]" />
          </div>
          <p className="text-[var(--text-secondary)] text-[13px] mb-1">Nenhum prompt gerado ainda.</p>
          <p className="text-[var(--text-disabled)] text-[12px]">
            Clique em "Gerar prompt" para criar a primeira versão com IA.
          </p>
        </div>
      )}

      {/* Skeleton durante geração */}
      {generating && (
        <div className="space-y-2 animate-pulse">
          {MODULE_ORDER.map((key) => (
            <div key={key} className="card p-4">
              <div className="h-3 w-40 bg-[var(--surface-raised)] rounded mb-2" />
              <div className="h-2 w-full bg-[var(--surface-raised)]/60 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Lista de módulos */}
      {activeVersion && !generating && (
        <div className="space-y-1.5">
          {sortedModules.map((mod, i) => (
            <div
              key={mod.moduleKey}
              style={{ animationDelay: `${i * 20}ms` }}
              className="animate-fade-up card overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                  onClick={() => setExpandedModule(expandedModule === mod.moduleKey ? null : mod.moduleKey)}
                >
                  <span className="text-[11px] text-[var(--text-disabled)] w-5 text-right tabular-nums shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">
                    {MODULE_LABELS[mod.moduleKey]}
                  </span>
                  <span className="text-[11px] text-[var(--text-disabled)] font-mono">
                    {mod.moduleKey}
                  </span>
                </button>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => openEditModal(mod)}
                    className="press flex items-center gap-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors px-2 py-1 rounded hover:bg-[var(--accent-subtle)]"
                  >
                    <Pencil size={11} />
                    Editar
                  </button>
                  <button
                    onClick={() => setExpandedModule(expandedModule === mod.moduleKey ? null : mod.moduleKey)}
                    className="text-[var(--text-disabled)] hover:text-[var(--text-muted)] transition-colors"
                  >
                    {expandedModule === mod.moduleKey
                      ? <ChevronUp size={14} />
                      : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {expandedModule === mod.moduleKey && (
                <div className="border-t border-[var(--surface-border)] px-4 py-4">
                  <pre className="text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap font-mono leading-relaxed">
                    {mod.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de importação */}
      {showImport && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) closeImport(); }}
        >
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)] shrink-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-disabled)] mb-0.5">
                  Importar prompt existente
                </p>
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  Cole o texto do prompt abaixo
                </h2>
              </div>
              <button
                onClick={closeImport}
                className="press text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-md hover:bg-[var(--surface-raised)] transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-md px-4 py-3 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                <p className="font-medium text-[var(--text-primary)] mb-1">
                  Cole qualquer formato de prompt — a IA reorganiza automaticamente.
                </p>
                <p className="text-[var(--text-muted)]">
                  Suporta: formato XML{" "}
                  <code className="text-[var(--accent-text)]">&lt;your_identity&gt;</code>, texto corrido, ou o formato nativo{" "}
                  <code className="text-[var(--accent-text)]">###MÓDULO:KEY###</code>.
                </p>
              </div>

              {importing && (
                <div className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-md px-4 py-3 text-[12px] text-[var(--text-secondary)] flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-[var(--text-disabled)] border-t-[var(--accent)] rounded-full animate-spin shrink-0" />
                  Processando com IA... pode levar até 30s.
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1.5 block">
                  Texto do prompt
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={18}
                  placeholder="Cole aqui o conteúdo completo do prompt..."
                  className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[12px] rounded-md px-3 py-2.5 font-mono resize-none focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-disabled)] leading-relaxed transition-colors"
                />
              </div>

              {importError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[12px] px-3 py-2 rounded-md">
                  {importError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--surface-border)] shrink-0">
              <button
                onClick={closeImport}
                className="press text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-4 py-2 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !importText.trim()}
                className="press flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[13px] font-medium px-5 py-2 rounded-md transition-colors duration-150"
              >
                {importing ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Upload size={13} />
                )}
                {importing ? "Importando..." : "Importar prompt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edição de módulo */}
      {editingModule && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}
        >
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-fade-up">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)] shrink-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-disabled)] mb-0.5">
                  Editando módulo
                </p>
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {MODULE_LABELS[editingModule.moduleKey]}
                </h2>
              </div>
              <button
                onClick={closeEditModal}
                className="press text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-md hover:bg-[var(--surface-raised)] transition-all"
              >
                <X size={14} />
              </button>
            </div>

            {/* Corpo */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1.5 block">
                  Conteúdo
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={12}
                  className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[12px] rounded-md px-3 py-2.5 font-mono resize-none focus:outline-none focus:border-[var(--accent)] transition-colors leading-relaxed"
                />
              </div>

              {suggestion && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-medium text-[var(--accent-text)] uppercase tracking-[0.1em]">
                      Sugestão da IA
                    </label>
                    <button
                      onClick={() => { setEditContent(suggestion); setSuggestion(null); }}
                      className="press text-[12px] text-[var(--accent-text)] hover:underline underline-offset-2 transition-colors"
                    >
                      Usar esta sugestão ↑
                    </button>
                  </div>
                  <pre className="text-[12px] text-[var(--text-secondary)] bg-[var(--surface-raised)] border border-[var(--accent)]/20 rounded-md px-3 py-3 whitespace-pre-wrap font-mono leading-relaxed">
                    {suggestion}
                  </pre>
                </div>
              )}

              {saveError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[12px] px-3 py-2 rounded-md">
                  {saveError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--surface-border)] shrink-0">
              <button
                onClick={handleSuggest}
                disabled={suggesting || saving}
                className="press flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-raised)] hover:bg-[var(--surface-border)] border border-[var(--surface-border)] px-4 py-2 rounded-md transition-colors disabled:opacity-40"
              >
                {suggesting ? (
                  <span className="w-3 h-3 border-2 border-[var(--text-disabled)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                ) : (
                  <Sparkles size={13} className="text-[var(--accent)]" />
                )}
                {suggesting ? "Gerando sugestão..." : "Sugerir com IA"}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeEditModal}
                  disabled={saving}
                  className="press text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-4 py-2 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveModule}
                  disabled={saving || suggesting}
                  className="press flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[13px] font-medium px-5 py-2 rounded-md transition-colors duration-150"
                >
                  {saving ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : null}
                  {saving ? "Salvando..." : "Salvar módulo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={dismiss} />
    </>
  );
}
