import { prisma } from "@/lib/prisma";

// Preços Anthropic (por token). Fonte: https://anthropic.com/pricing
// Atualizar se os preços mudarem.
const PRICING: Record<string, { inputPerToken: number; outputPerToken: number }> = {
  "claude-sonnet-4-6": {
    inputPerToken: 3.0 / 1_000_000,   // $3.00 por milhão de tokens de entrada
    outputPerToken: 15.0 / 1_000_000, // $15.00 por milhão de tokens de saída
  },
  "claude-haiku-4-5-20251001": {
    inputPerToken: 0.80 / 1_000_000,  // $0.80 por milhão de tokens de entrada
    outputPerToken: 4.0 / 1_000_000,  // $4.00 por milhão de tokens de saída
  },
};

// Estimativa de custo de uma geração completa de prompt (usado para calcular economia)
// Baseado em média observada: ~3.500 tokens entrada + ~7.000 tokens saída no Sonnet
export const ESTIMATED_FULL_REGEN_COST_USD =
  3_500 * PRICING["claude-sonnet-4-6"].inputPerToken +
  7_000 * PRICING["claude-sonnet-4-6"].outputPerToken;

export type OperationType =
  | "generate_prompt"
  | "suggest_module"
  | "suggest_ticket"
  | "import_restructure"
  | "identify_module"
  | "generate_kb";

export interface UsageData {
  input_tokens: number;
  output_tokens: number;
}

export function calculateCost(model: string, usage: UsageData): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return pricing.inputPerToken * usage.input_tokens + pricing.outputPerToken * usage.output_tokens;
}

/**
 * Registra o uso de tokens de uma chamada à API da Anthropic.
 * Chamado de forma assíncrona — não bloqueia o fluxo principal em caso de falha.
 */
export async function logUsage(params: {
  clientId?: string;
  operation: OperationType;
  model: string;
  usage: UsageData;
}): Promise<void> {
  const costUsd = calculateCost(params.model, params.usage);
  try {
    await prisma.apiUsageLog.create({
      data: {
        clientId: params.clientId ?? null,
        operation: params.operation,
        model: params.model,
        inputTokens: params.usage.input_tokens,
        outputTokens: params.usage.output_tokens,
        costUsd,
      },
    });
  } catch (err) {
    // Log silencioso — não deve quebrar o fluxo principal
    console.error("[usage-logger] Erro ao registrar uso:", err);
  }
}
