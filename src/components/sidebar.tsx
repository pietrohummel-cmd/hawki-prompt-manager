"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  BookOpen,
  FileText,
  Sparkles,
  Brain,
  TrendingUp,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",      label: "Dashboard",     icon: LayoutDashboard, group: "main" },
  { href: "/clients",        label: "Clientes",      icon: Users,           group: "main" },
  { href: "/clients/new",    label: "Novo cliente",  icon: PlusCircle,      group: "main" },
  { href: "/inteligencia",              label: "Inteligência",         icon: Sparkles,    group: "main" },
  { href: "/inteligencia/conhecimento", label: "Base de Conhecimento", icon: Brain,       group: "main" },
  { href: "/inteligencia/impacto",      label: "Impacto",              icon: TrendingUp,  group: "main" },
  { href: "/knowledge-base", label: "Knowledge Base",icon: BookOpen,        group: "library" },
  { href: "/templates",      label: "Templates",     icon: FileText,        group: "library" },
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
    <aside className="w-[220px] shrink-0 flex flex-col h-screen bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] transition-colors duration-200">

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-[var(--sidebar-border)]">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          {/* Ícone brand com barras */}
          <div className="flex gap-[3px] items-end shrink-0">
            <span className="w-[5px] h-[18px] rounded-full bg-[#655cb1]" />
            <span className="w-[5px] h-[13px] rounded-full bg-[#659fcf]" />
            <span className="w-[5px] h-[8px] rounded-full bg-[#5dd6d5]" />
          </div>
          <div className="leading-none">
            <span
              className="text-[15px] font-bold tracking-tight text-[var(--sidebar-foreground)]"
              
            >
              hawki
            </span>
            <span className="text-[11px] font-medium text-[var(--text-disabled)] ml-[5px] tracking-wide">
              PM
            </span>
          </div>
        </Link>
      </div>

      {/* Nav principal */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        <NavGroup>
          {navItems
            .filter((i) => i.group === "main")
            .map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/clients" && pathname.startsWith(href + "/"));
              return (
                <NavItem key={href} href={href} label={label} Icon={Icon} active={active} />
              );
            })}
        </NavGroup>

        <div className="pt-4 pb-1 px-2">
          <p className="text-[10px] font-semibold text-[var(--text-disabled)] uppercase tracking-[0.12em]">
            Biblioteca
          </p>
        </div>

        <NavGroup>
          {navItems
            .filter((i) => i.group === "library")
            .map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <NavItem key={href} href={href} label={label} Icon={Icon} active={active} />
              );
            })}
        </NavGroup>
      </nav>

      {/* Theme toggle */}
      {mounted && (
        <div className="px-3 py-3 border-t border-[var(--sidebar-border)]">
          <div className="flex items-center bg-[var(--surface-raised)] rounded-lg p-0.5">
            {THEMES.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={label}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all duration-200 press ${
                  theme === value
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--text-disabled)] hover:text-[var(--text-muted)]"
                }`}
              >
                <Icon size={12} strokeWidth={2} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User */}
      <div className="px-4 py-3.5 border-t border-[var(--sidebar-border)] flex items-center gap-3">
        <UserButton />
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--text-secondary)] truncate">Hawki</p>
          <p className="text-[10px] text-[var(--text-disabled)] truncate">Prompt Manager</p>
        </div>
      </div>
    </aside>
  );
}

function NavGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-0.5">{children}</div>;
}

function NavItem({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all duration-150 group press ${
        active
          ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] font-medium"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[var(--accent)] rounded-r-full" />
      )}
      <Icon
        size={14}
        strokeWidth={active ? 2.2 : 1.8}
        className={`shrink-0 transition-colors duration-150 ${
          active ? "text-[var(--accent)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
        }`}
      />
      {label}
    </Link>
  );
}
