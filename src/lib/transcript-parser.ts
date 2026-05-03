/**
 * Parser e anonimizador de transcrições de conversa.
 *
 * Camada 1 (regex, síncrona):  anonymizeTranscript()
 *   - phone, CPF, email, URL, data, prefixo de remetente WhatsApp
 *   - rápida, gratuita, mas vaza nomes de paciente/clínica/dentista
 *
 * Camada 2 (Haiku NER, async):  anonymizeWithNer()
 *   - aplica camada 1 + envia para Haiku detectar nomes próprios, clínicas,
 *     dentistas, endereços e valores
 *   - cache por SHA-256 do texto pós-regex (AnonymizationCache) evita
 *     pagar 2x por conversa repetida
 *   - controlada pela env ANONYMIZATION_LEVEL (regex | ner | strict)
 */

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { ANONYMIZATION_LEVEL, type AnonymizationLevel } from "@/lib/intelligence-constants";
import { logUsage } from "@/lib/usage-logger";

/** Padrões de PII a remover da transcrição */
const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // Telefones brasileiros: (11) 99999-9999, 11999999999, +55 11 99999-9999
  {
    pattern: /(\+55\s?)?(\(?\d{2}\)?\s?)[\d\s\-]{8,10}\d/g,
    replacement: "[TELEFONE]",
  },
  // CPF: 000.000.000-00
  {
    pattern: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
    replacement: "[CPF]",
  },
  // E-mails
  {
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL]",
  },
  // URLs
  {
    pattern: /https?:\/\/[^\s]+/g,
    replacement: "[LINK]",
  },
  // Datas no formato dd/mm/aaaa ou dd-mm-aaaa
  {
    pattern: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    replacement: "[DATA]",
  },
];

/**
 * Remove PII da transcrição.
 * Preserva a estrutura da conversa (turnos, pontuação) mas elimina dados identificáveis.
 */
export function anonymizeTranscript(raw: string): string {
  // Normaliza quebras de linha
  let text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  // Remove timestamps típicos de WhatsApp: [18/04/2025 14:32:10]
  text = text.replace(/\[\d{1,2}\/\d{1,2}\/\d{2,4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)?\]/g, "");

  // Remove prefixo de remetente WhatsApp: "João Silva: " ou "Clínica X: "
  // Substituído por tag genérica de turno.
  //
  // IMPORTANTE: linhas que JÁ vêm pré-anotadas pelo whatsapp-parser
  // (ex: "[SOFIA]: ..." ou "[PACIENTE]: ...") são preservadas — o
  // operador foi marcado explicitamente no upload, não re-classificar.
  text = text.replace(/^([^:\n]{1,50}):(\s)/gm, (full, name) => {
    const trimmed = name.trim();
    if (trimmed === "[SOFIA]" || trimmed === "[PACIENTE]") {
      return full;  // já anotado, não toca
    }
    const lower = trimmed.toLowerCase();
    // Fallback heurístico para uploads single (sem operador explícito)
    if (/sofia|atendente|cl[ií]nica|assistente|bot|\bia\b|recep/i.test(lower)) {
      return "[SOFIA]: ";
    }
    return "[PACIENTE]: ";
  });

  // Aplica padrões de PII
  for (const { pattern, replacement } of PII_PATTERNS) {
    text = text.replace(pattern, replacement);
  }

  // Colapsa linhas em branco múltiplas
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

// ─── Camada 2 (NER via Haiku) ─────────────────────────────────────────────────

interface RedactionGroup {
  type: "NOME" | "CLÍNICA" | "DENTISTA" | "ENDEREÇO" | "VALOR";
  values: string[];
}

interface NerResult {
  text: string;
  redactions: RedactionGroup[];
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.HAWKI_ANTHROPIC_API_KEY });
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Escapa string para uso em RegExp literal. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Aplica deterministicamente as redações apontadas pelo Haiku ao texto. */
function applyRedactions(text: string, groups: RedactionGroup[]): string {
  let out = text;
  for (const group of groups) {
    const replacement = `[${group.type}]`;
    // Ordena por tamanho desc para evitar match parcial (ex: "Maria" antes de "Maria Silva")
    const sorted = [...group.values]
      .filter((v) => v && v.trim().length >= 2)
      .sort((a, b) => b.length - a.length);
    for (const value of sorted) {
      const trimmed = value.trim();
      const re = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, "gi");
      out = out.replace(re, replacement);
    }
  }
  return out;
}

