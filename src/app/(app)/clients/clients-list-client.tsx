"use client";

import { useState } from "react";
import Link from "next/link";
import type { ClientStatus } from "@/generated/prisma";

const STATUS_LABELS: Record<ClientStatus, string> = {
  ONBOARDING: "Onboarding",
  ACTIVE:     "Ativo",
  ARCHIVED:   "Arquivado",
};

const STATUS_COLORS: Record<ClientStatus, string> = {
  ONBOARDING: "bg-yellow-500/10 text-yellow-500",
  ACTIVE:     "bg-emerald-500/10 text-emerald-500",
  ARCHIVED:   "bg-[var(--surface-raised)] text-[var(--text-muted)]",
};

type Client = {
  id: string;
  clinicName: string;
  assistantName: string;
  city: string | null;
  neighborhood: string | null;
  status: ClientStatus;
  procedureType: string | null;
  clinicPositioning: string | null;
  _count: { tickets: number; promptVersions: number };
};

const ALL_STATUSES: ClientStatus[] = ["ACTIVE", "ONBOARDING", "ARCHIVED"];

export function ClientsListClient({ clients }: { clients: Client[] }) {
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "">("");

  const filtered = clients.filter((c) => {
    const matchesSearch =
      !search ||
      c.clinicName.toLowerCase().includes(search.toLowerCase()) ||
      (c.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.assistantName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (clients.length === 0) {
    return (
      <div className="text-[var(--text-disabled)] text-sm mt-8">
        Nenhum cliente cadastrado ainda.{" "}
        <Link href="/clients/new" className="text-[var(--accent-text)] hover:underline">
          Cadastrar primeiro cliente →
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Busca + filtros */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-disabled)] text-sm select-none">⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar clínica, cidade..."
            className="w-full bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-md pl-8 pr-8 py-2 focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-disabled)] transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-base leading-none"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          <FilterBtn active={!statusFilter} onClick={() => setStatusFilter("")}>Todos</FilterBtn>
          {ALL_STATUSES.map((s) => (
            <FilterBtn key={s} active={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}>
              {STATUS_LABELS[s]}
            </FilterBtn>
          ))}
        </div>

        {(search || statusFilter) && (
          <span className="text-xs text-[var(--text-disabled)]">
            {filtered.length} de {clients.length}
          </span>
        )}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-[var(--text-muted)] text-sm py-8 text-center">
          Nenhum cliente encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}/prompt`}
              className="flex items-center justify-between bg-[var(--surface)] border border-[var(--surface-border)] hover:border-[var(--accent)]/40 rounded-lg px-5 py-4 transition-all group"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                  {client.clinicName}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {[client.city, client.neighborhood].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[var(--text-muted)]">
                  {client._count.promptVersions} versã{client._count.promptVersions !== 1 ? "ões" : "o"}
                </span>
                {client._count.tickets > 0 && (
                  <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">
                    {client._count.tickets} ticket{client._count.tickets !== 1 ? "s" : ""}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[client.status]}`}>
                  {STATUS_LABELS[client.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-md border transition-all ${
        active
          ? "border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-subtle)]"
          : "border-[var(--surface-border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--surface-muted)]"
      }`}
    >
      {children}
    </button>
  );
}
