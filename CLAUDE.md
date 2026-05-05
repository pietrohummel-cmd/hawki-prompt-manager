# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Comandos essenciais

```bash
npm run dev          # servidor em localhost:3000 (Next.js com Turbopack)
npx tsc --noEmit     # type-check sem compilar
npx prisma generate  # regenerar client após mudar schema.prisma

# Migrations (usar Session pooler porta 5432, não Transaction pooler 6543)
DATABASE_URL="postgresql://postgres.PROJECT:PASS@aws-1-sa-east-1.pooler.supabase.com:5432/postgres" \
  npx prisma migrate dev --name <descricao>

DATABASE_URL="..." npx prisma migrate deploy   # produção
```

Não há testes automatizados — validação é feita via aba **Regressão** e **Simulação** na UI.

---

## Stack

- **Next.js 16.2.3** (App Router) + TypeScript `strict: true`
- **Prisma 7.7** + PostgreSQL via Supabase (Transaction pooler para runtime, Session pooler para DDL)
- **OpenAI API** — `gpt-4o` para geração, importação/reorganização e correções de prompts. Regra do projeto: prompts que serão executados pela Sofia em produção devem ser gerados/corrigidos com OpenAI para ficarem calibrados ao executor real.
- **Anthropic API** — apenas para fluxos auxiliares especializados que não produzem o prompt final, como extração de campos, identificação/análise, scoring, anonimização NER e destilação.
- **Clerk** — autenticação via `src/proxy.ts` (Next.js 16 usa `proxy.ts`, não `middleware.ts`)
- **Tailwind CSS v4** — design tokens via CSS custom properties (`var(--surface)`, `var(--accent)`, etc.)
- **next-themes** — dark/light/system

---

## Arquitetura de dados

```
Client
  ├── PromptVersion (v1, v2... imutáveis; apenas 1 isActive por cliente)
  │     └── PromptModule × 10 (um por ModuleKey)
  ├── CorrectionTicket (tickets com sugestão e aplicação por IA)
  ├── RegressionCase → RegressionRun (testes automatizados de prompt)
  ├── ConversationSample (conversas reais para calibração)
  ├── Calibration (comparação Sofia vs. humano)
  ├── ClientKnowledgeArticle (KB por cliente, injetada como ragDocument)
  └── LeadOriginTag (aberturas personalizadas por origem do lead)
```

---

## Os 10 módulos do prompt (enum `ModuleKey`)

Ordem canônica em `src/lib/prompt-constants.ts → MODULE_ORDER`:

```
IDENTITY → INJECTION_PROTECTION → TONE_AND_STYLE → OPENING →
ATTENDANCE_FLOW → QUALIFICATION → OBJECTION_HANDLING →
FEW_SHOT_EXAMPLES → AUDIO_AND_HANDOFF → ABSOLUTE_RULES
```

Formato no prompt: `###MÓDULO:KEY###\n[conteúdo]`

Posicionamento crítico: **IDENTITY primeiro** (atenção do modelo), **ABSOLUTE_RULES último** (efeito de recência). Baseado em `hawki.readme.io/docs/prompts-estrutura`.

---

## Fluxo de geração de prompt

1. `POST /api/clients/[id]/generate-prompt` → chama `generateClientPrompt(client)` em `src/lib/generate-prompt.ts`
2. `buildClientContext(client)` monta todos os dados da clínica em texto estruturado
3. `buildSystemPromptForGeneration(client)` injeta contexto + `SOFIA_GUIDELINES_CONDENSED` + instruções por módulo
4. OpenAI (`gpt-4o`, max_tokens 8192) retorna os 10 módulos no formato hash-delimitado
5. `parseModules(text)` extrai com regex → `Partial<Record<ModuleKey, string>>`
6. Salva nova `PromptVersion`, desativa versão anterior, injeta artigos KB como `ragDocument`

## Fluxo de correção por ticket

1. Tickets podem ter `description`, `conversationTranscript`, `affectedModule` e feedback de regeneração.
2. A identificação automática de módulo ainda pode usar modelo auxiliar, mas a correção textual do módulo usa `gpt-4o` em `src/lib/module-editor.ts`.
3. Após a OpenAI escrever a correção, Anthropic/Claude pode atuar como auditor independente (`audit_prompt_correction`): avalia se a correção resolve o problema, tem gatilho + ação + forma, preserva dados e evita regra vaga.
4. Se a auditoria falhar, a crítica volta para a OpenAI gerar a versão final. Anthropic não deve ser autor final do módulo aplicado.
5. O operador pode editar o problema original, ajustar o contexto e informar o output esperado antes de regerar.
6. A correção deve seguir o padrão Hawki: mudança mínima, regra forte com gatilho + ação + forma, sem inventar dados da clínica e sem depender de limites frágeis como "máximo X caracteres" quando o objetivo é comportamento conversacional.
7. A sugestão continua sendo revisão humana: aplicar ticket cria nova versão, mas não há garantia absoluta de obediência sem regressão/simulação.

