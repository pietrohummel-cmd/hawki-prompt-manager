/**
 * Busca e formata SpecialtyKnowledge ACTIVE para injeção no momento de geração de prompt.
 *
 * Os insights são injetados como contexto extra na instrução de geração —
 * Sonnet os incorpora ao escrever OBJECTION_HANDLING e FEW_SHOT_EXAMPLES.
 * Não é um módulo separado: não aumenta o tamanho do prompt em produção.
 */

import { prisma } from "@/lib/prisma";
import { CATEGORY_LABELS, MAX_INSIGHTS_PER_INJECTION } from "@/lib/intelligence-constants";
import type { ServiceCategory } from "@/generated/prisma";

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

/**
 * Formata o bloco de knowledge para inserção no prompt de geração.
 * Retorna string vazia se não houver knowledge — o prompt segue sem alteração.
 */
export function formatKnowledgeBlock(knowledgeText: string): string {
  if (!knowledgeText.trim()) return "";
  return `\nINSIGHTS DE CONVERSAS REAIS (incorporar em OBJECTION_HANDLING e FEW_SHOT_EXAMPLES):
Estes padrões foram extraídos de conversas que realmente converteram pacientes.
Use-os para tornar os módulos de objeção e exemplos mais próximos da realidade.

${knowledgeText}
`;
}
