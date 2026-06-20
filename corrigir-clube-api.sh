#!/usr/bin/env bash
#
# corrigir-clube-api.sh
#
# Aplica as correções discutidas no projeto clube-api:
#   1. Reescreve src/modules/squad/squad.routes.ts (faltavam imports,
#      estrutura de módulo, rota pública GET e DELETE admin).
#   2. Adiciona variáveis do Cloudinary no .env.example.
#   3. Cria tsconfig.json (exigido pelo Dockerfile e pelo build).
#   4. Corrige error-handler.plugin.ts (distingue P2003 de P2025).
#   5. Corrige matches.routes.ts (homeScore/awayScore usam null).
#
# Uso:
#   1. Copie este arquivo para a RAIZ do projeto clube-api
#      (a pasta que contém package.json, prisma/, src/).
#   2. Rode:  bash corrigir-clube-api.sh
#
# O script é seguro para rodar mais de uma vez (idempotente) e faz
# backup de cada arquivo modificado em .backup-clube-api/ antes de
# sobrescrever.

set -euo pipefail

# ─── Validação: precisa estar na raiz do projeto ──────────────────
if [ ! -f "package.json" ] || [ ! -d "src" ] || [ ! -d "prisma" ]; then
  echo "❌ Erro: rode este script na RAIZ do projeto clube-api"
  echo "   (a pasta precisa ter package.json, prisma/ e src/)."
  exit 1
fi

if ! grep -q '"name": "clube-api"' package.json 2>/dev/null; then
  echo "⚠️  Aviso: o package.json desta pasta não tem \"name\": \"clube-api\"."
  read -r -p "   Continuar mesmo assim? [y/N] " resp
  if [[ ! "$resp" =~ ^[Yy]$ ]]; then
    echo "Abortado."
    exit 1
  fi
fi

BACKUP_DIR=".backup-clube-api/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

backup_if_exists() {
  local f="$1"
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp "$f" "$BACKUP_DIR/$f"
  fi
}

echo "📦 Backup dos arquivos originais em: $BACKUP_DIR"
echo ""

# ════════════════════════════════════════════════════════════════
# 1. squad.routes.ts — reescrito (faltavam imports e estrutura)
# ════════════════════════════════════════════════════════════════
echo "1/5  Corrigindo src/modules/squad/squad.routes.ts ..."
mkdir -p src/modules/squad
backup_if_exists "src/modules/squad/squad.routes.ts"

cat > src/modules/squad/squad.routes.ts << 'EOF'
// src/modules/squad/squad.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireApiKey } from '../../shared/plugins/api-key.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';
import { deleteImageSafe } from '../../shared/services/cloudinary';

const uploadPlayerPhoto = createUploadHandler('players');

export async function squadPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/squad?category=sub-20  (slug da categoria)
  app.get('/squad', async (request, reply) => {
    const { category } = request.query as { category?: string };

    if (!category) {
      return reply.code(422).send({ error: 'O parâmetro "category" (slug) é obrigatório.' });
    }

    const players = await prisma.squadMember.findMany({
      where: {
        isActive: true,
        category: { slug: category },
      },
      orderBy: [{ shirtNumber: 'asc' }, { name: 'asc' }],
    });
    return reply.send(players);
  });
}

export async function squadAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireApiKey);

  // GET /api/admin/squad?categoryId=...  — inclui inativos
  app.get('/squad', async (request, reply) => {
    const { categoryId } = request.query as { categoryId?: string };
    const players = await prisma.squadMember.findMany({
      where: { ...(categoryId && { categoryId }) },
      orderBy: [{ shirtNumber: 'asc' }, { name: 'asc' }],
    });
    return reply.send(players);
  });

  // POST /api/admin/squad — multipart/form-data: campos + arquivo "photo"
  app.post('/squad', { preHandler: [uploadPlayerPhoto] }, async (request, reply) => {
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    if (!body.categoryId || !body.name) {
      return reply.code(422).send({ error: 'Campos obrigatórios: categoryId, name.' });
    }

    const player = await prisma.squadMember.create({
      data: {
        categoryId: body.categoryId,
        name: body.name.trim(),
        position: body.position,
        shirtNumber: body.shirtNumber !== undefined ? Number(body.shirtNumber) : undefined,
        photoUrl: uploadedFile?.path,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
      },
    });
    return reply.code(201).send(player);
  });

  // PATCH /api/admin/squad/:id
  app.patch('/squad/:id', { preHandler: [uploadPlayerPhoto] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    if (uploadedFile) {
      const existing = await prisma.squadMember.findUnique({ where: { id } });
      if (existing?.photoUrl) await deleteImageSafe(existing.photoUrl);
    }

    const player = await prisma.squadMember.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.position !== undefined && { position: body.position }),
        ...(body.shirtNumber !== undefined && {
          shirtNumber: body.shirtNumber === null ? null : Number(body.shirtNumber),
        }),
        ...(uploadedFile && { photoUrl: uploadedFile.path }),
        ...(body.birthDate !== undefined && {
          birthDate: body.birthDate ? new Date(body.birthDate) : null,
        }),
        ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
      },
    });
    return reply.send(player);
  });

  // DELETE /api/admin/squad/:id
  app.delete('/squad/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const player = await prisma.squadMember.findUnique({ where: { id } });
    if (player?.photoUrl) await deleteImageSafe(player.photoUrl);
    await prisma.squadMember.delete({ where: { id } });
    return reply.send({ message: 'Jogador deletado.' });
  });
}
EOF
echo "    ✅ ok"
echo ""

