"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface LeadOriginTag {
  id: string;
  tag: string;
  opening: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

export default function OriginsPage() {
  const { id } = useParams<{ id: string }>();
  const [origins, setOrigins] = useState<LeadOriginTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal criar/editar
  const [editing, setEditing] = useState<LeadOriginTag | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTag, setFormTag] = useState("");
  const [formOpening, setFormOpening] = useState("");
  const [formDefault, setFormDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}/origins`);
      if (!res.ok) throw new Error("Erro ao carregar origens");
      setOrigins(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setFormTag("");
    setFormOpening("");
    setFormDefault(false);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(origin: LeadOriginTag) {
    setEditing(origin);
    setFormTag(origin.tag);
    setFormOpening(origin.opening);
    setFormDefault(origin.isDefault);
    setFormError(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!formTag.trim() || !formOpening.trim()) {
      setFormError("Tag e abertura são obrigatórias");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = { tag: formTag.trim(), opening: formOpening.trim(), isDefault: formDefault };
      let res: Response;
      if (editing) {
        res = await fetch(`/api/clients/${id}/origins/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/clients/${id}/origins`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(origin: LeadOriginTag) {
    const res = await fetch(`/api/clients/${id}/origins/${origin.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !origin.isActive }),
    });
    if (res.ok) {
      setOrigins((prev) => prev.map((o) => o.id === origin.id ? { ...o, isActive: !o.isActive } : o));
    }
  }

  async function handleDelete(origin: LeadOriginTag) {
    if (!confirm(`Apagar tag "${origin.tag}"?`)) return;
    const res = await fetch(`/api/clients/${id}/origins/${origin.id}`, { method: "DELETE" });
    if (res.ok) setOrigins((prev) => prev.filter((o) => o.id !== origin.id));
  }

  if (loading) return <div className="text-[var(--text-muted)] text-sm py-8 text-center">Carregando...</div>;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  const defaultTag = origins.find((o) => o.isDefault);
  const customTags = origins.filter((o) => !o.isDefault);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">
            Configure aberturas personalizadas por origem do lead.
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            A Sofia usa a abertura correspondente à tag de origem do contato. Quando nenhuma tag bate, usa a padrão.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-4 py-2 rounded-md transition-colors shrink-0"
        >
          + Nova tag
        </button>
      </div>

      {/* Tag padrão */}
      <div className="mb-6">
        <p className="text-xs text-[var(--text-disabled)] uppercase tracking-widest mb-2">Padrão (sem tag específica)</p>
        {defaultTag ? (
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-muted)] mb-1">Abertura:</p>
                <p className="text-sm text-[var(--text-primary)]">{defaultTag.opening}</p>
              </div>
              <button
                onClick={() => openEdit(defaultTag)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5 border border-[var(--surface-border)] rounded-md transition-colors shrink-0"
              >
                Editar
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-dashed border-[var(--surface-border)] rounded-lg px-4 py-4 text-center">
            <p className="text-xs text-[var(--text-muted)]">Nenhuma abertura padrão configurada.</p>
            <button
              onClick={() => { openCreate(); setFormDefault(true); }}
              className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 underline"
            >
              Criar agora
            </button>
          </div>
        )}
      </div>

      {/* Tags customizadas */}
      <p className="text-xs text-[var(--text-disabled)] uppercase tracking-widest mb-2">Tags de anúncio</p>
      {customTags.length === 0 ? (
        <div className="bg-[var(--surface)] border border-dashed border-[var(--surface-border)] rounded-lg p-8 text-center">
          <p className="text-[var(--text-muted)] text-sm">Nenhuma tag configurada.</p>
          <p className="text-[var(--text-disabled)] text-xs mt-1">Crie tags como "Anúncio Implante", "Anúncio Protocolo" etc.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customTags.map((origin) => (
            <div
              key={origin.id}
              className={`bg-[var(--surface)] border rounded-lg px-4 py-4 transition-colors ${
                origin.isActive ? "border-[var(--surface-border)]" : "border-[var(--surface-border)] opacity-50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{origin.tag}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      origin.isActive
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-[var(--surface-raised)] text-[var(--text-muted)]"
                    }`}>
                      {origin.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mb-0.5">Abertura:</p>
                  <p className="text-sm text-[var(--text-secondary)]">{origin.opening}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(origin)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5 border border-[var(--surface-border)] rounded-md transition-colors"
                  >
                    {origin.isActive ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => openEdit(origin)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5 border border-[var(--surface-border)] rounded-md transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(origin)}
                    className="text-xs text-[var(--text-disabled)] hover:text-red-400 transition-colors px-1"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {editing ? "Editar tag" : "Nova tag de origem"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-2 block">
                  Nome da tag <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                  disabled={formDefault}
                  placeholder='Ex: "Anúncio Implante"'
                  className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-2 block">
                  Abertura da Sofia <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formOpening}
                  onChange={(e) => setFormOpening(e.target.value)}
                  rows={4}
                  placeholder='Ex: "Vi que você tem interesse em implante. Me conta, o que aconteceu?"'
                  className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-md px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
                <p className="text-xs text-[var(--text-disabled)] mt-1">
                  Esta mensagem substitui a abertura genérica quando o lead vem desta origem.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formDefault}
                  onChange={(e) => setFormDefault(e.target.checked)}
                  className="rounded border-[var(--surface-border)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">Usar como abertura padrão</span>
              </label>
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-md">{formError}</div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--surface-border)]">
              <button onClick={() => setShowForm(false)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-4 py-2">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-medium px-5 py-2 rounded-md transition-colors"
              >
                {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar tag"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
