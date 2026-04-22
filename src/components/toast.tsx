"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

export type ToastData = {
  message: string;
  type: "success" | "error";
  action?: { label: string; onClick: () => void };
};

interface ToastProps {
  toast: ToastData | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-5 right-5 z-[200] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl text-[13px] font-medium animate-fade-up max-w-sm ${
        toast.type === "success"
          ? "bg-[var(--surface)] border-emerald-500/30 text-[var(--text-primary)]"
          : "bg-[var(--surface)] border-red-500/30 text-[var(--text-primary)]"
      }`}
    >
      {toast.type === "success" ? (
        <CheckCircle size={15} className="text-emerald-400 shrink-0" />
      ) : (
        <XCircle size={15} className="text-red-400 shrink-0" />
      )}
      <span className="flex-1">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => { toast.action!.onClick(); onDismiss(); }}
          className="text-[var(--accent-text)] hover:underline underline-offset-2 shrink-0 transition-colors"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={onDismiss}
        className="text-[var(--text-disabled)] hover:text-[var(--text-muted)] transition-colors shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const showToast = (data: ToastData) => setToast(data);
  const dismiss = () => setToast(null);
  return { toast, showToast, dismiss };
}
