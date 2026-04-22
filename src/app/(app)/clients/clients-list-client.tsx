"use client";

import { useState } from "react";
import Link from "next/link";
import type { ClientStatus } from "@/generated/prisma";
import { Search, X } from "lucide-react";

const STATUS_LABELS: Record<ClientStatus, string> = {
  ONBOARDING: "Onboarding",
  ACTIVE:     "Ativo",
  ARCHIVED:   "Arquivado",
};

const STATUS_COLORS: Record<ClientStatus, string> = {
  ONBOARDING: "bg-amber-500/10 text-amber-500",
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
  const [search, setSearch]             = useState("");
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
        <Link
          href="/clients/new"
          className="text-[var(--accent-text)] hover:underline underline-offset-2"
        >
          Cadastrar primeiro cliente →
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Busca + filtros */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-disabled)] pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar clínica, cidade..."
            className="w-full bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[13px] rounded-md pl-8 pr-7 py-2 focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-disabled)] transition-colors duration-150"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          <FilterBtn active={!statusFilter} onClick={() => setStatusFilter("")}>
            Todos
          </FilterBtn>
          {ALL_STATUSES.map((s) => (
            <FilterBtn
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
            >
              {STATUS_LABELS[s]}
            </FilterBtn>
          ))}
        </div>

        {(search || statusFilter) && (
          <span className="text-[11px] text-[var(--text-disabled)]">
            {filtered.length} de {clients.length}
          </span>
        )}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-[var(--text-muted)] text-sm py-10 text-center">
          Nenhum cliente encontrado.
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((client, i) => {
            const initials = client.clinicName
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase();

            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}/prompt`}
                style={{ animationDelay: `${i * 30}ms` }}
                className="animate-fade-up flex items-center justify-between card hover:border-[var(--accent)]/40 hover:bg-[var(--surface-raised)]/40 px-4 py-3 transition-all duration-150 group press"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 text-white/80"
                    style={{ background: "linear-gradient(135deg, #655cb1, #659fcf)" }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors truncate">
                      {client.clinicName}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                      {[client.city, client.neighborhood].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-[var(--text-disabled)] tabular-nums">
                    {client._count.promptVersions} versã
                    {client._count.promptVersions !== 1 ? "ões" : "o"}
                  </span>
                  {client._count.tickets > 0 && (
                    <span className="text-[11px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium">
                      {client._count.tickets} ticket{client._count.tickets !== 1 ? "s" : ""}
                    </span>
                  )}
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[client.status]}`}
                  >
                    {STATUS_LABELS[client.status]}
                  </span>
                  <span className="text-[var(--text-disabled)] text-xs group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all duration-150">
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`press text-[12px] px-3 py-1.5 rounded-md border transition-all duration-150 ${
        active
          ? "border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-subtle)]"
          : "border-[var(--surface-border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--surface-border)]"
      }`}
    >
      {children}
    </button>
  );
}