async function callHaikuForNer(text: string): Promise<RedactionGroup[]> {
  const prompt = `Você é um sistema de detecção de PII em transcrições de WhatsApp de clínicas odontológicas.

Receba o texto e identifique entidades sensíveis. Considere apenas o que aparece no texto fornecido.

Tipos a detectar:
- NOME: nomes próprios de pessoas (paciente, familiares mencionados)
- CLÍNICA: nomes de clínicas, consultórios, instituições
- DENTISTA: nomes de profissionais com título (Dr., Dra., Doutor) ou referidos como dentista
- ENDEREÇO: ruas, avenidas, bairros, números de endereço, complementos
- VALOR: valores monetários (R$ X, X reais, "três mil", etc.)

Telefones, CPFs, e-mails, URLs e datas JÁ foram removidos por regex — não os relate.

Texto:
"""
${text}
"""

Responda APENAS com JSON válido neste formato (vazio se não detectar nada):
{
  "redactions": [
    { "type": "NOME", "values": ["Maria Silva", "João"] },
    { "type": "CLÍNICA", "values": ["Sorriso Total"] }
  ]
}`;

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  await logUsage({
    operation: "transcript_anonymize",
    model: "claude-haiku-4-5-20251001",
    usage: message.usage,
  });

  const raw = message.content[0]?.type === "text" ? message.content[0].text.trim() : "{}";
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
    const parsed = JSON.parse(jsonMatch);
    const redactions: RedactionGroup[] = Array.isArray(parsed.redactions) ? parsed.redactions : [];
    return redactions.filter(
      (g) => g && typeof g.type === "string" && Array.isArray(g.values)
    );
  } catch {
    console.warn("[transcript-parser] Failed to parse NER response:", raw.slice(0, 200));
    return [];
  }
}

/**
 * Aplica camadas 1 + 2 (regex + Haiku NER) com cache.
 * Use esta função no fluxo de upload em vez de anonymizeTranscript() diretamente.
 *
 * @param raw  Texto bruto da conversa
 * @param level Override do nível (default: env ANONYMIZATION_LEVEL)
 * @returns texto anonimizado (mesma string em todos os níveis; flag de revisão fica
 *          embutida no metadata da interação se level=strict — o consumidor decide)
 */
export async function anonymizeWithNer(
  raw: string,
  level: AnonymizationLevel = ANONYMIZATION_LEVEL
): Promise<NerResult> {
  // Camada 1 sempre roda
  const post = anonymizeTranscript(raw);
  if (level === "regex") {
    return { text: post, redactions: [] };
  }

  // Camada 2: cache lookup
  const hash = sha256(post);
  try {
    const cached = await prisma.anonymizationCache.findUnique({ where: { contentHash: hash } });
    if (cached && cached.level === level) {
      const redactions = (cached.redactions as unknown as RedactionGroup[] | null) ?? [];
      return { text: cached.anonymized, redactions };
    }
  } catch (err) {
    console.warn("[transcript-parser] Cache lookup failed, proceeding without:", err);
  }

  // Camada 2: chamada ao Haiku
  let redactions: RedactionGroup[] = [];
  try {
    redactions = await callHaikuForNer(post);
  } catch (err) {
    console.error("[transcript-parser] NER call failed; falling back to regex-only:", err);
    return { text: post, redactions: [] };
  }
  const anonymized = applyRedactions(post, redactions);

  // Persist cache (best-effort, não bloqueia retorno em caso de erro)
  try {
    await prisma.anonymizationCache.upsert({
      where: { contentHash: hash },
      create: {
        contentHash: hash,
        anonymized,
        level,
        redactions: redactions as unknown as object,
      },
      update: {
        anonymized,
        level,
        redactions: redactions as unknown as object,
      },
    });
  } catch (err) {
    console.warn("[transcript-parser] Cache persist failed (non-fatal):", err);
  }

  return { text: anonymized, redactions };
}

/**
 * Helper: indica se o nível atual exige revisão humana antes de auto-aprovar.
 * Em strict, mesmo com NER aplicado, a interação fica como PENDING_REVIEW
 * obrigatoriamente — o curador valida que nada vazou.
 */
export function requiresManualReview(level: AnonymizationLevel = ANONYMIZATION_LEVEL): boolean {
  return level === "strict";
}

// ─── Outros utilitários ───────────────────────────────────────────────────────

/**
 * Extrai metadados superficiais da transcrição para pré-preenchimento do formulário.
 * Retorna null se não conseguir inferir nada confiável.
 */
export function inferOutcome(raw: string): "SCHEDULED" | "NOT_SCHEDULED" | null {
  const lower = raw.toLowerCase();

  const scheduledSignals = [
    "agendado",
    "agendamos",
    "marcado",
    "consulta marcada",
    "confirmado",
    "você está confirmado",
    "até amanhã",
    "até segunda",
    "até terça",
    "te esperamos",
  ];

  const notScheduledSignals = [
    "não consegui agendar",
    "sem agenda",
    "fora do atendimento",
    "não temos vaga",
    "encerrou sem",
    "sem retorno",
  ];

  if (scheduledSignals.some((s) => lower.includes(s))) return "SCHEDULED";
  if (notScheduledSignals.some((s) => lower.includes(s))) return "NOT_SCHEDULED";
  return null;
}
