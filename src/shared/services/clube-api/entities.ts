// src/shared/services/clube-api/types/entities.ts
//
// Tipos das entidades retornadas pela clube-api, espelhando
// prisma/schema.prisma. Mantenha este arquivo sincronizado se o
// schema da clube-api mudar.

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

// Resumo de categoria, como vem aninhado em Competition/Match (select parcial)
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

// Resumo de adversário, como vem aninhado em Match (select parcial)
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

// Resumo de competição, como vem aninhado em Match (select parcial)
export interface MatchCompetitionSummary {
  id: string;
  name: string;
  season: string;
  category: CategorySummary;
}

// Shape retornado pelas rotas de matches, que sempre incluem
// opponent e competition (ver matchInclude em matches.routes.ts)
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
  // string separada por vírgula, ex: "L,D,W,L,W" (mais antigo → mais recente)
  form: string | null;
  zone: Zone;
  createdAt: string;
  updatedAt: string;
}

// A API pública calcula goalDifference em runtime (não persistido)
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

// Resumo de jogador, como vem aninhado em PlayerMovement (select parcial)
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

// ─── Movimentação de elenco (entrada/saída do clube) ─────────
export interface PlayerMovement {
  id: string;
  squadMemberId: string;
  type: MovementType;
  date: string;
  // Clube de origem (ARRIVAL/LOAN_IN) ou destino (DEPARTURE/LOAN_OUT)
  club: string | null;
  notes: string | null;
  createdAt: string;
}

// Shape retornado por /api/movements/recent e /api/admin/movements,
// que sempre incluem o resumo do jogador (ver movementInclude)
export interface PlayerMovementWithSquadMember extends PlayerMovement {
  squadMember: SquadMemberSummary;
}