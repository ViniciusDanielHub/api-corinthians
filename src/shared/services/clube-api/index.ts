// src/shared/services/clube-api/index.ts
//
// Client HTTP totalmente tipado para consumir a clube-api a partir
// do sports-news-api (server-to-server).
//
// Variáveis de ambiente necessárias no .env do sports-news-api:
//   CLUBE_API_URL=http://localhost:3010
//   CLUBE_API_KEY=<mesma chave configurada na clube-api>
//
// Estrutura interna:
//   types/entities.ts   → shapes retornados pela API
//   types/payloads.ts   → shapes dos POST/PATCH (admin)
//   types/queries.ts    → query params e respostas paginadas
//   http.ts             → função request genérica + ClubeApiError
//   public.routes.ts    → rotas GET públicas
//   admin.routes.ts     → rotas /api/admin/* (auth automática)

import { clubeApiPublic } from '../clube-api/public.routes';
import { clubeApiAdmin }  from '../clube-api/admin.routes';

export const clubeApi = {
  ...clubeApiPublic,
  admin: clubeApiAdmin,
};

export { ClubeApiError } from '../clube-api/http';
export * from '../clube-api/types';
