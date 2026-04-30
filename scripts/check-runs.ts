import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const runs = await prisma.regressionRun.findMany({
    orderBy: { runAt: "desc" },
    take: 10,
    include: { case: { select: { name: true, clientId: true } } },
  });
  console.log(`Total runs recentes: ${runs.length}`);
  runs.forEach((r) =>
    console.log(`  ${r.runAt.toISOString().slice(11, 19)}  ${r.status}  ${r.case.name}`)
  );
}

main().catch(console.error).finally(() => pool.end());