# ════════════════════════════════════════════════════════════════
# 2. .env.example — adiciona variáveis do Cloudinary, se faltarem
# ════════════════════════════════════════════════════════════════
echo "2/5  Verificando .env.example (variáveis do Cloudinary) ..."
if [ -f ".env.example" ]; then
  backup_if_exists ".env.example"
  if ! grep -q "CLOUDINARY_CLOUD_NAME" ".env.example"; then
    cat >> .env.example << 'EOF'

# Cloudinary — usado para upload de logos, escudos de adversários e fotos
# de jogadores (ver src/shared/services/cloudinary/index.ts).
# Crie uma conta gratuita em https://cloudinary.com e copie os 3 valores
# do painel "Dashboard".
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Pasta-raiz onde as imagens serão organizadas dentro do Cloudinary
# (logos/opponents/players ficam dentro dela). Opcional.
CLOUDINARY_FOLDER=clube-api
EOF
    echo "    ✅ variáveis do Cloudinary adicionadas"
  else
    echo "    ⏭️  já tinha variáveis do Cloudinary, nada a fazer"
  fi
else
  echo "    ⚠️  .env.example não encontrado na raiz, pulei essa etapa"
fi
echo ""

# ════════════════════════════════════════════════════════════════
# 3. tsconfig.json — cria se não existir
# ════════════════════════════════════════════════════════════════
echo "3/5  Verificando tsconfig.json ..."
if [ -f "tsconfig.json" ]; then
  echo "    ⏭️  já existe, não sobrescrevi (faça ajustes manuais se precisar)"
else
  cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitAny": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
EOF
  echo "    ✅ criado"
fi
echo ""

# ════════════════════════════════════════════════════════════════
# 4. error-handler.plugin.ts — distingue P2003 de P2025
# ════════════════════════════════════════════════════════════════
echo "4/5  Corrigindo src/shared/plugins/error-handler.plugin.ts ..."
mkdir -p src/shared/plugins
backup_if_exists "src/shared/plugins/error-handler.plugin.ts"

cat > src/shared/plugins/error-handler.plugin.ts << 'EOF'
// src/shared/plugins/error-handler.plugin.ts
import type { FastifyInstance } from 'fastify';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: `Rota não encontrada: ${request.method} ${request.url}` });
  });

  app.setErrorHandler((err: any, request, reply) => {
    if (err.code === 'P2002') {
      return reply.code(409).send({
        error: 'Já existe um registro com este valor único.',
        meta: process.env.NODE_ENV !== 'production' ? err.meta : undefined,
      });
    }

    // Registro não encontrado (update/delete em id inexistente)
    if (err.code === 'P2025') {
      return reply.code(404).send({ error: 'Registro não encontrado.' });
    }

    // Violação de FK: ou a referência informada não existe (create/update),
    // ou o registro está sendo usado em outro lugar e não pode ser deletado
    // (ex: Opponent com onDelete: Restrict que já tem partidas vinculadas).
    if (err.code === 'P2003') {
      const isDelete = request.method === 'DELETE';
      return reply.code(isDelete ? 409 : 422).send({
        error: isDelete
          ? 'Não é possível deletar: este registro está em uso por outro recurso (ex: partidas vinculadas).'
          : 'Referência inválida: o registro relacionado informado não existe.',
      });
    }

    if (err.validation) {
      return reply.code(422).send({ error: 'Dados inválidos.', details: err.validation });
    }

    const statusCode = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error({ err }, 'Erro interno');
    }
    reply.code(statusCode).send({
      error: statusCode >= 500
        ? 'Erro interno do servidor.'
        : (err.message || 'Erro na requisição.'),
    });
  });
}
EOF
echo "    ✅ ok"
echo ""

