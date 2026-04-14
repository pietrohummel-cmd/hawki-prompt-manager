"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { parseOnboardingFile } from "@/lib/csv-parser";
import type { ParsedOnboardingData } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Obrigatório"),
  clinicName: z.string().min(1, "Obrigatório"),
  assistantName: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  neighborhood: z.string().optional(),
  address: z.string().optional(),
  reference: z.string().optional(),
  phone: z.string().optional(),
  instagram: z.string().optional(),
  website: z.string().optional(),
  attendantName: z.string().optional(),
  schedulingSystem: z.enum(["CLINICORP", "CONTROLE_ODONTO", "SIMPLES_DENTAL", "GOOGLE_AGENDA", ""]).optional(),
  schedulingMode: z.enum(["DIRECT", "HANDOFF", "LINK", ""]).optional(),
  tone: z.enum(["FORMAL", "INFORMAL_MODERATE", "CASUAL", ""]).optional(),
  targetAudience: z.string().optional(),
  ageRange: z.string().optional(),
  restrictions: z.string().optional(),
  mandatoryPhrases: z.string().optional(),
  paymentInfo: z.string().optional(),
  specialists: z.string().optional(),
  technologies: z.string().optional(),
  differentials: z.string().optional(),
  businessHours: z.string().optional(),
  emojiUsage: z.string().optional(),
  treatmentPronoun: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TONE_LABELS: Record<string, string> = {
  FORMAL: "Formal",
  INFORMAL_MODERATE: "Informal moderado",
  CASUAL: "Descontraído",
};

const SCHEDULING_MODE_LABELS: Record<string, string> = {
  DIRECT: "Sofia agenda diretamente",
  HANDOFF: "Sofia encaminha para humano",
  LINK: "Sofia envia link de agendamento",
};

const SCHEDULING_SYSTEM_LABELS: Record<string, string> = {
  CLINICORP: "Clinicorp",
  CONTROLE_ODONTO: "Controle Odonto",
  SIMPLES_DENTAL: "Simples Dental",
  GOOGLE_AGENDA: "Google Agenda",
};

function mapParsedToForm(parsed: ParsedOnboardingData): Partial<FormData> {
  const toneMap: Record<string, FormData["tone"]> = {
    formal: "FORMAL",
    "informal moderado": "INFORMAL_MODERATE",
    "informal_moderado": "INFORMAL_MODERATE",
    descontrai: "CASUAL",
    casual: "CASUAL",
  };

  const modeMap: Record<string, FormData["schedulingMode"]> = {
    direct: "DIRECT",
    agenda: "DIRECT",
    handoff: "HANDOFF",
    encaminha: "HANDOFF",
    link: "LINK",
  };

  const systemMap: Record<string, FormData["schedulingSystem"]> = {
    clinicorp: "CLINICORP",
    controle: "CONTROLE_ODONTO",
    controle_odonto: "CONTROLE_ODONTO",
    simples: "SIMPLES_DENTAL",
    simples_dental: "SIMPLES_DENTAL",
    google: "GOOGLE_AGENDA",
    google_agenda: "GOOGLE_AGENDA",
  };

  const normTone = parsed.tone?.toLowerCase().trim() ?? "";
  const normMode = parsed.schedulingMode?.toLowerCase().trim() ?? "";
  const normSystem = parsed.schedulingSystem?.toLowerCase().trim() ?? "";

  return {
    name: parsed.name,
    email: parsed.email,
    clinicName: parsed.clinicName,
    assistantName: parsed.assistantName,
    attendantName: parsed.attendantName,
    city: parsed.city,
    state: parsed.state,
    zipCode: parsed.zipCode,
    neighborhood: parsed.neighborhood,
    address: parsed.address,
    reference: parsed.reference,
    phone: parsed.phone,
    instagram: parsed.instagram,
    website: parsed.website,
    businessHours: parsed.businessHours,
    specialists: parsed.specialists,
    technologies: parsed.technologies,
    differentials: parsed.differentials,
    targetAudience: parsed.targetAudience,
    ageRange: parsed.ageRange,
    paymentInfo: parsed.paymentInfo,
    emojiUsage: parsed.emojiUsage,
    treatmentPronoun: parsed.treatmentPronoun,
    restrictions: parsed.restrictions,
    mandatoryPhrases: parsed.mandatoryPhrases,
    tone: Object.entries(toneMap).find(([k]) => normTone.includes(k))?.[1],
    schedulingMode: Object.entries(modeMap).find(([k]) => normMode.includes(k))?.[1],
    schedulingSystem: Object.entries(systemMap).find(([k]) => normSystem.includes(k))?.[1],
  };
}

