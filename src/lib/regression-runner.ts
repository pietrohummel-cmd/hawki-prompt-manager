import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { MODULE_ORDER } from "@/lib/prompt-constants";
import type { ModuleKey, RegressionCase, RegressionRun, PromptVersion, PromptModule } from "@/generated/prisma";

type RegressionCaseWithExpected = RegressionCase & {
  criteria: string[];
  expectedResponse?: string | null;
};

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.HAWKI_ANTHROPIC_API_KEY });
}

type ActiveVersion = PromptVersion & { modules: PromptModule[] };

export type RegressionEvalResult = {
  response: string;
  results: { criterion: string; passed: boolean }[];
  status: "PASSED" | "FAILED";
};

/**
 * Executa o caso de regressão contra uma versão e retorna o resultado SEM persistir.
 * Use isso para validações de draft/pipeline que não devem aparecer no histórico canônico.
 */
export async function evaluateRegressionCase(
  regressionCase: RegressionCaseWithExpected,
  version: ActiveVersion
): Promise<RegressionEvalResult> {
  const systemPrompt = MODULE_ORDER
    .filter((key) => version.modules.some((m) => m.moduleKey === key))
    .map((key) => {
      const mod = version.modules.find((m) => m.moduleKey === (key as ModuleKey))!;
      return `###MÓDULO:${mod.moduleKey}###\n${mod.content}`;
    })
    .join("\n\n");

  const sofiaResponse = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: regressionCase.input }],
  });

  const responseText = sofiaResponse.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const criteriaList = regressionCase.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n");

  const expectedBlock = regressionCase.expectedResponse
    ? `\nResposta ideal esperada (use como referência de tom, estrutura e conteúdo):\n${regressionCase.expectedResponse}\n`
    : "";

  const evalPrompt = `Você avalia se uma resposta de assistente de IA satisfaz critérios de qualidade.

Mensagem do paciente: ${regressionCase.input}
${expectedBlock}
Resposta da assistente: ${responseText}

Para cada critério abaixo, responda APENAS com "PASSOU" ou "FALHOU" — uma resposta por linha, sem texto adicional:
${criteriaList}`;

  const evalResponse = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: evalPrompt }],
  });

  const evalText = evalResponse.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  const evalLines = evalText.split("\n").map((l) => l.trim()).filter(Boolean);

  const results = regressionCase.criteria.map((criterion, i) => {
    const line = evalLines[i] ?? "";
    const passed = /PASSOU/i.test(line) ? true : /FALHOU/i.test(line) ? false : null;
    return { criterion, passed: passed ?? false };
  });

  const allPassed = results.every((r) => r.passed === true);
  return { response: responseText, results, status: allPassed ? "PASSED" : "FAILED" };
}

/**
 * Executa o caso de regressão e PERSISTE o resultado no histórico canônico.
 * Use apenas para runs contra a versão ativa em produção.
 */
export async function runRegressionCase(
  regressionCase: RegressionCaseWithExpected,
  activeVersion: ActiveVersion
): Promise<RegressionRun> {
  const { response, results, status } = await evaluateRegressionCase(regressionCase, activeVersion);

  return prisma.regressionRun.create({
    data: {
      caseId: regressionCase.id,
      response,
      results,
      status,
    },
  });
}
