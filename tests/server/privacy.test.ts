import { describe, it, expect } from 'vitest'
import { maskProfile, maskRecentSeries, maskChatMessage, slimMatch } from '../../src/shared/privacy'

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
})

describe('maskRecentSeries / maskChatMessage', () => {
  it('drops the discord ids and nothing else', () => {
    const s = maskRecentSeries({ series_id: 'x', p1_discord_id: '1', p2_discord_id: null, p1_name: 'A' })
    expect(s).toEqual({ series_id: 'x', p1_name: 'A' })
    const m = maskChatMessage({ id: 1, discord_id: '2', message: 'hi' })
    expect(m).toEqual({ id: 1, message: 'hi' })
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
