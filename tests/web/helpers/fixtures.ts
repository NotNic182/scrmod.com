import presence from '../../../fixtures/presence__online.json'
import multimode from '../../../fixtures/series__recent-multimode.json'
import leaderboard from '../../../fixtures/leaderboard.json'
import teamBoard from '../../../fixtures/team__leaderboard.json'
import ffaBoard from '../../../fixtures/ffa__leaderboard.json'
import ovtBoard from '../../../fixtures/ovt__leaderboard.json'
import profileRaw from '../../../fixtures/players__ID.json'
import matchesRaw from '../../../fixtures/players__ID__matches.json'
import achievements from '../../../fixtures/achievements__ID.json'
import tournamentCurrent from '../../../fixtures/tournaments__current.json'
import tournamentHistory from '../../../fixtures/tournaments__history.json'
import tournamentHistoryDetail from '../../../fixtures/tournaments__history-detail.json'
import cards from '../../../fixtures/cards.json'
import { maskProfile, slimMatch } from '../../../src/shared/privacy'
import type { HomeData } from '../../../src/shared/hub-types'
import { env } from './mockHub'

export const LIVE_1V1 = {
  series_id: 's1', p1_steam_id: '76561199311926326', p1_name: 'NotNic', p1_rating: 1101, p1_rd: 66, p1_wins: 1, p1_odds: 2.1, p1_bettable: true,
  p2_steam_id: '76561198040410653', p2_name: 'Sid', p2_rating: 2564, p2_rd: 127, p2_wins: 0, p2_odds: 1.05, p2_bettable: false,
  live_p1_points: 1, live_p2_points: 0, bets_locked: true, lock_reason: 'game_in_progress', is_private: false, is_tournament: true,
  tournament_kind: 'sync' as const, tournament_label: 'Sync Tournament - Round 1', phase: 'live' as const, started_at: new Date().toISOString(),
}

export function homeData(overrides: Partial<HomeData> = {}): HomeData {
  return {
    presence: presence as HomeData['presence'],
    queue: { ranked_searching: 1, team_searching: 0, online: (presence as HomeData['presence']).online_count },
    live: { series_1v1: [LIVE_1V1], series_2v2: [], ffa_lobbies: [], spectate: [] },
    results: (multimode as { entries: HomeData['results'] }).entries,
    maintenance: false,
    alerts: [],
    ...overrides,
  }
}

export const homeEnvelope = (overrides: Partial<HomeData> = {}) => env(homeData(overrides), { errors: [] })
export const boards = { '1v1': leaderboard, '2v2': teamBoard, ffa: ffaBoard, '1v2': ovtBoard }
export const profile = maskProfile(profileRaw as Record<string, unknown>)
export const matches = (matchesRaw as Record<string, unknown>[]).map(slimMatch)
export { achievements, tournamentCurrent, tournamentHistory, tournamentHistoryDetail, cards }
