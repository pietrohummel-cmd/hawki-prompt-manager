import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ParsedOnboardingData } from "@/types";

type MappableField = keyof Omit<ParsedOnboardingData, "unmapped" | "urgencyHandling" | "urgencyProcedure" | "consultationInfo" | "schedulingRequirements">;

// Normaliza string: lowercase, sem acentos, sem espaços/pontuação → underscore
function normalize(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// Campos que acumulam valor de múltiplas colunas (separados por \n)
const ACCUMULATE_FIELDS = new Set<MappableField>([
  "technologies",
  "differentials",
  "restrictions",
  "mandatoryPhrases",
  "specialists",
]);

// Colunas a ignorar silenciosamente (metadados do formulário)
const IGNORE_KEYWORDS = [
  "timezone", "submission_date", "submission", "source",
  "fbEventId", "fbeventid", "medium", "mediumid",
  "documenturl", "url",
];

// Detecção por palavras-chave na coluna normalizada
// Retorna o campo mapeado ou null se não reconhecido
function detectField(key: string): MappableField | null {
  // Ignorar metadados do formulário
  if (IGNORE_KEYWORDS.some((k) => key.includes(k))) return null;

  // Nome do responsável (contato)
  if (key === "nome_completo" || key.startsWith("nome_completo")) return "name";

  // Email
  if (key === "email") return "email";

  // Nome da clínica
  if (key === "nome_clinica" || key === "nome_da_clinica" || key === "clinica") return "clinicName";

  // Nome da assistente
  if (key.includes("nome_da_assistente") || key.includes("nome_assistente") || key === "assistente") return "assistantName";
  if (key === "nome_sofia") return "assistantName";

  // Responsável humano pelo agendamento
  if (key.includes("responsavel") && key.includes("agendamento")) return "attendantName";
  if (key === "atendente" || key === "nome_responsavel") return "attendantName";

  // Cidade
  if (key === "cidade" || key === "city") return "city";

  // Estado
  if (key === "estado" || key === "state" || key === "uf") return "state";

  // CEP
  if (key === "cep" || key === "zipcode" || key === "zip_code" || key === "codigo_postal") return "zipCode";

  // Bairro
  if (key === "bairro" || key === "neighborhood") return "neighborhood";

  // Endereço
  if (key.startsWith("endereco") || key === "address" || key === "endereco_completo") return "address";

  // Ponto de referência
  if (key.includes("referencia") || key.includes("ponto_de_referencia") || key.includes("localizacao")) return "reference";

  // Telefone / WhatsApp
  if (key === "telefone" || key === "whatsapp" || key === "phone" || key === "celular") return "phone";

  // Instagram
  if (key === "instagram") return "instagram";

  // Site
  if (key === "site" || key === "website") return "website";

  // Horários de atendimento
  if (key.includes("horario") && (key.includes("atendimento") || key.includes("clinica") || key.includes("funcionamento"))) return "businessHours";
  if (key === "horarios" || key === "horario_de_atendimento" || key === "business_hours") return "businessHours";

  // Dentistas e especialidades
  if (key.includes("dentista") || (key.includes("especialidade") && key.includes("nome"))) return "specialists";

  // Certificações, prêmios e diferenciais dos profissionais
  // "Algum profissional tem certificação/prêmio/diferencial importante?"
  if (key.includes("profissional") && (key.includes("certificacao") || key.includes("premio") || key.includes("diferencial"))) return "certifications";

  // Tecnologias e equipamentos (incluindo colunas "Outros")
  if (key.includes("tecnologia") || key.includes("equipamento")) return "technologies";

  // Diferenciais de tratamento
  // Usar "diferencia" para capturar tanto "diferencial" (singular) quanto "diferenciais" (plural)
  if (key.includes("diferencia") && !key.includes("profissional")) return "differentials";
  if (key.includes("conforto") || key.includes("experiencia")) return "differentials";

  // Tom / informalidade
  if (key.includes("informalidade") || key.includes("nivel_de_informal") || key.includes("tom_desejado") || key === "tom" || key === "tone") return "tone";

  // Uso de emojis
  if (key.includes("emoji") || key.includes("uso_de_emoji")) return "emojiUsage";

  // Pronome de tratamento (você/tu)
  if (key === "tratamento" || key.includes("pronome") || key.includes("voce_ou_tu")) return "treatmentPronoun";

  // Público-alvo
  if (key.includes("publico_alvo") || key.includes("publico_alv") || key === "publico") return "targetAudience";

  // Faixa etária
  if (key.includes("faixa_etaria") || key.includes("idade")) return "ageRange";

  // Pagamento
  if (key.includes("pagamento") || key.includes("parcelamento") || key.includes("payment")) return "paymentInfo";

  // Restrições — APENAS o que Sofia nunca deve fazer/falar
  if (key.includes("nunca") || key.includes("restricao") || key.includes("restricoes") || key.includes("proibid")) return "restrictions";

  // Informações que Sofia SEMPRE deve mencionar (campo "Informações importantes")
  if (key.includes("sempre") || key.includes("frases_obrigatorias") || key.includes("informacoes_importantes") || key.includes("mandatory")) return "mandatoryPhrases";

  // Modo de agendamento
  if (key.includes("sofia_agenda") || key.includes("modo_agendamento") || key === "scheduling_mode") return "schedulingMode";

  // Sistema de agendamento
  if (key.includes("sistema") && (key.includes("agenda") || key.includes("agendamento"))) return "schedulingSystem";
  if (key === "sistema_de_agendamento" || key === "scheduling_system") return "schedulingSystem";

  return null;
}

// Detecta campos fora do MappableField (urgência, consulta, agendamento)
function detectSpecialField(key: string): "urgencyHandling" | "urgencyProcedure" | "consultationInfo" | "schedulingRequirements" | null {
  // "A clínica atende urgência odontológica?" → Sim/Não
  if (key.includes("atende") && key.includes("urgencia")) return "urgencyHandling";
  if (key.includes("urgencia") && key.includes("odontologica")) return "urgencyHandling";
  // "Se sim, como proceder:" → procedimento de urgência
  if (key.includes("como_proceder") || key.includes("se_sim")) return "urgencyProcedure";
  // "Como funciona a Primeira Consulta / Avaliação?" → consultationInfo
  if (key.includes("primeira_consulta") || key.includes("avaliacao") || key.includes("como_funciona")) return "consultationInfo";
  // "Dados obrigatórios para agendar" / "o que Sofia deve coletar" → schedulingRequirements
  if (key.includes("dados_obrigatorios") || key.includes("deve_coletar") || (key.includes("obrigatorios") && key.includes("agendar"))) return "schedulingRequirements";
  return null;
}

// Normaliza o valor do campo "tom" para o enum ClientTone
// Opções do GHL:
//   "Bem informal"     → CASUAL           (E aí!, Opa!, Bora agendar?)
//   "Informal moderado"→ INFORMAL_MODERATE (Oi, Tudo bem?, Vamos agendar?)
//   "Semi-formal"      → FORMAL            (Olá, Como vai?, Podemos agendar?)
function normalizeTone(existing: string | undefined, newValue: string): string {
  const v = newValue.toLowerCase();
  let tone = existing ?? "";

  // Bem informal — checar "bem" + "informal" antes de checar "informal" sozinho
  if ((v.includes("bem") && v.includes("informal")) || v.includes("casual") || v.includes("descont")) {
    tone = "CASUAL";
  // Informal moderado — checar "moderado" ou "informal" sem o qualificador "bem"
  } else if (v.includes("moderado") || v.includes("moderately") || (v.includes("informal") && !v.includes("bem"))) {
    tone = "INFORMAL_MODERATE";
  // Semi-formal — o mais formal das três opções
  } else if (v.includes("semi") || v.includes("formal")) {
    tone = "FORMAL";
  } else {
    // Guarda o texto livre se não conseguiu mapear para enum
    tone = tone ? `${tone} | ${newValue}` : newValue;
  }

  return tone;
}

// Normaliza o valor do campo "schedulingSystem" para o enum
function normalizeSchedulingSystem(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("clinicorp")) return "CLINICORP";
  if (v.includes("controle")) return "CONTROLE_ODONTO";
  if (v.includes("simples")) return "SIMPLES_DENTAL";
  if (v.includes("google")) return "GOOGLE_AGENDA";
  return value; // mantém texto livre se não reconheceu
}