# ════════════════════════════════════════════════════════════════
# 5. matches.routes.ts — homeScore/awayScore usam null no POST
# ════════════════════════════════════════════════════════════════
echo "5/5  Corrigindo src/modules/matches/matches.routes.ts ..."
mkdir -p src/modules/matches
backup_if_exists "src/modules/matches/matches.routes.ts"

cat > src/modules/matches/matches.routes.ts << 'EOF'
// src/modules/matches/matches.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireApiKey } from '../../shared/plugins/api-key.plugin';

const matchInclude = {
  opponent: { select: { id: true, name: true, logoUrl: true } },
  competition: {
    select: { id: true, name: true, season: true, category: { select: { name: true, slug: true } } },
  },
} as const;

export async function matchesPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/matches?category=sub-20&status=SCHEDULED&limit=10
  app.get('/matches', async (request, reply) => {
    const { category, status, competitionId, limit } = request.query as {
      category?: string; status?: string; competitionId?: string; limit?: string;
    };

    const matches = await prisma.match.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(competitionId && { competitionId }),
        ...(category && { competition: { category: { slug: category } } }),
      },
      include: matchInclude,
      orderBy: { date: 'asc' },
      take: limit ? Math.min(Number(limit), 100) : 20,
    });
    return reply.send(matches);
  });

  // GET /api/matches/next?category=principal&limit=5
  app.get('/matches/next', async (request, reply) => {
    const { category, limit } = request.query as { category?: string; limit?: string };
    const matches = await prisma.match.findMany({
      where: {
        status: 'SCHEDULED',
        date: { gte: new Date() },
        ...(category && { competition: { category: { slug: category } } }),
      },
      include: matchInclude,
      orderBy: { date: 'asc' },
      take: limit ? Math.min(Number(limit), 50) : 5,
    });
    return reply.send(matches);
  });

  // GET /api/matches/recent?category=principal&limit=5
  app.get('/matches/recent', async (request, reply) => {
    const { category, limit } = request.query as { category?: string; limit?: string };
    const matches = await prisma.match.findMany({
      where: {
        status: 'FINISHED',
        ...(category && { competition: { category: { slug: category } } }),
      },
      include: matchInclude,
      orderBy: { date: 'desc' },
      take: limit ? Math.min(Number(limit), 50) : 5,
    });
    return reply.send(matches);
  });
}

export async function matchesAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireApiKey);

  app.get('/matches', async (request, reply) => {
    const { page = '1', limit = '20' } = request.query as any;
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Number(page) - 1) * take;

    const [data, total] = await Promise.all([
      prisma.match.findMany({ include: matchInclude, orderBy: { date: 'desc' }, skip, take }),
      prisma.match.count(),
    ]);
    return reply.send({ data, total, page: Number(page), limit: take });
  });

  app.post('/matches', async (request, reply) => {
    const body = request.body as any;
    if (!body.competitionId || !body.opponentId || !body.date) {
      return reply.code(422).send({ error: 'Campos obrigatórios: competitionId, opponentId, date.' });
    }
    const match = await prisma.match.create({
      data: {
        competitionId: body.competitionId,
        opponentId: body.opponentId,
        date: new Date(body.date),
        venue: body.venue,
        isHome: body.isHome ?? true,
        status: body.status ?? 'SCHEDULED',
        homeScore: body.homeScore !== undefined ? Number(body.homeScore) : null,
        awayScore: body.awayScore !== undefined ? Number(body.awayScore) : null,
        round: body.round,
      },
      include: matchInclude,
    });
    return reply.code(201).send(match);
  });

  app.patch('/matches/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const match = await prisma.match.update({
      where: { id },
      data: {
        ...(body.competitionId && { competitionId: body.competitionId }),
        ...(body.opponentId && { opponentId: body.opponentId }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.venue !== undefined && { venue: body.venue }),
        ...(body.isHome !== undefined && { isHome: Boolean(body.isHome) }),
        ...(body.status && { status: body.status }),
        ...(body.homeScore !== undefined && { homeScore: body.homeScore === null ? null : Number(body.homeScore) }),
        ...(body.awayScore !== undefined && { awayScore: body.awayScore === null ? null : Number(body.awayScore) }),
        ...(body.round !== undefined && { round: body.round }),
      },
      include: matchInclude,
    });
    return reply.send(match);
  });

  app.delete('/matches/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.match.delete({ where: { id } });
    return reply.send({ message: 'Partida deletada.' });
  });
}
EOF
echo "    ✅ ok"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ Todas as correções foram aplicadas."
echo "   Backup dos arquivos originais em: $BACKUP_DIR"
echo ""
echo "Próximos passos sugeridos:"
echo "  1. npm install"
echo "  2. npx prisma generate"
echo "  3. npm run dev"
echo "════════════════════════════════════════════════════════════"
