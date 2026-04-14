"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ClientStatus } from "@/generated/prisma";

interface ClientNavProps {
  client: {
    id: string;
    clinicName: string;
    assistantName: string;
    status: ClientStatus;
  };
}

const STATUS_COLORS: Record<ClientStatus, string> = {
  ONBOARDING: "bg-yellow-500/10 text-yellow-500",
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

export function ClientNav({ client }: ClientNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  return (
    <div className="mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/clients" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
              ← Clientes
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{client.clinicName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[var(--text-muted)]">Assistente: {client.assistantName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[client.status]}`}>
              {STATUS_LABELS[client.status]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-[var(--text-secondary)]">Confirmar exclusão?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
              >
                {deleting ? "Apagando..." : "Sim, apagar"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5 rounded-md transition-colors"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-[var(--text-disabled)] hover:text-red-400 transition-colors px-2 py-1"
            >
              Apagar cliente
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--surface-border)]">
        {tabs.map((tab) => {
          const href = tab.href(client.id);
          const active = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={tab.label}
              href={href}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
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
  );
}
