import { describe, it, expect } from 'vitest'
import {
  KEEP_FOR_PROFILE_MASK,
  isRankedMatch,
  maskProfile,
  rankedSummary,
  maskRecentSeries,
  maskChatMessage,
  scrubPrivate,
  slimMatch,
} from '../../src/shared/privacy'

const base = {
  steam_id: '76561199311926326',
  display_name: 'NotNic',
  discord_id: '1299197810780143656',
  discord_username: 'ntnic',
  discord_display_name: 'Nic',
  show_discord: true,
  gold_earned: 31818,
  gold_spent: 31445,
  bet_gold_net: -200,
  hide_gold: false,
  appear_offline: false,
  rating: 1101.8,
}

describe('maskProfile', () => {
  it('always removes discord_id, discord_username, appear_offline and hide_gold', () => {
    const m = maskProfile(base)
    expect(m).not.toHaveProperty('discord_id')
    expect(m).not.toHaveProperty('discord_username')
    expect(m).not.toHaveProperty('appear_offline')
    expect(m).not.toHaveProperty('hide_gold')
    expect(m.rating).toBe(1101.8)
  })

  it('keeps discord_display_name only when show_discord is true', () => {
    expect(maskProfile(base).discord_display_name).toBe('Nic')
    expect(maskProfile({ ...base, show_discord: false })).not.toHaveProperty('discord_display_name')
  })

  it('removes gold fields when hide_gold is true and reports gold_hidden', () => {
    const shown = maskProfile(base)
    expect(shown.gold_earned).toBe(31818)
    expect(shown.gold_hidden).toBe(false)
    const hidden = maskProfile({ ...base, hide_gold: true })
    expect(hidden).not.toHaveProperty('gold_earned')
    expect(hidden).not.toHaveProperty('gold_spent')
    expect(hidden).not.toHaveProperty('bet_gold_net')
    expect(hidden.gold_hidden).toBe(true)
  })

  it('does not mutate its input', () => {
    const copy = { ...base }
    maskProfile(copy)
    expect(copy).toEqual(base)
  })

  it('removes casual games: the record, count, streak, head-to-head record and form entries', () => {
    const form = [
      { result: 'W', ranked: true, opponent: 'Sid', score: '3-1', date: '2026-09-23' },
      { result: 'L', ranked: false, opponent: 'Stan', score: '0-3', date: '2026-09-23' },
      { result: 'L', opponent: 'Nix', score: '2-3', date: '2026-09-22' },
    ]
    const m = maskProfile({
      ...base,
      casual_wins: 12,
      casual_losses: 9,
      casual_matches: 21,
      best_casual_streak: 4,
      h2h_casual_wins: 2,
      h2h_casual_losses: 1,
      // Fields the upstream sends that the hub's types don't name: any casual_* key goes.
      casual_dc_count: 9,
      casual_opponent_dc_count: 9,
      casual_own_dc_count: 0,
      casual_rage_quit_pct: 0.03,
      h2h_ranked_wins: 3,
      ranked_series_wins: 45,
      recent_form: form,
    })
    expect(Object.keys(m).filter((k) => /casual/.test(k))).toEqual([])
    expect(m.recent_form).toEqual([form[0]])
    expect(m.h2h_ranked_wins).toBe(3)
    expect(m.ranked_series_wins).toBe(45)
  })
})

describe('isRankedMatch / rankedSummary', () => {
  it('keeps only matches the API marks as ranked', () => {
    expect(isRankedMatch({ is_ranked: true })).toBe(true)
    expect(isRankedMatch({ is_ranked: false })).toBe(false)
    expect(isRankedMatch({})).toBe(false)
  })

  it('drops the casual count and totals ranked matches only', () => {
    expect(rankedSummary({ total: 100, ranked_matches: 69, casual_matches: 31, ranked_groups: 30 })).toEqual({ total: 69, ranked_matches: 69, ranked_groups: 30 })
    expect(rankedSummary({ total: 5 })).toEqual({ total: 5 })
  })
})

describe('maskRecentSeries / maskChatMessage', () => {
  it('drops the discord ids and nothing else', () => {
    const s = maskRecentSeries({ series_id: 'x', p1_discord_id: '1', p2_discord_id: null, p1_name: 'A' })
    expect(s).toEqual({ series_id: 'x', p1_name: 'A' })
    const m = maskChatMessage({ id: 1, discord_id: '2', message: 'hi' })
    expect(m).toEqual({ id: 1, message: 'hi' })
  })
})

describe('scrubPrivate', () => {
  it('drops every private key recursively through objects and arrays', () => {
    const out = scrubPrivate({
      profile: { discord_id: '1', discord_username: 'ntnic', discord_display_name: 'Nic', display_name: 'NotNic' },
      rows: [
        { p1_discord_id: '1', p2_discord_id: '2', p1_name: 'A' },
        { hide_gold: true, appear_offline: true, nested: [{ discord_id: '9', n: 1 }] },
      ],
      count: 3,
    })
    expect(out).toEqual({
      profile: { discord_display_name: 'Nic', display_name: 'NotNic' },
      rows: [{ p1_name: 'A' }, { nested: [{ n: 1 }] }],
      count: 3,
    })
  })

  it('passes primitives and null through and does not mutate its input', () => {
    expect(scrubPrivate(null)).toBeNull()
    expect(scrubPrivate(7)).toBe(7)
    expect(scrubPrivate('x')).toBe('x')
    const input = { discord_id: '1', keep: true }
    scrubPrivate(input)
    expect(input).toEqual({ discord_id: '1', keep: true })
  })

  it('keeps the named keys so maskProfile can still read hide_gold', () => {
    const out = scrubPrivate({ discord_id: '1', hide_gold: true, show_discord: false }, KEEP_FOR_PROFILE_MASK)
    expect(out).toEqual({ hide_gold: true, show_discord: false })
    expect(maskProfile(out).gold_hidden).toBe(true)
  })
})

describe('slimMatch', () => {
  it('removes timeline, end_stats and point_times fields and keeps the rest', () => {
    const slim = slimMatch({
      match_id: 'm',
      won: true,
      point_timeline: '1:0,1:1',
      player_fps_timeline: '300,299',
      opp_ping_timeline: '50,51',
      player_damage_timeline: '1,2',
      point_times: '3,7',
      player_end_stats: '1|2|3',
      opp_end_stats: '4|5|6',
      cards_picked: [{ card_name: 'Grow' }],
    })
    expect(slim).toEqual({ match_id: 'm', won: true, cards_picked: [{ card_name: 'Grow' }] })
  })
})
