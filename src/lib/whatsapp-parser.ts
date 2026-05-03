/**
 * Parser de exportações de conversa do WhatsApp.
 *
 * Suporta os dois formatos de exportação nativos do WhatsApp:
 *   Formato Android: "DD/MM/AAAA HH:MM - Remetente: mensagem"
 *   Formato iOS:     "[DD/MM/AA, HH:MM:SS] Remetente: mensagem"
 *
 * Divide o arquivo em conversas individuais — cada conversa é uma janela
 * contínua de mensagens. Conversas separadas por mais de GAP_HOURS horas
 * de silêncio são consideradas sessões distintas.
 */

// Regex para linha de mensagem do WhatsApp (ambos os formatos)
// Android: "27/04/2024 14:32 - Nome: texto"  ou  "27/04/2024 às 14:32 - Nome: texto"
// iOS:     "[27/04/24, 14:32:00] Nome: texto"
const WA_LINE_RE =
  /^(?:\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?)\]|(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:às\s+)?(\d{1,2}:\d{2}))\s*[-–]?\s*(.+?):\s*(.*)$/;

// Mensagens de sistema do WhatsApp a ignorar (criptografia, convites, etc.)
const SYSTEM_PATTERNS = [
  /as mensagens e chamadas são protegidas/i,
  /messages and calls are end-to-end encrypted/i,
  /criou o grupo/i,
  /adicionou/i,
  /saiu/i,
  /mudou o assunto/i,
  /mudou a descrição/i,
  /mudou a imagem/i,
  /‎/,            // Unicode left-to-right mark (metadata WA)
  /^‏/,           // Unicode right-to-left mark
  /^<mídia oculta>/i,
  /^<media omitted>/i,
  /<mídia oculta>/i,
  /<media omitted>/i,
];

export interface WaMessage {
  sender: string;
  text: string;
  timestampMs: number;
}

export interface WaConversation {
  messages: WaMessage[];
  startMs: number;
  endMs: number;
  /** Texto bruto da conversa reconstruído para armazenamento */
  raw: string;
}

/** Silêncio em horas que separa duas sessões distintas */
const GAP_HOURS = 4;
const GAP_MS = GAP_HOURS * 60 * 60 * 1000;

/** Mínimo de mensagens para considerar uma conversa válida */
const MIN_MESSAGES = 3;

function parseTimestamp(dateStr: string, timeStr: string): number {
  // Normaliza para DD/MM/YYYY
  const parts = dateStr.split("/");
  let [day, month, year] = parts;
  if (year.length === 2) year = `20${year}`;
  const [hh, mm] = timeStr.split(":");
  return new Date(`${year}-${month.padStart(2,"0")}-${day.padStart(2,"0")}T${hh.padStart(2,"0")}:${mm.padStart(2,"0")}:00`).getTime();
}

function isSystemMessage(text: string): boolean {
  return SYSTEM_PATTERNS.some((p) => p.test(text));
}

/**
 * Extrai a lista de remetentes únicos detectados no arquivo, ordenada
 * por nº de mensagens (mais frequente primeiro). Usado pela UI para
 * permitir que o operador seja marcado explicitamente antes do upload.
 */
export function extractParticipants(raw: string): { name: string; messageCount: number }[] {
  const lines = raw.split(/\r?\n/);
  const counts = new Map<string, number>();
  for (const line of lines) {
    const match = WA_LINE_RE.exec(line);
    if (!match) continue;
    const sender = match[5].trim();
    const text = match[6].trim();
    if (!sender || isSystemMessage(text) || isSystemMessage(sender)) continue;
    counts.set(sender, (counts.get(sender) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, messageCount]) => ({ name, messageCount }))
    .sort((a, b) => b.messageCount - a.messageCount);
}

