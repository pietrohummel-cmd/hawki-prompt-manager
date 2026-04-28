import { getDocsForMode } from './docs'

export type CopilotModeId =
  | 'cadencia'
  | 'prompt'
  | 'kb'
  | 'config'
  | 'debug'
  | 'fullSetup'
  | 'conversaReal'
  | 'crm'

export interface CopilotModeDefinition {
  id: CopilotModeId
  label: string
  description: string
  docsKey: Parameters<typeof getDocsForMode>[0]
  inputFields: InputField[]
}

export interface InputField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'checkboxes'
  placeholder?: string
  options?: string[]
  required?: boolean
}

export const COPILOT_MODES: CopilotModeDefinition[] = [
  {
    id: 'cadencia',
    label: 'Planejador de Cadência',
    description: 'Monta o fluxo completo de cadência com copy das mensagens, timing e ajustes de prompt.',
    docsKey: 'cadencias',
    inputFields: [
      {
        key: 'objetivo',
        label: 'Objetivo da cadência',
        type: 'textarea',
        placeholder: 'Ex: Reativar leads inativos há 90 dias e trazer de volta para agendamento',
        required: true,
      },
      {
        key: 'segmento',
        label: 'Segmento / perfil dos leads',
        type: 'textarea',
        placeholder: 'Ex: Pacientes de clínica odontológica que não consultam há 3+ meses. ~340 leads importados via CSV.',
        required: true,
      },
      {
        key: 'etapaPipeline',
        label: 'Etapa do pipeline onde ficam esses leads',
        type: 'text',
        placeholder: 'Ex: Inativos, Pós-consulta, Leads frios',
      },
      {
        key: 'sistemagenda',
        label: 'Sistema de agendamento ativo',
        type: 'select',
        options: ['Nenhum', 'Google Calendar', 'Clinicorp', 'Controle Odonto', 'Dental Office', 'SoftClinica', 'Prontuário Verde'],
      },
      {
        key: 'camposPersonalizados',
        label: 'Campos personalizados disponíveis no contato',
        type: 'text',
        placeholder: 'Ex: ultima_consulta, procedimento_interesse, nome_profissional',
      },
      {
        key: 'contextoExtra',
        label: 'Contexto adicional (tom, ofertas, restrições)',
        type: 'textarea',
        placeholder: 'Ex: Tom informal, oferecer desconto de 15% para retorno, não mencionar concorrentes',
      },
    ],
  },
  {
    id: 'prompt',
    label: 'Revisor de Prompt',
    description: 'Diagnostica o prompt atual e sugere melhorias cirúrgicas por seção.',
    docsKey: 'prompts',
    inputFields: [
      {
        key: 'promptAtual',
        label: 'Prompt atual (Personalidade do bot)',
        type: 'textarea',
        placeholder: 'Cole aqui o conteúdo atual do campo Personalidade...',
        required: true,
      },
      {
        key: 'problema',
        label: 'Problema observado OU objetivo novo',
        type: 'textarea',
        placeholder: 'Ex: O bot está inventando preços / Quero que o bot seja mais proativo em oferecer agendamento',
        required: true,
      },
      {
        key: 'toolsAtivas',
        label: 'Ferramentas ativas no bot',
        type: 'checkboxes',
        options: [
          'search_knowledge',
          'request_help',
          'send_image',
          'send_document',
          'Google Calendar',
          'Clinicorp',
          'Controle Odonto',
          'Dental Office',
          'SoftClinica',
          'Prontuário Verde',
        ],
      },
      {
        key: 'contextoNegocio',
        label: 'Contexto do negócio',
        type: 'text',
        placeholder: 'Ex: Clínica odontológica, atende São Paulo, 3 dentistas',
      },
    ],
  },
  {
    id: 'kb',
    label: 'Arquiteto de KB',
    description: 'Define o que vai na base de conhecimento, como estruturar e o que fica no prompt.',
    docsKey: 'kb',
    inputFields: [
      {
        key: 'negocio',
        label: 'Descrição do negócio',
        type: 'textarea',
        placeholder: 'Ex: Clínica odontológica com 3 dentistas, especialidades: implante, ortodontia e clareamento',
        required: true,
      },
      {
        key: 'faqs',
        label: 'Perguntas frequentes dos pacientes/clientes',
        type: 'textarea',
        placeholder: 'Cole aqui as dúvidas mais comuns. Ex:\n- Quanto custa uma limpeza?\n- Vocês aceitam plano?\n- Como funciona o implante?',
        required: true,
      },
      {
        key: 'informacoesEstaticas',
        label: 'Informações estáticas (endereço, horários, telefone)',
        type: 'textarea',
        placeholder: 'Essas geralmente ficam no prompt, não na KB. Cole aqui para eu decidir.',
      },
      {
        key: 'jaTemKB',
        label: 'Já tem alguma base de conhecimento?',
        type: 'textarea',
        placeholder: 'Se sim, descreva o que já tem para evitar duplicação.',
      },
    ],
  },
  {
    id: 'config',
    label: 'Configurador de Bot',
    description: 'Recomenda toda a configuração técnica do bot: debounce, horário, tools e integração.',
    docsKey: 'config',
    inputFields: [
      {
        key: 'tipoNegocio',
        label: 'Tipo de negócio',
        type: 'select',
        options: [
          'Clínica odontológica',
          'Clínica médica',
          'Clínica estética',
          'Consultório geral',
          'E-commerce',
          'Serviços B2B',
          'Educação',
          'Imobiliária',
          'Outro',
        ],
        required: true,
      },
      {
        key: 'sistemagenda',
        label: 'Sistema de agendamento',
        type: 'select',
        options: ['Não usa', 'Google Calendar', 'Clinicorp', 'Controle Odonto', 'Dental Office', 'SoftClinica', 'Prontuário Verde'],
      },
      {
        key: 'volumeConversa',
        label: 'Volume estimado de conversas por dia',
        type: 'select',
        options: ['< 20', '20–50', '50–150', '150–500', '500+'],
      },
      {
        key: 'horarioHumano',
        label: 'Horário de atendimento humano',
        type: 'text',
        placeholder: 'Ex: Seg–Sex 08h–18h, Sáb 08h–12h',
      },
      {
        key: 'funcionalidades',
        label: 'O que o bot precisa fazer',
        type: 'textarea',
        placeholder: 'Ex: Agendar consultas, tirar dúvidas sobre procedimentos, enviar tabela de preços em PDF, escalar para humano em reclamações',
        required: true,
      },
    ],
  },
  {
    id: 'debug',
    label: 'Debugger',
    description: 'Diagnostica comportamentos inesperados e indica o que mudar e onde.',
    docsKey: 'debug',
    inputFields: [
      {
        key: 'comportamento',
        label: 'Descreva o comportamento inesperado',
        type: 'textarea',
        placeholder: 'Ex: O bot está respondendo em inglês quando o cliente escreve em português / Fica pedindo transferência humana sem necessidade',
        required: true,
      },
      {
        key: 'exemploConversa',
        label: 'Trecho da conversa onde o problema ocorreu',
        type: 'textarea',
        placeholder: 'Cole aqui o trecho (usuário: ... / bot: ...) para análise mais precisa',
      },
      {
        key: 'promptAtual',
        label: 'Prompt atual (Personalidade)',
        type: 'textarea',
        placeholder: 'Cole o prompt atual para diagnóstico mais preciso',
      },
      {
        key: 'toolsAtivas',
        label: 'Ferramentas ativas no bot',
        type: 'checkboxes',
        options: [
          'search_knowledge',
          'request_help',
          'send_image',
          'send_document',
          'Google Calendar',
          'Clinicorp',
          'Controle Odonto',
          'Dental Office',
          'SoftClinica',
          'Prontuário Verde',
        ],
      },
      {
        key: 'ultimaAlteracao',
        label: 'Última alteração feita antes do problema aparecer',
        type: 'text',
        placeholder: 'Ex: Adicionei exemplos few-shot / Habilitei send_image',
      },
    ],
  },
  {
    id: 'fullSetup',
    label: 'Gerador de Fluxo Completo',
    description: 'Gera prompt completo, estrutura de KB, config de bot e primeira cadência para um bot do zero.',
    docsKey: 'fullSetup',
    inputFields: [
      {
        key: 'especialidade',
        label: 'Especialidade / setor',
        type: 'text',
        placeholder: 'Ex: Clínica odontológica com foco em estética dental',
        required: true,
      },
      {
        key: 'objetivo',
        label: 'Objetivo principal do bot',
        type: 'textarea',
        placeholder: 'Ex: Atender novos leads, agendar consultas iniciais e reativar pacientes inativos',
        required: true,
      },
      {
        key: 'nomeBotPersonagem',
        label: 'Nome e personalidade do bot',
        type: 'text',
        placeholder: 'Ex: Sofia — simpática, direta, informal mas profissional',
      },
      {
        key: 'sistemagenda',
        label: 'Sistema de agendamento',
        type: 'select',
        options: ['Não usa', 'Google Calendar', 'Clinicorp', 'Controle Odonto', 'Dental Office', 'SoftClinica', 'Prontuário Verde'],
      },
      {
        key: 'servicos',
        label: 'Principais serviços oferecidos',
        type: 'textarea',
        placeholder: 'Ex: Limpeza R$150, Clareamento R$800, Implante R$2.500, Ortodontia R$350/mês',
      },
      {
        key: 'informacoesContato',
        label: 'Informações de contato e localização',
        type: 'textarea',
        placeholder: 'Endereço, horários, telefone, site',
      },
      {
        key: 'restricoes',
        label: 'Restrições e regras importantes',
        type: 'textarea',
        placeholder: 'Ex: Nunca confirmar preço sem consultar tabela, sempre pedir nome antes de agendar',
      },
    ],
  },
  {
    id: 'conversaReal',
    label: 'Análise de Conversa',
    description: 'Cola um transcript real e recebe o diagnóstico exato do que causou o problema e o que mudar.',
    docsKey: 'conversaReal',
    inputFields: [
      {
        key: 'transcript',
        label: 'Transcript da conversa',
        type: 'textarea',
        placeholder: 'Cole aqui a conversa completa no formato:\nUsuário: ...\nBot: ...\nUsuário: ...\nBot: ...',
        required: true,
      },
      {
        key: 'problemaObservado',
        label: 'O que deu errado (do seu ponto de vista)',
        type: 'textarea',
        placeholder: 'Ex: O bot inventou um preço que não existe / Escalou para humano sem necessidade / Ignorou o pedido de agendamento',
        required: true,
      },
      {
        key: 'promptAtual',
        label: 'Prompt atual do bot (Personalidade)',
        type: 'textarea',
        placeholder: 'Cole o prompt atual — quanto mais contexto, mais preciso o diagnóstico',
      },
      {
        key: 'toolsAtivas',
        label: 'Ferramentas ativas no bot',
        type: 'checkboxes',
        options: [
          'search_knowledge',
          'request_help',
          'send_image',
          'send_document',
          'Google Calendar',
          'Clinicorp',
          'Controle Odonto',
          'Dental Office',
          'SoftClinica',
          'Prontuário Verde',
        ],
      },
    ],
  },
  {
    id: 'crm',
    label: 'Planejador de CRM',
    description: 'Define quais campos personalizados criar, como nomear e como usar em cadências e filtros.',
    docsKey: 'crm',
    inputFields: [
      {
        key: 'objetivo',
        label: 'Objetivo do negócio / campanha',
        type: 'textarea',
        placeholder: 'Ex: Reativar pacientes inativos há 90 dias / Nutrir leads que pediram orçamento mas não fecharam',
        required: true,
      },
      {
        key: 'tipoNegocio',
        label: 'Tipo de negócio',
        type: 'text',
        placeholder: 'Ex: Clínica odontológica, imobiliária, curso online',
        required: true,
      },
      {
        key: 'dadosDisponiveis',
        label: 'Dados que você já tem sobre os leads',
        type: 'textarea',
        placeholder: 'Ex: Tenho CSV com: nome, telefone, data da última consulta, procedimento realizado',
      },
      {
        key: 'cadenciaPlanejada',
        label: 'Cadência ou automação planejada',
        type: 'textarea',
        placeholder: 'Ex: Quero mandar mensagens personalizadas com o tempo que faz desde a última visita',
      },
      {
        key: 'camposExistentes',
        label: 'Campos personalizados já criados (se houver)',
        type: 'text',
        placeholder: 'Ex: ultima_consulta, procedimento_interesse',
      },
    ],
  },
]

