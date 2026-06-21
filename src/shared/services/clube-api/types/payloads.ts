// src/shared/services/clube-api/types/payloads.ts
//
// Tipos dos corpos de requisição aceitos pelas rotas /api/admin/*
// da clube-api. Espelham o que cada controller lê de request.body.

import type { Gender, Modality, MatchStatus, Zone, MovementType } from './entities';

// ─── Time ─────────────────────────────────────────────────────
export interface UpdateTeamPayload {
  name?: string;
  shortName?: string;
  foundedYear?: number;
  stadium?: string;
  city?: string;
  website?: string;
}

// ─── Categorias ───────────────────────────────────────────────
export interface CreateCategoryPayload {
  name: string;
  gender?: Gender;
  modality?: Modality;
  order?: number;
}

export interface UpdateCategoryPayload {
  name?: string;
  gender?: Gender;
  modality?: Modality;
  order?: number;
  isActive?: boolean;
}

// ─── Competições ──────────────────────────────────────────────
export interface CreateCompetitionPayload {
  name: string;
  season: string;
  categoryId: string;
}

export interface UpdateCompetitionPayload {
  name?: string;
  season?: string;
  isActive?: boolean;
}

// ─── Adversários ──────────────────────────────────────────────
export interface CreateOpponentPayload {
  name: string;
}

export interface UpdateOpponentPayload {
  name?: string;
}

// ─── Partidas ─────────────────────────────────────────────────
export interface CreateMatchPayload {
  competitionId: string;
  opponentId: string;
  date: string;
  venue?: string;
  isHome?: boolean;
  status?: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  round?: string;
}

export interface UpdateMatchPayload {
  competitionId?: string;
  opponentId?: string;
  date?: string;
  venue?: string;
  isHome?: boolean;
  status?: MatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  round?: string;
}

// ─── Tabela de classificação ─────────────────────────────────
export interface UpsertStandingRowPayload {
  competitionId: string;
  position: number;
  teamName: string;
  logoUrl?: string;
  points?: number;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  isOwnTeam?: boolean;
  form?: string;
  zone?: Zone;
}

export type BulkStandingRow = Omit<UpsertStandingRowPayload, 'competitionId'>;

// ─── Elenco ───────────────────────────────────────────────────
export interface CreateSquadMemberPayload {
  categoryId: string;
  name: string;
  position?: string;
  shirtNumber?: number;
  birthDate?: string;
}

export interface UpdateSquadMemberPayload {
  name?: string;
  position?: string;
  shirtNumber?: number | null;
  birthDate?: string | null;
  isActive?: boolean;
}

// ─── Movimentações ────────────────────────────────────────────
export interface CreatePlayerMovementPayload {
  squadMemberId: string;
  type: MovementType;
  date: string;
  club?: string;
  notes?: string;
}

export interface UpdatePlayerMovementPayload {
  type?: MovementType;
  date?: string;
  club?: string;
  notes?: string;
}

export interface CreateTransferClubPayload {
  name: string;
}
export interface UpdateTransferClubPayload {
  name?: string;
}

export interface CreatePlayerMovementPayload {
  squadMemberId: string;
  type: MovementType;
  date: string;
  clubId?: string;
  notes?: string;
}

export interface UpdatePlayerMovementPayload {
  type?: MovementType;
  date?: string;
  clubId?: string | null;
  notes?: string;
}
