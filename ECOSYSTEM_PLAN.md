# ECOSYSTEM_PLAN.md — Fase 2: Loop Fechado da Inteligência Hawki

> **Status:** planejamento aprovado em 2026-05-02
> **Fase anterior:** [INTELLIGENCE_PLAN.md](./INTELLIGENCE_PLAN.md) (Fase 1 concluída ✅ — corpus cross-tenant + injeção de conhecimento na geração)
> **Esta fase:** transformar o corpus em **loop autônomo de aprendizado** com outcome data, per-clinic personalization e A/B autônomo.

---

## Tese estratégica

A Fase 1 construiu o substrato. A Fase 2 fecha o ciclo:

```
Conversa Sofia → Outcome real (CRM) → Score validado → Insight destilado →
A/B em produção → Promoção autônoma → Próxima conversa Sofia
```

**Sem humano no caminho crítico.** O moat só funciona quando esse ciclo gira sozinho. Enquanto depender de aprovação manual conversa-a-conversa, a vantagem competitiva é teórica.

**Objetivo de negócio:** sair de "ferramenta com dados proprietários rasos" para "sistema autoaperfeiçoante baseado em outcome real" — a única posição defensável segundo a tese JP Morgan sobre vertical AI.

---

## Classificação das ações por dependência

### ✅ Faz agora — sem dependências externas

Tudo isolado dentro do Hawki Prompt Manager. Pode começar amanhã.

- **Slice 0:** Correções dos achados do Codex
- **Slice 1:** Outcome tracking (schema + entrada manual + dashboard de impacto)
- **Slice 2:** Camada per-clinic (segundo nível de conhecimento, por cliente)
- **Slice 3:** A/B variant infrastructure (validação só via regressão local primeiro)

### ⚠️ Precisa Sofia (codebase + endpoints)

Depende de modificar a Sofia em produção.

- **Slice 4:** Webhook Sofia → Hawki para auto-upload de conversas
- **Slice 4:** API de deploy de prompt (Hawki → Sofia)
- **Slice 4:** Telemetria de versão de prompt por conversa
- **Slice 4:** A/B em produção (traffic split por hash de conversa)

### 🔌 Precisa integrações de terceiros

Depende de adapters para sistemas de gestão odontológica.

- **Slice 5:** Adapter Dental Office / Clinicorp / Eaí Doctor
- **Slice 5:** Auto-fill de Outcome via CRM
- **Slice 6:** WhatsApp Business API formal (multimodal — áudio, imagem)

### 🔑 Pendências de credenciais e acessos

| Pendência | Bloqueia | Razão |
|---|---|---|
| API OpenAI configurada para Sofia (produção) | Slice 4 | Hoje Sofia usa Sonnet; produção em escala precisa GPT-4o-mini por custo |
| Acesso ao codebase ou API da Sofia | Slice 4 | Para implementar webhook + consulta de prompt em runtime |
| Webhook URL público estável (deploy Hawki) | Slice 4 | Sofia precisa endpoint fixo para `/api/intelligence/ingest/conversation` |
| Conta dev Dental Office | Slice 5 | CRM #1 do mercado dental BR |
| Conta dev Clinicorp | Slice 5 | CRM #2 do mercado dental BR |
| Conta dev Eaí Doctor | Slice 5 (opcional) | Alternativa para clínicas pequenas |
| Cliente piloto com CRM integrado | Slice 5 | Sem cliente real não dá para validar match heurístico |
| WhatsApp Business API formal | Slice 6 | Multimodal e telefonia dependem |

---

## Slice 0 — Correções imediatas ✅ concluída (2026-05-03)

**Objetivo:** resolver os 3 achados do Codex antes de empilhar mais features. Fundação confiável é pré-requisito.

**Commits:**
- `53fc68e` — Slice 0.1: ativação atômica de lote (KnowledgeBatch)
- `d41ca0a` — Slice 0.2: anonymização body-level via Haiku NER (com cache)
- `825b119` — Slice 0.3: papel do operador explícito no bulk upload

### Tarefas

**0.1 — Ativação atômica de lote**
- Arquivo: `src/app/api/intelligence/knowledge/[id]/route.ts`
- Problema atual: ativar 1 insight arquiva **todos** os outros ACTIVE da mesma categoria. Como `distillKnowledge()` cria lotes de até 5, só o último clicado fica ativo. A injeção multi-insight projetada nunca acontece.
- Solução:
  - Schema: adicionar `batchId String?` em `SpecialtyKnowledge`
  - `distillKnowledge()` cria todos os insights do batch com mesmo `batchId`
  - Endpoint novo: `PATCH /api/intelligence/knowledge/batch/[batchId]/activate` — promove batch inteiro
  - Endpoint individual continua existindo mas só permite editar/arquivar dentro do batch ativo
  - Múltiplos insights ACTIVE por categoria (limitado a 5 pelo `MAX_INSIGHTS_PER_INJECTION`)

