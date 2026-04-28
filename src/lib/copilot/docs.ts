// Documentação do Hawki embutida por modo do copiloto.
// Cada modo carrega apenas os docs relevantes para manter o contexto enxuto.

import { SOFIA_GUIDELINES_FULL } from '@/lib/sofia-guidelines'

export const HAWKI_DOCS = {
  cadencias: `
# DOCUMENTAÇÃO HAWKI — CADÊNCIAS E PIPELINE

Cadências são sequências de mensagens que o bot dispara automaticamente para leads que estão em determinadas etapas do Pipeline. Use para follow-up, nutrição e lembrete.

Onde fica: menu lateral → Cadências.

## Estados (badges)

| Estado | Cor | Significado |
|--------|-----|-------------|
| Ativa | verde | enviando mensagens normalmente |
| Pausada | âmbar | parou de enviar; reativa quando quiser |
| Agendada | azul | vai ativar automaticamente em data/hora marcada |
| Rascunho | cinza | criada mas nunca rodou |
| Inativa | cinza | desligada |

## Criar cadência — campos obrigatórios

- Nome da cadência
- Quais leads devem entrar (seleciona etapas do Pipeline)

Fluxo: cadência criada em Rascunho → builder de sequência → Ativar quando pronto.

## Detalhe da cadência — 3 abas

### Aba "Sequência"

Cada etapa pode ser:
- **Mensagem** — texto com variáveis ({{contact.name}}, {{contact.custom.<chave>}}); opcionalmente áudio ou imagem
- **Atraso** — espera N horas ou dias antes da próxima etapa
- **Filtro** — condição para continuar (campo + operador + valor)

Janela de entrega (vale para toda a cadência):
- Intervalo de entrega: dias da semana + faixa de horário (ex: seg-sex 9h–18h)
- Timezone padrão: America/Sao_Paulo

### Aba "Configurações"

| Campo | Observação |
|-------|------------|
| Nome | livre |
| Etapas do pipeline | quais etapas inscrevem leads automaticamente |
| Lead duplicates | se ativado, leads em várias etapas entram só uma vez |
| Max sends per lead | máximo de mensagens por lead (0 = ilimitado) |

### Aba "Monitor"

Métricas: leads inscritos, ativos, completos, pausados, taxa de conversão.
Log por lead: quem está em que etapa, última mensagem enviada, status.

## Controle de status

- Inativa/Rascunho → "Ativar agora" ou "Agendar" (abre data/hora)
- Ativa → "Pausar" ou "Desativar"
- Pausada/Agendada → "Voltar para rascunho"

## Pipeline

Visão kanban do funil de leads. Arrastar cards entre colunas move o lead de etapa.
As mesmas etapas do pipeline aparecem na configuração de cadências.

## Campos personalizados
Definidos em: Conta → aba "Campos".
Sintaxe de variável: {{contact.custom.<chave>}}
Tipos: texto, número, data, select, booleano.
Exemplos úteis: ultima_consulta, procedimento_interesse, status_reativacao.

## Boas práticas de cadência
- 3–4 etapas máximo (mais que isso vira spam)
- Espaçamento crescente: 1 dia, 3 dias, 7 dias
- Janela de entrega dentro do horário comercial
- Sempre ofereça opt-out ("responda PARAR")
- PARAR automação quando lead responder — bot principal assume a conversa
  `,

  prompts: SOFIA_GUIDELINES_FULL,

  kb: `
# DOCUMENTAÇÃO HAWKI — BASE DE CONHECIMENTO (TREINAMENTO) E RAG

A página Treinamento gerencia a base de conhecimento do bot. Cada "conhecimento" é um trecho de texto que o bot pode consultar via a ferramenta search_knowledge durante uma conversa.

Onde fica: menu lateral → Treinamento.

## Por baixo do capô
Cada conhecimento é convertido em embeddings vetoriais (1536-dim, armazenados em pgvector no PostgreSQL). Busca semântica — encontra o conhecimento mais relevante para a pergunta do contato, não por correspondência literal.

## Quando criar entradas de KB

✅ Crie quando:
- Há muita informação para colocar no prompt (ex: 50+ FAQs)
- A informação muda de tempos em tempos (ajuste sem mexer no prompt)
- Detalhes de produtos, procedimentos, políticas

❌ NÃO crie quando:
- É algo curto e estável (endereço, telefone) → vai no prompt
- É identidade ou tom → vai na Personalidade
- É dado em tempo real → requer integração

## Criar conhecimento — campos

| Campo | Obrigatório | Observação |
|-------|-------------|------------|
| Título | sim | curto, identifica o conhecimento na lista |
| Descrição | não | resumo opcional (não vai para o LLM) |
| Conteúdo | sim | texto que o bot vai consultar |
| Categoria | não | agrupamento opcional |

## Boas práticas de KB

| Bom conhecimento | Ruim |
|-----------------|------|
| Pergunta + resposta direta | Texto institucional longo |
| Bullets curtos | Parágrafos densos |
| Um título por tópico | Documento sem hierarquia |
| Linguagem que o cliente usa | Jargão interno |
| Atualizado | "Revisado em 2019" |

Se o bot frequentemente recupera o conhecimento errado, divida em conhecimentos menores e mais focados.

## search_knowledge (tool RAG)

Como funciona:
1. O paciente faz uma pergunta
2. O LLM decide se search_knowledge ajuda
3. A pergunta vira embedding e busca no pgvector
4. Os conhecimentos mais relevantes voltam ao LLM
5. O LLM responde citando ou parafraseando

Deve estar HABILITADA em Ferramentas para funcionar. Sem conhecimentos cadastrados, nunca encontra nada.

## Orientação no prompt para RAG

Sem orientação, o LLM chama de forma errática. Adicione na Personalidade:

\`\`\`
# Ferramentas — Conhecimento
search_knowledge — Use quando o paciente perguntar sobre:
- Detalhes de procedimentos
- Política de cancelamento, garantia ou reembolso
- Preço de procedimento
NUNCA responda dúvida nessas categorias sem chamar a ferramenta.
Se a busca não retornar resposta clara, diga "vou confirmar isso para você" e chame request_help.
\`\`\`

Instruir o bot a citar a fonte: "Conforme nosso guia de procedimentos..."
Custo: tokens do conhecimento retornado aumentam contexto — quebre em chunks menores.
  `,

  config: `
# DOCUMENTAÇÃO HAWKI — CONFIGURAÇÃO DE BOT E FERRAMENTAS

## Campos do formulário de bot
- Nome e slug (identificação)
- Personalidade: system prompt (campo mais importante)
- Mensagem de boas-vindas: breve + pergunta útil
- Debounce: 0–30s (recomendado: 4s para maioria dos casos)
- Horário de atendimento: bot silencia durante expediente humano
- Resposta por áudio: TTS via ElevenLabs (cobra por caractere)

## Debounce — Tempo de Espera

No WhatsApp as pessoas escrevem como falam: várias mensagens curtas em sequência. Sem debounce, o bot responde cada uma. Com debounce, o bot espera alguns segundos para ver se vem mais e responde tudo de uma vez.

Onde está: Bots → [seu bot] → Editar → Tempo de Espera (Debounce)

| Valor | Quando |
|-------|--------|
| 0 | Debounce desligado — bot responde cada mensagem na hora |
| 2–3s | Resposta rápida com algum agrupamento |
| 4s | Recomendado para a maioria dos casos |
| 6–10s | Públicos que tipicamente escrevem muito antes de pausar |
| >10s | Quase nunca — pessoas acham que o bot travou |

Exemplo sem debounce: 3 respostas para 3 mensagens curtas.
Exemplo com 4s: 1 resposta única considerando as 3 mensagens.

## Horário de Atendimento

Lógica invertida: bot silencia DURANTE o horário configurado (humanos atendem), responde FORA.
Onde está: Bots → [seu bot] → Editar → Horário de Atendimento
Grade de 7 dias com horário início/fim por dia. Dia desligado = bot ativo o dia inteiro.
Bot NÃO assume retroativamente mensagens não respondidas durante o expediente.

## As 5 tools nativas

| Tool | Nome interno | Padrão | Função |
|------|-------------|--------|--------|
| Busca de Conhecimento | search_knowledge | ✅ ativa | RAG na base de conhecimento |
| Solicitar Ajuda | request_help | ✅ ativa | Escala para humano |
| Enviar Imagem | send_image | ❌ inativa | Imagens da biblioteca de mídia |
| Enviar Documento | send_document | ❌ inativa | PDFs da biblioteca de mídia |
| Atualizar Nome | update_contact_name | ❌ inativa | Atualiza nome do contato |

Princípio fundamental: Tool habilitada sem orientação no prompt = chamadas erráticas.
Ativar só o que vai usar. Cada tool: latência + tokens + custo.

## search_knowledge — orientação no prompt

\`\`\`
search_knowledge — Use quando o paciente perguntar sobre procedimentos, preços, políticas.
NUNCA responda dúvida nessas categorias sem chamar a ferramenta.
Se a busca não retornar resposta clara, chame request_help.
\`\`\`

## request_help — quando chamar

Sempre habilite. Bot sem rota de escape = bot que alucina ou frustra.

O que acontece: bot envia mensagem final → conversa entra em estado "solicitando assistência" → operadores recebem notificação → alguém clica Assumir → bot fica silencioso até "Devolver para o bot".

Situações que SEMPRE devem acionar:
- Reclamação direta
- Pedido de cancelamento de serviço já realizado
- Urgência médica (também orientar a ligar 192)
- Pergunta fora do escopo do bot
- Pedido explícito ("quero falar com humano")
- 3+ falhas de compreensão na mesma conversa

Taxa de transferência humana: <8% = automação excessiva, 8–20% = saudável, >30% = prompt insuficiente.

## Integrações de agendamento (1 por bot)

| Integração | Para | Auth |
|-----------|------|------|
| Google Calendar | calendário genérico | OAuth |
| Clinicorp | clínicas odontológicas | API URL + usuário/senha |
| Controle Odonto | clínicas odontológicas | API usuário/senha + sala |
| Dental Office | clínicas odontológicas | API URL + usuário/senha |
| SoftClinica (Cloudia) | médico/odonto | URL + token + tipo |
| Prontuário Verde | clínicas | API URL + usuário/senha |

Quando integrado: bot pode buscar disponibilidade, criar, cancelar e reagendar. Confirmações e lembretes automáticos são ativados.

## Resposta por Áudio (TTS via ElevenLabs)

Onde ativar: Bots → [seu bot] → Editar → bloco "Resposta por Áudio"

✅ Funciona bem: públicos que preferem áudio, conteúdo curto (até 2–3 frases), persona se beneficia da voz.
❌ Evitar: respostas com listas/tabelas/números longos, ambientes onde não pode ouvir.

Custo: TTS cobra por caractere sintetizado — cada resposta em áudio = chamada paga adicional ao custo do LLM.
Importante: quando TTS ativo, ajustar o prompt para cap de ~3 frases por mensagem — áudio longo = contato fecha no meio.
Em Cadências: toggle "Incluir áudio?" aparece em etapas do tipo Mensagem quando TTS está ligado no bot.
  `,

  debug: `
# DOCUMENTAÇÃO HAWKI — DEBUGGING E ITERAÇÃO

## Processo de diagnóstico
1. Revisar contexto COMPLETO da conversa (não mensagens isoladas)
2. Verificar metadados: histórico de contexto, respostas de tools, completude da persona
3. Reproduzir no painel de teste antes de fazer mudanças
4. Aplicar modificações mínimas e retestar

## Tabela de sintomas
| Sintoma | Causa provável | Onde ajustar |
|---------|---------------|--------------|
| Dados inventados | Sem regra proibindo | Regras absolutas |
| Mudança de tom | Identidade fraca | Seção de identidade |
| Perguntas repetidas | Fluxo ambíguo | Fluxos comuns |
| Tool errada disparando | Pré-condições ausentes | Seção de ferramentas |
| Idioma errado | Idioma não declarado | Tom e estilo |
| Alta latência | Model congestionado, tool lenta, prompt grande | Simplificar prompt ou tool |
| Mensagens truncadas | Bug de canal | Verificar canal, não o prompt |
| Respostas duplicadas | Problema de retry/debounce | Config de debounce |

## Antipadrões comuns que causam bugs
- Instruções vagas sem comportamento verificável
- Tools habilitadas mas não descritas no prompt
- Exemplos few-shot com dados reais inventados
- Fluxos com mais de 5 etapas consecutivas
- Reescrita completa em vez de edição cirúrgica

## Ciclo de iteração seguro
1. Observar conversas reais (semanalmente)
2. Identificar padrão de falha
3. Formar hipótese específica
4. Editar UMA coisa por vez no prompt
5. Testar em casos de regressão (mínimo 3–5 casos do caminho feliz)
6. Publicar em horário de baixo movimento
7. Monitorar por 2 horas

## Controle de versão
Hawki não tem versionamento automático.
Armazenar prompts em Git com mensagens de commit explicando o "porquê".

## Recursos para investigar
- Painel de detalhes da conversa (direito)
- Traces LangSmith para loops completos do agente
- Dashboard de métricas do bot
  `,

  fullSetup: `
# DOCUMENTAÇÃO HAWKI COMPLETA — SETUP COMPLETO DE BOT

## Vocabulário e estrutura do sistema

**Tenant** — organização no Hawki. Tem seus próprios bots, canais, conversas, contatos. Dados nunca cruzam tenants.
**Bot** — configuração de IA: Personalidade + Mensagem de Boas-vindas + Debounce + Horário + Tools. Não fala diretamente — precisa estar acoplado a um canal.
**Canal** — conexão concreta com WhatsApp (Cloud API para produção, WWeb.js para testes). Vinculado a 1 bot por vez.
**Contato/Lead** — pessoa do outro lado, identificada pelo número de WhatsApp.
**Conversa** — sequência de mensagens entre contato e canal, com estado (open, human, etc.).
**Tool** — capacidade que o LLM pode chamar: search_knowledge, request_help, send_image, send_document.
**Integração** — sistema externo de agendamento (1 por bot): Google Calendar, Clinicorp, etc.
**Pipeline** — funil de leads em kanban. Etapas são as colunas.
**Cadência** — sequência automática de mensagens para leads em etapas do funil.

Como tudo se conecta:
Tenant → Bots → habilita Tools (4 tools + 1 integração) → acoplado a Canal → responde em Conversa → Contato/Lead
Tenant → Pipeline (etapas) → Cadências (vinculadas a etapas) → Leads

## Sequência de setup recomendada

1. Criar bot com Personalidade básica (sem tools)
2. Validar comportamento base em conversas de teste (roteiro mínimo abaixo)
3. Habilitar tools progressivamente
4. Integrar sistema de agendamento
5. Construir base de conhecimento em Treinamento
6. Configurar cadências
7. Conectar canal Cloud API de produção

## Configurações essenciais de bot
- Debounce: 4s (padrão recomendado)
- Horário de atendimento: bot silencia durante expediente humano, responde fora
- Mensagem de boas-vindas: breve saudação + pergunta útil
- Resposta por áudio: comece desligada — habilite só quando o texto estiver bom

## Tools — princípio de ativação mínima
Habilitar apenas o necessário:
- search_knowledge: sempre (se tiver KB)
- request_help: sempre (bot sem rota de escape = bot que alucina)
- send_image/send_document: apenas se tiver mídia útil
- Integração de agendamento: apenas se o negócio agenda

## Roteiro mínimo de validação antes de produção
- [ ] Cumprimento (oi, bom dia)
- [ ] Pedido válido (quero marcar uma consulta)
- [ ] Pergunta fora de escopo (qual o melhor remédio para dor de cabeça?)
- [ ] Urgência (estou com muita dor, sangrando)
- [ ] Reclamação (atendimento foi péssimo ontem)

## Base de conhecimento
- Chunks focados por tópico (não uma entrada gigante)
- Estrutura: Pergunta + Resposta direta em bullets
- Habilitada via tool search_knowledge
- Se bot buscar conhecimento errado: dividir entradas em partes menores

## Cadências
- Por etapa do pipeline
- 3–4 etapas máximo, espaçamento crescente (1, 3, 7 dias)
- Janela de entrega dentro do horário comercial
- Parar quando lead responder
- Usar campos personalizados: {{contact.custom.<chave>}}

## Canais
- Cloud API (Meta): produção — requer configuração na Meta
- WWeb.js: testes apenas — autenticação por QR code, menos estável

## Métricas de saúde
- Transferência humana: 8–20% saudável (<8% = automação excessiva, >30% = prompt insuficiente)
- Satisfação via 👍/👎 em Conversas
- NPS via Avaliações (configurar em Ferramentas → NpsConfig)
  `,
  conversaReal: `
# DOCUMENTAÇÃO HAWKI — ANÁLISE DE CONVERSAS E DEBUGGING

## Como interpretar uma conversa real

Ao analisar um transcript, observar:
1. **Contexto acumulado**: o LLM enxerga toda a conversa anterior — respostas ruins geralmente têm causa em mensagens anteriores
2. **Chamadas de tool**: quando o bot chama search_knowledge ou request_help, o resultado da tool aparece no contexto
3. **Ponto de virada**: identificar exatamente a mensagem onde o comportamento divergiu do esperado

## Padrões de falha comuns em conversas reais

| Padrão no transcript | Causa | Correção |
|---------------------|-------|----------|
| Bot inventa preço/endereço | Sem regra proibindo fabricação | Adicionar regra absoluta: "NUNCA invente dados" |
| Bot repete a mesma pergunta | Fluxo ambíguo, não sabe onde está | Clarificar etapas do fluxo no prompt |
| Bot ignora pedido do usuário | Regra conflitante ou fluxo rígido demais | Revisar ordem de prioridade das regras |
| Bot escala sem necessidade | Gatilho de request_help muito sensível | Especificar pré-condições mais restritivas |
| Bot muda de tom no meio | Persona fraca, sem ancoragem | Reforçar identidade com exemplos few-shot |
| Bot responde fora do escopo | Sem regra de "não sei, redirecione" | Adicionar fluxo de fora do escopo |
| Bot não usa a KB | search_knowledge não descrita no prompt | Adicionar seção de ferramentas com pré-condições |
| Bot envia mídia sem pedir | send_image/send_document sem pré-condições | Restringir: "SOMENTE quando o usuário pedir" |
| Resposta em idioma errado | Idioma não declarado no prompt | Declarar idioma na seção de tom |
| Bot confirma agendamento sem verificar disponibilidade | Fluxo de agenda não descrito | Adicionar passo de verificação antes de confirmar |

## Estrutura da análise

Para cada falha identificada:
1. Citar a mensagem exata onde ocorreu
2. Hipótese de causa (prompt, tool, config)
3. Correção mínima — texto exato a alterar no prompt
4. Caso de teste para verificar a correção

## O que NÃO é problema de prompt
- Mensagens truncadas → bug de canal (não mexer no prompt)
- Respostas duplicadas → debounce mal configurado
- Alta latência → tool lenta ou prompt muito grande
- QR code desconectado → problema de canal WWeb.js
  `,

  crm: `
# DOCUMENTAÇÃO HAWKI — CAMPOS PERSONALIZADOS E CRM LEVE

## O que são campos personalizados
Campos extras definidos em Conta → aba "Campos" que aparecem em todos os contatos/leads do tenant.
Acessíveis como variáveis em cadências: {{contact.custom.<chave>}}

## Tipos disponíveis
- **texto**: strings livres (nome do procedimento, observações)
- **número**: valores numéricos (quantidade de consultas, score)
- **data**: datas (última consulta, próximo retorno)
- **select**: lista de opções fixas (status do lead, procedimento de interesse)
- **booleano**: verdadeiro/falso (aceitou orçamento, recebeu boas-vindas)

## Convenções de nomenclatura
- Chave em snake_case: ultima_consulta, procedimento_interesse
- Nome legível: "Última Consulta", "Procedimento de Interesse"
- Chave não pode ser alterada depois sem quebrar mensagens existentes

## Casos de uso por objetivo

### Reativação de base
Campos úteis: ultima_consulta (data), motivo_ausencia (select), procedimento_pendente (texto)
Uso em cadência: "{{contact.custom.nome}}, faz {{contact.custom.tempo_inativo}} que não te vemos..."

### Funil de vendas
Campos úteis: estagio_negociacao (select), valor_orcamento (número), data_orcamento (data)

### Pós-consulta / fidelização
Campos úteis: ultimo_procedimento (texto), data_ultimo_atendimento (data), nps_ultima_avaliacao (número)

### Nutrição de leads frios
Campos úteis: origem_lead (select), procedimento_interesse (select), tentativas_contato (número)

## Como o bot usa os campos
O bot NÃO lê campos personalizados diretamente — eles só são acessíveis em cadências via variável.
Para o bot usar o dado durante a conversa, o operador precisa inserir manualmente ou via integração.

## Importação em massa
Leads podem ser importados via CSV/XLSX com mapeamento de colunas para campos personalizados.
Isso permite popular campos em massa (ex: importar lista com coluna "ultima_consulta").

## Pipeline e campos
Campos personalizados aparecem no painel direito de cada lead em Conversas e Leads.
Filtros em Leads podem usar campos personalizados para segmentação.

## Boas práticas
- Começar com 3–5 campos essenciais, expandir conforme necessidade real
- Campos de tipo "select" são mais confiáveis que texto livre para filtros e automações
- Campos de data permitem calcular tempo decorrido (ideal para reativação)
- Nomear a chave pensando em como vai aparecer na variável: {{contact.custom.ultima_consulta}}
  `,
} as const

export type CopilotMode = keyof typeof HAWKI_DOCS

export function getDocsForMode(mode: CopilotMode): string {
  return HAWKI_DOCS[mode]
}
