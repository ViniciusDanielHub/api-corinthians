-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('ARRIVAL', 'DEPARTURE', 'LOAN_OUT', 'LOAN_IN', 'RETURN');

-- CreateTable
CREATE TABLE "player_movements" (
    "id" TEXT NOT NULL,
    "squadMemberId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "club" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_movements_squadMemberId_idx" ON "player_movements"("squadMemberId");

-- CreateIndex
CREATE INDEX "player_movements_date_idx" ON "player_movements"("date");

-- CreateIndex
CREATE INDEX "player_movements_type_date_idx" ON "player_movements"("type", "date");

-- AddForeignKey
ALTER TABLE "player_movements" ADD CONSTRAINT "player_movements_squadMemberId_fkey" FOREIGN KEY ("squadMemberId") REFERENCES "squad_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;