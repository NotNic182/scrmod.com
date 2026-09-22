// Upstream response shapes, verified against the live API on 2026-09-22.
// Readers must tolerate missing fields: use optional chaining and defaults.

export interface ModVersion {
  version: string
  min_version: string
}

export interface MaintenanceStatus {
  in_maintenance: boolean
}

export interface AlertItem {
  category?: string
  message: string
  expires_at?: string | null
  created_at?: string
}

export interface AlertsActive {
  rev: number
  alerts: AlertItem[]
}

export interface RankTiersResponse {
  tiers: Array<{ floor: number; name: string; color: string }>
}

// ── Leaderboards ──────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number
  steam_id: string
  display_name: string
  is_online: boolean
  inactive: boolean
  rating: number
  rd: number
  total_matches: number
  wins: number
  losses: number
  win_rate: number
  level: number
  gold: number // -1 when the player hides gold
  title: string
  title_color: string
  rank_name: string
  rank_color: string
}

export interface Leaderboard {
  entries: LeaderboardEntry[]
  total_players: number
  last_updated: string
}

export interface TeamLeaderboardEntry {
  rank: number
  steam_id: string
  display_name: string
  is_online: boolean
  inactive: boolean
  rating: number
  rd: number
  peak_rating: number
  completed_series: number
  series_wins: number
  series_losses: number
  win_rate: number
  level: number
  title: string
  title_color: string
  avg_teammate_elo: number
  team_gold_earned: number
  team_xp_earned: number
}

export interface TeamLeaderboard {
  entries: TeamLeaderboardEntry[]
  total_players: number
  last_updated: string
}

export interface FfaLeaderboardEntry {
  rank: number
  steam_id: string
  display_name: string
  is_online: boolean
  inactive: boolean
  rating: number
  rd: number
  peak_rating: number
  games_played: number
  wins: number
  top3: number
  avg_placement: number
  win_rate: number
  level: number
  title: string
  title_color: string
  ffa_gold_earned: number // -1 when hidden
  ffa_xp_earned: number
}

export interface FfaLeaderboard {
  entries: FfaLeaderboardEntry[]
  total_players: number
  last_updated: string
  is_ranked: boolean
}

export interface OvtLeaderboardEntry {
  rank: number
  steam_id: string
  display_name: string
  is_online: boolean
  inactive: boolean
  games_played: number
  wins: number
  losses: number
  win_rate: number // percent, e.g. 81.2 (unlike the other boards)
  solo_games: number
  duo_games: number
  solo_wins: number
  solo_losses: number
  duo_wins: number
  duo_losses: number
  level: number
  title: string
  title_color: string
  last_played: string
}

export interface OvtLeaderboard {
  entries: OvtLeaderboardEntry[]
  total_players: number
  last_updated: string
  is_ranked: boolean
}

// ── Presence, queues, live games ──────────────────────────────

export interface PresenceEntry {
  display_name: string
  steam_id: string
  rating: number
  title: string
  title_color: string
  minutes_ago: number
}

export interface PresenceOnline {
  online_count: number
  online: PresenceEntry[]
  recent: PresenceEntry[]
}

export interface QueueCount {
  searching: number
  total: number
  online: number
}

export interface TeamQueueCount {
  searching: number
}

export interface ActiveSeries {
  series_id: string
  p1_steam_id: string
  p1_name: string
  p1_rating: number
  p1_rd: number
  p1_wins: number
  p1_odds: number
  p1_bettable: boolean
  p2_steam_id: string
  p2_name: string
  p2_rating: number
  p2_rd: number
  p2_wins: number
  p2_odds: number
  p2_bettable: boolean
  live_p1_points: number
  live_p2_points: number
  bets_locked: boolean
  lock_reason: string | null
  is_private: boolean
  is_tournament: boolean
  tournament_kind: 'sync' | 'async' | null
  tournament_label: string
  phase: 'live' | 'pre_match'
  started_at: string | null
}

export interface ActiveSeriesList {
  series: ActiveSeries[]
}

export interface ActiveTeamSeries {
  series_id: string
  t1a_steam: string
  t1a_name: string
  t1b_steam: string
  t1b_name: string
  t2a_steam: string
  t2a_name: string
  t2b_steam: string
  t2b_name: string
  t1_rating: number
  t2_rating: number
  t1a_rating: number
  t1b_rating: number
  t2a_rating: number
  t2b_rating: number
  t1_wins: number
  t2_wins: number
  live_t1_points?: number
  live_t2_points?: number
  t1_odds: number
  t2_odds: number
  t1_bettable: boolean
  t2_bettable: boolean
  bets_locked: boolean
  lock_reason: string | null
  started_at: string | null
  dc_grace_until: string | null
  t1_color_name: string
  t1_color_hex: string
  t2_color_name: string
  t2_color_hex: string
  color_decided: boolean
}

