const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRawUnsafe(
    `UPDATE _prisma_migrations
     SET migration_name = '20260620120000_transfer_clubs'
     WHERE migration_name = '<timestamp>_transfer_clubs';`
  );
  console.log('Linhas atualizadas:', result);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());