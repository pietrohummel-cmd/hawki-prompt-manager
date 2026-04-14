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
| IA | Anthropic API — `claude-sonnet-4-6` |
| Auth | Clerk |
| Storage | Supabase Storage (CSVs de onboarding, exports de prompt) |
| Linguagem | TypeScript (`strict: true`) |

---

## Documentação de domínio

- [`/docs/sofia-knowledge-base.md`](docs/sofia-knowledge-base.md) — documento principal:
  arquitetura de prompts, 18 módulos, regras de humanização, anti-padrões, SPIN, modos de agendamento

**Leia esse arquivo antes de qualquer implementação.**

---

## Estrutura de pastas (estado atual)

```
/
├── CLAUDE.md
├── docs/
│   └── sofia-knowledge-base.md
├── prisma/
│   └── schema.prisma
└── src/
    ├── app/
    │   ├── (app)/                         ← grupo de rota (layout com sidebar)
    │   │   ├── layout.tsx
    │   │   ├── dashboard/
    │   │   │   └── page.tsx
    │   │   └── clients/
    │   │       ├── page.tsx               ← listagem de clientes
    │   │       ├── new/
    │   │       │   └── page.tsx           ← cadastro + upload CSV
    │   │       └── [id]/
    │   │           └── prompt/
    │   │               └── page.tsx       ← visualização/geração de prompt por módulos
    │   ├── api/
    │   │   └── clients/
    │   │       ├── route.ts               ← GET (listar) + POST (criar cliente)
    │   │       └── [id]/
    │   │           ├── route.ts           ← GET (buscar cliente com promptVersions)
    │   │           └── generate-prompt/
    │   │               └── route.ts       ← POST (gerar prompt via Anthropic)
    │   ├── sign-in/ e sign-up/            ← páginas Clerk
    │   ├── layout.tsx
    │   └── page.tsx                       ← redirect para /clients
    ├── components/
    │   ├── sidebar.tsx
    │   └── ui/button.tsx
    ├── lib/
    │   ├── generate-prompt.ts             ← geração via Anthropic API (função principal)
    │   ├── prompt-constants.ts            ← MODULE_LABELS e MODULE_ORDER
    │   ├── csv-parser.ts                  ← parse de planilhas de onboarding
    │   ├── prisma.ts                      ← instância singleton do Prisma Client
    │   └── utils.ts
    ├── generated/prisma/                  ← client Prisma gerado
    ├── types/index.ts
    └── proxy.ts
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

| Key | Label (`MODULE_LABELS`) |
|-----|------------------------|
| `IDENTITY` | Identidade |
| `ABSOLUTE_RULES` | Regras Absolutas |
| `INJECTION_PROTECTION` | Proteção contra Injeção de Prompt |
| `CONVERSATION_STATE` | Estado da Conversa |
| `CONVERSATION_RESUME` | Retomada de Conversa |
| `PRESENTATION` | Apresentação |
| `COMMUNICATION_STYLE` | Estilo de Comunicação |
| `HUMAN_BEHAVIOR` | Comportamento Humano |
| `ACTIVE_LISTENING` | Escuta Ativa |
| `ATTENDANCE_STAGES` | Etapas do Atendimento |
| `QUALIFICATION` | Qualificação (SPIN) |
| `SLOT_OFFER` | Oferta de Horário |
| `COMMITMENT_CONFIRMATION` | Confirmação de Compromisso |
| `OPENING` | Abertura |
| `FINAL_OBJECTIVE` | Objetivo Final |
| `AUDIO_RULES` | Regras para Áudio |
| `STATUS_RULES` | Regras de Status |
| `HANDOFF` | Passagem para Humano |

A ordem canônica está em `MODULE_ORDER` em `src/lib/prompt-constants.ts`.
O formato no prompt é `###MÓDULO:KEY###\n[conteúdo]`.

---

## Fluxo de geração de prompt

1. `POST /api/clients/[id]/generate-prompt` chama `generateClientPrompt(client)` em `src/lib/generate-prompt.ts`
2. Constrói contexto da clínica (`buildClientContext`) e system prompt (`buildSystemPromptForGeneration`)
3. Envia para Anthropic (`claude-sonnet-4-6`, max_tokens: 8192) pedindo os 18 módulos no formato hash-delimitado
4. Faz parse com regex em `parseModules(text)` → `Partial<Record<ModuleKey, string>>`
5. Salva nova `PromptVersion` com os módulos, desativa versão anterior, atualiza `client.status = ACTIVE`
6. Retorna a versão criada com `include: { modules: true }`

---

## Convenções de código

- TypeScript `strict: true` — sem `any` implícito
- Variáveis e funções: `camelCase`
- Tipos e interfaces: `PascalCase`
- Arquivos: `kebab-case`
- Route Handlers: `src/app/api/[recurso]/route.ts`
- Lógica de negócio: `src/lib/` — nunca dentro de componentes
- Chamadas à Anthropic: apenas em `src/lib/generate-prompt.ts`
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

---

## Status de implementação (atualizado 2026-04-14)

- [x] **Fase 1** — Setup do projeto, Prisma schema, Auth (Clerk), layout base com sidebar
- [x] **Fase 2** — Cadastro de cliente + upload CSV (parse fuzzy de colunas via `csv-parser.ts`)
- [x] **Fase 3** — Geração de prompt via Anthropic API (`generate-prompt.ts`, rota `generate-prompt/route.ts`, UI em `prompt/page.tsx` com accordion por módulo + skeleton de loading)
- [ ] **Fase 4** — Editor por módulos (18 cards, modal de edição, sugestão de IA por módulo)
- [ ] **Fase 5** — Histórico de versões + diff visual + export `.txt`
- [ ] **Fase 6** — Tickets de correção com sugestão automática do Claude
- [ ] **Fase 7** — Dashboard (cards por cliente, tickets abertos, atividade recente)

### O que funciona hoje (Fase 3 concluída)
- Listar clientes em `/clients` com status, contagem de versões e tickets
- Criar cliente manualmente ou via upload de CSV/XLSX em `/clients/new`
- Visualizar prompt de um cliente em `/clients/[id]/prompt`
- Gerar/regenerar prompt completo (18 módulos) via botão na UI
- Accordion para expandir/recolher cada módulo individualmente
- Visualização do prompt completo em texto bruto (detalhes ocultos)
- Versões numeradas e apenas 1 ativa por cliente
