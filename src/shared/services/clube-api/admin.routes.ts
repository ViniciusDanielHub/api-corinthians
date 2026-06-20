// src/shared/services/clube-api/admin.routes.ts
//
// Rotas /api/admin/* da clube-api (exigem x-api-key, enviado
// automaticamente pela função request quando auth: true).

import { request, buildQueryString } from './http';
import type {
  Team,
  Category,
  Competition,
  CompetitionWithCategory,
  Opponent,
  Match,
  MatchWithRelations,
  StandingEntryWithGoalDifference,
  SquadMember,
  PlayerMovement,
  PlayerMovementWithSquadMember,
} from './types/entities';
import type {
  UpdateTeamPayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CreateCompetitionPayload,
  UpdateCompetitionPayload,
  CreateOpponentPayload,
  UpdateOpponentPayload,
  CreateMatchPayload,
  UpdateMatchPayload,
  UpsertStandingRowPayload,
  BulkStandingRow,
  CreateSquadMemberPayload,
  UpdateSquadMemberPayload,
  CreatePlayerMovementPayload,
  UpdatePlayerMovementPayload,
} from './types/payloads';
import type {
  ListAdminMatchesParams,
  ListAdminSquadParams,
  ListAdminMovementsParams,
  PaginatedResponse,
  MessageResponse,
  BulkReplaceResponse,
} from './types/queries';

export const clubeApiAdmin = {
  team: {
    update: (data: UpdateTeamPayload) =>
      request<Team, UpdateTeamPayload>('/api/admin/team', { method: 'PATCH', body: data, auth: true }),
  },

  categories: {
    list: () => request<Category[]>('/api/admin/categories', { auth: true }),
    create: (data: CreateCategoryPayload) =>
      request<Category, CreateCategoryPayload>('/api/admin/categories', {
        method: 'POST', body: data, auth: true,
      }),
    update: (id: string, data: UpdateCategoryPayload) =>
      request<Category, UpdateCategoryPayload>(`/api/admin/categories/${id}`, {
        method: 'PATCH', body: data, auth: true,
      }),
    delete: (id: string) =>
      request<MessageResponse>(`/api/admin/categories/${id}`, { method: 'DELETE', auth: true }),
  },

  competitions: {
    list: () => request<CompetitionWithCategory[]>('/api/admin/competitions', { auth: true }),
    create: (data: CreateCompetitionPayload) =>
      request<Competition, CreateCompetitionPayload>('/api/admin/competitions', {
        method: 'POST', body: data, auth: true,
      }),
    update: (id: string, data: UpdateCompetitionPayload) =>
      request<Competition, UpdateCompetitionPayload>(`/api/admin/competitions/${id}`, {
        method: 'PATCH', body: data, auth: true,
      }),
    delete: (id: string) =>
      request<MessageResponse>(`/api/admin/competitions/${id}`, { method: 'DELETE', auth: true }),
  },

  opponents: {
    // multipart/form-data na API real (campo de arquivo "logo");
    // aqui tipamos o payload de texto — anexe o FormData no caller
    // se for enviar logo, adaptando o transporte conforme necessário.
    create: (data: CreateOpponentPayload) =>
      request<Opponent, CreateOpponentPayload>('/api/admin/opponents', {
        method: 'POST', body: data, auth: true,
      }),
    update: (id: string, data: UpdateOpponentPayload) =>
      request<Opponent, UpdateOpponentPayload>(`/api/admin/opponents/${id}`, {
        method: 'PATCH', body: data, auth: true,
      }),
    delete: (id: string) =>
      request<MessageResponse>(`/api/admin/opponents/${id}`, { method: 'DELETE', auth: true }),
  },

  matches: {
    list: (params?: ListAdminMatchesParams) =>
      request<PaginatedResponse<MatchWithRelations>>(
        `/api/admin/matches${buildQueryString({ page: params?.page ?? 1, limit: params?.limit ?? 20 })}`,
        { auth: true },
      ),
    create: (data: CreateMatchPayload) =>
      request<MatchWithRelations, CreateMatchPayload>('/api/admin/matches', {
        method: 'POST', body: data, auth: true,
      }),
    update: (id: string, data: UpdateMatchPayload) =>
      request<MatchWithRelations, UpdateMatchPayload>(`/api/admin/matches/${id}`, {
        method: 'PATCH', body: data, auth: true,
      }),
    delete: (id: string) =>
      request<MessageResponse>(`/api/admin/matches/${id}`, { method: 'DELETE', auth: true }),
  },

  standings: {
    upsertRow: (data: UpsertStandingRowPayload) =>
      request<StandingEntryWithGoalDifference, UpsertStandingRowPayload>('/api/admin/standings', {
        method: 'POST', body: data, auth: true,
      }),
    bulkReplace: (competitionId: string, rows: BulkStandingRow[]) =>
      request<BulkReplaceResponse, BulkStandingRow[]>(
        `/api/admin/standings/${competitionId}/bulk`,
        { method: 'PUT', body: rows, auth: true },
      ),
    deleteRow: (id: string) =>
      request<MessageResponse>(`/api/admin/standings/${id}`, { method: 'DELETE', auth: true }),
  },

  squad: {
    list: (params?: ListAdminSquadParams) =>
      request<SquadMember[]>(`/api/admin/squad${buildQueryString(params)}`, { auth: true }),
    // multipart/form-data na API real (campo de arquivo "photo");
    // payload de texto tipado aqui — adapte o transporte se for
    // enviar a foto junto.
    create: (data: CreateSquadMemberPayload) =>
      request<SquadMember, CreateSquadMemberPayload>('/api/admin/squad', {
        method: 'POST', body: data, auth: true,
      }),
    update: (id: string, data: UpdateSquadMemberPayload) =>
      request<SquadMember, UpdateSquadMemberPayload>(`/api/admin/squad/${id}`, {
        method: 'PATCH', body: data, auth: true,
      }),
    delete: (id: string) =>
      request<MessageResponse>(`/api/admin/squad/${id}`, { method: 'DELETE', auth: true }),
  },

  movements: {
    list: (params?: ListAdminMovementsParams) =>
      request<PaginatedResponse<PlayerMovementWithSquadMember>>(
        `/api/admin/movements${buildQueryString(params)}`,
        { auth: true },
      ),
    create: (data: CreatePlayerMovementPayload) =>
      request<PlayerMovementWithSquadMember, CreatePlayerMovementPayload>('/api/admin/movements', {
        method: 'POST', body: data, auth: true,
      }),
    update: (id: string, data: UpdatePlayerMovementPayload) =>
      request<PlayerMovementWithSquadMember, UpdatePlayerMovementPayload>(`/api/admin/movements/${id}`, {
        method: 'PATCH', body: data, auth: true,
      }),
    delete: (id: string) =>
      request<MessageResponse>(`/api/admin/movements/${id}`, { method: 'DELETE', auth: true }),
  },
};