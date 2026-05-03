# Plano de Execução — Inteligência Hawki

Dados proprietários de conversas bem-sucedidas da Sofia como vantagem competitiva cross-tenant.

## Arquitetura Central

- `SuccessfulInteraction` — conversas anonimizadas, **sem clientId** (cross-tenant)
- `SpecialtyKnowledge` — insights destilados por `ServiceCategory`, **sem clientId**
- Injeção no momento de **geração do prompt** (não no runtime da Sofia)
- Chave de segmentação: `ServiceCategory` APENAS — este é o moat

```
Conversa real (Clínica A)
  → anonimização + scoring
  → curadoria humana (APPROVED)
  → destilação por LLM
  → SpecialtyKnowledge(category=IMPLANTES)
  → injetado na geração do prompt da Clínica D
```

## Status dos Slices

### ✅ Pré-trabalho (concluído)
- Enums: `ServiceCategory`, `InteractionStatus`, `KnowledgeStatus`
- Tabelas: `SuccessfulInteraction`, `SpecialtyKnowledge`
- Campo `serviceCategories` no `Client`
- `db push` + `prisma generate` executados

### ✅ Slice 1 — Upload & Curadoria (concluído)
**Arquivos criados:**
- `src/lib/intelligence-constants.ts` — CATEGORY_LABELS, INTELLIGENCE_ADMIN_EMAILS
- `src/lib/transcript-parser.ts` — anonymizeTranscript(), inferOutcome()
- `src/app/api/intelligence/interactions/route.ts` — GET (lista) + POST (upload)
- `src/app/api/intelligence/interactions/[id]/route.ts` — PATCH (aprovar/rejeitar)
- `src/app/(app)/inteligencia/page.tsx` — UI completa com upload + curadoria
- Sidebar atualizado com item "Inteligência" (ícone Sparkles)

**Acesso restrito:** `INTELLIGENCE_ADMIN_EMAILS` (env var, default `contato@hawki.com.br`)

---

### ✅ Slice 2 — Scoring automático + Destilação de SpecialtyKnowledge
**Objetivo:** Transformar interações APPROVED em insights acionáveis

**Arquivos a criar:**
- `src/lib/interaction-scorer.ts`
  - `scoreInteraction(transcript, category)` → `{ scoreQuality, scoreTone, scoreObjection }`
  - Usa claude-haiku, persiste os scores na `SuccessfulInteraction`
- `src/lib/knowledge-distiller.ts`
  - `distillKnowledge(category)` → cria/atualiza registros em `SpecialtyKnowledge`
  - Agrupa por category, pega as top-N aprovadas com maior score
  - Cria até 5 insights por categoria via Sonnet
  - Atualiza `sourceCount`
- `src/app/api/intelligence/score/route.ts`
  - `POST` — faz scoring de uma interação específica
- `src/app/api/intelligence/distill/route.ts`
  - `POST { category }` — destila knowledge para uma categoria

**Trigger sugerido:** Manual via botão na UI de curadoria (ou cron futuro)

---

### ✅ Slice 3 — Injeção na Geração de Prompt
**Objetivo:** `generateClientPrompt()` busca e injeta insights relevantes ao gerar

**Arquivos a modificar:**
- `src/lib/generate-prompt.ts`
  - Nova função `fetchRelevantKnowledge(categories: ServiceCategory[])` — busca top ACTIVE insights
  - Injeta como seção `###MÓDULO:SPECIALTY_INSIGHTS###` ou diretamente em `OBJECTION_HANDLING` e `FEW_SHOT_EXAMPLES`
  - Adiciona `ModuleKey.SPECIALTY_INSIGHTS` no schema (opcional — pode ser injeção inline)

**Onde injetar no prompt:**
```
###MÓDULO:FEW_SHOT_EXAMPLES###
[exemplos gerados normalmente]

[INSIGHTS DE IMPLANTES — Hawki Intelligence]
Padrão identificado em conversas reais: "Pacientes com objeção de preço respondem 
melhor quando Sofia apresenta o custo por mês do que o total."
Exemplo: "Um implante de R$4.500 divide em 36x = R$125/mês — menos que um plano dental."
```

---

### ✅ Slice 4 — Painel de SpecialtyKnowledge (Admin)
**Objetivo:** Visualizar, editar e aprovar insights destilados

**Arquivos a criar:**
- `src/app/api/intelligence/knowledge/route.ts` — CRUD de SpecialtyKnowledge
- `src/app/(app)/inteligencia/conhecimento/page.tsx` — lista de insights por categoria
  - Cards com insight + exemplo + status
  - Botões: Ativar / Arquivar / Editar
  - Filtro por categoria

---

### ✅ Slice 5 — Upload via CSV/WhatsApp Export
**Objetivo:** Upload em lote de múltiplas conversas de uma vez

**Arquivos a criar:**
- `src/lib/whatsapp-parser.ts` — parser do formato de exportação do WhatsApp
  - `parseWhatsAppExport(raw)` → array de conversas separadas por data
  - Detecta automaticamente turnos `[DATA] REMETENTE: mensagem`
- `src/app/api/intelligence/bulk-upload/route.ts`
  - Recebe arquivo de texto, divide em conversas, anonimiza, cria múltiplas interações
- UI na página de Inteligência: tab "Upload em lote" ao lado de "Transcrição manual"

---

## Variáveis de Ambiente Necessárias

```bash
# .env.local (adicionar)
INTELLIGENCE_ADMIN_EMAILS="contato@hawki.com.br"  # separado por vírgula para múltiplos
```

## Regras Arquiteturais

1. **Nunca armazenar clientId em SuccessfulInteraction ou SpecialtyKnowledge** — estes dados são cross-tenant
2. **Anonimizar ANTES de armazenar** — `anonymizeTranscript()` sempre é chamada no POST
3. **Curadoria humana obrigatória** — insights só chegam em ACTIVE após aprovação manual
4. **Scoring é sinal, não filtro** — conversas com score baixo ficam no DB, mas são priorizadas por último na destilação
5. **MAX_INSIGHTS_PER_INJECTION = 5** — não sobrecarregar o prompt da Sofia
