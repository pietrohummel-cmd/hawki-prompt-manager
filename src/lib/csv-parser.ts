import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ParsedOnboardingData } from "@/types";

// Normaliza string para comparação fuzzy: lowercase, sem acentos, sem espaços extras
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// Mapa de variações de nomes de colunas → campo interno
const COLUMN_MAP: Record<string, keyof Omit<ParsedOnboardingData, "unmapped">> = {
  // Nome da clínica
  nome_da_clinica: "clinicName",
  nome_clinica: "clinicName",
  clinica: "clinicName",
  clinic_name: "clinicName",

  // Nome da assistente
  nome_da_assistente: "assistantName",
  nome_assistente: "assistantName",
  assistente: "assistantName",
  assistant_name: "assistantName",
  nome_sofia: "assistantName",

  // Responsável pelo agendamento humano
  responsavel_agendamento: "attendantName",
  responsavel_pelo_agendamento: "attendantName",
  nome_responsavel: "attendantName",
  atendente: "attendantName",
  attendant_name: "attendantName",

  // Cidade
  cidade: "city",
  city: "city",

  // Bairro
  bairro: "neighborhood",
  neighborhood: "neighborhood",

  // Endereço
  endereco: "address",
  endereco_completo: "address",
  address: "address",

  // Ponto de referência
  ponto_de_referencia: "reference",
  referencia: "reference",
  reference: "reference",

  // Telefone / WhatsApp
  telefone: "phone",
  whatsapp: "phone",
  phone: "phone",
  celular: "phone",

  // Instagram
  instagram: "instagram",

  // Site
  site: "website",
  website: "website",
  url: "website",

  // Horários
  horario_de_atendimento: "businessHours",
  horarios_de_atendimento: "businessHours",
  horario_atendimento: "businessHours",
  business_hours: "businessHours",
  horarios: "businessHours",
  funcionamento: "businessHours",

  // Dentistas e especialidades
  dentistas: "specialists",
  especialidades: "specialists",
  dentistas_e_especialidades: "specialists",
  specialists: "specialists",

  // Tecnologias
  tecnologias: "technologies",
  equipamentos: "technologies",
  technologies: "technologies",

  // Diferenciais
  diferenciais: "differentials",
  differentials: "differentials",

  // Tom desejado
  tom_desejado: "tone",
  tom: "tone",
  tone: "tone",
  estilo: "tone",

  // Público-alvo
  publico_alvo: "targetAudience",
  publico: "targetAudience",
  target_audience: "targetAudience",

  // Faixa etária
  faixa_etaria: "ageRange",
  idade: "ageRange",
  age_range: "ageRange",

  // Formas de pagamento
  formas_de_pagamento: "paymentInfo",
  pagamento: "paymentInfo",
  payment: "paymentInfo",
  parcelamento: "paymentInfo",

  // Restrições
  restricoes: "restrictions",
  o_que_sofia_nunca_pode_dizer: "restrictions",
  restrictions: "restrictions",

  // Frases obrigatórias
  frases_obrigatorias: "mandatoryPhrases",
  frases: "mandatoryPhrases",
  mandatory_phrases: "mandatoryPhrases",

  // Modo de agendamento
  sofia_agenda_ou_encaminha: "schedulingMode",
  modo_agendamento: "schedulingMode",
  scheduling_mode: "schedulingMode",
  agendamento: "schedulingMode",

  // Sistema de agendamento
  sistema_de_agendamento: "schedulingSystem",
  sistema: "schedulingSystem",
  scheduling_system: "schedulingSystem",
};

function mapRow(row: Record<string, string>): ParsedOnboardingData {
  const result: ParsedOnboardingData = { unmapped: {} };

  for (const [rawKey, value] of Object.entries(row)) {
    if (!value?.trim()) continue;
    const normalizedKey = normalize(rawKey);
    const field = COLUMN_MAP[normalizedKey];

    if (field) {
      (result as unknown as Record<string, string>)[field] = value.trim();
    } else {
      result.unmapped[rawKey] = value.trim();
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
