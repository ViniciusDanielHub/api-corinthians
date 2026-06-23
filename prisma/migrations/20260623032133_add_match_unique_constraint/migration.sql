/*
  Warnings:

  - A unique constraint covering the columns `[competitionId,opponentId,date]` on the table `matches` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[squadMemberId,type,date,clubId]` on the table `player_movements` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "matches_competitionId_opponentId_date_key" ON "matches"("competitionId", "opponentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "player_movements_squadMemberId_type_date_clubId_key" ON "player_movements"("squadMemberId", "type", "date", "clubId");