export interface ActiveTeamSeriesList {
  series: ActiveTeamSeries[]
}

export interface FfaLobbyMember {
  rating: number
  established: boolean
  title_color: string
  title: string
  name: string
}

export interface FfaLobby {
  lobby_id: string
  host_name: string
  player_count: number
  max_players: number
  has_password: boolean
  age_seconds: number
  bets_open: boolean
  bet_targets: Array<{ id: string; name: string }>
  members: FfaLobbyMember[]
}

export interface FfaLobbies {
  lobbies: FfaLobby[]
  count: number
}

export interface SpectateGame {
  game_id: string
  mode: string
  source_ref: string
  roster_titles: string // pipe-joined
  roster_title_colors: string // pipe-joined
  roster_ratings: string // comma-joined
  roster: string
  phase: string
  names: string // comma-joined display names
  spectator_count: number
  spectator_cap: number
  spectatable: boolean
  disabled_reason: string
}

export interface SpectateGames {
  games: SpectateGame[]
}

// ── Results ───────────────────────────────────────────────────

export interface MultimodeEntry {
  mode: string // '1v1' | '2v2' | 'ffa' | 'ovt'
  id: string
  ended_at: string
  left_label: string
  right_label: string
  score: string
  left_rating_change: number | null
  right_rating_change: number | null
  settings: Record<string, unknown> | null
  bets: unknown[]
}

export interface MultimodeRecent {
  entries: MultimodeEntry[]
}

export interface SeriesBet {
  bettor_name: string
  bettor_steam_id: string
  amount: number
  payout: number
  odds_multiplier: number
  bet_on_name: string
  bet_on_steam_id: string
  won: boolean
}

export interface RecentSeries {
  series_id: string
  game_codes: string[]
  p1_name: string
  p1_steam_id: string
  p1_discord_id?: string | null // stripped by the hub
  p1_rating: number
  p1_rating_change: number
  p1_streak: number
  p2_name: string
  p2_steam_id: string
  p2_discord_id?: string | null // stripped by the hub
  p2_rating: number
  p2_rating_change: number
  p2_streak: number
  p1_series_wins: number
  p2_series_wins: number
  winner_name: string
  winner_steam_id: string
  completed_at: string
  rules: Record<string, unknown> | null
  bets: SeriesBet[]
  tournament: boolean
  tournament_label: string
}

export interface RecentSeriesList {
  series: RecentSeries[]
}

// ── Players ───────────────────────────────────────────────────

export interface PlayerSearchResult {
  steam_id: string
  display_name: string
  rating: number
}

export interface PlayerSearch {
  results: PlayerSearchResult[]
}

export interface RatingPoint {
  rating: number
  rd: number
  date: string
  period_end: string
}

export interface FfaRatingPoint {
  rating: number
  recorded_at: string
  date: string
  period_end: string
  rating_before: number
}

export interface TopCard {
  card_name: string
  times_picked: number
  wins_with: number
  win_rate: number
  times_offered?: number
  pass_rate?: number
}

export interface FormEntry {
  result: 'W' | 'L'
  ranked: boolean
  opponent: string
  score: string
  date: string
}

export interface PlayerProfile {
  steam_id: string
  display_name: string
  rating: number
  rating_deviation: number
  peak_rating: number
  total_matches: number
  wins: number
  losses: number
  win_rate: number
  ranked_enabled: boolean
  discord_id?: string | null // stripped by the hub
  discord_username?: string | null // stripped by the hub
  discord_display_name?: string | null // kept only when show_discord
  show_discord: boolean
  allow_spectators: boolean
  gold_earned?: number // removed when hide_gold
  gold_spent?: number // removed when hide_gold
  bullets_fired: number
  bullets_hit: number
  blocks_activated: number
  blocks_successful: number
  active_title: string
  active_title_color: string
  active_player_color_hex?: string
  active_player_color_name?: string
  hide_gold?: boolean // stripped by the hub
  appear_offline?: boolean // stripped by the hub
  last_match: string | null
  recent_rating_history: RatingPoint[]
  ffa_rating_history: FfaRatingPoint[]
  top_cards: TopCard[]
  worst_cards: TopCard[]
  level: number
  total_xp: number
  xp_into_level: number
  xp_for_next_level: number
  best_ranked_streak: number
  best_casual_streak: number
  best_ranked_game_streak: number
  current_ranked_game_streak: number
  best_ranked_series_streak: number
  current_ranked_series_streak: number
  ranked_series_wins: number
  ranked_series_losses: number
  casual_wins: number
  casual_losses: number
  sweeps_given: number
  sweeps_taken: number
  ranked_dc_count: number
  recent_form: FormEntry[]
  avg_fps: number
  avg_cards_per_game: number
  achievements_unlocked: number
  region_breakdown: Array<{ region: string; matches: number }>
  avg_game_seconds: number
  bets_won: number
  bets_lost: number
  bet_gold_net?: number // removed when hide_gold
  rank_name: string
  rank_color: string
  team_rating: number
  team_completed_series: number
  team_rating_deviation?: number
  team_peak_rating?: number
  team_standing?: number
  team_standing_population?: number
  ovt_solo_wins: number
  ovt_solo_losses: number
  ovt_duo_wins: number
  ovt_duo_losses: number
  ovt_standing?: number
  ovt_standing_population?: number
  ffa_games: number
  ffa_wins: number
  ffa_top3: number
  ffa_avg_placement: number
  ffa_avg_kills: number
  ffa_avg_damage: number
  ffa_rating?: number
  ffa_rating_deviation?: number
  ffa_peak_rating?: number
  ffa_standing?: number
  ffa_standing_population?: number
  mod_version: string | null
  // Head-to-head vs the viewer passed as ?viewer_steam_id= (all zero without a viewer)
  h2h_ranked_wins: number
  h2h_ranked_losses: number
  h2h_casual_wins: number
  h2h_casual_losses: number
  h2h_series_wins: number
  h2h_series_losses: number
  casual_matches: number
  ranked_dps: number
  ffa_dps: number
  self_death_pct: number
  deaths_total: number
  record_max_single_hit: number
  record_max_health: number
  ranked_unique_opponents: number
  ranked_total_series: number
  standing: number
  standing_population: number
}

