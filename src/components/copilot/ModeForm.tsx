'use client'

import { type InputField } from '@/lib/copilot/prompts'

interface ModeFormProps {
  fields: InputField[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}

const fieldBase =
  'w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors'

export function ModeForm({ fields, values, onChange }: ModeFormProps) {
  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <label htmlFor={field.key} className="text-xs font-medium text-[var(--text-secondary)]">
            {field.label}
            {field.required && <span className="ml-1 text-red-400">*</span>}
          </label>

          {field.type === 'textarea' && (
            <textarea
              id={field.key}
              placeholder={field.placeholder}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              rows={4}
              className={`${fieldBase} resize-y`}
            />
          )}

          {field.type === 'text' && (
            <input
              id={field.key}
              type="text"
              placeholder={field.placeholder}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              className={fieldBase}
            />
          )}

          {field.type === 'select' && field.options && (
            <select
              id={field.key}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              className={`${fieldBase} cursor-pointer`}
            >
              <option value="" disabled>Selecione...</option>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {field.type === 'checkboxes' && field.options && (
            <div className="flex flex-wrap gap-2">
              {field.options.map((opt) => {
                const selected = (values[field.key] ?? '').split(',').map(s => s.trim()).filter(Boolean)
                const checked = selected.includes(opt)
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      const next = checked
                        ? selected.filter(s => s !== opt)
                        : [...selected, opt]
                      onChange(field.key, next.join(', '))
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      checked
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent-text)]'
                        : 'border-[var(--surface-border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
