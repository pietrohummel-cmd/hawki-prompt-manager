import { CopilotPanel } from '@/components/copilot/CopilotPanel'

export default function CopilotPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-1">
          Copiloto da Sofia
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Planeje cadências, revise prompts, estruture bases de conhecimento e configure bots
          com recomendações baseadas no manual completo do Hawki.
        </p>
      </div>
      <CopilotPanel />
    </div>
  )
}
