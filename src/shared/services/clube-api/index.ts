// src/shared/services/clube-api/index.ts
//
// Client HTTP da clube-api (projeto separado), totalmente tipado.
// Cole esta pasta inteira dentro do sports-news-api e use nas
// controllers do painel admin que vão exibir/cadastrar dados do clube.
//
// Variáveis de ambiente necessárias no sports-news-api (.env):
//   CLUBE_API_URL=http://localhost:3010   (ou a URL de produção)
//   CLUBE_API_KEY=<mesma chave configurada na clube-api>
//
// Estrutura:
//   types/entities.ts   → shapes retornados pela API (Team, Match, etc.)
//   types/payloads.ts   → shapes esperados nos POST/PATCH (admin)
//   types/queries.ts    → query params e respostas paginadas
//   http.ts             → função request genérica + ClubeApiError
//   public.routes.ts    → rotas públicas (sem auth)
//   admin.routes.ts     → rotas /api/admin/* (com x-api-key)

import { clubeApiPublic } from './public.routes';
import { clubeApiAdmin } from './admin.routes';

export const clubeApi = {
  ...clubeApiPublic,
  admin: clubeApiAdmin,
};

export { ClubeApiError } from './http';
export * from './types';