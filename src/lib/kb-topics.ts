export const KB_TOPICS = [
  { key: "localizacao",       title: "Localização e Horários" },
  { key: "primeira_consulta", title: "Primeira Consulta" },
  { key: "procedimentos",     title: "Procedimentos e Expectativas" },
  { key: "precos_pagamento",  title: "Preços e Pagamento" },
  { key: "convenios",         title: "Convênios e Planos" },
  { key: "diferenciais",      title: "Diferenciais da Clínica" },
  { key: "urgencias",         title: "Protocolo de Urgência" },
  { key: "pos_procedimento",  title: "Cuidados Pós-Procedimento" },
  { key: "faq_clinico",       title: "FAQ Clínico" },
] as const;

export type KbTopicKey = (typeof KB_TOPICS)[number]["key"];
