// src/shared/services/clube-api/types/entities.ts
//
// Tipos das entidades retornadas pela clube-api, espelhando
// prisma/schema.prisma. Mantenha sincronizado se o schema mudar.

// ─── Enums ────────────────────────────────────────────────────
export type Gender = 'MALE' | 'FEMALE';
export type Modality = 'FOOTBALL' | 'FUTSAL' | 'BASKETBALL';
export type MatchStatus = 'SCHEDULED' | 'IN_PLAY' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
export type Zone =
  | 'NONE'
  | 'TITLE'
  | 'LIBERTADORES'
  | 'LIBERTADORES_PRELIMINARY'
  | 'SULAMERICANA'
  | 'RELEGATION';
export type MovementType = 'ARRIVAL' | 'DEPARTURE' | 'LOAN_OUT' | 'LOAN_IN' | 'RETURN';

// ─── Time (singleton) ────────────────────────────────────────
export interface Team {
  id: 'main';
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  foundedYear: number | null;
  stadium: string | null;
  city: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Categoria ────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  slug: string;
  gender: Gender;
  modality: Modality;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategorySummary {
  name: string;
  slug: string;
}

// ─── Competição ───────────────────────────────────────────────
export interface Competition {
  id: string;
  name: string;
  season: string;
  categoryId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitionWithCategory extends Competition {
  category: CategorySummary;
}

// ─── Adversário ───────────────────────────────────────────────
export interface Opponent {
  id: string;
  name: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpponentSummary {
  id: string;
  name: string;
  logoUrl: string | null;
}

// ─── Partida ──────────────────────────────────────────────────
export interface Match {
  id: string;
  competitionId: string;
  opponentId: string;
  date: string;
  venue: string | null;
  isHome: boolean;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  round: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchCompetitionSummary {
  id: string;
  name: string;
  season: string;
  category: CategorySummary;
}

export interface MatchWithRelations extends Match {
  opponent: OpponentSummary;
  competition: MatchCompetitionSummary;
}

// ─── Linha da tabela de classificação ────────────────────────
export interface StandingEntry {
  id: string;
  competitionId: string;
  position: number;
  teamName: string;
  logoUrl: string | null;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  isOwnTeam: boolean;
  form: string | null; // ex: "L,D,W,L,W" (mais antigo → mais recente)
  zone: Zone;
  createdAt: string;
  updatedAt: string;
}

export interface StandingEntryWithGoalDifference extends StandingEntry {
  goalDifference: number;
}

// ─── Jogador (elenco) ─────────────────────────────────────────
export interface SquadMember {
  id: string;
  categoryId: string;
  name: string;
  position: string | null;
  shirtNumber: number | null;
  photoUrl: string | null;
  birthDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SquadMemberSummary {
  id: string;
  name: string;
  photoUrl: string | null;
  shirtNumber: number | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

// ─── Clube de transferência (entidade reutilizável) ───────────
// Representa o "outro lado" de uma movimentação de elenco —
// o clube de onde o jogador veio ou pra onde ele foi.
export interface TransferClub {
  id: string;
  name: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransferClubSummary {
  id: string;
  name: string;
  logoUrl: string | null;
}

// ─── Movimentação de elenco ───────────────────────────────────
export interface PlayerMovement {
  id: string;
  squadMemberId: string;
  type: MovementType;
  date: string;
  clubId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PlayerMovementWithSquadMember extends PlayerMovement {
  squadMember: SquadMemberSummary;
  club: TransferClubSummary | null; // null em RETURN
}