import { useQuery } from '@tanstack/react-query'
import type {
  FfaHistory,
  MatchesSummary,
  OvtHistory,
  PlayerAchievements,
  PlayerMatch,
  PlayerTournaments,
  RatingHistory,
  TeamHistory,
  TeamStats,
  VsTopCards,
} from '../../shared/api-types'
import { hubGet } from './client'
import type {
  AnyBoard,
  BoardMode,
  BracketResponse,
  CardLeadersResponse,
  CardPageResponse,
  CardPickersResponse,
  CardsResponse,
  Env,
  HomeEnvelope,
  HubProfile,
  MeResponse,
  MetaEnvelope,
  Results1v1Response,
  ResultsResponse,
  SearchResponse,
  StatusResponse,
  StreamResponse,
  TournamentHistoryResponse,
  TournamentsResponse,
} from './types'

export const POLL = { LIVE: 15_000, BOARD: 60_000, PLAYER: 60_000, RESULTS: 30_000, REF: 600_000 } as const

const live = { refetchInterval: POLL.LIVE, refetchIntervalInBackground: false, staleTime: 5_000 }
const board = { refetchInterval: POLL.BOARD, refetchIntervalInBackground: false, staleTime: 20_000 }
const player = { refetchInterval: POLL.PLAYER, refetchIntervalInBackground: false, staleTime: 30_000 }
const results = { refetchInterval: POLL.RESULTS, refetchIntervalInBackground: false, staleTime: 10_000 }
const ref = { staleTime: POLL.REF, refetchInterval: false as const }

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== false) u.set(k, String(v))
  const s = u.toString()
  return s ? `?${s}` : ''
}

export function useHome() {
  return useQuery({ queryKey: ['home'], queryFn: () => hubGet<HomeEnvelope>('/home'), ...live })
}

export function useLeaderboard(mode: BoardMode | string, inactive: boolean) {
  return useQuery({
    queryKey: ['leaderboard', mode, inactive],
    queryFn: () => hubGet<Env<AnyBoard>>(`/leaderboard/${mode}${inactive ? '?inactive=1' : ''}`),
    ...board,
  })
}

export function usePlayer(steamId: string | undefined, me: string | null | undefined) {
  const viewer = me && me !== steamId ? me : undefined
  return useQuery({
    queryKey: ['player', steamId, viewer ?? null],
    queryFn: () => hubGet<Env<HubProfile>>(`/players/${steamId}${qs({ me: viewer })}`),
    enabled: !!steamId,
    ...player,
  })
}

export type PlayerSub =
  | 'matches'
  | 'matches-summary'
  | 'rating-history'
  | 'team-history'
  | 'ffa-history'
  | 'ovt-history'
  | 'team-stats'
  | 'achievements'
  | 'tournaments'

export interface SubTypes {
  matches: PlayerMatch[]
  'matches-summary': MatchesSummary
  'rating-history': RatingHistory
  'team-history': TeamHistory
  'ffa-history': FfaHistory
  'ovt-history': OvtHistory
  'team-stats': TeamStats
  achievements: PlayerAchievements
  tournaments: PlayerTournaments
}

export function usePlayerSub<S extends PlayerSub>(steamId: string | undefined, sub: S, params: Record<string, string | number | undefined> = {}, enabled = true) {
  return useQuery({
    queryKey: ['player', steamId, sub, params],
    queryFn: () => hubGet<Env<SubTypes[S]>>(`/players/${steamId}/${sub}${qs(params)}`),
    enabled: !!steamId && enabled,
    ...player,
  })
}

export function useVs(steamId: string | undefined, opp: string | null | undefined) {
  return useQuery({
    queryKey: ['vs', steamId, opp],
    queryFn: () => hubGet<Env<VsTopCards>>(`/players/${steamId}/vs/${opp}`),
    enabled: !!steamId && !!opp && steamId !== opp,
    ...player,
  })
}

/** `enabled`: false while the feed isn't on screen, so it neither loads nor polls in the background of another tab. */
export function useResults(limit = 60, enabled = true) {
  return useQuery({ queryKey: ['results', limit], queryFn: () => hubGet<ResultsResponse>(`/results${qs({ limit })}`), enabled, ...results })
}

export function useResults1v1(limit = 50, enabled = true) {
  return useQuery({ queryKey: ['results-1v1', limit], queryFn: () => hubGet<Results1v1Response>(`/results/1v1${qs({ limit })}`), enabled, ...results })
}

export function useTournaments() {
  return useQuery({ queryKey: ['tournaments'], queryFn: () => hubGet<TournamentsResponse>('/tournaments'), ...board })
}

export function useTournamentHistory() {
  return useQuery({ queryKey: ['tournament-history'], queryFn: () => hubGet<TournamentHistoryResponse>('/tournaments/history'), ...board })
}

export function useBracket(id: string | undefined) {
  return useQuery({ queryKey: ['bracket', id], queryFn: () => hubGet<BracketResponse>(`/tournaments/${id}/bracket`), enabled: !!id, ...board })
}

export function useCards(filter: string, sort: string, order: 'asc' | 'desc') {
  return useQuery({ queryKey: ['cards', filter, sort, order], queryFn: () => hubGet<CardsResponse>(`/cards${qs({ filter, sort, order })}`), ...ref })
}

export function useCardLeaders() {
  return useQuery({ queryKey: ['card-leaders'], queryFn: () => hubGet<CardLeadersResponse>('/cards/leaders'), ...ref })
}

export function useCardPickers(name: string | null) {
  return useQuery({
    queryKey: ['card-pickers', name],
    queryFn: () => hubGet<CardPickersResponse>(`/cards/${encodeURIComponent(name!)}/pickers`),
    enabled: !!name,
    ...ref,
  })
}

export function useCard(slug: string | undefined) {
  return useQuery({
    queryKey: ['card', slug],
    queryFn: () => hubGet<CardPageResponse>(`/card/${encodeURIComponent(slug!)}`),
    enabled: !!slug,
    ...ref,
  })
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => hubGet<MetaEnvelope>('/meta'), ...ref })
}

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => hubGet<MeResponse>('/me'), staleTime: 60_000, retry: false, refetchInterval: false })
}

export function useSearch(q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: ['search', term],
    queryFn: () => hubGet<SearchResponse>(`/players/search${qs({ q: term })}`),
    enabled: term.length >= 1,
    staleTime: 30_000,
    refetchInterval: false,
  })
}

export function useStatus() {
  return useQuery({ queryKey: ['status'], queryFn: () => hubGet<StatusResponse>('/_status'), staleTime: 60_000, refetchInterval: false })
}

export function useStream() {
  return useQuery({ queryKey: ['stream'], queryFn: () => hubGet<StreamResponse>('/stream'), refetchInterval: 60_000, refetchIntervalInBackground: false, staleTime: 30_000 })
}