**0.2 — Anonymização body-level**
- Arquivo: `src/lib/transcript-parser.ts`
- Problema atual: regex apenas de phone/CPF/email/URL/data. Nomes próprios, clínicas, dentistas, valores e endereços passam direto.
- Solução:
  - Layer 2: chamada ao Haiku com prompt de NER ("identifique nomes próprios, clínicas, valores, endereços e substitua por tokens `[NOME]`, `[CLÍNICA]`, `[VALOR]`, `[ENDEREÇO]`")
  - Custo estimado: ~$0.001 por conversa de 50 turnos
  - Cache por hash de conteúdo para reprocessamento gratuito
  - Flag `ANONYMIZATION_LEVEL` em env: `regex` (atual) | `ner` (novo) | `strict` (regex+NER+revisão humana obrigatória)

**0.3 — Speaker role explícito no upload**
- Arquivos: `src/app/(app)/inteligencia/page.tsx` + `src/lib/whatsapp-parser.ts`
- Problema atual: `anonymizeTranscript()` infere papel via substring (`sofia|atendente|clínica|...`). Atendentes chamados "Mariana" ou "Dra. Ana" são marcados como `[PACIENTE]`, invertendo papéis.
- Solução:
  - Após selecionar arquivo no bulk upload, parser detecta participantes únicos e mostra dropdown
  - Usuário marca explicitamente quem é o operador
  - `parseWhatsAppExport()` recebe `operatorIdentifiers: string[]` e usa para anotar cada turno

### Critério de pronto
- Lote de 10 conversas reais processadas: zero nomes de paciente vazados, zero papéis invertidos.
- Multi-insight ativo: ao destilar IMPLANTES, todos os 5 insights gerados aparecem na injeção do prompt seguinte.

---

## Slice 1 — Outcome tracking ✅ concluída (2026-05-03)

**Commits:**
- `696f3b0` — Slice 1.1: schema ConversationOutcome + endpoints PUT/GET/DELETE + OutcomeModal + badge na lista
- `36b240a` — Slice 1.2: computeRankingScore (score recalibrado por outcome real, ground truth > LLM)
- (próximo)  — Slice 1.3: dashboard /inteligencia/impacto + KPIs globais + funil por categoria


**Objetivo:** conectar conversa a desfecho real. Item de maior impacto defensivo do plano.

### Schema (Prisma)

```prisma
model ConversationOutcome {
  id                String   @id @default(cuid())
  interactionId     String   @unique
  interaction       SuccessfulInteraction @relation(fields: [interactionId], references: [id], onDelete: Cascade)

  // Funil
  scheduledAt       DateTime?
  appointmentDate   DateTime?
  showedUp          Boolean?    // ground truth — apareceu ou faltou
  treatmentClosed   Boolean?    // fechou tratamento depois?
  revenueCents      Int?        // valor real

  source            OutcomeSource
  enteredAt         DateTime    @default(now())
  enteredBy         String?     // userId Clerk

  notes             String?     @db.Text
}

enum OutcomeSource {
  MANUAL              // admin digitou
  CRM_DENTAL_OFFICE
  CRM_CLINICORP
  CRM_EAI_DOCTOR
  API_WEBHOOK         // Sofia ou cliente posta direto
}
```

### Tarefas

1. Schema migration (`db push`)
2. Endpoint `POST /api/intelligence/outcomes` (admin-only, dev-bypass)
3. UI em `/inteligencia/[id]/outcome` — formulário de entrada manual com campos do funil
4. Indicador visual na lista `/inteligencia`: badge mostrando se conversa tem outcome
5. **Score recalibrado:** `interaction-scorer.ts` ganha bônus por outcome positivo (peso 2x se gerou receita real, vs só "agendou")
6. Dashboard novo: `/inteligencia/impacto`
   - Por categoria: receita média atribuída a conversas usando insight X
   - Ranking de insights por correlação com outcome positivo
   - Distribuição de funil: agendou → apareceu → fechou

### Critério de pronto
- 50 outcomes inseridos manualmente
- Dashboard mostra ranking de insights por receita média gerada
- Dois insights da mesma categoria com performance diferente: o de melhor outcome aparece priorizado na injeção

---

## Slice 2 — Camada per-clinic

**Objetivo:** segundo nível de conhecimento que pertence à clínica específica. Cria switching cost real — sair do Sofia significa perder a personalidade acumulada.

