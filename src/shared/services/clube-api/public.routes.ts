// src/shared/services/clube-api/public.routes.ts
//
// Rotas públicas da clube-api (não exigem x-api-key).

import { request, buildQueryString } from './http';
import type {
  Team,
  Category,
  CompetitionWithCategory,
  Opponent,
  MatchWithRelations,
  StandingEntryWithGoalDifference,
  SquadMember,
  PlayerMovement,
  PlayerMovementWithSquadMember,
  TransferClub,
} from './types/entities';
import type {
  ListMatchesParams,
  NextOrRecentMatchesParams,
  RecentMovementsParams,
} from './types/queries';

export const clubeApiPublic = {
  team: {
    get: () => request<Team>('/api/team'),
  },

  categories: {
    list: () => request<Category[]>('/api/categories'),
    getBySlug: (slug: string) => request<Category>(`/api/categories/${slug}`),
  },

  competitions: {
    list: (categorySlug?: string) =>
      request<CompetitionWithCategory[]>(
        `/api/competitions${categorySlug ? `?category=${categorySlug}` : ''}`,
      ),
  },

  opponents: {
    list: () => request<Opponent[]>('/api/opponents'),
  },

  matches: {
    list: (params?: ListMatchesParams) =>
      request<MatchWithRelations[]>(`/api/matches${buildQueryString(params)}`),
    next: (params?: NextOrRecentMatchesParams) =>
      request<MatchWithRelations[]>(`/api/matches/next${buildQueryString(params)}`),
    recent: (params?: NextOrRecentMatchesParams) =>
      request<MatchWithRelations[]>(`/api/matches/recent${buildQueryString(params)}`),
  },

  standings: {
    get: (competitionId: string) =>
      request<StandingEntryWithGoalDifference[]>(`/api/standings/${competitionId}`),
  },

  squad: {
    list: (categorySlug: string) =>
      request<SquadMember[]>(`/api/squad?category=${categorySlug}`),
  },
  // Movimentações de elenco (entradas e saídas do clube)
  movements: {
    // Histórico de um jogador específico
    listByPlayer: (squadMemberId: string) =>
      request<PlayerMovement[]>(`/api/squad/${squadMemberId}/movements`),
    // Últimas movimentações do clube (home, página de transferências...)
    recent: (params?: RecentMovementsParams) =>
      request<PlayerMovementWithSquadMember[]>(`/api/movements/recent${buildQueryString(params)}`),
  },

  transferClubs: {
    list: () => request<TransferClub[]>('/api/transfer-clubs'),
  },

};