---

## Regras de negócio críticas

1. **Nunca enviar o prompt inteiro para a IA** — sempre módulo isolado + contexto mínimo (`buildMinimalContext` em `module-editor.ts`)
2. **Versões são imutáveis** — edição de módulo sempre cria nova `PromptVersion`
3. **Apenas 1 versão ativa** — flag `isActive` gerenciada automaticamente ao salvar nova versão
4. **`schedulingMode` controla ferramenta de agendamento** — `DIRECT` invoca API, `HANDOFF` passa para humano, `LINK` envia link. Nunca gerar instrução de tool call para modos que não são DIRECT
5. **Dados obrigatórios para agendar** vêm de `client.schedulingRequirements`, nunca hardcoded
6. **Geração/correção de prompt** deve usar OpenAI. Não voltar `generate-prompt.ts`, `module-editor.ts` ou correções do `correction-pipeline.ts` para Claude sem decisão explícita registrada.

---

## Tabs do cliente (`/clients/[id]/`)

| Tab | Arquivo | Função |
|-----|---------|--------|
| Prompt | `prompt/page.tsx` | Editor modular, geração, importação, sugestão por IA |
| Versões | `versions/page.tsx` | Histórico imutável, diff Myers (lib `diff`), ativar/exportar |
| Tickets | `tickets/page.tsx` | Tickets de correção, sugestão e aplicação por IA |
| Simulação | `simulation/page.tsx` | Chat streaming contra o prompt ativo |
| Conversas | `conversations/page.tsx` | Banco de conversas reais |
| Regressão | `regression/page.tsx` | Casos de teste com critérios + execução automatizada |
| Calibração | `calibration/page.tsx` | Comparação Sofia vs. humano |
| Copiloto | `copilot/page.tsx` | Sugestões de melhoria baseadas em tickets |
| KB | `knowledge/page.tsx` | Base de conhecimento por cliente |
| Origens | `origins/page.tsx` | Aberturas personalizadas por origem do lead |

O `ClientNav` em `src/components/client-nav.tsx` renderiza todas as tabs + botão "Ver prompt completo" com `data-prompt-modal` (usado pelo toast para navegar programaticamente).

---

## Convenções de código

- Validação de input: Zod em todos os endpoints — `affectedModule` usa `z.enum(MODULE_ORDER)`, nunca `z.string()` com cast
- Route Handlers em `src/app/api/` — lógica de negócio em `src/lib/`, nunca em componentes
- Path alias `@/` → `src/`
- Design tokens no CSS: usar `var(--surface)`, `var(--accent)`, `var(--text-primary)` etc. — nunca classes `zinc-*` hardcoded (não funcionam no light mode)
- Toast: `useToast()` de `src/components/toast.tsx` — não usar `alert()`
- Diff de texto: usar `diffLines` da lib `diff` (Myers LCS) — não reescrever algoritmo set-based

---

## Variáveis de ambiente (`/.env.local`)

```
DATABASE_URL                        # Transaction pooler Supabase (porta 6543)
OPENAI_API_KEY                      # geração/correção de prompts
HAWKI_ANTHROPIC_API_KEY             # fluxos auxiliares
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

A senha do banco contém `@` — deve ser URL-encoded como `%40` na connection string.

---

## Arquivos-chave em `src/lib/`

| Arquivo | Responsabilidade |
|---------|-----------------|
| `generate-prompt.ts` | Geração completa, parse de módulos, restructurePromptToModules (importação) |
| `module-editor.ts` | Sugestão/correção de módulo individual via OpenAI, descrições por módulo |
| `prompt-constants.ts` | `MODULE_ORDER`, `MODULE_LABELS` — fonte canônica da ordem dos módulos |
| `sofia-guidelines.ts` | `SOFIA_GUIDELINES_CONDENSED` — injetado em todas as chamadas à IA |
| `usage-logger.ts` | `logUsage()` — registra custo em `ApiUsageLog` a cada chamada de IA |
| `csv-parser.ts` | Parse fuzzy de planilhas de onboarding (.csv/.xlsx) |
| `prisma.ts` | Singleton do Prisma Client com `@prisma/adapter-pg` |

---

## Plano de melhorias pendente

Ver `PROMPT_IMPROVEMENT_PLAN.md` na raiz — inclui adição do módulo `TOOLS`, correção do `restructurePromptToModules` e estratégia de teste com regressão antes de qualquer deploy.
**Dependência externa bloqueante:** confirmar identificadores exatos das ferramentas de agendamento no painel Hawki antes de implementar o módulo TOOLS.