### Schema

```prisma
model ClientSpecificInsight {
  id          String   @id @default(cuid())
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  category    ServiceCategory?  // null = aplicável a todas
  text        String   @db.Text
  example     String?  @db.Text
  status      KnowledgeStatus @default(DRAFT)

  // Métricas de impacto
  appearedInConversations Int @default(0)
  attributedRevenueCents  Int @default(0)

  source      ClientInsightSource  // MANUAL | DISTILLED_FROM_OWN_HISTORY
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum ClientInsightSource { MANUAL DISTILLED_FROM_OWN_HISTORY }
```

### Tarefas

1. Schema migration
2. UI `/clients/[id]/knowledge` — gestão de insights da clínica
3. Função `fetchClientSpecificKnowledge(clientId, categories)` em `knowledge-injector.ts`
4. Injeção em **duas camadas** no `generate-prompt.ts`:
   ```
   ## INSIGHTS GERAIS DA CATEGORIA (cross-tenant)
   [...do SpecialtyKnowledge ACTIVE...]

   ## TOM E POSICIONAMENTO DESTA CLÍNICA
   [...do ClientSpecificInsight ACTIVE da clínica...]
   ```
5. Migrações de dados: clínicas existentes começam com lista vazia (sem retroatividade)
6. **Bonus:** botão "Destilar do meu histórico" — quando a clínica tem ≥20 conversas próprias aprovadas, gera insights só dela

### Critério de pronto
- 1 cliente piloto com 5 insights próprios cadastrados
- Sofia gerando prompt que reflete tom específico da clínica (validado em simulação)
- Comparação A→B: prompt com camada per-clinic vs sem mostra diferença qualitativa em outputs de simulação

---

## Slice 3 — A/B variant infrastructure (local-first)

**Objetivo:** validar mudanças de prompt antes de deployar, usando regressão como proxy de produção. Quando Slice 4 acontecer, infra está pronta para produção.

### Schema

```prisma
model PromptVariant {
  id                String   @id @default(cuid())
  clientId          String
  client            Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  baselinePromptId  String?  // versão anterior do prompt (PromptVersion existente)
  variantPrompt     String   @db.Text
  source            VariantSource

  // Resultados de regressão local (Slice 3)
  regressionRunId   String?
  regressionPassed  Int?
  regressionFailed  Int?
  regressionDelta   Float?   // vs baseline, % de melhoria

  // Resultados de produção (Slice 4 — preencher depois)
  productionTrafficPct Int?
  conversationsTested  Int?
  conversionDelta      Float?
  outcomeDelta         Float?

  status            VariantStatus
  createdAt         DateTime @default(now())
  promotedAt        DateTime?
  rolledBackAt      DateTime?
}

enum VariantSource    { INSIGHT_ACTIVATION TICKET_FIX MANUAL DISTILLATION_BATCH }
enum VariantStatus    { PENDING TESTING WON LOST PROMOTED ROLLED_BACK }
```

### Tarefas

1. Schema migration
2. Modificar ativação de insight (Slice 0) para opcionalmente criar variant em vez de promover direto
3. Endpoint `POST /api/clients/[id]/variants/[variantId]/test`: roda regressão completa contra baseline + grava delta
4. UI `/clients/[id]/variants`: lista de variantes com:
   - Delta de regressão visual (verde/vermelho)
   - Source (que insight gerou)
   - Botão "Promover" ou "Descartar"
5. Promoção automática se `regressionDelta > THRESHOLD_AUTO_PROMOTE` (configurável em env, default 5%)
6. Rollback de 1-clique: troca prompt ativo de volta pra `baselinePromptId`

### Critério de pronto
- Ativar 1 insight gera variant automaticamente
- Regressão roda em background (~30s)
- Dashboard mostra delta vs baseline com cor
- Promoção manual ou automática funciona; rollback funciona

---

## Slice 4 — Sofia ↔ Hawki (precisa Sofia)

**Objetivo:** fim do copy-paste manual. Conversas e outcomes fluem nativamente. Loop autônomo real.

### Pré-requisitos externos (resolver antes)

- [ ] Sofia hospedada com endpoint público + capacidade de fazer outbound HTTP
- [ ] API key OpenAI (ou manter Anthropic) configurada na Sofia
- [ ] Definição de stack: Sofia migra para GPT-4o-mini ou continua Sonnet?
- [ ] Acordo de versionamento — Sofia consulta Hawki em runtime ou via push?

### Tarefas

