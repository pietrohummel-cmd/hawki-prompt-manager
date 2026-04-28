import { auth } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt, COPILOT_MODES, type CopilotModeId } from '@/lib/copilot/prompts'
import { getDocsForMode } from '@/lib/copilot/docs'
import { prisma } from '@/lib/prisma'

const anthropic = new Anthropic()

async function buildClientContext(clientId: string): Promise<string> {
  const [client, activeVersion, recentTickets, recentCalibrations] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { clinicName: true, assistantName: true } }),
    prisma.promptVersion.findFirst({
      where: { clientId, isActive: true },
      orderBy: { version: 'desc' },
      select: { version: true, modules: { select: { moduleKey: true, content: true } } },
    }),
    prisma.correctionTicket.findMany({
      where: { clientId, status: { in: ['OPEN', 'SUGGESTED'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { description: true, affectedModule: true, status: true, priority: true },
    }),
    prisma.calibration.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { createdAt: true, gaps: true, appliedToPrompt: true },
    }),
  ])

  if (!client) return ''

  const lines: string[] = [
    `CONTEXTO DO CLIENTE: ${client.clinicName} (Sofia: ${client.assistantName})`,
    '',
  ]

  if (activeVersion) {
    lines.push(`PROMPT ATIVO (v${activeVersion.version}):`)
    for (const mod of activeVersion.modules) {
      lines.push(`###MÓDULO:${mod.moduleKey}###`)
      lines.push(mod.content.slice(0, 400) + (mod.content.length > 400 ? '...' : ''))
    }
    lines.push('')
  } else {
    lines.push('PROMPT ATIVO: nenhuma versão ativa gerada ainda.')
    lines.push('')
  }

  if (recentTickets.length > 0) {
    lines.push('TICKETS RECENTES (abertos/sugeridos):')
    for (const t of recentTickets) {
      const mod = t.affectedModule ? `[${t.affectedModule}]` : '[sem módulo]'
      lines.push(`- ${mod} ${t.description.slice(0, 120)} (${t.status}, ${t.priority})`)
    }
    lines.push('')
  }

  if (recentCalibrations.length > 0) {
    lines.push('CALIBRAÇÕES RECENTES:')
    for (const c of recentCalibrations) {
      const gaps = Array.isArray(c.gaps) ? c.gaps.length : 0
      const applied = c.appliedToPrompt ? 'aplicada' : 'não aplicada'
      lines.push(`- ${c.createdAt.toLocaleDateString('pt-BR')}: ${gaps} gaps identificados (${applied})`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const { modeId, inputs, clientId } = body as { modeId: CopilotModeId; inputs: Record<string, string>; clientId?: string }

  const mode = COPILOT_MODES.find((m) => m.id === modeId)
  if (!mode) return new Response('Modo inválido', { status: 400 })

  const docs = getDocsForMode(mode.docsKey)
  const clientContext = clientId ? await buildClientContext(clientId) : ''
  const systemPrompt = buildSystemPrompt(modeId, docs, clientContext)
  const userMessage = buildUserMessage(mode.inputFields, inputs)

  let stream
  try {
    stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 529 || (err as { error?: { type?: string } }).error?.type === 'overloaded_error') {
      return new Response('A API está temporariamente sobrecarregada. Aguarde alguns segundos e tente novamente.', { status: 503 })
    }
    return new Response('Erro ao conectar com a IA. Tente novamente.', { status: 500 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch {
        controller.enqueue(encoder.encode('\n\n⚠️ Resposta interrompida. O resultado acima pode estar incompleto.'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}

function buildUserMessage(
  fields: { key: string; label: string }[],
  inputs: Record<string, string>
): string {
  return fields
    .filter((f) => inputs[f.key]?.trim())
    .map((f) => `**${f.label}:**\n${inputs[f.key].trim()}`)
    .join('\n\n')
}