export interface CardPick {
  card_name: string
  card_rarity: string
  pick_order: number
  round_number: number
  rolled: boolean
}

export interface PlayerMatch {
  match_id: string
  opponent_steam_id: string
  opponent_name: string
  opponent_title: string
  opponent_title_color: string
  player_rounds_won: number
  opponent_rounds_won: number
  player_points: number
  opponent_points: number
  won: boolean
  is_ranked: boolean
  ended_at: string
  cards_picked: CardPick[]
  opponent_cards_picked: CardPick[]
  series_id: string | null
  series_score: string | null
  series_rating_change: number | null
  xp_gained: number
  gold_gained: number
  series_gold_gained: number
  player_fps_avg: number | null
  opponent_fps_avg: number | null
  player_bullets_fired: number
  player_bullets_hit: number
  player_blocks_activated: number
  player_blocks_successful: number
  opp_bullets_fired: number
  opp_bullets_hit: number
  opp_blocks_activated: number
  opp_blocks_successful: number
  player_ping_avg: number | null
  opponent_ping_avg: number | null
  duration_seconds: number | null
  player_damage_dealt: number | null
  opp_damage_dealt: number | null
  rules: Record<string, unknown> | null
  sitting_head: boolean
  // *_timeline, point_times and *_end_stats strings exist upstream; the hub strips them.
}

export interface MatchesSummary {
  total: number
  ranked_matches: number
  casual_matches: number
  ranked_groups: number
}

export interface RatingHistory {
  steam_id: string
  display_name: string
  history: RatingPoint[]
}

export interface TeamHistoryEntry {
  series_id: string
  won: boolean
  score: string
  mate: string
  opponents: string[]
  rating_change: number
  completed_at: string
  rules: Record<string, unknown> | null
}

export interface TeamHistory {
  series: TeamHistoryEntry[]
}

export interface FfaHistoryEntry {
  match_id: string
  player_count: number
  placement: number
  rating_change: number
  kills: number
  rounds_won: number
  points_total: number
  ended_at: string
  settings: Record<string, unknown> | null
  participants: string[]
}

export interface FfaHistory {
  games: FfaHistoryEntry[]
}

export interface OvtHistoryEntry {
  match_id: string
  role: 'solo' | 'duo'
  won: boolean
  score: string
  solo: string
  duo: string[]
  ended_at: string
  gold_gained: number
  series_gold_gained: number
  rules: Record<string, unknown> | null
}

export interface OvtHistory {
  games: OvtHistoryEntry[]
}

export interface VsTopCards {
  player_steam_id: string
  opponent_steam_id: string
  player_cards: Array<{ card_name: string; picks: number; wins: number }>
  opponent_cards: Array<{ card_name: string; picks: number; wins: number }>
}

export interface TeamStats {
  steam_id: string
  display_name: string
  rating: number
  rating_deviation: number
  peak_rating: number
  completed_series: number
  series_wins: number
  series_losses: number
  series_win_rate: number
  match_wins: number
  match_losses: number
  current_streak: number
}

export interface AchievementDefinitions {
  achievements: Record<string, { name: string; desc: string }>
}

export interface PlayerAchievement {
  achievement_key: string
  unlocked_at: string | null
  unlocked: boolean
  name: string
  global_pct: number
  gold: number
}

export interface PlayerAchievements {
  steam_id: string
  achievements: PlayerAchievement[]
}

