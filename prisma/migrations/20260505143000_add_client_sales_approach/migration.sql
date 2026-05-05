-- CreateEnum
CREATE TYPE "ClientSalesApproach" AS ENUM ('DIRECT', 'BALANCED', 'CONSULTATIVE_SPIN', 'ADAPTIVE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "salesApproach" "ClientSalesApproach" NOT NULL DEFAULT 'ADAPTIVE';
