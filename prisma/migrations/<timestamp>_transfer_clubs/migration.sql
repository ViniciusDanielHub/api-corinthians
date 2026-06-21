-- CreateTable
CREATE TABLE "transfer_clubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfer_clubs_name_key" ON "transfer_clubs"("name");

-- AlterTable: troca a coluna texto "club" pela FK "clubId"
ALTER TABLE "player_movements" ADD COLUMN "clubId" TEXT;

-- Migra dados existentes: cria um TransferClub pra cada nome distinto
-- já usado em "club" e religa o movimento a ele.
INSERT INTO "transfer_clubs" ("id", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, DISTINCT_NAME, NOW(), NOW()
FROM (SELECT DISTINCT "club" AS DISTINCT_NAME FROM "player_movements" WHERE "club" IS NOT NULL) t;

UPDATE "player_movements" pm
SET "clubId" = tc."id"
FROM "transfer_clubs" tc
WHERE pm."club" = tc."name";

ALTER TABLE "player_movements" DROP COLUMN "club";

-- CreateIndex
CREATE INDEX "player_movements_clubId_idx" ON "player_movements"("clubId");

-- AddForeignKey
ALTER TABLE "player_movements" ADD CONSTRAINT "player_movements_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "transfer_clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;