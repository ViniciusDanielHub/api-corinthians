// src/shared/services/clube-api/types/payloads.ts
//
// Tipos dos corpos de requisição (payloads) aceitos pelas rotas
// /api/admin/* da clube-api. Espelham o que cada controller lê de
// request.body — ver os arquivos *.routes.ts do projeto clube-api.

import type { Gender, Modality, MatchStatus, Zone, MovementType } from './entities';

// ─── Time ─────────────────────────────────────────────────────
// PATCH /api/admin/team é multipart/form-data (campo de arquivo "logo"),
// mas os campos de texto seguem este formato.
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
// POST/PATCH /api/admin/opponents são multipart/form-data
// (campo de arquivo "logo"); "name" é o único campo de texto.
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
  date: string; // ISO 8601
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
  date?: string; // ISO 8601
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
  form?: string; // ex: "L,D,W,L,W"
  zone?: Zone;
}

// Linha usada no replace em massa (PUT .../bulk) — mesmos campos do
// upsert, mas sem competitionId (já vai na URL)
export type BulkStandingRow = Omit<UpsertStandingRowPayload, 'competitionId'>;

// ─── Elenco ───────────────────────────────────────────────────
// POST/PATCH /api/admin/squad são multipart/form-data
// (campo de arquivo "photo"); os demais campos seguem este formato.
export interface CreateSquadMemberPayload {
  categoryId: string;
  name: string;
  position?: string;
  shirtNumber?: number;
  birthDate?: string; // ISO 8601 (date)
}

export interface UpdateSquadMemberPayload {
  name?: string;
  position?: string;
  shirtNumber?: number | null;
  birthDate?: string | null; // ISO 8601 (date)
  isActive?: boolean;
}

// ─── Movimentações de elenco ─────────────────────────────────
export interface CreatePlayerMovementPayload {
  squadMemberId: string;
  type: MovementType;
  date: string; // ISO 8601
  club?: string;
  notes?: string;
}

export interface UpdatePlayerMovementPayload {
  type?: MovementType;
  date?: string; // ISO 8601
  club?: string;
  notes?: string;
}