**4a. Auto-upload (Sofia → Hawki):**
1. Endpoint `POST /api/intelligence/ingest/conversation` autenticado por API key da clínica (header `X-Client-Api-Key`)
2. Sofia envia ao final de cada conversa fechada:
   ```json
   {
     "clientId": "client_xyz",
     "transcript": "...",
     "outcomeHint": { "scheduled": true, "patientPhone": "5511..." },
     "promptVersion": "v42",
     "category": "IMPLANTES",
     "timestamp": "2026-05-02T14:30:00Z"
   }
   ```
3. Pipeline automático: anonymização (Slice 0) → score (existente) → entrada como `PENDING_REVIEW`
4. Auto-aprovação: se `scoreQuality > 0.85` E `outcome.scheduled === true`, vai direto para `APPROVED` (sem humano)

**4b. Deploy de prompt (Hawki → Sofia):**
1. Endpoint `GET /api/clients/[id]/prompt/active` autenticado por API key
2. Sofia consulta no início de cada conversa, faz cache local 5min
3. Resposta inclui `promptId` para rastreabilidade:
   ```json
   { "promptId": "v42", "systemPrompt": "...", "modules": [...] }
   ```
4. Sofia inclui `promptId` no payload de `ingest/conversation` (fechamento do loop)

**4c. A/B em produção:**
1. Endpoint `/prompt/active` retorna variant baseado em hash determinístico do `conversationId`:
   ```ts
   const bucket = hash(conversationId) % 100
   const variant = bucket < trafficPct ? newVariant : baseline
   ```
2. Métricas voltam separadas por variant via `ingest/conversation`
3. Hawki promove auto se `outcomeDelta > 5%` em ≥1000 conversas testadas (configurável)
4. Rollback automático se variant produz `regressionDelta < -10%` em janela de 100 conversas

### Critério de pronto
- Sofia em 1 clínica piloto enviando conversas automaticamente
- Prompt sendo consultado em runtime
- 1 variant em A/B com traffic split funcional
- Zero copy-paste manual no fluxo

---

## Slice 5 — Outcome integration externa

**Objetivo:** outcome data sem digitação manual. Loop completamente autônomo.

### Pré-requisitos externos

- [ ] Conta de desenvolvedor em pelo menos 1: Dental Office, Clinicorp, ou Eaí Doctor
- [ ] Documentação de API ou webhook do CRM escolhido
- [ ] Cliente piloto que use o CRM (sem cliente real não há como validar match)

### Tarefas

1. Adapter pattern: `src/lib/crm-adapters/`
   - `dental-office.ts`
   - `clinicorp.ts`
   - `eai-doctor.ts`
   - Interface comum: `fetchAppointments(clientCredentials, since): Promise<RawAppointment[]>`
2. Cron job `cron/outcome-sync.ts` (rodando a cada 6h):
   - Para cada `Client` com `crmIntegration` configurado
   - Busca consultas dos últimos 30 dias
   - Match heurístico: telefone do paciente na conversa anonimizada (hash) → telefone na agenda do CRM
   - Cria `ConversationOutcome` com `source = CRM_*`
3. UI `/clients/[id]/integrations`:
   - Configurar credenciais por cliente (criptografadas em rest)
   - Visualizar última sincronização
   - Forçar sync manual
4. Logs em `OutcomeMatchLog` para debugging:
   ```prisma
   model OutcomeMatchLog {
     id              String   @id @default(cuid())
     interactionId   String?
     crmAppointmentId String
     matchScore      Float    // 0-1, confiança do match
     matchedFields   String[] // ["phone", "name_first_5"]
     createdAt       DateTime @default(now())
   }
   ```

### Critério de pronto
- 80% das conversas do piloto com outcome auto-populado em até 24h
- Match com confiança ≥0.8 promovido sem revisão; <0.8 vai para fila de revisão humana
- Dashboard `/inteligencia/integration-health`: % de match por cliente

---

## Slice 6 — Pós-MVP (não desenvolver agora)

Registrar para não esquecer. Priorizar conforme tração de mercado.

- **Multimodal:** transcrição de áudio WhatsApp via Whisper API (40% das mensagens BR são áudio)
- **Image input:** paciente manda foto de problema dental → triagem inicial automática
- **Reactivation workflows:** Sofia identifica paciente inativo (6+ meses sem contato) e dispara mensagem proativa
- **Recall preventivo:** lembrete automático de limpeza semestral (consulta agenda do CRM)
- **Voz / telefonia:** Sofia atendendo telefone via Twilio + Whisper + TTS
- **Fine-tuning próprio:** quando corpus aprovado passar de 100k conversas, treinar LoRA em Llama 3.1 70B ou Mistral em conversas dental BR
- **Compliance package:** dossiê LGPD + CFO + ANPD vendável como diferencial enterprise para clínicas grandes
- **Marketplace de insights:** clínicas premium acessam tier de insights "destilados das top 10% conversoras do Brasil"

