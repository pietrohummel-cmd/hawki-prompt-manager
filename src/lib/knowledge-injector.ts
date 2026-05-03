/**
 * Busca e formata conhecimento para injeção no momento de geração de prompt.
 *
 * Camada 1 — SpecialtyKnowledge (cross-tenant): padrões validados por categoria
 * Camada 2 — ClientSpecificInsight: tom, objeções e posicionamento específicos da clínica
 *
 * Os dois blocos são injetados consecutivamente antes das instruções de geração —
 * Sonnet os incorpora ao escrever TONE_AND_STYLE, OBJECTION_HANDLING e FEW_SHOT_EXAMPLES.
 */

import { prisma } from "@/lib/prisma";
import { CATEGORY_LABELS, MAX_INSIGHTS_PER_INJECTION } from "@/lib/intelligence-constants";
import type { ServiceCategory } from "@/generated/prisma";

// ─── Camada 1: cross-tenant ───────────────────────────────────────────────────

/**
 * Retorna uma seção de texto com os insights ativos para as categorias do cliente.
 * Retorna string vazia se não houver insights ou categorias.
 */
export async function fetchRelevantKnowledge(
  categories: ServiceCategory[]
): Promise<string> {
  if (!categories.length) return "";

  const insights = await prisma.specialtyKnowledge.findMany({
    where: {
      category: { in: categories },
      status: "ACTIVE",
    },
    orderBy: [
      { sourceCount: "desc" },
      { createdAt: "desc" },
    ],
    take: categories.length * MAX_INSIGHTS_PER_INJECTION,
  });

  if (!insights.length) return "";

  // Agrupa por categoria para leitura mais clara no prompt de geração
  const byCategory = new Map<ServiceCategory, typeof insights>();
  for (const insight of insights) {
    const list = byCategory.get(insight.category) ?? [];
    list.push(insight);
    byCategory.set(insight.category, list);
  }

  const sections: string[] = [];

  for (const [category, items] of byCategory.entries()) {
    const label = CATEGORY_LABELS[category];
    const bullets = items.map((i) => {
      const lines = [`• ${i.insight}`];
      if (i.examplePhrase && i.exampleResponse) {
        lines.push(`  Paciente: "${i.examplePhrase}"`);
        lines.push(`  Resposta modelo: "${i.exampleResponse}"`);
      }
      return lines.join("\n");
    });

    sections.push(
      `[HAWKI INTELLIGENCE — Padrões reais de sucesso em ${label} (${items.length} insight${items.length !== 1 ? "s" : ""})]\n${bullets.join("\n")}`
    );
  }

  return sections.join("\n\n");
}

// ─── Camada 2: per-clinic ─────────────────────────────────────────────────────

/**
 * Retorna insights ACTIVE específicos da clínica para as categorias solicitadas.
 * Inclui insights globais da clínica (category = null) em todas as chamadas.
 */
export async function fetchClientSpecificKnowledge(
  clientId: string,
  categories: ServiceCategory[]
): Promise<string> {
  const insights = await prisma.clientSpecificInsight.findMany({
    where: {
      clientId,
      status: "ACTIVE",
      OR: [
        { category: null },
        ...(categories.length ? [{ category: { in: categories } }] : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: 10, // limite razoável por clínica
  });

  if (!insights.length) return "";

  const bullets = insights.map((i) => {
    const lines = [`• ${i.insight}`];
    if (i.example) {
      lines.push(`  ${i.example}`);
    }
    return lines.join("\n");
  });

  return `[TOM E POSICIONAMENTO DESTA CLÍNICA — ${insights.length} insight${insights.length !== 1 ? "s" : ""} específico${insights.length !== 1 ? "s" : ""}]\n${bullets.join("\n")}`;
}

// ─── Formatação do bloco combinado ────────────────────────────────────────────

/**
 * Formata o bloco combinado (cross-tenant + per-clinic) para inserção no prompt.
 * Retorna string vazia se não houver nenhuma camada preenchida.
 */
export function formatKnowledgeBlock(
  crossTenantText: string,
  clientSpecificText?: string
): string {
  const parts: string[] = [];
  if (crossTenantText.trim()) parts.push(crossTenantText.trim());
  if (clientSpecificText?.trim()) parts.push(clientSpecificText.trim());

  if (!parts.length) return "";

  return `\nINSIGHTS DE CONVERSAS REAIS (incorporar em TONE_AND_STYLE, OBJECTION_HANDLING e FEW_SHOT_EXAMPLES):
Estes padrões foram extraídos de conversas que realmente converteram pacientes.
Use-os para tornar os módulos de tom, objeção e exemplos mais próximos da realidade desta clínica.

${parts.join("\n\n")}
`;
}
