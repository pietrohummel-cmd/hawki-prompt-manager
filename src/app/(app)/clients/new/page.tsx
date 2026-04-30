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
  consultationInfo: z.string().optional(),
  schedulingRequirements: z.string().optional(),
  paymentInfo: z.string().optional(),
  specialists: z.string().optional(),
  certifications: z.string().optional(),
  technologies: z.string().optional(),
  differentials: z.string().optional(),
  businessHours: z.string().optional(),
  emojiUsage: z.string().optional(),
  treatmentPronoun: z.string().optional(),
  urgencyHandling: z.string().optional(),
  urgencyProcedure: z.string().optional(),
  procedureType: z.string().optional(),
  clinicPositioning: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TONE_LABELS: Record<string, string> = {
  CASUAL: 'Bem informal — "E aí!", "Opa!", "Bora agendar?"',
  INFORMAL_MODERATE: 'Informal moderado — "Oi", "Tudo bem?", "Vamos agendar?"',
  FORMAL: 'Semi-formal — "Olá", "Como vai?", "Podemos agendar?"',
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

const VALID_TONES = ["FORMAL", "INFORMAL_MODERATE", "CASUAL"] as const;
const VALID_MODES = ["DIRECT", "HANDOFF", "LINK"] as const;
const VALID_SYSTEMS = ["CLINICORP", "CONTROLE_ODONTO", "SIMPLES_DENTAL", "GOOGLE_AGENDA"] as const;

function mapParsedToForm(parsed: ParsedOnboardingData): Partial<FormData> {
  // O csv-parser já retorna os enums em maiúsculas — usar direto evita bugs de substring
  // (ex: "informal_moderate".includes("formal") === true, mapearia errado para FORMAL)
  const tone = VALID_TONES.includes(parsed.tone as typeof VALID_TONES[number])
    ? (parsed.tone as FormData["tone"])
    : undefined;

  const schedulingMode = VALID_MODES.includes(parsed.schedulingMode as typeof VALID_MODES[number])
    ? (parsed.schedulingMode as FormData["schedulingMode"])
    : undefined;

  const schedulingSystem = VALID_SYSTEMS.includes(parsed.schedulingSystem as typeof VALID_SYSTEMS[number])
    ? (parsed.schedulingSystem as FormData["schedulingSystem"])
    : undefined;

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
    certifications: parsed.certifications,
    technologies: parsed.technologies,
    differentials: parsed.differentials,
    targetAudience: parsed.targetAudience,
    ageRange: parsed.ageRange,
    paymentInfo: parsed.paymentInfo,
    emojiUsage: parsed.emojiUsage,
    treatmentPronoun: parsed.treatmentPronoun,
    restrictions: parsed.restrictions,
    mandatoryPhrases: parsed.mandatoryPhrases,
    consultationInfo: parsed.consultationInfo,
    schedulingRequirements: parsed.schedulingRequirements,
    urgencyHandling: parsed.urgencyHandling,
    urgencyProcedure: parsed.urgencyProcedure,
    tone,
    schedulingMode,
    schedulingSystem,
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
        throw new Error(err.detail ? `${err.error}: ${err.detail}` : (err.error ?? "Erro ao salvar cliente"));
      }

      const client = await res.json();

      // Gera o primeiro prompt automaticamente — sem etapa extra para o usuário
      const genRes = await fetch(`/api/clients/${client.id}/generate-prompt`, { method: "POST" });
      if (!genRes.ok) {
        const genErr = await genRes.json().catch(() => ({}));
        throw new Error(genErr.error ?? "Cliente criado, mas falha ao gerar o prompt. Tente gerar manualmente na aba Prompt.");
      }

      router.push(`/clients/${client.id}/prompt`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl animate-fade-up">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-1">Novo cliente</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">
        Preencha os dados da clínica ou faça upload do CSV de onboarding para pré-preencher o formulário.
      </p>

      {/* Upload CSV */}
      <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg p-5 mb-8">
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">
          Importar formulário de onboarding (opcional)
        </p>
        <label className="flex items-center gap-3 cursor-pointer group">
          <span className="bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] border border-[var(--surface-border)] text-[var(--text-secondary)] text-xs px-3 py-1.5 rounded transition-colors">
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
            <summary className="text-xs text-[var(--text-disabled)] cursor-pointer hover:text-[var(--text-muted)]">
              {Object.keys(csvUnmapped).length} coluna(s) não mapeada(s) — clique para ver
            </summary>
            <div className="mt-2 space-y-1">
              {Object.entries(csvUnmapped).map(([k, v]) => (
                <p key={k} className="text-xs text-[var(--text-disabled)]">
                  <span className="text-[var(--text-muted)]">{k}:</span> {v}
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
            <Field label="Tipo de procedimento majoritário">
              <input
                {...register("procedureType")}
                list="procedure-types"
                placeholder="Ex: Ortodontia, Implantes, Estética..."
                className={input()}
              />
              <datalist id="procedure-types">
                <option value="Ortodontia" />
                <option value="Implantes e Protocolo" />
                <option value="Estética" />
                <option value="Clínica Geral" />
                <option value="Endodontia" />
                <option value="Periodontia" />
                <option value="Odonto Pediátrica" />
              </datalist>
            </Field>
            <Field label="Posicionamento da clínica">
              <input
                {...register("clinicPositioning")}
                list="positioning-options"
                placeholder="Ex: Popular, Boutique, Premium..."
                className={input()}
              />
              <datalist id="positioning-options">
                <option value="Popular" />
                <option value="Intermediária" />
                <option value="Premium" />
                <option value="Boutique" />
                <option value="Corporativa" />
              </datalist>
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
            <Field label="Certificações, prêmios e diferenciais dos profissionais">
              <input
                {...register("certifications")}
                placeholder="Ex: Sim, especialidades — Dr. João certificado pela USP"
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
            <Field label="Como funciona a Primeira Consulta / Avaliação?">
              <textarea
                {...register("consultationInfo")}
                rows={2}
                placeholder="Ex: Avaliação completa de cortesia, passamos orçamento personalizado"
                className={input()}
              />
            </Field>
            <Field label="Dados obrigatórios para agendar (o que Sofia deve coletar)">
              <textarea
                {...register("schedulingRequirements")}
                rows={2}
                placeholder="Ex: Nome completo, Telefone com DDD, CPF, Data de nascimento"
                className={input()}
              />
            </Field>
            <Field label="Informações que Sofia SEMPRE deve mencionar">
              <textarea
                {...register("mandatoryPhrases")}
                rows={3}
                placeholder="Ex: Sempre mostrar opções de pagamento&#10;Sempre confirmar data do especialista"
                className={input()}
              />
            </Field>
            <Field label="Restrições (o que Sofia NUNCA pode fazer ou dizer)">
              <textarea
                {...register("restrictions")}
                rows={3}
                placeholder="Ex: Nunca prometer resultado em tempo específico"
                className={input()}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Atende urgência odontológica?">
                <select {...register("urgencyHandling")} className={input()}>
                  <option value="">Selecione...</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </Field>
              <Field label="Como Sofia deve proceder em urgência">
                <input
                  {...register("urgencyProcedure")}
                  placeholder="Ex: Sofia passa o telefone para ligar"
                  className={input()}
                />
              </Field>
            </div>
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
            className="press bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-medium text-sm px-6 py-2.5 rounded-md transition-colors"
          >
            {saving ? "Criando e gerando prompt..." : "Salvar e gerar prompt →"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm px-4 py-2.5 transition-colors"
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
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-disabled)] mb-4 pb-2 border-b border-[var(--surface-border)]">
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
      <label className="block text-xs text-[var(--text-muted)] mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function input() {
  return "w-full bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-md px-3 py-2 placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors resize-none";
}
