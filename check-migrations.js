const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;'
  );
  console.log(rows);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());