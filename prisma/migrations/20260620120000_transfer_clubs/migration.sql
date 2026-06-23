-- Garante função de UUID disponível (Postgres 13+ já tem nativo,
-- mas isso protege caso a imagem use uma versão mais antiga)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "transfer_clubs" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "logoUrl"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfer_clubs_name_key" ON "transfer_clubs"("name");

-- AlterTable: adiciona a FK "clubId" (ainda mantendo "club" por ora)
ALTER TABLE "player_movements" ADD COLUMN "clubId" TEXT;

-- Migra dados existentes: cria um TransferClub pra cada nome distinto
-- já usado em "club" (ignorando NULL, string vazia e espaços nas pontas)
INSERT INTO "transfer_clubs" ("id", "name", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  trimmed_name,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT TRIM("club") AS trimmed_name
  FROM "player_movements"
  WHERE "club" IS NOT NULL AND TRIM("club") <> ''
) AS distinct_clubs;

-- Religa cada movimento ao TransferClub correspondente (comparando já com TRIM)
UPDATE "player_movements" pm
SET "clubId" = tc."id"
FROM "transfer_clubs" tc
WHERE TRIM(pm."club") = tc."name"
  AND pm."club" IS NOT NULL
  AND TRIM(pm."club") <> '';

-- Remove a coluna texto antiga, agora que os dados foram migrados
ALTER TABLE "player_movements" DROP COLUMN "club";

-- CreateIndex
CREATE INDEX "player_movements_clubId_idx" ON "player_movements"("clubId");

-- AddForeignKey
ALTER TABLE "player_movements"
  ADD CONSTRAINT "player_movements_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "transfer_clubs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;