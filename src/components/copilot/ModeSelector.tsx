'use client'

import { COPILOT_MODES, type CopilotModeId } from '@/lib/copilot/prompts'
import { cn } from '@/lib/utils'

interface ModeSelectorProps {
  selected: CopilotModeId
  onChange: (id: CopilotModeId) => void
}

const MODE_ICONS: Record<CopilotModeId, string> = {
  cadencia:     '📅',
  prompt:       '✏️',
  kb:           '📚',
  config:       '⚙️',
  debug:        '🔍',
  fullSetup:    '🚀',
  conversaReal: '💬',
  crm:          '🗂️',
}

export function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {COPILOT_MODES.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          className={cn(
            'flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all',
            selected === mode.id
              ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
              : 'border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--accent)] hover:bg-[var(--surface-raised)]'
          )}
        >
          <span className="text-base leading-none">{MODE_ICONS[mode.id]}</span>
          <span
            className={cn(
              'text-xs font-medium leading-tight',
              selected === mode.id ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
            )}
          >
            {mode.label}
          </span>
        </button>
      ))}
    </div>
  )
}