export interface PlayerByDiscord {
  steam_id: string
  display_name: string
  discord_id: string
  rating: number
  peak_rating: number
  level: number
}

// ── Cards ─────────────────────────────────────────────────────

export interface CardStat {
  card_name: string
  card_rarity: string
  times_picked: number
  matches_appeared: number
  unique_players: number
  wins_with_card: number
  win_rate: number
  times_offered: number
  pass_rate: number
  sweeps_with_card: number
  stacked_builds: number
}

export type CardStats = CardStat[]

export interface CardTopPickers {
  card_name: string
  display_names: string[]
  steam_ids: string[]
  picks: number[]
  win_rates: number[]
}

export interface CardLeadersSummary {
  sweepers: string[] // "Card Name|Player|count"
  winners: string[] // "Card Name|Player|count"
}

// ── Tournaments (router prefix /api/v1/tournaments) ───────────

export interface TournamentSignup {
  signup_id: string
  steam_id: string
  display_name: string
  signed_up_at: string
  is_speculative: boolean
  seed: number | null
  penalty_at_signup: number
  ready: boolean
  forfeited: boolean
  placed_rank: number | null
  progress_label: string | null
  rating: number
  title: string
  title_color: string
}

export interface TournamentMatch {
  match_id: string
  round: number
  bracket_side: string
  slot_idx: number
  p1_signup_id: string | null
  p2_signup_id: string | null
  p1_display_name: string | null
  p2_display_name: string | null
  prereq_match_ids: string[]
  is_bye: boolean
  status: string
  series_id: string | null
  winner_signup_id: string | null
  p1_series_wins: number | null
  p2_series_wins: number | null
  ready_deadline_at: string | null
  deadline_at?: string | null
  started_at: string | null
  ended_at: string | null
}

export interface TournamentCurrent {
  tournament_id: string | null
  status: string | null
  kind: 'sync' | 'async' | null
  default_start_ts: string | null
  scheduled_start_ts: string | null
  lock_at: string | null
  voting_closes_at: string | null
  started_at: string | null
  ended_at: string | null
  min_players: number
  max_players: number
  prize_players?: number
  prize_gold_1?: number
  prize_gold_2?: number
  prize_gold_3?: number
  prize_xp_1?: number
  prize_xp_2?: number
  prize_xp_3?: number
  signups: TournamentSignup[]
  matches: TournamentMatch[]
  time_slot_options: string[]
  time_slot_tallies: Array<{ slot_ts: string; votes: number }>
  force_vote_count: number
  photon_region?: string | null
}

export interface TournamentHistoryRow {
  tournament_id: string
  kind: 'sync' | 'async'
  format: string
  started_at: string
  ended_at: string
  prize_tier: string
  winner_display_name: string | null
  winner_steam_id: string | null
  runner_up_display_name: string | null
  runner_up_steam_id: string | null
  third_place_display_name: string | null
  third_place_steam_id: string | null
  signup_count: number
}

export interface TournamentParticipant {
  steam_id: string
  display_name: string
  seed: number
  elo: number
  placed_rank: number | null
  forfeited: boolean
  wins: number
  losses: number
  result_label: string
}

export interface TournamentHistoryDetail {
  tournaments: Array<{
    tournament_id: string
    kind: 'sync' | 'async'
    format: string
    started_at: string
    ended_at: string
    duration_seconds: number
    signup_count: number
    prize_gold_1: number
    prize_gold_2: number
    prize_gold_3: number
    prize_xp_1: number
    prize_xp_2: number
    prize_xp_3: number
    participants: TournamentParticipant[]
  }>
}

export interface BracketGame {
  n: number
  p1_rounds: number
  p2_rounds: number
  p1_points: number
  p2_points: number
  dur: number
  p1_fps: number
  p2_fps: number
  p1_ping: number
  p2_ping: number
  p1_hit_pct: number
  p2_hit_pct: number
  p1_blk_pct: number
  p2_blk_pct: number
  p1_cards: string // pipe-joined
  p2_cards: string // pipe-joined
}

export interface BracketDetail {
  matches: Array<{ match_id: string; games: BracketGame[] }>
}

export interface PlayerTournaments {
  steam_id: string
  winner_count: number
  runner_up_count: number
  third_place_count: number
  participant_count: number
  recent: unknown[]
}

// ── Chat, releases ────────────────────────────────────────────

export interface ChatMessage {
  source: string
  id: number
  steam_id: string
  discord_id?: string | null // stripped by the hub
  display_name: string
  rating: number
  title: string
  title_color: string
  channel: string
  message: string
  timestamp: string
}

export interface ChatRecent {
  messages: ChatMessage[]
}

export interface ReleasePost {
  author: string
  content: string
  posted_at: string
}

export interface ReleasesRecent {
  posts: ReleasePost[]
}
