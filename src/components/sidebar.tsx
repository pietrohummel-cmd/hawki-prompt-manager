"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, PlusCircle, BookOpen, FileText, Sun, Moon, Monitor, Bot } from "lucide-react";

const navItems = [
  { href: "/dashboard",     label: "Dashboard",    icon: LayoutDashboard, group: "main" },
  { href: "/clients",       label: "Clientes",     icon: Users,           group: "main" },
  { href: "/clients/new",   label: "Novo cliente", icon: PlusCircle,      group: "main" },
  { href: "/copilot",       label: "Copiloto",     icon: Bot,             group: "tools" },
  { href: "/knowledge-base",label: "Knowledge Base", icon: BookOpen,      group: "library" },
  { href: "/templates",     label: "Templates",    icon: FileText,        group: "library" },
];

const THEMES = [
  { value: "dark",   icon: Moon,    label: "Escuro" },
  { value: "light",  icon: Sun,     label: "Claro" },
  { value: "system", icon: Monitor, label: "Sistema" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen bg-[var(--surface)] border-r border-[var(--surface-border)] transition-colors duration-200">

      {/* Logo Hawki */}
      <div className="px-5 py-5 border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-2">
          {/* Ícone com as cores da brand */}
          <div className="flex gap-0.5 items-end">
            <span className="w-2 h-4 rounded-sm bg-[#655cb1]" />
            <span className="w-2 h-3 rounded-sm bg-[#659fcf]" />
            <span className="w-2 h-2 rounded-sm bg-[#5dd6d5]" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              hawki
            </span>
            <span className="text-xs font-medium text-[var(--text-muted)] ml-1.5">
              PM
            </span>
          </div>
        </div>
        <p className="text-[11px] text-[var(--text-disabled)] mt-1 ml-6">Prompt Manager</p>
      </div>

      {/* Nav principal */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.filter((i) => i.group === "main").map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/clients" && pathname.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                active
                  ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] font-medium"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
              }`}
            >
              <Icon size={15} className={active ? "text-[var(--accent)]" : ""} />
              {label}
            </Link>
          );
        })}

        <div className="pt-4 pb-1">
          <p className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-widest px-3 mb-1">
            Sofia
          </p>
        </div>

        {navItems.filter((i) => i.group === "tools").map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                active
                  ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] font-medium"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
              }`}
            >
              <Icon size={15} className={active ? "text-[var(--accent)]" : ""} />
              {label}
            </Link>
          );
        })}

        <div className="pt-4 pb-1">
          <p className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-widest px-3 mb-1">
            Biblioteca
          </p>
        </div>

        {navItems.filter((i) => i.group === "library").map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                active
                  ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] font-medium"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
              }`}
            >
              <Icon size={15} className={active ? "text-[var(--accent)]" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      {mounted && (
        <div className="px-4 py-3 border-t border-[var(--surface-border)]">
          <div className="flex items-center justify-between bg-[var(--surface-raised)] rounded-lg p-1">
            {THEMES.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={label}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${
                  theme === value
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User */}
      <div className="px-5 py-4 border-t border-[var(--surface-border)] flex items-center gap-3">
        <UserButton />
        <div>
          <p className="text-xs font-medium text-[var(--text-secondary)]">Hawki</p>
          <p className="text-[10px] text-[var(--text-disabled)]">Prompt Manager</p>
        </div>
      </div>
    </aside>
  );
}
