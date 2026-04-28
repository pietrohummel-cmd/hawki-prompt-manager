'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { ModeSelector } from './ModeSelector'
import { ModeForm } from './ModeForm'
import { COPILOT_MODES, type CopilotModeId } from '@/lib/copilot/prompts'
import { MODULE_LABELS, MODULE_ORDER } from '@/lib/prompt-constants'
import { Button } from '@/components/ui/button'
import { Loader2, Copy, Check, RotateCcw, TicketPlus, X } from 'lucide-react'
import type { ModuleKey } from '@/generated/prisma'

const TICKET_MODES: CopilotModeId[] = ['prompt', 'debug', 'conversaReal']

interface CopilotPanelProps {
  clientId?: string
}

export function CopilotPanel({ clientId }: CopilotPanelProps) {
  const [selectedMode, setSelectedMode] = useState<CopilotModeId>('cadencia')
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [clientName, setClientName] = useState<string | null>(null)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [ticketDescription, setTicketDescription] = useState('')
  const [ticketModule, setTicketModule] = useState<ModuleKey | ''>('')
  const [ticketSuggestion, setTicketSuggestion] = useState('')
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [ticketCreated, setTicketCreated] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const currentMode = COPILOT_MODES.find((m) => m.id === selectedMode)!
  const canCreateTicket = !!clientId && !!output && !loading && TICKET_MODES.includes(selectedMode)

  useEffect(() => {
    if (!clientId) return
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((d) => setClientName(d.clinicName ?? null))
      .catch(() => null)
  }, [clientId])

  function handleModeChange(id: CopilotModeId) {
    setSelectedMode(id)
    setInputs({})
    setOutput('')
    setTicketCreated(false)
  }

  function handleInputChange(key: string, value: string) {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    setOutput('')
    setTicketCreated(false)
    setLoading(true)
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modeId: selectedMode, inputs, clientId }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Erro na API')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let done = false
      while (!done) {
        const { value, done: d } = await reader.read()
        done = d
        if (value) setOutput((prev) => prev + decoder.decode(value))
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setOutput(`⚠️ ${(err as Error).message || 'Erro ao gerar resposta. Tente novamente.'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleStop() {
    abortRef.current?.abort()
    setLoading(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openTicketModal() {
    setTicketDescription('')
    setTicketModule('')
    setTicketSuggestion(output.slice(0, 2000))
    setShowTicketModal(true)
  }

  async function handleCreateTicket() {
    if (!clientId || !ticketDescription.trim()) return
    setCreatingTicket(true)
    const fullDescription = ticketSuggestion.trim()
      ? `${ticketDescription}\n\nContexto do copiloto:\n${ticketSuggestion}`
      : ticketDescription
    try {
      const res = await fetch(`/api/clients/${clientId}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: fullDescription,
          affectedModule: ticketModule || undefined,
          priority: 'NORMAL',
        }),
      })
      if (!res.ok) throw new Error('Erro ao criar ticket')
      setShowTicketModal(false)
      setTicketCreated(true)
    } catch {
      alert('Erro ao criar ticket. Tente novamente.')
    } finally {
      setCreatingTicket(false)
    }
  }

  const requiredFilled = currentMode.inputFields
    .filter((f) => f.required)
    .every((f) => inputs[f.key]?.trim())

  return (
    <div className="flex flex-col gap-6">
      {/* Badge de contexto do cliente */}
      {clientId && clientName && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20">
          <span className="text-xs text-[var(--accent-text)] font-medium">Contexto:</span>
          <span className="text-xs text-[var(--text-secondary)]">{clientName}</span>
        </div>
      )}

      {/* Seletor de modo */}
      <section>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-disabled)]">
          Modo
        </p>
        <ModeSelector selected={selectedMode} onChange={handleModeChange} />
      </section>

      <div className="border-t border-[var(--surface-border)]" />

      {/* Formulário */}
      <section className="flex flex-col gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-disabled)] mb-0.5">
            {currentMode.label}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{currentMode.description}</p>
        </div>
        <ModeForm fields={currentMode.inputFields} values={inputs} onChange={handleInputChange} />
        <div className="flex gap-2">
          {loading ? (
            <Button variant="destructive" size="sm" onClick={handleStop}>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Parar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!requiredFilled}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
            >
              Gerar plano
            </Button>
          )}
          {output && !loading && (
            <Button variant="ghost" size="sm" onClick={() => { setOutput(''); setInputs({}); setTicketCreated(false) }}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>
      </section>

      {/* Output */}
      {(output || loading) && (
        <>
          <div className="border-t border-[var(--surface-border)]" />
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-disabled)]">
                Plano gerado
              </p>
              {output && !loading && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {copied
                    ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copiado</>
                    : <><Copy className="h-3.5 w-3.5" /> Copiar</>
                  }
                </button>
              )}
            </div>

            {loading && !output && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando plano...
              </div>
            )}

            {output && (
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] p-5 overflow-y-auto max-h-[60vh]">
                <div className="prose prose-sm prose-invert max-w-none
                  prose-headings:text-[var(--text-primary)] prose-headings:font-semibold
                  prose-p:text-[var(--text-secondary)] prose-p:leading-relaxed
                  prose-li:text-[var(--text-secondary)]
                  prose-strong:text-[var(--text-primary)]
                  prose-code:text-[var(--accent-text)] prose-code:bg-[var(--surface)] prose-code:px-1 prose-code:rounded
                  prose-pre:bg-[var(--surface)] prose-pre:border prose-pre:border-[var(--surface-border)]
                  prose-a:text-[var(--accent-text)]
                  prose-hr:border-[var(--surface-border)]
                  prose-table:text-[var(--text-secondary)]
                  prose-th:text-[var(--text-primary)]
                ">
                  <ReactMarkdown>{output}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Ações pós-resposta */}
            {output && !loading && (
              <div className="flex items-center gap-3 pt-1">
                {canCreateTicket && !ticketCreated && (
                  <button
                    onClick={openTicketModal}
                    className="flex items-center gap-1.5 text-xs text-[var(--accent-text)] hover:text-[var(--accent)] transition-colors"
                  >
                    <TicketPlus className="h-3.5 w-3.5" />
                    Criar ticket para {clientName ?? 'cliente'}
                  </button>
                )}
                {ticketCreated && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                    Ticket criado!{' '}
                    <a
                      href={`/clients/${clientId}/tickets`}
                      className="underline hover:text-emerald-300"
                    >
                      Ver na aba Tickets →
                    </a>
                  </span>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* Modal de criar ticket */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Criar ticket para {clientName}
              </h2>
              <button
                onClick={() => setShowTicketModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-disabled)] block mb-1.5">
                  Descrição do problema *
                </label>
                <textarea
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Descreva o comportamento que precisa de correção..."
                  rows={3}
                  className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-disabled)] block mb-1.5">
                  Módulo afetado
                </label>
                <select
                  value={ticketModule}
                  onChange={(e) => setTicketModule(e.target.value as ModuleKey | '')}
                  className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  <option value="">Sem módulo específico</option>
                  {MODULE_ORDER.map((key) => (
                    <option key={key} value={key}>{MODULE_LABELS[key]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-disabled)] block mb-1.5">
                  Contexto do copiloto (adicionado à descrição)
                </label>
                <textarea
                  value={ticketSuggestion}
                  onChange={(e) => setTicketSuggestion(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
                />
                <p className="text-[10px] text-[var(--text-disabled)] mt-1">Após criar o ticket, use "Sugerir com IA" na aba Tickets para gerar o conteúdo corrigido do módulo.</p>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTicketModal(false)}
                  disabled={creatingTicket}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateTicket}
                  disabled={!ticketDescription.trim() || creatingTicket}
                  className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
                >
                  {creatingTicket ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Criando...</>
                  ) : (
                    'Criar ticket'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
