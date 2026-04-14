"use client";

import { useEffect, useState, useCallback } from "react";

interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = ["pesquisa-mercado", "boas-praticas", "comunicacao", "scripts", "benchmarks", "outro"];

export default function KnowledgeBasePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KnowledgeDoc | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formTags, setFormTags] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge");
      setDocs(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setFormTitle(""); setFormContent(""); setFormCategory(""); setFormTags("");
    setShowForm(true);
  }

  function openEdit(doc: KnowledgeDoc) {
    setEditing(doc);
    setFormTitle(doc.title);
    setFormContent(doc.content);
    setFormCategory(doc.category ?? "");
    setFormTags(doc.tags.join(", "));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setError(null);
  }

  async function handleSave() {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSaving(true);
    setError(null);
    const tags = formTags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = { title: formTitle, content: formContent, category: formCategory || undefined, tags };

    try {
      const url = editing ? `/api/knowledge/${editing.id}` : "/api/knowledge";
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

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  const allTags = [...new Set(docs.flatMap((d) => d.tags))].sort();
  const filtered = filterTag ? docs.filter((d) => d.tags.includes(filterTag)) : docs;

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Carregando...</div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Knowledge Base</h1>
          <p className="text-zinc-400 text-sm">Pesquisas, boas práticas e insights que enriquecem os prompts.</p>
        </div>
        <button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-4 py-2 rounded-md transition-colors">
          + Novo documento
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
          <p className="text-zinc-400 text-sm">Nenhum documento encontrado.</p>
          <p className="text-zinc-600 text-xs mt-1">Adicione pesquisas de mercado, boas práticas e scripts que podem enriquecer os prompts.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => {
            const expanded = expandedId === doc.id;
            return (
              <div key={doc.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="flex items-start justify-between px-5 py-4">
                  <button
                    className="flex-1 text-left"
                    onClick={() => setExpandedId(expanded ? null : doc.id)}
                  >
                    <p className="text-sm font-medium text-zinc-200">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {doc.category && (
                        <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">{doc.category}</span>
                      )}
                      {doc.tags.map((tag) => (
                        <span key={tag} className="text-xs text-zinc-500"># {tag}</span>
                      ))}
                    </div>
                  </button>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button onClick={() => openEdit(doc)} className="text-xs text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800 transition-colors">Editar</button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleting === doc.id}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors px-2 py-1"
                    >
                      {deleting === doc.id ? "..." : "Apagar"}
                    </button>
                    <span className="text-zinc-700 text-xs">{expanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-zinc-800 px-5 py-4">
                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{doc.content}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criação/edição */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
              <h2 className="text-sm font-semibold text-white">{editing ? "Editar documento" : "Novo documento"}</h2>
              <button onClick={closeForm} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Título *</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Pesquisa de comunicação clínicas boutique SP"
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Categoria</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Selecione...</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Tags (separadas por vírgula)</label>
                  <input
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="boutique, implante, spin"
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Conteúdo *</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={14}
                  placeholder="Cole aqui o conteúdo da pesquisa, insight ou boa prática..."
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800 shrink-0">
              <button onClick={closeForm} className="text-sm text-zinc-400 hover:text-zinc-200 px-4 py-2">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving || !formTitle.trim() || !formContent.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-medium px-5 py-2 rounded-md transition-colors"
              >
                {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar documento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
