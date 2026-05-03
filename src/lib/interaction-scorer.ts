/**
 * Scoring automático de interações aprovadas.
 *
 * Avalia 3 dimensões (0–1) via claude-haiku:
 *   - scoreQuality   : clareza, completude, resolução da dúvida
 *   - scoreTone      : tom humanizado e profissional para odontologia
 *   - scoreObjection : handling de objeções (preço, medo, urgência)
 *
 * Persiste os scores de volta na SuccessfulInteraction.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CATEGORY_LABELS } from "@/lib/intelligence-constants";
import { logUsage } from "@/lib/usage-logger";
import type { ServiceCategory } from "@/generated/prisma";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.HAWKI_ANTHROPIC_API_KEY });
}

interface ScoreResult {
  scoreQuality: number;
  scoreTone: number;
  scoreObjection: number;
}

async function evaluateWithLLM(
  transcript: string,
  category: ServiceCategory
): Promise<ScoreResult> {
  const categoryLabel = CATEGORY_LABELS[category];

  const prompt = `Você é um avaliador especializado em qualidade de conversas de atendimento odontológico.

Avalie a conversa abaixo em 3 dimensões, com notas de 0.0 a 1.0:

1. scoreQuality: qualidade geral (clareza, completude, resolveu a dúvida do paciente, atendimento humanizado)
2. scoreTone: tom adequado para uma clínica odontológica (cordial, acolhedor, profissional — sem ser robótico)
3. scoreObjection: handling de objeções sobre ${categoryLabel} (preço, medo, urgência, comparações). Se não houver objeção na conversa, atribua 0.5

CATEGORIA: ${categoryLabel}

CONVERSA:
${transcript.slice(0, 3000)}

Responda APENAS com JSON válido:
{"scoreQuality": 0.0, "scoreTone": 0.0, "scoreObjection": 0.0}`;

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 128,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({
    operation: "interaction_score",
    model: "claude-haiku-4-5-20251001",
    usage: message.usage,
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
  try {
    const raw = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
    const result = JSON.parse(raw);
    return {
      scoreQuality:   clamp(Number(result.scoreQuality)   ?? 0),
      scoreTone:      clamp(Number(result.scoreTone)      ?? 0),
      scoreObjection: clamp(Number(result.scoreObjection) ?? 0.5),
    };
  } catch {
    console.warn("[interaction-scorer] Failed to parse score JSON:", text);
    return { scoreQuality: 0.5, scoreTone: 0.5, scoreObjection: 0.5 };
  }
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, isNaN(v) ? 0.5 : v));
}

/**
 * Pontua uma interação aprovada e persiste os scores.
 * Retorna os scores calculados.
 */
export async function scoreInteraction(interactionId: string): Promise<ScoreResult> {
  const interaction = await prisma.successfulInteraction.findUnique({
    where: { id: interactionId },
  });
  if (!interaction) throw new Error(`Interação ${interactionId} não encontrada`);

  const scores = await evaluateWithLLM(interaction.transcript, interaction.category);

  await prisma.successfulInteraction.update({
    where: { id: interactionId },
    data: scores,
  });

  return scores;
}

// ─── Score recalibrado por outcome (ground truth) ─────────────────────────────

/**
 * Sinal mínimo de outcome necessário para calcular o ranking adjustado.
 * Espelha os campos de ConversationOutcome — fica desacoplado do tipo Prisma
 * para permitir que callers passem dados parciais.
 */
export interface OutcomeSignal {
  scheduledAt:     Date | string | null;
  showedUp:        boolean | null;
  treatmentClosed: boolean | null;
  revenueCents:    number | null;
}

/**
 * Recalibra scoreQuality por outcome real. A LLM dá uma estimativa baseada
 * só na conversa; o outcome traz ground truth. Conversa que pareceu boa mas
 * o paciente não fechou tratamento deve cair no ranking; conversa que pareceu
 * média mas gerou receita deve subir.
 *
 * Ajustes (somatórios, depois clamp em [0, 1]):
 *   +0.20 se revenueCents > 0       (sinal mais forte: dinheiro real)
 *   +0.15 se treatmentClosed = true (fechou mas sem receita registrada)
 *   -0.10 se treatmentClosed = false
 *   +0.05 se showedUp = true        (apareceu mas não fechou)
 *   -0.15 se showedUp = false       (no-show forte penalty)
 *   +0.00 caso só haja scheduledAt  (intenção sem confirmação)
 *
 * Sem outcome → retorna scoreQuality intacto.
 */
export function computeRankingScore(
  scoreQuality: number | null,
  outcome: OutcomeSignal | null
): number {
  const base = scoreQuality ?? 0.5;
  if (!outcome) return base;

  let adj = 0;
  if (outcome.revenueCents !== null && outcome.revenueCents > 0) {
    adj += 0.20;
  } else if (outcome.treatmentClosed === true) {
    adj += 0.15;
  } else if (outcome.treatmentClosed === false) {
    adj -= 0.10;
  }
  if (outcome.showedUp === true) adj += 0.05;
  else if (outcome.showedUp === false) adj -= 0.15;

  return Math.min(1, Math.max(0, base + adj));
}
