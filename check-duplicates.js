const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Partidas duplicadas (mesma competição + adversário + data) ---');
  const matchDupes = await prisma.$queryRawUnsafe(`
    SELECT "competitionId", "opponentId", "date", COUNT(*) as total
    FROM "matches"
    GROUP BY "competitionId", "opponentId", "date"
    HAVING COUNT(*) > 1;
  `);
  console.log(matchDupes.length === 0 ? 'Nenhuma duplicata encontrada.' : matchDupes);

  console.log('\n--- Movimentações duplicadas (mesmo jogador + tipo + data + clube) ---');
  const movementDupes = await prisma.$queryRawUnsafe(`
    SELECT "squadMemberId", "type", "date", "clubId", COUNT(*) as total
    FROM "player_movements"
    GROUP BY "squadMemberId", "type", "date", "clubId"
    HAVING COUNT(*) > 1;
  `);
  console.log(movementDupes.length === 0 ? 'Nenhuma duplicata encontrada.' : movementDupes);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());