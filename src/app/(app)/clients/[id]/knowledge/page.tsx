"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { KB_TOPICS, type KbTopicKey } from "@/lib/kb-topics";

interface KbArticle {
  id: string;
  topic: KbTopicKey;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function KnowledgePage() {
  const { id } = useParams<{ id: string }>();
  const [articles, setArticles] = useState<(KbArticle | null)[]>(
    KB_TOPICS.map(() => null)
  );
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}/knowledge`);
      if (!res.ok) throw new Error("Erro ao carregar artigos");
      const data: (KbArticle | null)[] = await res.json();
      setArticles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${id}/knowledge`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Erro ao gerar KB");
      }
      await fetchArticles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setGenerating(false);
    }
  }

  function startEdit(article: KbArticle) {
    setEditing(article.id);
    setEditContent(article.content);
  }

  async function handleSave(articleId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}/knowledge/${articleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      await fetchArticles();
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(article: KbArticle) {
    try {
      const res = await fetch(`/api/clients/${id}/knowledge/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !article.isActive }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      await fetchArticles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  }

  const hasAnyArticle = articles.some((a) => a !== null);

  if (loading) {
    return (
      <div className="space-y-3">
        {KB_TOPICS.map((t) => (
          <div key={t.key} className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-xl p-4 animate-pulse">
            <div className="h-4 w-48 bg-zinc-700 rounded mb-2" />
            <div className="h-3 w-full bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Base de Conhecimento</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {hasAnyArticle
              ? `${articles.filter((a) => a?.isActive).length} de ${KB_TOPICS.length} artigos ativos`
              : "Nenhum artigo gerado ainda"}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {generating ? "Gerando..." : hasAnyArticle ? "Regenerar KB" : "Gerar KB"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {generating && (
        <div className="mb-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
          Gerando 8 artigos personalizados com os dados da clínica... isso leva cerca de 15 segundos.
        </div>
      )}

      {/* Articles */}
      <div className="space-y-3">
        {KB_TOPICS.map((topicDef, i) => {
          const article = articles[i];

          if (!article) {
            return (
              <div
                key={topicDef.key}
                className="bg-[var(--surface-card)] border border-[var(--surface-border)] border-dashed rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text-muted)]">{topicDef.title}</p>
                  <p className="text-xs text-[var(--text-disabled)] mt-0.5">Não gerado</p>
                </div>
              </div>
            );
          }

          const isExpanded = expanded === article.id;
          const isEditing = editing === article.id;
          const preview = article.content.split("\n").slice(0, 2).join(" ").slice(0, 120);

          return (
            <div
              key={article.id}
              className={`bg-[var(--surface-card)] border rounded-xl transition-colors ${
                article.isActive
                  ? "border-[var(--surface-border)]"
                  : "border-[var(--surface-border)] opacity-50"
              }`}
            >
              {/* Card header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => !isEditing && setExpanded(isExpanded ? null : article.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{article.title}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      article.isActive
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-zinc-500/10 text-zinc-500"
                    }`}>
                      {article.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  {!isExpanded && (
                    <p className="text-xs text-[var(--text-muted)] mt-1 truncate">{preview}…</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleActive(article); }}
                    className="text-xs text-[var(--text-disabled)] hover:text-[var(--text-secondary)] px-2 py-1 rounded transition-colors"
                  >
                    {article.isActive ? "Desativar" : "Ativar"}
                  </button>
                  <span className="text-[var(--text-disabled)]">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[var(--surface-border)]">
                  {isEditing ? (
                    <div className="mt-3 space-y-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={12}
                        className="w-full bg-[var(--surface-input)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono resize-y"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(article.id)}
                          disabled={saving}
                          className="px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                          {saving ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="px-4 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-sans leading-relaxed">
                        {article.content}
                      </pre>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(article); }}
                        className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--surface-border)] px-3 py-1.5 rounded-md transition-colors"
                      >
                        Editar
                      </button>
                    </div>
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
