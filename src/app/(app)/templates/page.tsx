"use client";

import { useEffect, useState, useCallback } from "react";

interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  version: string;
  isActive: boolean;
  tags: string[];
  createdAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formVersion, setFormVersion] = useState("v1.0");
  const [formTags, setFormTags] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      setTemplates(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setFormName(""); setFormDescription(""); setFormContent(""); setFormVersion("v1.0"); setFormTags("");
    setShowForm(true);
    setError(null);
  }

  function openEdit(t: PromptTemplate) {
    setEditing(t);
    setFormName(t.name);
    setFormDescription(t.description ?? "");
    setFormContent(t.content);
    setFormVersion(t.version);
    setFormTags(t.tags.join(", "));
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setError(null);
  }

  async function handleSave() {
    if (!formName.trim() || !formContent.trim()) return;
    setSaving(true);
    setError(null);
    const tags = formTags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      name: formName,
      description: formDescription || undefined,
      content: formContent,
      version: formVersion,
      tags,
    };

    try {
      const url = editing ? `/api/templates/${editing.id}` : "/api/templates";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Erro ao salvar");
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(t: PromptTemplate) {
    await fetch(`/api/templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    await load();
  }

  async function handleConvert() {
    if (!formContent.trim()) return;
    setConverting(true);
    setError(null);
    try {
      const res = await fetch("/api/templates/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: formContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao converter");
      setFormContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao converter");
    } finally {
      setConverting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  function handleExport(t: PromptTemplate) {
    const blob = new Blob([t.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${t.name.toLowerCase().replace(/\s+/g, "-")}-${t.version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allTags = [...new Set(templates.flatMap((t) => t.tags))].sort();
  const filtered = filterTag ? templates.filter((t) => t.tags.includes(filterTag)) : templates;

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Templates</h1>
          <p className="text-zinc-400 text-sm">Templates universais de prompt — histórico e versionamento.</p>
        </div>
        <button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-4 py-2 rounded-md transition-colors">
          + Novo template
        </button>
      </div>

      {/* Filtro por tag */}
      {allTags.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setFilterTag("")}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${!filterTag ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : "border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}
          >
            Todos
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? "" : tag)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterTag === tag ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : "border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <p className="text-zinc-400 text-sm">Nenhum template cadastrado.</p>
          <p className="text-zinc-600 text-xs mt-1">Suba os templates que já estão em uso para ter histórico e versionamento.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const expanded = expandedId === t.id;
            return (
              <div
                key={t.id}
                className={`bg-zinc-900 border rounded-lg overflow-hidden ${t.isActive ? "border-zinc-800" : "border-zinc-800/50 opacity-60"}`}
              >
                <div className="flex items-start justify-between px-5 py-4">
                  <button className="flex-1 text-left" onClick={() => setExpandedId(expanded ? null : t.id)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-zinc-200">{t.name}</span>
                      <span className="text-xs text-zinc-600 font-mono">{t.version}</span>
                      {!t.isActive && (
                        <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">Inativo</span>
                      )}
                    </div>
                    {t.description && <p className="text-xs text-zinc-500 mb-1">{t.description}</p>}
                    <div className="flex gap-2 flex-wrap">
                      {t.tags.map((tag) => (
                        <span key={tag} className="text-xs text-zinc-600"># {tag}</span>
                      ))}
                    </div>
                  </button>

                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button onClick={() => handleExport(t)} className="text-xs text-zinc-500 hover:text-zinc-200 px-2 py-1 border border-zinc-700 hover:border-zinc-600 rounded transition-colors">
                      .txt
                    </button>
                    <button onClick={() => openEdit(t)} className="text-xs text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800 transition-colors">
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(t)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                    >
                      {t.isActive ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting === t.id}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors px-2 py-1"
                    >
                      {deleting === t.id ? "..." : "Apagar"}
                    </button>
                    <span className="text-zinc-700 text-xs">{expanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-zinc-800 px-5 py-4">
                    <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                      {t.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal criar/editar */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
              <h2 className="text-sm font-semibold text-white">{editing ? "Editar template" : "Novo template"}</h2>
              <button onClick={closeForm} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Nome *</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Template Clínica Popular v2"
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Versão</label>
                  <input
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    placeholder="v1.0"
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Descrição</label>
                <input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ex: Template base para clínicas populares — tom casual, foco em acessibilidade"
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Tags (separadas por vírgula)</label>
                <input
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="popular, ortodontia, casual"
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-xs text-zinc-600 mt-1">Sugestões: popular, intermediaria, premium, boutique, ortodontia, implante, estetica, geral</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-zinc-400">Conteúdo do template * (formato ###MÓDULO:KEY###)</label>
                  <button
                    type="button"
                    onClick={handleConvert}
                    disabled={converting || !formContent.trim()}
                    className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-40 flex items-center gap-1 transition-colors"
                    title="Converte o conteúdo colado (XML, texto livre) para o formato ###MÓDULO:KEY### usando IA"
                  >
                    {converting ? "Convertendo..." : "✦ Converter com IA"}
                  </button>
                </div>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={16}
                  placeholder="###MÓDULO:IDENTITY###&#10;[conteúdo]&#10;###MÓDULO:ABSOLUTE_RULES###&#10;[conteúdo]&#10;..."
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs rounded-md px-3 py-2.5 font-mono resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 leading-relaxed"
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800 shrink-0">
              <button onClick={closeForm} className="text-sm text-zinc-400 hover:text-zinc-200 px-4 py-2">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formContent.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-medium px-5 py-2 rounded-md transition-colors"
              >
                {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
