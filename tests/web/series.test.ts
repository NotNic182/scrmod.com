import { describe, it, expect } from 'vitest'
import { groupSeries } from '../../src/web/lib/series'
import type { PlayerMatch } from '../../src/shared/api-types'

const m = (over: Partial<PlayerMatch>): PlayerMatch =>
  ({ match_id: 'x', opponent_steam_id: '1', opponent_name: 'A', opponent_title: '', opponent_title_color: '', player_rounds_won: 5, opponent_rounds_won: 2, player_points: 2, opponent_points: 0, won: true, is_ranked: true, ended_at: '2026-09-21T07:17:22Z', cards_picked: [], opponent_cards_picked: [], series_id: 's1', series_score: '2-0', series_rating_change: 8.9, xp_gained: 0, gold_gained: 0, series_gold_gained: 0, player_fps_avg: null, opponent_fps_avg: null, player_bullets_fired: 0, player_bullets_hit: 0, player_blocks_activated: 0, player_blocks_successful: 0, opp_bullets_fired: 0, opp_bullets_hit: 0, opp_blocks_activated: 0, opp_blocks_successful: 0, player_ping_avg: null, opponent_ping_avg: null, duration_seconds: null, player_damage_dealt: null, opp_damage_dealt: null, rules: null, sitting_head: false, ...over }) as PlayerMatch

describe('groupSeries', () => {
  it('groups consecutive games of one series and keeps casual games separate', () => {
    const groups = groupSeries([
      m({ match_id: 'g2', series_id: 's1' }),
      m({ match_id: 'g1', series_id: 's1' }),
      m({ match_id: 'c1', series_id: null, is_ranked: false, series_score: null, series_rating_change: null }),
      m({ match_id: 'g0', series_id: 's0', opponent_name: 'B' }),
    ])
    expect(groups.map((g) => g.games.length)).toEqual([2, 1, 1])
    expect(groups[0].score).toBe('2-0')
    expect(groups[0].rating_change).toBe(8.9)
    expect(groups[1].ranked).toBe(false)
    expect(groups[2].opponent_name).toBe('B')
  })

  it('handles an empty list', () => {
    expect(groupSeries([])).toEqual([])
  })
})
