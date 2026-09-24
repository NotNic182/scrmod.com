import type {
  ActiveSeries,
  ActiveTeamSeries,
  AlertItem,
  CardStat,
  FfaLobby,
  ModVersion,
  MultimodeEntry,
  PlayerProfile,
  PresenceOnline,
  ReleasePost,
  SpectateGame,
} from './api-types'
import type { CardLeader } from '../server/routes/cards'
import type { RankTier } from './rank'

/** Every hub JSON response has this envelope. */
export interface HubEnvelope<T> {
  data: T
  fetched_at: string // ISO timestamp of the oldest upstream item in `data`
  stale: boolean
}

export interface HomeData {
  presence: PresenceOnline
  queue: { ranked_searching: number; team_searching: number; online: number }
  live: {
    series_1v1: ActiveSeries[]
    series_2v2: ActiveTeamSeries[]
    ffa_lobbies: FfaLobby[]
    spectate: SpectateGame[]
  }
  results: MultimodeEntry[]
  maintenance: boolean
  alerts: AlertItem[]
}

export interface HomeEnvelope extends HubEnvelope<HomeData> {
  errors: string[] // keys of upstream items that failed with nothing cached
}

export interface MetaData {
  rank_tiers: RankTier[]
  achievement_definitions: Record<string, { name: string; desc: string }>
  mod_version: ModVersion | null
  releases: ReleasePost[]
}

export interface MetaEnvelope extends HubEnvelope<MetaData> {
  errors: string[]
}

/** PlayerProfile after privacy masking (spec 6.4). */
export type HubProfile = Omit<
  PlayerProfile,
  | 'discord_id'
  | 'discord_username'
  | 'appear_offline'
  | 'hide_gold'
  // Casual games stay off profiles (maskProfile drops them).
  | 'casual_wins'
  | 'casual_losses'
  | 'casual_matches'
  | 'best_casual_streak'
  | 'h2h_casual_wins'
  | 'h2h_casual_losses'
> & { gold_hidden: boolean }

export interface MeData {
  discord: { id: string; username: string; avatar: string | null; global_name: string | null } | null
  player: { steam_id: string; display_name: string; rating: number; peak_rating: number; level: number } | null
}

export interface MeResponse {
  data: MeData
  auth_enabled: boolean
}

/** One card's page: its stats overall, ranked and casual, who wins with it, and its neighbours by pick count. */
export interface CardPageData {
  slug: string
  card: CardStat
  ranked: CardStat | null
  casual: CardStat | null
  winners: CardLeader[]
  sweepers: CardLeader[]
  prev: { name: string; slug: string } | null
  next: { name: string; slug: string } | null
}

export interface StreamLive {
  platform: 'twitch' | 'youtube'
  title: string
  viewers: number | null
  started_at: string | null
  url: string
  embed: { kind: 'twitch'; channel: string } | { kind: 'youtube'; videoId: string }
}

export interface StreamVideo {
  title: string
  url: string
  videoId: string
  published_at: string
}

export interface StreamData {
  live: StreamLive | null
  recent: StreamVideo[]
  links: { twitch: string; youtube: string }
}

export interface StatusResponse {
  mode: 'community' | 'hosted' | 'fixtures'
  app_version: string
  features: string[]
  auth_enabled: boolean
  upstream: {
    base: string
    version: {
      version: string | null
      min_version: string | null
      fetched_at: string | null
      source: 'override' | 'discovered' | 'none'
    }
    reachable?: boolean
    /** Spec 11: the version gate, so NotNic hears about a 426 fast. */
    last_426_at?: string | null
    count_426?: number
  }
  cache: { size: number; bytes?: number }
}