---

## Ordem de execução recomendada

```
Mês 1: Slice 0 (correções, ~1 semana) + Slice 1 (outcome tracking, ~3 semanas)
Mês 2: Slice 2 (per-clinic) + Slice 3 (A/B local)
Mês 3: Slice 4 (Sofia integration) — assumindo que pendências externas foram resolvidas
Mês 4: Slice 5 (CRM integration) — assumindo cliente piloto com CRM
Mês 5+: Slice 6 conforme demanda
```

### Marcos de validação

- **Fim do mês 2:** plataforma autossuficiente, A/B local funcional, outcome data fluindo manualmente, ranking de insights por receita.
- **Fim do mês 3:** 1 cliente piloto com loop fechado parcial (Sofia → Hawki, sem CRM ainda).
- **Fim do mês 4:** 1 cliente com loop completamente fechado, métrica de receita atribuída por insight.
- **Fim do mês 6:** 5 clientes em loop fechado, primeiros sinais de auto-promoção autônoma de variantes.

---

## Critérios de sucesso da Fase 2

A Fase 2 termina quando os seguintes itens são verdadeiros e mensuráveis:

| Métrica | Meta | Como medir |
|---|---|---|
| Outcome data | ≥70% das conversas APPROVED têm outcome real associado | Query: `ConversationOutcome` count / `SuccessfulInteraction` APPROVED count |
| Loop autônomo | ≥50% das mudanças de prompt são auto-promovidas (sem clique humano) | Query: `PromptVariant.status = PROMOTED AND auto-flag` / total promoções |
| Per-clinic | ≥80% dos clientes ativos têm ≥5 insights próprios | Query: `ClientSpecificInsight` count agrupado por client |
| Defensabilidade mensurável | Insights baseados em outcome geram delta de conversão >10% vs baseline em A/B real | `PromptVariant.outcomeDelta` médio para variants com `source=INSIGHT_ACTIVATION` |
| Custo unit | Custo de processar 1 conversa (anonymização + score + match) < R$0,05 | Soma de tokens Anthropic + chamadas externas / total de conversas |

Sem essas métricas, a Fase 2 é só feature work. Com elas, o moat é real e auditável.

---

## Decisões pendentes que afetam o plano

Registrar aqui antes de começar cada slice. Atualizar conforme decisões são tomadas.

- [ ] **Stack do Sofia em produção:** continua Anthropic (Sonnet) ou migra para OpenAI (GPT-4o-mini) para reduzir custo unit? Decisão impacta Slice 4 diretamente.
- [ ] **Modelo de cobrança:** Hawki é cobrado separado da Sofia ou bundled? Afeta como apresentamos as métricas de impacto da inteligência.
- [ ] **Quem cura conversas em escala:** equipe Hawki centralizada ou clínica revisa as próprias? Afeta UX da Slice 1.
- [ ] **Threshold de auto-aprovação:** começamos conservador (`scoreQuality > 0.85 AND scheduled`)? Quanto isso filtra na prática? Validar no mês 1.
- [ ] **Anonymização strict vs ner:** strict bloqueia até revisão humana, ner é probabilístico. Qual nível antes de habilitar auto-upload?

---

## Riscos identificados

| Risco | Mitigação |
|---|---|
| CRMs odontológicos não têm API pública decente | Fallback: webhook reverso (cliente posta no Hawki via integração nativa do CRM) ou export CSV manual semanal |
| Sofia em produção em stack diferente do esperado | Slice 4 vira "agnostic" com SDK leve em Node + Python. Tempo +30%. |
| Conversas reais têm dados sensíveis que regex+NER não pegam | Slice 0 já endereça via `ANONYMIZATION_LEVEL=strict` (revisão humana obrigatória) — uso default em Slice 4 até confiança em NER subir |
| Outcome data tem alta latência (paciente fecha tratamento 30 dias depois) | Outcome é evento, não snapshot. `ConversationOutcome` aceita updates incrementais (scheduled → showedUp → treatmentClosed → revenueCents) ao longo do tempo |
| Variantes A/B causam regressão silenciosa em produção | Rollback automático em janela de 100 conversas + monitor de outcome contínuo |

---

## Referências

- [INTELLIGENCE_PLAN.md](./INTELLIGENCE_PLAN.md) — Fase 1 (corpus + injeção)
- [CLAUDE.md](./CLAUDE.md) — visão geral do repositório
- Codex adversarial review (2026-05-02) — origem dos achados que formam Slice 0
