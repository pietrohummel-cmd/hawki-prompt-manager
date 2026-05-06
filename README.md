# Hawki Prompt Manager

Ferramenta interna da Hawki para gerenciar os prompts da **Sofia IA** — assistente de WhatsApp para clínicas odontológicas.

## Stack

- **Next.js 16.2.3** (App Router) + TypeScript
- **Prisma** ORM + **PostgreSQL** (Supabase)
- **OpenAI API** — `gpt-4o` para geração, importação/reorganização e correções de prompts
- **Anthropic API** — usada apenas em fluxos auxiliares especializados, como extração/análise, scoring, anonimização NER e destilação
- **Clerk** (autenticação)
- **Tailwind CSS** + tema dark/light/sistema

## Funcionalidades

- Cadastro de clientes (clínicas) com onboarding via CSV
- Geração de prompts com 10 módulos via IA
- Editor modular com sugestão de melhorias via OpenAI
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
- `OPENAI_API_KEY` — geração/correção de prompts
- `SOFIA_RUNTIME_MODEL` — modelo esperado da Sofia em produção, usado como padrão na simulação
- `HAWKI_ANTHROPIC_API_KEY` — fluxos auxiliares que ainda usam Anthropic
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

O prompt de cada cliente é dividido em 10 módulos (`###MÓDULO:KEY###`):

`IDENTITY` · `INJECTION_PROTECTION` · `TONE_AND_STYLE` · `OPENING` · `ATTENDANCE_FLOW` · `QUALIFICATION` · `OBJECTION_HANDLING` · `FEW_SHOT_EXAMPLES` · `AUDIO_AND_HANDOFF` · `ABSOLUTE_RULES`

## Modelos de IA utilizados

| Operação | Modelo | Motivo |
|---|---|---|
| Gerar prompt completo | `gpt-4o` | Mesmo stack que processa o prompt na Sofia em produção |
| Sugerir módulo / ticket | `gpt-4o` | Correções calibradas para o executor real do prompt |
| Importar/reorganizar prompt | `gpt-4o` | Mantém módulos atuais e linguagem compatível com Sofia |
| Simulação local | `SOFIA_RUNTIME_MODEL` ou `HAWKI_SIMULATION_MODEL` | Evita falsa confiança simulando com modelo diferente do runtime |
| Extração/análise/scoring auxiliares | Claude Sonnet/Haiku | Tarefas de leitura, NER, scoring ou destilação que não geram o prompt final |
