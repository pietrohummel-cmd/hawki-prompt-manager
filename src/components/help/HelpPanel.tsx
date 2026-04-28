'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { HELP_TREE, type HelpNode } from '@/lib/help-content'

interface HelpPanelProps {
  onClose: () => void
}

export function HelpPanel({ onClose }: HelpPanelProps) {
  const [path, setPath] = useState<HelpNode[]>([])

  const current = path.length === 0 ? null : path[path.length - 1]
  const items = current?.children ?? HELP_TREE

  function navigate(node: HelpNode) {
    setPath((prev) => [...prev, node])
  }

  function goBack() {
    setPath((prev) => prev.slice(0, -1))
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-[380px] bg-[var(--surface)] border-l border-[var(--surface-border)] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
          <div className="flex items-center gap-2 min-w-0">
            {path.length > 0 && (
              <button
                onClick={goBack}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex-shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {path.length === 0 ? 'Central de Ajuda' : current?.title}
              </p>
              {path.length > 0 && (
                <p className="text-[10px] text-[var(--text-disabled)] truncate">
                  {['Ajuda', ...path.slice(0, -1).map((n) => n.title)].join(' › ')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex-shrink-0 ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Se o nó atual tem conteúdo próprio, mostrar */}
          {current?.content && (
            <div className="px-5 py-4 border-b border-[var(--surface-border)]">
              <div className="prose prose-sm prose-invert max-w-none
                prose-headings:text-[var(--text-primary)] prose-headings:font-semibold prose-headings:text-sm
                prose-p:text-[var(--text-secondary)] prose-p:leading-relaxed prose-p:text-sm
                prose-li:text-[var(--text-secondary)] prose-li:text-sm
                prose-strong:text-[var(--text-primary)]
                prose-code:text-[var(--accent-text)] prose-code:bg-[var(--surface-raised)] prose-code:px-1 prose-code:rounded prose-code:text-xs
                prose-pre:bg-[var(--surface-raised)] prose-pre:border prose-pre:border-[var(--surface-border)] prose-pre:text-xs
                prose-a:text-[var(--accent-text)]
                prose-hr:border-[var(--surface-border)]
                prose-table:text-sm
                prose-th:text-[var(--text-primary)] prose-th:text-xs
                prose-td:text-[var(--text-secondary)] prose-td:text-xs
              ">
                <ReactMarkdown>{current.content}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Subtópicos navegáveis */}
          {items.length > 0 && (
            <div className="py-2">
              {path.length === 0 && (
                <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-disabled)]">
                  Como posso te ajudar?
                </p>
              )}
              {current?.children && current.children.length > 0 && (
                <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-disabled)]">
                  Tópicos
                </p>
              )}
              {items.map((node) => (
                <button
                  key={node.id}
                  onClick={() => navigate(node)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[var(--surface-raised)] transition-colors group"
                >
                  <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    {node.title}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--text-disabled)] group-hover:text-[var(--text-muted)] flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--surface-border)]">
          <p className="text-[10px] text-[var(--text-disabled)]">
            Hawki Prompt Manager — uso interno
          </p>
        </div>
      </div>
    </div>
  )
}
