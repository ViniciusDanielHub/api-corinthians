-- AlterTable
ALTER TABLE "player_movements" ADD COLUMN     "currency" TEXT DEFAULT 'BRL',
ADD COLUMN     "valueCents" BIGINT;

-- AlterTable
ALTER TABLE "transfer_clubs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "player_movements_type_date_valueCents_idx" ON "player_movements"("type", "date", "valueCents");
