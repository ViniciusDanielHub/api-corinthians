// src/shared/services/clube-api/types/queries.ts
//
// Tipos dos parâmetros de query e respostas paginadas do client.

import type { MatchStatus, MovementType } from './entities';

// ─── Query params ─────────────────────────────────────────────
export interface ListMatchesParams {
  category?: string;
  status?: MatchStatus;
  competitionId?: string;
  limit?: number;
}

export interface NextOrRecentMatchesParams {
  category?: string;
  limit?: number;
}

export interface ListAdminMatchesParams {
  page?: number;
  limit?: number;
}

export interface ListAdminSquadParams {
  categoryId?: string;
}

export interface RecentMovementsParams {
  limit?: number;
  type?: MovementType;
}

export interface ListAdminMovementsParams {
  page?: number;
  limit?: number;
  squadMemberId?: string;
}

// ─── Respostas paginadas ──────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Respostas simples ────────────────────────────────────────
export interface MessageResponse {
  message: string;
}

export interface BulkReplaceResponse {
  message: string;
}
