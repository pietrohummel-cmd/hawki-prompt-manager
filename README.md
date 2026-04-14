# Hawki Prompt Manager

Ferramenta interna da Hawki para gerenciar os prompts da **Sofia IA** — assistente de WhatsApp para clínicas odontológicas.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Prisma** ORM + **PostgreSQL** (Supabase)
- **Anthropic API** — Sonnet 4.6 (geração) + Haiku 4.5 (sugestões)
- **Clerk** (autenticação)
- **Tailwind CSS** + tema dark/light/sistema

## Funcionalidades

- Cadastro de clientes (clínicas) com onboarding via CSV
- Geração de prompts com 18 módulos via IA
- Editor modular com sugestão de melhorias via Haiku
- Histórico de versões imutável com diff módulo a módulo
- Sistema de tickets de correção com sugestão e aplicação por IA
- Importação de prompts em qualquer formato (XML, texto livre) com reorganização automática
- Dashboard com custo de tokens por cliente e economia estimada
- Knowledge Base interna (boas práticas, pesquisa de mercado)
- Templates universais de prompt versionados

## Setup

### 1. Clonar e instalar dependências

```bash
git clone https://github.com/pietrohummel-cmd/hawki-prompt-manager.git
cd hawki-prompt-manager
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha o `.env.local` com as credenciais (peça ao Pietro):
- `DATABASE_URL` — Supabase PostgreSQL
- `ANTHROPIC_API_KEY` — console.anthropic.com
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` — dashboard.clerk.com
- `NEXT_PUBLIC_SUPABASE_URL` + chaves Supabase

### 3. Gerar o Prisma Client

```bash
npx prisma generate
```

> O banco já está na nuvem (Supabase). Não é necessário rodar migrations — elas já foram aplicadas.

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Estrutura de módulos do prompt

O prompt de cada cliente é dividido em 18 módulos (`###MÓDULO:KEY###`):

`IDENTITY` · `ABSOLUTE_RULES` · `INJECTION_PROTECTION` · `CONVERSATION_STATE` · `CONVERSATION_RESUME` · `PRESENTATION` · `COMMUNICATION_STYLE` · `HUMAN_BEHAVIOR` · `ACTIVE_LISTENING` · `ATTENDANCE_STAGES` · `QUALIFICATION` · `SLOT_OFFER` · `COMMITMENT_CONFIRMATION` · `OPENING` · `FINAL_OBJECTIVE` · `AUDIO_RULES` · `STATUS_RULES` · `HANDOFF`

## Modelos de IA utilizados

| Operação | Modelo | Motivo |
|---|---|---|
| Gerar prompt completo | `claude-sonnet-4-6` | Geração criativa de alta qualidade |
| Sugerir módulo / ticket | `claude-haiku-4-5-20251001` | Classificação focada, ~25x mais barato |
| Importar/reorganizar prompt | `claude-haiku-4-5-20251001` | Reorganização (não geração) |