export default function NewClientPage() {
  const router = useRouter();
  const [csvPreview, setCsvPreview] = useState<ParsedOnboardingData | null>(null);
  const [csvUnmapped, setCsvUnmapped] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { assistantName: "Sofia" },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const results = await parseOnboardingFile(file);
      const first = results[0];
      if (!first) return;

      const mapped = mapParsedToForm(first);
      setCsvPreview(first);
      setCsvUnmapped(first.unmapped);

      // Preenche o formulário com os dados parseados
      (Object.keys(mapped) as (keyof FormData)[]).forEach((key) => {
        const val = mapped[key];
        if (val !== undefined) setValue(key, val as string);
      });
    } catch (err) {
      setError("Erro ao processar o arquivo. Verifique se é um CSV ou XLSX válido.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError(null);
    try {
      // Remove campos de enum vazios antes de enviar
      const payload = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== "" && v !== undefined)
      );

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao salvar cliente");
      }

      const client = await res.json();
      router.push(`/clients/${client.id}/prompt`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-white mb-1">Novo cliente</h1>
      <p className="text-zinc-400 text-sm mb-8">
        Preencha os dados da clínica ou faça upload do CSV de onboarding para pré-preencher o formulário.
      </p>

      {/* Upload CSV */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mb-8">
        <p className="text-sm font-medium text-zinc-300 mb-3">
          Importar formulário de onboarding (opcional)
        </p>
        <label className="flex items-center gap-3 cursor-pointer group">
          <span className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs px-3 py-1.5 rounded transition-colors">
            {uploading ? "Processando..." : "Escolher arquivo (.csv ou .xlsx)"}
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {csvPreview && (
            <span className="text-xs text-emerald-400">
              Arquivo importado — formulário pré-preenchido
            </span>
          )}
        </label>

        {/* Campos não mapeados do CSV */}
        {Object.keys(csvUnmapped).length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
              {Object.keys(csvUnmapped).length} coluna(s) não mapeada(s) — clique para ver
            </summary>
            <div className="mt-2 space-y-1">
              {Object.entries(csvUnmapped).map(([k, v]) => (
                <p key={k} className="text-xs text-zinc-600">
                  <span className="text-zinc-500">{k}:</span> {v}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* Seção: Dados básicos */}
        <Section title="Dados básicos">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome do responsável *" error={errors.name?.message}>
              <input {...register("name")} placeholder="Pietro Hummel" className={input()} />
            </Field>
            <Field label="Nome da clínica *" error={errors.clinicName?.message}>
              <input {...register("clinicName")} placeholder="Clínica Sorrir" className={input()} />
            </Field>
            <Field label="Email do responsável">
              <input {...register("email")} type="email" placeholder="contato@clinica.com.br" className={input()} />
            </Field>
            <Field label="Nome da assistente" error={errors.assistantName?.message}>
              <input {...register("assistantName")} placeholder="Sofia" className={input()} />
            </Field>
            <Field label="Tom de comunicação">
              <select {...register("tone")} className={input()}>
                <option value="">Selecione...</option>
                {Object.entries(TONE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Público-alvo" className="col-span-2">
              <input {...register("targetAudience")} placeholder="Ex: adultos com dor dental, interessados em implantes" className={input()} />
            </Field>
            <Field label="Faixa etária">
              <input {...register("ageRange")} placeholder="Ex: 40+" className={input()} />
            </Field>
            <Field label="Pronome de tratamento">
              <input {...register("treatmentPronoun")} placeholder="Você / Tu" className={input()} />
            </Field>
            <Field label="Uso de emojis" className="col-span-2">
              <input {...register("emojiUsage")} placeholder="Ex: Moderado, 1-2 por mensagem" className={input()} />
            </Field>
          </div>
        </Section>

        {/* Seção: Localização */}
        <Section title="Localização">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cidade">
              <input {...register("city")} placeholder="São Paulo" className={input()} />
            </Field>
            <Field label="Estado">
              <input {...register("state")} placeholder="PR" className={input()} />
            </Field>
            <Field label="CEP">
              <input {...register("zipCode")} placeholder="86125-000" className={input()} />
            </Field>
            <Field label="Bairro">
              <input {...register("neighborhood")} placeholder="Vila Madalena" className={input()} />
            </Field>
            <Field label="Endereço completo" className="col-span-2">
              <input {...register("address")} placeholder="Rua das Flores, 123" className={input()} />
            </Field>
            <Field label="Ponto de referência" className="col-span-2">
              <input {...register("reference")} placeholder="Próximo ao metrô Fradique Coutinho" className={input()} />
            </Field>
          </div>
        </Section>

        {/* Seção: Contato */}
        <Section title="Contato">
          <div className="grid grid-cols-2 gap-4">
            <Field label="WhatsApp / Telefone">
              <input {...register("phone")} placeholder="(11) 9 9999-9999" className={input()} />
            </Field>
            <Field label="Instagram">
              <input {...register("instagram")} placeholder="@clinicasorrir" className={input()} />
            </Field>
            <Field label="Site" className="col-span-2">
              <input {...register("website")} placeholder="https://clinicasorrir.com.br" className={input()} />
            </Field>
          </div>
        </Section>

        {/* Seção: Agendamento */}
        <Section title="Agendamento">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome do responsável humano (handoff)">
              <input {...register("attendantName")} placeholder="Mariana" className={input()} />
            </Field>
            <Field label="Modo de agendamento">
              <select {...register("schedulingMode")} className={input()}>
                <option value="">Selecione...</option>
                {Object.entries(SCHEDULING_MODE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Sistema de agendamento" className="col-span-2">
              <select {...register("schedulingSystem")} className={input()}>
                <option value="">Selecione...</option>
                {Object.entries(SCHEDULING_SYSTEM_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Horários de atendimento" className="col-span-2">
              <textarea
                {...register("businessHours")}
                rows={3}
                placeholder="Seg a Sex: 8h–18h | Sábado: 8h–12h | Domingo: fechado"
                className={input()}
              />
            </Field>
          </div>
        </Section>

        {/* Seção: Clínica */}
        <Section title="Sobre a clínica">
          <div className="space-y-4">
            <Field label="Dentistas e especialidades">
              <textarea
                {...register("specialists")}
                rows={3}
                placeholder="Dr. João Silva — Implantodontia (15 anos de experiência)&#10;Dra. Ana Costa — Ortodontia"
                className={input()}
              />
            </Field>
            <Field label="Tecnologias e equipamentos (apenas confirmados)">
              <textarea
                {...register("technologies")}
                rows={2}
                placeholder="Tomografia 3D, laser odontológico, câmera intraoral"
                className={input()}
              />
            </Field>
            <Field label="Diferenciais (apenas reais e verificáveis)">
              <textarea
                {...register("differentials")}
                rows={3}
                placeholder="Avaliação gratuita, parcelamento em 36x sem juros, implante com carga imediata"
                className={input()}
              />
            </Field>
            <Field label="Formas de pagamento">
              <textarea
                {...register("paymentInfo")}
                rows={2}
                placeholder="PIX, cartão em até 12x, parcelamento próprio em 36x"
                className={input()}
              />
            </Field>
          </div>
        </Section>

        {/* Seção: Regras da Sofia */}
        <Section title="Regras da Sofia">
          <div className="space-y-4">
            <Field label="Frases obrigatórias (o que Sofia deve sempre dizer)">
              <textarea
                {...register("mandatoryPhrases")}
                rows={3}
                placeholder="Sempre mencionar a avaliação gratuita&#10;Sempre confirmar o endereço no final"
                className={input()}
              />
            </Field>
            <Field label="Restrições (o que Sofia nunca pode fazer ou dizer)">
              <textarea
                {...register("restrictions")}
                rows={3}
                placeholder="Nunca mencionar o nome do concorrente X&#10;Nunca informar preço de implante antes da avaliação"
                className={input()}
              />
            </Field>
          </div>
        </Section>

        {/* Erro */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-medium text-sm px-6 py-2.5 rounded-md transition-colors"
          >
            {saving ? "Salvando..." : "Salvar e gerar prompt →"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-zinc-400 hover:text-zinc-200 text-sm px-4 py-2.5 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// Helpers de UI
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-zinc-800">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function input() {
  return "w-full bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-2 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors resize-none";
}
