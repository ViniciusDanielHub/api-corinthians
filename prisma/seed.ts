// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const name = process.env.SEED_TEAM_NAME || 'Meu Clube';
  const shortName = process.env.SEED_TEAM_SHORT_NAME || name;

  const team = await prisma.team.upsert({
    where: { id: 'main' },
    update: {},
    create: { id: 'main', name, shortName },
  });

  console.log('✅ Team (singleton) pronto:', team.name);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