function mapRow(row: Record<string, string>): ParsedOnboardingData {
  const result: ParsedOnboardingData = { unmapped: {} };
  const accumulator: Partial<Record<MappableField, string[]>> = {};

  for (const [rawKey, value] of Object.entries(row)) {
    const trimmedValue = value?.trim();
    if (!trimmedValue) continue;

    const normalizedKey = normalize(rawKey);

    // Verifica campos especiais (fora do MappableField) — urgência, consulta, agendamento
    const specialField = detectSpecialField(normalizedKey);
    if (specialField) {
      if (!result[specialField]) {
        result[specialField] = trimmedValue;
      }
      continue;
    }

    const field = detectField(normalizedKey);

    if (!field) {
      result.unmapped[rawKey] = trimmedValue;
      continue;
    }

    // Campos especiais com normalização de enum
    if (field === "tone") {
      result.tone = normalizeTone(result.tone, trimmedValue);
      continue;
    }
    if (field === "schedulingSystem") {
      const normalized = normalizeSchedulingSystem(trimmedValue);
      result.schedulingSystem = normalized;
      continue;
    }

    // Campos que acumulam múltiplas colunas
    if (ACCUMULATE_FIELDS.has(field)) {
      if (!accumulator[field]) accumulator[field] = [];
      // Ignora valores genéricos: "Outros" (checkbox placeholder), "Sim"/"Não" (respostas booleanas), "..." (vazio disfarçado)
      const lv = trimmedValue.toLowerCase();
      const isGeneric = lv === "outros" || lv === "sim" || lv === "não" || lv === "nao" || lv === "...";
      if (!isGeneric) {
        accumulator[field]!.push(trimmedValue);
      }
      continue;
    }

    // Campo simples — primeira ocorrência vence
    if (!(result as unknown as Record<string, string>)[field]) {
      (result as unknown as Record<string, string>)[field] = trimmedValue;
    }
  }

  // Consolida campos acumulados
  for (const [field, values] of Object.entries(accumulator) as [MappableField, string[]][]) {
    if (values.length > 0) {
      (result as unknown as Record<string, string>)[field] = values.join("\n");
    }
  }

  return result;
}

export async function parseCSV(file: File): Promise<ParsedOnboardingData[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data.map(mapRow));
      },
      error: reject,
    });
  });
}

export async function parseXLSX(file: File): Promise<ParsedOnboardingData[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
  });
  return rows.map(mapRow);
}

export async function parseOnboardingFile(
  file: File
): Promise<ParsedOnboardingData[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "xlsx" || ext === "xls") return parseXLSX(file);
  return parseCSV(file);
}
