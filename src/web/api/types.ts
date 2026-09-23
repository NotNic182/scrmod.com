import type {
  BracketDetail,
  CardStat,
  CardTopPickers,
  FfaLeaderboard,
  Leaderboard,
  MultimodeRecent,
  OvtLeaderboard,
  PlayerSearch,
  RecentSeries,
  TeamLeaderboard,
  TournamentCurrent,
  TournamentHistoryDetail,
  TournamentHistoryRow,
} from '../../shared/api-types'
import type { CardLeader } from '../../server/routes/cards'
import type { CardPageData } from '../../shared/hub-types'

export type { HomeEnvelope, MetaEnvelope, MeResponse, HubProfile, StatusResponse } from '../../shared/hub-types'

export interface Env<T> {
  data: T
  fetched_at: string
  stale: boolean
  errors?: string[]
}

export type AnyBoard = Leaderboard | TeamLeaderboard | FfaLeaderboard | OvtLeaderboard
export type BoardMode = '1v1' | '2v2' | 'ffa' | '1v2' | '1v2-solo' | '1v2-duo'

export type ResultsResponse = Env<MultimodeRecent>
export type Results1v1Response = Env<{ series: Array<Omit<RecentSeries, 'p1_discord_id' | 'p2_discord_id'>> }>
export type SearchResponse = Env<PlayerSearch>
export type TournamentsResponse = Env<{ sync: TournamentCurrent | null; async: TournamentCurrent | null }>
export type TournamentHistoryResponse = Env<{ rows: TournamentHistoryRow[]; detail: TournamentHistoryDetail['tournaments'] }>
export type BracketResponse = Env<BracketDetail>
export type CardsResponse = Env<CardStat[]>
export type CardLeadersResponse = Env<{ sweepers: CardLeader[]; winners: CardLeader[] }>
export type CardPickersResponse = Env<CardTopPickers>
export type CardPageResponse = Env<CardPageData>
