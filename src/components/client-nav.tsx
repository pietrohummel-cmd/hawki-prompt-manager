"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ChevronLeft, Trash2, FileText, Copy, Check, X } from "lucide-react";
import type { ClientStatus } from "@/generated/prisma";
import { MODULE_ORDER, MODULE_LABELS } from "@/lib/prompt-constants";
import type { ModuleKey } from "@/generated/prisma";

interface ClientNavProps {
  client: {
    id: string;
    clinicName: string;
    assistantName: string;
    status: ClientStatus;
  };
}

const STATUS_COLORS: Record<ClientStatus, string> = {
  ONBOARDING: "bg-amber-500/10 text-amber-500",
  ACTIVE:     "bg-emerald-500/10 text-emerald-500",
  ARCHIVED:   "bg-[var(--surface-border)] text-[var(--text-muted)]",
};

const STATUS_LABELS: Record<ClientStatus, string> = {
  ONBOARDING: "Onboarding",
  ACTIVE:     "Ativo",
  ARCHIVED:   "Arquivado",
};

const tabs = [
  { label: "Prompt",  href: (id: string) => `/clients/${id}/prompt` },
  { label: "Versões", href: (id: string) => `/clients/${id}/versions` },
  { label: "Tickets", href: (id: string) => `/clients/${id}/tickets` },
];

interface PromptModule {
  moduleKey: ModuleKey;
  content: string;
}

export function ClientNav({ client }: ClientNavProps) {
  const pathname  = usePathname();
  const router    = useRouter();

  const [deleting, setDeleting]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Modal prompt completo
  const [showPrompt, setShowPrompt]       = useState(false);
  const [modules, setModules]             = useState<PromptModule[] | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [promptError, setPromptError]     = useState(false);
  const [copied, setCopied]               = useState(false);

  // Fecha modal com Escape
  useEffect(() => {
    if (!showPrompt) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowPrompt(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showPrompt]);

  async function fetchPrompt() {
    setLoadingPrompt(true);
    setPromptError(false);
    try {
      const res  = await fetch(`/api/clients/${client.id}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const active =
        data.promptVersions?.find((v: { isActive: boolean }) => v.isActive) ??
        data.promptVersions?.[0] ?? null;
      setModules(active?.modules ?? []);
    } catch {
      setModules(null); // não persistir erro como dado vazio
      setPromptError(true);
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function openPromptModal() {
    setShowPrompt(true);
    setModules(null); // sempre re-fetch ao abrir para dados frescos
    fetchPrompt();
  }

  const fullPromptText = modules
    ? MODULE_ORDER
        .map((key) => modules.find((m) => m.moduleKey === key))
        .filter(Boolean)
        .map((m) => `###MÓDULO:${m!.moduleKey}###\n${m!.content}`)
        .join("\n\n")
    : "";

  async function handleCopy() {
    await navigator.clipboard.writeText(fullPromptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao apagar cliente");
      router.push("/clients");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
      alert("Erro ao apagar o cliente. Tente novamente.");
    }
  }

  const initials = client.clinicName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <div className="mb-6 animate-fade-up">
        {/* Breadcrumb */}
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-disabled)] hover:text-[var(--text-muted)] transition-colors mb-3 group"
        >
          <ChevronLeft size={13} className="group-hover:-translate-x-0.5 transition-transform duration-150" />
          Clientes
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0 text-white/80"
              style={{ background: "linear-gradient(135deg, #655cb1, #5dd6d5)" }}
            >
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                  {client.clinicName}
                </h1>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[client.status]}`}>
                  {STATUS_LABELS[client.status]}
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                Assistente: <span className="text-[var(--text-secondary)]">{client.assistantName}</span>
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2">
            {/* ── Botão Prompt Completo ── */}
            <button
              onClick={openPromptModal}
              data-prompt-modal
              className="press flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent-text)] border border-[var(--accent)]/30 hover:border-[var(--accent)]/60 hover:bg-[var(--accent-subtle)] px-3 py-1.5 rounded-md transition-all duration-150"
            >
              <FileText size={12} />
              Ver prompt completo
            </button>

            {/* Delete */}
            {confirmDelete ? (
              <>
                <span className="text-[12px] text-[var(--text-secondary)]">Confirmar exclusão?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="press text-[12px] text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 px-3 py-1.5 rounded-md transition-all duration-150 disabled:opacity-50"
                >
                  {deleting ? "Apagando..." : "Sim, apagar"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="press text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5 rounded-md transition-colors"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="press flex items-center gap-1.5 text-[12px] text-[var(--text-disabled)] hover:text-red-400 transition-colors px-2 py-1.5 rounded-md hover:bg-red-500/5"
              >
                <Trash2 size={12} />
                Apagar
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[var(--surface-border)]">
          {tabs.map((tab) => {
            const href   = tab.href(client.id);
            const active = pathname === href || pathname.startsWith(href);
            return (
              <Link
                key={tab.label}
                href={href}
                className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors duration-150 border-b-2 -mb-px ${
                  active
                    ? "border-[var(--accent)] text-[var(--accent-text)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Modal Prompt Completo ── */}
      {showPrompt && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPrompt(false); }}
        >
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-fade-up">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)] shrink-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-disabled)] mb-0.5">
                  Prompt completo
                </p>
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {client.clinicName} — {client.assistantName}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Copiar */}
                {!loadingPrompt && fullPromptText && (
                  <button
                    onClick={handleCopy}
                    className={`press flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md border transition-all duration-150 ${
                      copied
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-[var(--accent)]/40 bg-[var(--accent-subtle)] text-[var(--accent-text)] hover:border-[var(--accent)]/60"
                    }`}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Copiado!" : "Copiar tudo"}
                  </button>
                )}
                <button
                  onClick={() => setShowPrompt(false)}
                  className="press text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-md hover:bg-[var(--surface-raised)] transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingPrompt ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-3 rounded bg-[var(--surface-raised)] animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
                  ))}
                </div>
              ) : promptError ? (
                <div className="text-center py-10">
                  <p className="text-[var(--text-secondary)] text-sm">Erro ao carregar o prompt.</p>
                  <button
                    onClick={fetchPrompt}
                    className="press mt-3 text-[12px] text-[var(--accent-text)] border border-[var(--accent)]/30 hover:border-[var(--accent)]/60 px-3 py-1.5 rounded-md transition-all"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : fullPromptText ? (
                <pre className="text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap font-mono leading-relaxed">
                  {fullPromptText}
                </pre>
              ) : (
                <div className="text-center py-10">
                  <p className="text-[var(--text-disabled)] text-sm">Nenhum prompt gerado ainda.</p>
                  <p className="text-[var(--text-disabled)] text-xs mt-1">
                    Gere o primeiro prompt na aba Prompt.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            {!loadingPrompt && fullPromptText && (
              <div className="px-5 py-3 border-t border-[var(--surface-border)] shrink-0 flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-disabled)] tabular-nums">
                  {fullPromptText.length.toLocaleString("pt-BR")} caracteres · {fullPromptText.split(/\s+/).length.toLocaleString("pt-BR")} palavras
                </span>
                <button
                  onClick={handleCopy}
                  className={`press flex items-center gap-1.5 text-[12px] font-medium px-4 py-2 rounded-md transition-all duration-150 ${
                    copied
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
                  }`}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copiado!" : "Copiar para Sofia"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
