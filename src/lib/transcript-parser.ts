/**
 * Parser e anonimizador de transcrições de conversa.
 *
 * Fluxo:
 * 1. Normaliza o texto (encoding, quebras de linha)
 * 2. Remove informações identificadoras (nomes de clínica, telefones, CPFs, emails)
 * 3. Retorna texto limpo pronto para armazenamento cross-tenant
 */

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
  // Substituído por tag genérica de turno
  text = text.replace(/^([^:\n]{1,50}):(\s)/gm, (_, name) => {
    const lower = name.toLowerCase();
    // Heurística: se parece operador (sofia, atendente, clínica) → [SOFIA]
    if (/sofia|atendente|clínica|clinica|assistente|bot|ia/i.test(lower)) {
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
