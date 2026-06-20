# clube-api

API isolada do clube: time único, categorias (Principal, Sub-20, Sub-17, Sub-15,
Sub-13, Futsal, Basquete...), campeonatos, adversários, partidas, tabela de
classificação (digitada manualmente) e elenco por categoria.

Sem APIs externas — só CRUD + leitura, mesma stack do sports-news-api
(Fastify + Prisma + TypeScript).

## Subir o projeto

```bash
cp .env.example .env
# edite o .env: gere uma CLUBE_API_KEY forte (ex: openssl rand -hex 32)

docker compose -f docker-compose.dev.yml up -d   # só o Postgres, na porta 5441
npm install
npm run db:migrate
npm run db:seed       # cria o registro singleton do Team
npm run dev            # http://localhost:3010
```

## Modelo de dados

```
Team (singleton, id="main")
Category (Principal, Sub-20, Futsal, Basquete...) — gender + modality
Competition (pertence a uma Category; ex: "Brasileirão Sub-20 2026")
Opponent (reutilizável entre partidas)
Match (competitionId + opponentId + data + placar)
StandingEntry (linha da tabela, digitada manualmente — não calculada)
SquadMember (elenco, por categoria)
```

## Rotas

### Públicas (leitura — sem autenticação)
```
GET /api/team
GET /api/categories
GET /api/categories/:slug
GET /api/competitions?category=<slug>
GET /api/opponents
GET /api/matches?category=&status=&competitionId=&limit=
GET /api/matches/next?category=&limit=
GET /api/matches/recent?category=&limit=
GET /api/standings/:competitionId
GET /api/squad?category=<slug>
```

### Admin (escrita — exigem header `x-api-key: <CLUBE_API_KEY>`)
```
PATCH /api/admin/team
GET|POST|PATCH|DELETE /api/admin/categories
GET|POST|PATCH|DELETE /api/admin/competitions
POST|PATCH|DELETE      /api/admin/opponents
GET|POST|PATCH|DELETE /api/admin/matches
POST   /api/admin/standings                       (upsert 1 linha)
PUT    /api/admin/standings/:competitionId/bulk    (substitui a tabela inteira — cole e cole de outro site)
DELETE /api/admin/standings/:id
GET|POST|PATCH|DELETE /api/admin/squad
```

## Por que API key e não JWT/roles aqui?

Esta API não tem login de usuário. Quem decide **quem** pode cadastrar
o quê é o painel admin do sports-news-api, que já tem usuários e roles.
O sports-news-api chama esta API **server-to-server** com uma chave
compartilhada (`x-api-key`) — é o jeito mais simples e seguro de ligar
os dois projetos sem duplicar autenticação.

## Como consumir no sports-news-api (API principal)

1. Copie `CONSUMIR-NO-SPORTS-NEWS-API/clube-api-client.ts` para
   `src/shared/services/clube-api/index.ts` no projeto sports-news-api.

2. Adicione no `.env` do sports-news-api:
   ```
   CLUBE_API_URL=http://localhost:3010
   CLUBE_API_KEY=<a mesma chave que você colocou no .env da clube-api>
   ```
   Em produção, se os dois rodarem no mesmo Docker network, use o nome
   do serviço (`http://clube-api:3010`) em vez de localhost.

3. Use o client em qualquer controller/route do painel admin:
   ```ts
   import { clubeApi } from '../../shared/services/clube-api';

   // Exemplo: rota nova no admin pra listar próximos jogos do time principal
   app.get('/admin/clube/matches/next', async (_req, reply) => {
     const matches = await clubeApi.matches.next({ category: 'principal', limit: 5 });
     return reply.send(matches);
   });

   // Exemplo: cadastrar uma partida nova a partir do formulário do admin
   app.post('/admin/clube/matches', async (request, reply) => {
     const match = await clubeApi.admin.matches.create(request.body);
     return reply.code(201).send(match);
   });
   ```

4. No front do admin (React), basta apontar os formulários novos para
   essas rotas que você criar no sports-news-api — o front nunca precisa
   saber que existe uma segunda API por trás.

Isso te dá: zero duplicação de auth, zero CORS extra exposto ao público
(o front nunca fala direto com a clube-api), e os dois bancos continuam
totalmente independentes.
