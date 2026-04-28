'use client'

import { useState } from 'react'
import { HelpPanel } from './HelpPanel'

export function HelpButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Ajuda"
        className="fixed bottom-6 right-6 z-40 h-10 w-10 rounded-full bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/40 shadow-lg transition-all hover:scale-105 flex items-center justify-center text-sm font-semibold select-none"
      >
        ?
      </button>
      {open && <HelpPanel onClose={() => setOpen(false)} />}
    </>
  )
}