function classifySender(sender: string, operatorIdentifiers?: string[]): "SOFIA" | "PACIENTE" {
  // Caminho explícito: o usuário marcou quem é o operador no upload
  if (operatorIdentifiers && operatorIdentifiers.length > 0) {
    const normalized = sender.trim().toLowerCase();
    const hit = operatorIdentifiers.some((op) => op.trim().toLowerCase() === normalized);
    return hit ? "SOFIA" : "PACIENTE";
  }
  // Fallback heurístico (legacy): infere por substring de palavras-chave
  return /sofia|atendente|cl[ií]nica|assistente|bot|\bia\b|recep/i.test(sender)
    ? "SOFIA"
    : "PACIENTE";
}

/**
 * Parseia o texto bruto de uma exportação do WhatsApp.
 * Retorna conversas agrupadas por sessão (gap > GAP_HOURS).
 *
 * @param raw                   Conteúdo do arquivo .txt exportado
 * @param operatorIdentifiers   Lista de nomes de remetentes que são o operador.
 *                              Se ausente, cai no fallback heurístico (palavras-chave).
 */
export function parseWhatsAppExport(
  raw: string,
  operatorIdentifiers?: string[]
): WaConversation[] {
  const lines = raw.split(/\r?\n/);
  const messages: WaMessage[] = [];

  let currentMsg: WaMessage | null = null;

  for (const line of lines) {
    const match = WA_LINE_RE.exec(line);
    if (match) {
      // Salva mensagem anterior
      if (currentMsg) messages.push(currentMsg);

      // iOS: grupos 1-2, Android: grupos 3-4
      const dateStr = match[1] ?? match[3];
      const timeStr = match[2] ?? match[4];
      const sender  = match[5].trim();
      const text    = match[6].trim();

      if (isSystemMessage(text) || isSystemMessage(sender)) {
        currentMsg = null;
        continue;
      }

      currentMsg = {
        sender,
        text,
        timestampMs: parseTimestamp(dateStr, timeStr),
      };
    } else if (currentMsg && line.trim()) {
      // Continuação de mensagem multi-linha
      currentMsg.text += "\n" + line.trim();
    }
  }
  if (currentMsg) messages.push(currentMsg);

  if (messages.length === 0) return [];

  // Agrupa em sessões por gap de tempo
  const conversations: WaConversation[] = [];
  let sessionMsgs: WaMessage[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const gap = messages[i].timestampMs - messages[i - 1].timestampMs;
    if (gap > GAP_MS) {
      if (sessionMsgs.length >= MIN_MESSAGES) {
        conversations.push(buildConversation(sessionMsgs, operatorIdentifiers));
      }
      sessionMsgs = [messages[i]];
    } else {
      sessionMsgs.push(messages[i]);
    }
  }
  if (sessionMsgs.length >= MIN_MESSAGES) {
    conversations.push(buildConversation(sessionMsgs, operatorIdentifiers));
  }

  return conversations;
}

function buildConversation(msgs: WaMessage[], operatorIdentifiers?: string[]): WaConversation {
  // Reconstrói o texto bruto com papéis já anotados — isso evita que a camada
  // de anonymização precise inferir papel por substring de nome (que invertia
  // papéis quando atendentes têm nomes próprios como "Mariana" ou "Dra. Ana").
  const raw = msgs
    .map((m) => `[${classifySender(m.sender, operatorIdentifiers)}]: ${m.text}`)
    .join("\n");
  return {
    messages: msgs,
    startMs:  msgs[0].timestampMs,
    endMs:    msgs[msgs.length - 1].timestampMs,
    raw,
  };
}

/**
 * Retorna um resumo legível da conversa para exibição na UI.
 */
export function summarizeConversation(conv: WaConversation): string {
  const start = new Date(conv.startMs).toLocaleDateString("pt-BR");
  const turns = conv.messages.length;
  const senders = [...new Set(conv.messages.map((m) => m.sender))].join(", ");
  return `${start} · ${turns} mensagens · ${senders}`;
}
