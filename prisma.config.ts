// Loads .env.local first (Next.js convention), then falls back to .env.
// For migrations / db push, prefer DIRECT_URL (port 5432, session mode) — Prisma's
// schema engine hangs on Supabase transaction-mode pooler (port 6543).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { defineConfig } from "prisma/config";

const PG_URL =
  process.env["DIRECT_URL"] ??
  // Auto-derive session-mode URL from transaction-mode pooler if DIRECT_URL absent.
  process.env["DATABASE_URL"]?.replace(":6543/", ":5432/") ??
  process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: PG_URL,
  },
});
