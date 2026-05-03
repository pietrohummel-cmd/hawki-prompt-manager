/**
 * Constantes para o sistema Inteligência Hawki.
 * Estes valores alimentam o pipeline cross-tenant de conhecimento.
 */

import type { ServiceCategory } from "@/generated/prisma";

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  IMPLANTES:    "Implantes",
  ORTODONTIA:   "Ortodontia",
  ESTETICA:     "Estética",
  CLINICO_GERAL:"Clínico Geral",
  PERIODONTIA:  "Periodontia",
  ENDODONTIA:   "Endodontia",
  PEDIATRIA:    "Odontopediatria",
  PROTESE:      "Prótese",
  CIRURGIA:     "Cirurgia",
  OUTROS:       "Outros",
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS) as ServiceCategory[];

/** Emails autorizados a aprovar/rejeitar interações no painel de curadoria.
 *  Em desenvolvimento, a restrição é ignorada — qualquer usuário autenticado tem acesso.
 *  Em produção, defina INTELLIGENCE_ADMIN_EMAILS no .env com emails separados por vírgula.
 */
export const INTELLIGENCE_ADMIN_EMAILS = (
  process.env.INTELLIGENCE_ADMIN_EMAILS ?? "contato@hawki.com.br"
)
  .split(",")
  .map((e) => e.trim().toLowerCase());

/** Em desenvolvimento local, qualquer usuário autenticado é considerado admin. */
export const INTELLIGENCE_DEV_BYPASS = process.env.NODE_ENV === "development";

/** Quanto de cada padrão a incluir por categoria na injeção de conhecimento. */
export const MAX_INSIGHTS_PER_INJECTION = 5;
