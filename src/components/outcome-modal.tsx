"use client";

import { useEffect, useState } from "react";
import { X, Save, Trash2, DollarSign, Calendar, CheckCircle, HelpCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutcomeSource =
  | "MANUAL"
  | "CRM_DENTAL_OFFICE"
  | "CRM_CLINICORP"
  | "CRM_EAI_DOCTOR"
  | "CRM_OTHER"
  | "API_WEBHOOK";

export interface OutcomeData {
  id?: string;
  interactionId: string;
  scheduledAt:     string | null;  // ISO
  appointmentDate: string | null;
  showedUp:        boolean | null;
  treatmentClosed: boolean | null;
  revenueCents:    number | null;
  source:          OutcomeSource;
  notes:           string | null;
}

interface Props {
  interactionId: string;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function isoToLocalDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // datetime-local needs YYYY-MM-DDTHH:mm in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDateTimeToIso(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

function centsToBrl(cents: number | null): string {
  if (cents === null || cents === 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function brlToCents(brl: string): number | null {
  const cleaned = brl.trim().replace(/[^0-9,.]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

// ─── Tri-state (yes / no / unknown) ──────────────────────────────────────────

function TriState({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const Btn = ({ v, txt }: { v: boolean | null; txt: string }) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
        value === v
          ? v === true
            ? "border-green-500 bg-green-500/15 text-green-500"
            : v === false
            ? "border-red-400 bg-red-400/15 text-red-400"
            : "border-[var(--text-disabled)] bg-[var(--surface-hover)] text-[var(--text-muted)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--accent)]/40"
      }`}
    >
      {txt}
    </button>
  );

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[var(--text-muted)]">{label}</label>
      <div className="flex gap-1.5">
        <Btn v={true}  txt="Sim" />
        <Btn v={false} txt="Não" />
        <Btn v={null}  txt="Não sei" />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OutcomeModal({ interactionId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);

  // Form state
  const [scheduledAt, setScheduledAt]         = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [showedUp, setShowedUp]               = useState<boolean | null>(null);
  const [treatmentClosed, setTreatmentClosed] = useState<boolean | null>(null);
  const [revenueBrl, setRevenueBrl]           = useState("");
  const [notes, setNotes]                     = useState("");

  // Fetch existing outcome on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/intelligence/outcomes/${interactionId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: OutcomeData | null = await res.json();
        if (cancelled) return;
        if (data) {
          setHasExisting(true);
          setScheduledAt(isoToLocalDateTime(data.scheduledAt));
          setAppointmentDate(isoToLocalDateTime(data.appointmentDate));
          setShowedUp(data.showedUp);
          setTreatmentClosed(data.treatmentClosed);
          setRevenueBrl(centsToBrl(data.revenueCents));
          setNotes(data.notes ?? "");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [interactionId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        scheduledAt:     localDateTimeToIso(scheduledAt),
        appointmentDate: localDateTimeToIso(appointmentDate),
        showedUp,
        treatmentClosed,
        revenueCents:    brlToCents(revenueBrl),
        notes:           notes.trim() || null,
        source:          "MANUAL" as OutcomeSource,
      };
      const res = await fetch(`/api/intelligence/outcomes/${interactionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remover este outcome? A interação será mantida, apenas o desfecho será apagado.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/intelligence/outcomes/${interactionId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <CheckCircle size={16} className="text-[var(--accent)]" />
              {hasExisting ? "Editar outcome" : "Adicionar outcome"}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Desfecho real desta conversa — preencha o que souber, deixe em branco o resto.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-10 text-center text-sm text-[var(--text-muted)]">Carregando…</div>
        ) : (
          <form onSubmit={handleSave} className="overflow-y-auto px-5 py-4 space-y-4">
            {/* Funil */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                <Calendar size={11} />
                Quando foi agendado
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                <Calendar size={11} />
                Data marcada da consulta
              </label>
              <input
                type="datetime-local"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <TriState label="Apareceu na consulta?" value={showedUp} onChange={setShowedUp} />
            <TriState label="Fechou tratamento?"     value={treatmentClosed} onChange={setTreatmentClosed} />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                <DollarSign size={11} />
                Receita real (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={revenueBrl}
                onChange={(e) => setRevenueBrl(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <p className="text-[10px] text-[var(--text-disabled)] flex items-center gap-1">
                <HelpCircle size={9} />
                Valor consolidado do tratamento (não da consulta de avaliação)
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-muted)]">Observações</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Contexto adicional, ex: 'fechou só consulta inicial e abandonou'"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </form>
        )}

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--border)] shrink-0">
            <div>
              {hasExisting && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition"
                >
                  <Trash2 size={12} />
                  {deleting ? "Removendo…" : "Remover outcome"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || deleting}
                className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition"
              >
                <Save size={12} />
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
