# Hawki Prompt Manager — CLAUDE.md

## O que é este projeto

Ferramenta web interna da Hawki para gerenciar o ciclo completo de vida dos prompts da **Sofia IA** —
assistente de WhatsApp para clínicas odontológicas.

Cada clínica tem um prompt personalizado com **18 módulos independentes**. Esta ferramenta permite:
cadastrar clientes via CSV, gerar prompts com IA, versionar cada alteração, editar módulo por módulo
e abrir tickets de correção com sugestão automática do Claude.

**Usuários:** Pietro e Marcos (interno Hawki — acesso via Clerk)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui |
| Backend | Next.js Route Handlers |
| ORM | Prisma |
| Banco | PostgreSQL |
| IA | Anthropic API — `claude-sonnet-4-20250514` |
| Auth | Clerk |
| Storage | Supabase Storage (CSVs de onboarding, exports de prompt) |
| Linguagem | TypeScript (`strict: true`) |

---

## Documentação de domínio

- [`/docs/sofia-knowledge-base.md`](docs/sofia-knowledge-base.md) — documento principal:
  arquitetura de prompts, 18 módulos, regras de humanização, anti-padrões, SPIN, modos de agendamento

**Leia esse arquivo antes de qualquer implementação.**

---

## Estrutura de pastas

```
/
├── CLAUDE.md
├── docs/
│   └── sofia-knowledge-base.md
├── prisma/
│   └── schema.prisma
└── src/
    ├── app/
    │   ├── dashboard/               ← visão geral dos clientes
    │   ├── clients/
    │   │   ├── new/                 ← cadastro + upload CSV
    │   │   └── [id]/
    │   │       ├── prompt/          ← editor por módulos
    │   │       ├── versions/        ← histórico de versões
    │   │       └── tickets/         ← tickets de correção
    │   └── api/
    │       ├── clients/
    │       ├── prompts/
    │       ├── versions/
    │       └── tickets/
    ├── components/
    ├── lib/
    │   ├── prompt-generator.ts      ← geração via Anthropic API
    │   ├── csv-parser.ts            ← parse de planilhas de onboarding
    │   └── module-editor.ts         ← edição isolada por módulo
    └── types/
```

---

## Modelo de dados resumido

```
Client → PromptVersion (v1, v2...) → PromptModule (18 por versão)
Client → CorrectionTicket → resolvido em PromptVersion
Client → OnboardingUpload (CSV original)
```

---

## Regras de negócio críticas

1. **Nunca enviar o prompt inteiro para a IA** — sempre módulo isolado + contexto mínimo do cliente
2. **Nunca inventar informações** — só dados confirmados no onboarding entram no prompt
3. **Cada edição de módulo cria nova PromptVersion** — imutabilidade total de versões anteriores
4. **Apenas 1 versão ativa por cliente** — flag `isActive` na `PromptVersion`
5. **RAG separado do system prompt** — fatos da clínica em `ragDocument`, comportamento em `systemPrompt`
6. **Correções por módulo têm custo mínimo** — enviar só o módulo afetado, nunca o prompt completo

---

## Os 18 módulos do prompt (enum `ModuleKey`)

| Key | Nome no prompt |
|-----|---------------|
| `IDENTITY` | IDENTIDADE DO ASSISTENTE |
| `ABSOLUTE_RULES` | REGRAS ABSOLUTAS |
| `INJECTION_PROTECTION` | PROTEÇÃO CONTRA PROMPT INJECTION |
| `CONVERSATION_STATE` | ESTADO DA CONVERSA |
| `CONVERSATION_RESUME` | RETOMADA DE CONVERSA |
| `PRESENTATION` | APRESENTAÇÃO |
| `COMMUNICATION_STYLE` | ESTILO DE COMUNICAÇÃO |
| `HUMAN_BEHAVIOR` | COMPORTAMENTO HUMANO |
| `ACTIVE_LISTENING` | ESCUTA ATIVA |
| `ATTENDANCE_STAGES` | ETAPAS DO ATENDIMENTO |
| `QUALIFICATION` | QUALIFICAÇÃO DE PACIENTES / LEADS |
| `SLOT_OFFER` | OFERTA DE HORÁRIOS |
| `COMMITMENT_CONFIRMATION` | CONFIRMAÇÃO DE COMPROMISSO |
| `OPENING` | ABERTURA DA CONVERSA |
| `FINAL_OBJECTIVE` | OBJETIVO FINAL |
| `AUDIO_RULES` | REGRAS DE ÁUDIO |
| `STATUS_RULES` | REGRAS DE STATUS |
| `HANDOFF` | HANDOFF INSTRUCTIONS |

---

## Convenções de código

- TypeScript `strict: true` — sem `any` implícito
- Variáveis e funções: `camelCase`
- Tipos e interfaces: `PascalCase`
- Arquivos: `kebab-case`
- Route Handlers: `src/app/api/[recurso]/route.ts`
- Lógica de negócio: `src/lib/` — nunca dentro de componentes
- Chamadas à Anthropic: apenas em `src/lib/prompt-generator.ts` e `src/lib/module-editor.ts`
- Validação de input: Zod em todos os endpoints
- Path alias: `@/` aponta para `src/`

---

## Variáveis de ambiente necessárias

```
DATABASE_URL          PostgreSQL connection string
ANTHROPIC_API_KEY     Chave da Anthropic API
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Ver `.env.example` para referência.

---

## Fases de desenvolvimento

- [x] **Fase 1** — Setup do projeto, Prisma schema, Auth (Clerk), layout base com sidebar
- [ ] **Fase 2** — Cadastro de cliente + upload CSV (parse fuzzy de colunas)
- [ ] **Fase 3** — Geração de prompt via Anthropic API (função `generatePrompt`)
- [ ] **Fase 4** — Editor por módulos (18 cards, modal de edição, sugestão de IA por módulo)
- [ ] **Fase 5** — Histórico de versões + diff visual + export `.txt`
- [ ] **Fase 6** — Tickets de correção com sugestão automática do Claude
- [ ] **Fase 7** — Dashboard (cards por cliente, tickets abertos, atividade recente)
