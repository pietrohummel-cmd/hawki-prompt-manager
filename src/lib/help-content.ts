export interface HelpNode {
  id: string
  title: string
  content?: string // markdown, exibido quando nó é folha ou expandido
  children?: HelpNode[]
}

export const HELP_TREE: HelpNode[] = [
  {
    id: 'daily',
    title: '📋 Fluxo do dia-a-dia',
    content: `
## O que fazer todo dia

Siga essa sequência e você cobre 90% do trabalho de manutenção dos bots:

**1. Abrir o Dashboard**
Veja quais clientes têm tickets abertos (badge vermelho/âmbar na lista de clientes). Priorize clientes com tickets CRÍTICOS.

**2. Resolver tickets pendentes**
Na aba **Tickets** de cada cliente:
- Tickets com status **SUGGESTED** já têm sugestão da IA — basta revisar e clicar **Aplicar**.
- Tickets **OPEN** precisam de sugestão: clique **Sugerir com IA** e depois **Aplicar**.
- Use **Aplicar em lote** se houver vários tickets sugeridos de uma vez.

**3. Rodar calibração (quando tiver conversa nova)**
Se chegou uma conversa real do WhatsApp que precisa de análise:
- Acesse a aba **Calibração** do cliente
- Cole a conversa humana e a resposta da Sofia
- Clique **Analisar** — a IA identifica os gaps e sugere correções
- Converta os gaps em tickets com um clique

**4. Usar o Copiloto para dúvidas pontuais**
Quando não souber como melhorar um prompt específico, use a aba **Copiloto** do cliente para ter orientação contextualizada (o copiloto já conhece o prompt ativo e os tickets do cliente).

**5. Verificar clientes novos**
Se houver cliente em status **Onboarding**, gere o prompt inicial na aba **Prompt** antes de entregar.
`,
  },
  {
    id: 'tabs',
    title: '📦 O que é cada aba?',
    children: [
      {
        id: 'tabs-prompt',
        title: 'Prompt',
        content: `
## Aba Prompt

O coração da ferramenta. Aqui você vê e edita o prompt ativo do cliente.

**O que você pode fazer:**
- **Gerar prompt completo** — manda os dados do onboarding para a IA e ela cria os 10 módulos do zero
- **Editar módulo por módulo** — cada accordion é um módulo independente; clique em Editar para alterar só aquele módulo sem regenerar o prompt inteiro
- **Ver qual versão está ativa** — sempre aparece o número da versão atual

**Quando usar:**
- Para criar o prompt inicial de um cliente novo → Gerar
- Para ajustes pontuais no comportamento da Sofia → Editar módulo específico
- Para corrigir algo que um ticket identificou → Aplicar na aba Tickets (mais rastreável)

**Os 10 módulos (em ordem):**
IDENTITY, INJECTION_PROTECTION, TONE_AND_STYLE, OPENING, ATTENDANCE_FLOW, QUALIFICATION, OBJECTION_HANDLING, FEW_SHOT_EXAMPLES, AUDIO_AND_HANDOFF, ABSOLUTE_RULES
`,
      },
      {
        id: 'tabs-versions',
        title: 'Versões',
        content: `
## Aba Versões

Histórico completo de todas as versões do prompt. Cada vez que você gera, edita ou aplica um ticket, uma nova versão é criada automaticamente.

**O que você pode fazer:**
- Ver quais módulos mudaram entre versões (diff visual — módulos com badge "Alterado")
- Ativar uma versão anterior se a nova estiver pior
- Exportar o prompt de qualquer versão como texto

**Regras de versionamento:**
- Apenas 1 versão pode estar **ativa** por cliente
- Versões anteriores são preservadas para sempre (não se perdem)
- Cada correção via ticket registra qual versão foi gerada a partir dela
`,
      },
      {
        id: 'tabs-tickets',
        title: 'Tickets',
        content: `
## Aba Tickets

Sistema de rastreamento de correções. Todo problema identificado vira um ticket.

**Ciclo de vida de um ticket:**
\`\`\`
OPEN → (gerar sugestão) → SUGGESTED → (revisar e aplicar) → APPLIED
                                     → (rejeitar)          → REJECTED
\`\`\`

**Status explicados:**
- **OPEN** — problema identificado, aguardando sugestão de correção
- **SUGGESTED** — IA já gerou uma sugestão; precisa de revisão humana
- **APPLIED** — correção aplicada, nova versão do prompt criada
- **REJECTED** — descartado (não era problema real ou foi resolvido de outra forma)

**Prioridades:**
- 🔴 **CRITICAL** — bot pode estar dando informação errada ou falhando em fluxo principal
- 🟡 **NORMAL** — comportamento inadequado mas não crítico
- 🔵 **IMPROVEMENT** — melhoria de qualidade, não urgente

**Dica:** tickets criados via Calibração já vêm com sugestão da IA (status SUGGESTED). São os mais fáceis de resolver.
`,
      },
      {
        id: 'tabs-calibration',
        title: 'Calibração',
        content: `
## Aba Calibração

Análise profunda de conversas reais para identificar onde a Sofia errou ou pode melhorar.

**Quando usar:**
- Quando o cliente reclamar de uma conversa específica
- Na revisão semanal de conversas reais
- Quando quiser proativamente melhorar o bot com dados reais

**Como funciona:**
1. Cole a conversa humana (como deveria ter acontecido) e a conversa da Sofia (o que ela fez)
2. Clique **Analisar** — a IA compara as duas e identifica gaps e violações
3. Os gaps aparecem com a sugestão de correção já pronta
4. Clique **Criar ticket** em cada gap que quiser resolver
5. Os tickets são criados com status SUGGESTED e aiSuggestion preenchida

**Diferença entre gap e violação:**
- **Gap** — a Sofia deixou de fazer algo que deveria (comportamento ausente)
- **Violação** — a Sofia fez algo que não deveria (regra quebrada)
`,
      },
      {
        id: 'tabs-copilot',
        title: 'Copiloto',
        content: `
## Aba Copiloto

Consultoria especializada em bots Hawki, contextualizada para o cliente específico.

**Quando está na aba Copiloto de um cliente**, o copiloto já sabe:
- O prompt ativo do cliente (todos os 18 módulos)
- Os tickets recentes em aberto
- As calibrações recentes

**Os 8 modos disponíveis:**

| Modo | Quando usar |
|------|------------|
| Revisor de Prompt | Diagnosticar e melhorar o prompt atual |
| Planejador de Cadência | Montar sequência de follow-up |
| Arquiteto de KB | Estruturar base de conhecimento |
| Configurador de Bot | Decidir debounce, tools, integrações |
| Debugger | Investigar comportamento inesperado |
| Gerador de Fluxo Completo | Criar prompt + KB + cadência do zero |
| Análise de Conversa | Diagnóstico cirúrgico de transcript |
| Planejador de CRM | Definir campos personalizados |

**Botão "Criar ticket":** após a resposta do copiloto nos modos de revisão/debug, aparece o botão para transformar a sugestão diretamente em ticket do cliente.
`,
      },
      {
        id: 'tabs-simulation',
        title: 'Simulação',
        content: `
## Aba Simulação

Chat em tempo real com o prompt ativo do cliente. Serve para testar o comportamento antes de aplicar mudanças em produção.

**Quando usar:**
- Antes de entregar o prompt para um cliente novo
- Depois de aplicar uma correção importante
- Para simular situações específicas que causaram tickets

**Roteiro mínimo de validação:**
1. \`oi\` — testar saudação
2. \`quero marcar uma consulta\` — testar fluxo principal
3. \`qual o preço da limpeza?\` — testar se não inventa preço
4. \`estou com muita dor\` — testar escalada de urgência
5. \`me passa uma receita de bolo\` — testar rejeição de fora do escopo

Se algum passo falhar → criar ticket.
`,
      },
      {
        id: 'tabs-regression',
        title: 'Regressão',
        content: `
## Aba Regressão

Casos de teste automatizados. Você define uma pergunta e os critérios de sucesso — a ferramenta testa contra o prompt atual.

**Quando usar:**
- Quando você quiser garantir que uma mudança não quebrou nada
- Para documentar situações que já causaram problemas no passado

**Como funciona:**
1. Crie um caso de regressão com uma mensagem de entrada
2. Defina critérios (ex: "deve mencionar agendamento", "não deve inventar preço")
3. Rode os testes — a IA avalia cada critério como PASSED/FAILED
4. Qualquer falha indica regressão

**Dica:** crie pelo menos 1 caso de regressão para cada ticket CRITICAL que você já resolveu. Isso garante que a correção não desfaça no futuro.
`,
      },
      {
        id: 'tabs-conversations',
        title: 'Conversas',
        content: `
## Aba Conversas

Registro de amostras de conversas reais com resultados. Serve para acompanhar a taxa de agendamento da Sofia ao longo do tempo.

**Quando usar:**
- Ao receber feedback do cliente sobre conversas específicas
- Na revisão semanal de desempenho

**O que registrar:**
- Outcome: SCHEDULED (agendou), NOT_SCHEDULED (não agendou), LOST (perdeu)
- Fonte: de onde veio a conversa (whatsapp, indicação, etc.)
- Notas: observações relevantes

**Para que serve:** quando você tiver 10+ amostras, consegue ver padrão — se a taxa de agendamento está caindo, vale investigar com Calibração.
`,
      },
      {
        id: 'tabs-origins',
        title: 'Origens',
        content: `
## Aba Origens

Personalização da mensagem de abertura da Sofia com base na origem do lead (de onde veio o contato).

**Exemplo:** leads vindos de Instagram podem receber uma abertura diferente de leads vindos de indicação.

**Como usar:**
1. Crie uma origem (ex: "Instagram", "Google Ads", "Indicação")
2. Defina o texto de abertura específico para essa origem
3. Ative a origem
4. No Hawki, configure a origem do lead ao importar ou criar contato

**Nota:** esta funcionalidade requer integração com campos personalizados do Hawki para funcionar em produção.
`,
      },
    ],
  },
  {
    id: 'faq',
    title: '❓ Perguntas frequentes',
    children: [
      {
        id: 'faq-generate-vs-edit',
        title: 'Devo gerar do zero ou editar módulo por módulo?',
        content: `
## Gerar vs. editar

**Gerar do zero** quando:
- É um cliente novo e ainda não tem prompt
- O prompt atual está muito desatualizado ou mal estruturado
- O cliente mudou completamente de foco/público

**Editar módulo por módulo** quando:
- O prompt já existe e funciona bem no geral
- Você identificou um problema específico (via ticket ou calibração)
- Quer fazer ajuste cirúrgico sem arriscar o que está funcionando

**Regra de ouro:** edição incremental é sempre mais segura que reescrita completa. A IA pode introduzir variações ao regenerar — editar preserva o que já foi validado.
`,
      },
      {
        id: 'faq-calibration-vs-ticket',
        title: 'Qual a diferença entre calibração e ticket?',
        content: `
## Calibração vs. Ticket

**Ticket** é o problema. **Calibração** é o diagnóstico que pode gerar tickets.

- **Ticket** — registro de um problema específico que precisa de correção. Pode ser criado manualmente, via calibração, ou via copiloto.
- **Calibração** — análise comparativa de conversa real vs. ideal. A IA identifica múltiplos gaps de uma vez e sugere correções. Cada gap pode virar um ticket.

**Fluxo típico:**
\`\`\`
Conversa real problemática
  → Calibração (análise profunda)
    → Gaps identificados
      → Tickets criados
        → Correções aplicadas
\`\`\`

Use calibração quando tiver uma conversa real para analisar. Crie tickets manualmente quando souber o que está errado sem precisar da análise comparativa.
`,
      },
      {
        id: 'faq-copilot-vs-edit',
        title: 'Quando usar o copiloto vs. editar direto no prompt?',
        content: `
## Copiloto vs. edição direta

**Editar direto** quando:
- Você sabe exatamente o que mudar e onde
- É uma correção simples (uma frase, uma regra)
- Você já tem a correção do ticket para aplicar

**Usar o copiloto** quando:
- Não sabe por que o bot está se comportando de forma estranha
- Quer entender qual seção do prompt está causando o problema
- Precisa criar do zero e não sabe por onde começar
- Quer uma segunda opinião antes de fazer mudança grande

**Dica:** use o copiloto na aba do cliente (não no copiloto global) — assim ele já conhece o prompt ativo e os tickets, dando diagnóstico muito mais preciso.
`,
      },
      {
        id: 'faq-no-module',
        title: 'O que fazer quando o ticket não tem módulo definido?',
        content: `
## Ticket sem módulo

Tickets sem módulo definido têm o botão **✦ IA** ao lado do seletor de módulo. Clique nele — a IA analisa a descrição do problema e sugere qual dos 18 módulos é o mais provável.

**Se quiser fazer manualmente**, os módulos mais comuns para cada tipo de problema:

| Problema | Módulo provável |
|---------|----------------|
| Tom errado / frase inadequada | COMMUNICATION_STYLE ou HUMAN_BEHAVIOR |
| Inventa dados | ABSOLUTE_RULES |
| Não escalou para humano | HANDOFF |
| Perguntou dados errados | ATTENDANCE_STAGES ou QUALIFICATION |
| Não se apresentou corretamente | IDENTITY ou PRESENTATION |
| Passou por prompt injection | INJECTION_PROTECTION |
| Não reconheceu retomada | CONVERSATION_RESUME |
| Mensagem de áudio problemática | AUDIO_RULES |
`,
      },
      {
        id: 'faq-version-better',
        title: 'Como sei que uma versão nova melhorou o bot?',
        content: `
## Verificando se a versão melhorou

**Imediato (antes de entregar):**
1. Aba **Simulação** → rode o roteiro mínimo de 5 casos
2. Aba **Regressão** → execute os casos de teste salvos — todos devem passar

**Médio prazo (depois de alguns dias):**
1. Aba **Conversas** → registre outcomes reais e compare taxas entre versões
2. Aba **Calibração** → passe conversas recentes pelo analisador e veja se o número de gaps caiu

**Atalho visual:**
Na aba **Versões**, expanda qualquer versão para ver o diff — quais módulos mudaram em relação à anterior. Se a mudança foi cirúrgica (1-2 módulos), o risco de regressão é baixo.
`,
      },
      {
        id: 'faq-multiple-tickets',
        title: 'Posso ter vários tickets abertos ao mesmo tempo?',
        content: `
## Múltiplos tickets abertos

**Sim, e é o comportamento esperado.** Cada ticket é independente — você pode ter 10 tickets OPEN simultaneamente e resolver na ordem que preferir.

**Recomendação de priorização:**
1. Primeiro os **CRITICAL** (badge vermelho) — podem estar causando falhas em produção
2. Depois os **SUGGESTED** (já têm sugestão, basta revisar e aplicar)
3. Por último os **OPEN** sem sugestão

**Aplicar em lote:** quando tiver vários tickets SUGGESTED com módulos definidos, use o botão **"Aplicar todos sugeridos"** na aba Tickets — cria uma nova versão com todas as correções de uma vez em vez de aplicar uma por uma.

**Tickets de versões diferentes:** um ticket criado na v3 pode ser aplicado gerando a v4, mesmo que você já tenha criado outros tickets enquanto isso. A aplicação sempre parte da versão ativa no momento.
`,
      },
    ],
  },
]