export function buildSystemPrompt(modeId: CopilotModeId, docs: string, clientContext = ''): string {
  const base = `Você é o Copiloto da Sofia — um especialista em configuração e otimização de bots de atendimento construídos na plataforma Hawki.

Você tem acesso à documentação completa do Hawki. Use esse conhecimento para dar recomendações precisas, referenciando funcionalidades reais da plataforma (campos, variáveis, configurações, tools).

REGRAS:
- Seja específico e acionável — nada de conselhos genéricos
- Sempre que mencionar uma configuração, diga exatamente onde fica no Hawki (ex: "Bots → [seu bot] → Editar → Debounce")
- Use exemplos concretos com variáveis reais do Hawki ({{contact.custom.chave}})
- Formate a resposta em seções claras com markdown
- Se a informação fornecida for insuficiente para uma recomendação precisa, diga o que falta

DOCUMENTAÇÃO DO HAWKI RELEVANTE PARA ESTE MODO:
${docs}
`

  const moduleBlock = ['prompt', 'fullSetup', 'debug', 'conversaReal'].includes(modeId)
    ? `
ESTRUTURA DO PROMPT MANAGER (hawki-prompt-manager):
Os prompts nesta ferramenta são divididos em 10 módulos independentes.
Formato de cada módulo: ###MÓDULO:KEY### seguido do conteúdo.

Módulos disponíveis (na ordem canônica):
IDENTITY, INJECTION_PROTECTION, TONE_AND_STYLE, OPENING, ATTENDANCE_FLOW,
QUALIFICATION, OBJECTION_HANDLING, FEW_SHOT_EXAMPLES, AUDIO_AND_HANDOFF, ABSOLUTE_RULES

Quando sugerir correções a um prompt desta ferramenta, sempre indique:
- Qual ModuleKey (chave exata acima) é afetado
- O que adicionar/alterar especificamente naquele módulo
`
    : ''

  const modeInstructions: Record<CopilotModeId, string> = {
    cadencia: `
MODO: PLANEJADOR DE CADÊNCIA

Sua tarefa é montar um plano completo de cadência com base nas informações do usuário. Estruture a resposta assim:

## 1. Visão Geral da Cadência
- Objetivo, etapa do pipeline, duração total

## 2. Estrutura da Sequência
Para cada etapa:
- **Etapa N — Dia X**
  - Horário recomendado de disparo
  - Copy completo da mensagem (com variáveis {{contact.custom.*}} reais)
  - Objetivo dessa mensagem
  - Critério para avançar ou parar

## 3. Configurações Técnicas
- Janela de entrega (dias e horários)
- Tratamento de leads que respondem
- Campos personalizados a criar (se necessário)

## 4. Ajustes no Prompt do Bot
O que adicionar/mudar na Personalidade do bot para que ele saiba lidar com leads que chegam via essa cadência

## 5. Métricas para Acompanhar
O que monitorar no Monitor da cadência e em Analytics
`,

    prompt: `
MODO: REVISOR DE PROMPT

Sua tarefa é diagnosticar o prompt atual e propor melhorias cirúrgicas. Estruture assim:

## 1. Diagnóstico
- Seções presentes e ausentes
- Problemas identificados por seção
- Causa provável do problema relatado

## 2. O que está bom (não mexer)
Liste o que funciona e deve ser preservado

## 3. Mudanças recomendadas
Para cada mudança:
- **Seção:** [nome da seção]
- **Problema:** [o que está errado]
- **Substituir por:**
\`\`\`
[texto exato sugerido]
\`\`\`

## 4. Checklist de validação
Casos de teste para confirmar que a mudança funcionou
`,

    kb: `
MODO: ARQUITETO DE KB

Sua tarefa é definir o que vai na base de conhecimento e como estruturar. Responda assim:

## 1. O que vai no prompt vs. na KB
Tabela clara separando o que é estático (prompt) do que é consultado (KB)

## 2. Estrutura da Base de Conhecimento
Para cada entrada de KB sugerida:
- **Título:** [título descritivo]
- **Categoria:** [categoria]
- **Conteúdo:**
\`\`\`
[conteúdo estruturado em Pergunta + Resposta direta]
\`\`\`

## 3. Orientação no Prompt para RAG
O trecho exato a adicionar na seção de Ferramentas do prompt

## 4. O que NÃO entra na KB
Itens que ficam melhor no prompt ou não precisam de KB
`,

    config: `
MODO: CONFIGURADOR DE BOT

Sua tarefa é recomendar toda a configuração técnica. Responda assim:

## 1. Configurações do Bot
| Campo | Valor recomendado | Motivo |
Para: debounce, horário de atendimento, mensagem de boas-vindas, resposta por áudio

## 2. Tools a Ativar
Cada tool com: por que ativar, onde está no Hawki, orientação para o prompt

## 3. Integração de Agendamento
Qual integração usar, como configurar, o que incluir no prompt

## 4. Campos Personalizados Sugeridos
Quais criar em Conta → Campos e para que usar em cadências

## 5. Passo a Passo de Setup
Sequência exata de configuração com caminhos no Hawki
`,

    debug: `
MODO: DEBUGGER

Sua tarefa é diagnosticar o problema e indicar a correção mínima. Responda assim:

## 1. Diagnóstico
Causa mais provável do comportamento relatado

## 2. Descarte de causas (se aplicável)
O que NÃO é o problema e por quê

## 3. Correção recomendada
- **Onde mexer:** [seção exata do prompt ou configuração]
- **O que mudar:**
\`\`\`
[texto atual → texto sugerido]
\`\`\`

## 4. Como verificar
Casos de teste para confirmar a correção

## 5. Próximos passos se não resolver
Outras hipóteses em ordem de probabilidade
`,

    fullSetup: `
MODO: GERADOR DE FLUXO COMPLETO

Sua tarefa é gerar um setup completo e pronto para usar. Responda assim:

## 1. Prompt Completo (Personalidade)
O prompt completo nos 10 módulos do prompt manager, no formato:
###MÓDULO:IDENTITY###
[conteúdo]
###MÓDULO:INJECTION_PROTECTION###
[conteúdo]
... (todos os 10 módulos na ordem canônica: IDENTITY, INJECTION_PROTECTION, TONE_AND_STYLE, OPENING, ATTENDANCE_FLOW, QUALIFICATION, OBJECTION_HANDLING, FEW_SHOT_EXAMPLES, AUDIO_AND_HANDOFF, ABSOLUTE_RULES)

O output deve ser importável diretamente no prompt manager.

## 2. Base de Conhecimento
3–5 entradas de KB prioritárias, formatadas e prontas para cadastrar

## 3. Configuração do Bot
| Campo | Valor | Onde configurar |

## 4. Tools e Integrações
Quais ativar, nesta ordem, e o que incluir no prompt para cada uma

## 5. Primeira Cadência Recomendada
Nome, etapa do pipeline, sequência de mensagens com copy pronto

## 6. Ordem de Implantação
Sequência exata para colocar o bot no ar sem erros
`,

    conversaReal: `
MODO: ANÁLISE DE CONVERSA REAL

Sua tarefa é ler o transcript de uma conversa e identificar exatamente o que deu errado, por quê, e o que mudar.

Seja cirúrgico: não reescreva o prompt inteiro. Identifique a causa raiz e proponha a menor mudança possível que resolve o problema.

Estruture a resposta assim:

## 1. Leitura da Conversa
Resumo do que aconteceu em 2–3 linhas: fluxo geral, ponto de virada, desfecho

## 2. Falhas Identificadas
Para cada problema encontrado:
- **Mensagem:** cite o trecho exato onde ocorreu
- **O que aconteceu:** descrição do comportamento indesejado
- **Causa provável:** qual parte do prompt (ou ausência dela) gerou isso

## 3. Correções Recomendadas
Para cada falha, a correção mínima:
- **Seção do prompt a alterar:** [nome da seção]
- **Adicionar / substituir:**
\`\`\`
[texto exato sugerido]
\`\`\`

## 4. O que estava correto (não mexer)
Comportamentos do bot que funcionaram bem nessa conversa

## 5. Caso de teste para regressão
1 caso de teste baseado nessa conversa para garantir que a correção funciona e não quebra o restante
`,

    crm: `
MODO: PLANEJADOR DE CRM LEVE

Sua tarefa é definir quais campos personalizados criar no Hawki para o objetivo do usuário, como nomeá-los, e como usá-los em cadências e filtros.

Seja prático: começar com o mínimo necessário, não criar campos "para o futuro".

Estruture a resposta assim:

## 1. Campos a Criar
Para cada campo:
| Nome legível | Chave (snake_case) | Tipo | Por que esse campo |
|---|---|---|---|

Caminho para criar: Conta → aba "Campos" → Novo campo

## 2. Como Importar os Dados
Se o usuário tem uma lista de leads, como mapear as colunas do CSV para os campos criados
(Leads → Importar → mapear coluna → campo)

## 3. Uso em Cadências
Para cada campo relevante, o trecho de mensagem com a variável real:
\`\`\`
Oi {{contact.name}}! Vimos que sua última consulta foi em {{contact.custom.ultima_consulta}}...
\`\`\`

## 4. Segmentação e Filtros
Como usar os campos para filtrar leads em Leads → Filtros antes de adicionar à cadência

## 5. O que NÃO criar como campo
Informações que ficam melhor no prompt, na KB, ou que o bot coleta durante a conversa
`,
  }

  const clientBlock = clientContext
    ? `\n${clientContext}\n`
    : ''

  return base + clientBlock + moduleBlock + modeInstructions[modeId]
}
