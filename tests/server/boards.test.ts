import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'

const LB = { entries: [{ rank: 1, steam_id: '76561198040410653', display_name: 'Sid', is_online: false, inactive: false, rating: 2564, rd: 127, total_matches: 405, wins: 400, losses: 5, win_rate: 0.9877, level: 71, gold: -1, title: 'FFA 1st Place', title_color: '#FFD700', rank_name: 'Grand Master IV', rank_color: '#E52745' }], total_players: 97, last_updated: '2026-09-22T12:54:34Z' }

describe('leaderboards', () => {
  it('maps modes to upstream boards with limit=500', async () => {
    const { app, fake } = makeApp({ '/leaderboard': LB, '/team/leaderboard': { entries: [], total_players: 0, last_updated: '' }, '/ffa/leaderboard': { entries: [], total_players: 0, last_updated: '', is_ranked: true }, '/ovt/leaderboard': { entries: [], total_players: 0, last_updated: '', is_ranked: false } })
    const body = await (await app.request('/api/leaderboard/1v1')).json()
    expect(body.data.entries[0].rank_name).toBe('Grand Master IV')
    expect(body.data.entries[0].gold).toBe(-1)
    for (const mode of ['2v2', 'ffa', '1v2', '1v2-solo', '1v2-duo']) expect((await app.request(`/api/leaderboard/${mode}`)).status).toBe(200)
    const q = (p: string) => fake.calls.filter((c) => c.url.pathname === `/api/v1${p}`).map((c) => Object.fromEntries(c.url.searchParams))
    expect(q('/leaderboard')[0]).toEqual({ limit: '500' })
    expect(q('/ovt/leaderboard').map((x) => x.role)).toEqual(['combined', 'solo', 'duo'])
  })

  it('passes include_inactive only when asked and caches per variant', async () => {
    const { app, fake } = makeApp({ '/leaderboard': LB })
    await app.request('/api/leaderboard/1v1')
    await app.request('/api/leaderboard/1v1?inactive=1')
    await app.request('/api/leaderboard/1v1?inactive=1')
    const calls = fake.calls.filter((c) => c.url.pathname === '/api/v1/leaderboard')
    expect(calls.length).toBe(2)
    expect(calls[0].url.searchParams.get('include_inactive')).toBeNull()
    expect(calls[1].url.searchParams.get('include_inactive')).toBe('true')
  })

  it('rejects an unknown mode with 404 and the list of modes', async () => {
    const { app } = makeApp({})
    const res = await app.request('/api/leaderboard/3v3')
    expect(res.status).toBe(404)
    expect((await res.json()).modes).toContain('1v1')
  })

  it('rejects prototype-chain keys as unknown modes', async () => {
    const { app, fake } = makeApp({})
    for (const mode of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const res = await app.request(`/api/leaderboard/${mode}`)
      expect(res.status).toBe(404)
      expect((await res.json()).error).toBe('unknown_mode')
    }
    expect(fake.calls.length).toBe(0)
  })
})

const MULTI = {
  entries: [
    { mode: 'ffa', id: 'f1', ended_at: '2026-09-23T01:51:25.880882+00:00', left_label: 'Nix', right_label: '3-player FFA', score: '#1 of 3', left_rating_change: 6.7, right_rating_change: null, settings: null, bets: [] },
    { mode: '2v2', id: 't1', ended_at: '2026-09-16T23:10:16.882611+00:00', left_label: 'Sid + Spirit', right_label: 'Nix + SlopsOn1', score: '1-0', left_rating_change: 11.8, right_rating_change: -20.5, settings: null, bets: [] },
  ],
}
const series = (id: string, completed_at: string, p1Won: boolean) => ({
  series_id: id,
  p1_name: 'Spirit',
  p1_steam_id: '76561198984811435',
  p1_discord_id: '111',
  p1_rating: 1852.5,
  p1_rating_change: p1Won ? 12.1 : -15.7,
  p2_name: 'galaxy ice',
  p2_steam_id: '76561199013169799',
  p2_discord_id: '222',
  p2_rating: 1832,
  p2_rating_change: p1Won ? -10.4 : 13.5,
  p1_series_wins: p1Won ? 2 : 1,
  p2_series_wins: p1Won ? 0 : 2,
  winner_name: p1Won ? 'Spirit' : 'galaxy ice',
  winner_steam_id: p1Won ? '76561198984811435' : '76561199013169799',
  completed_at,
  rules: null,
  bets: [],
  tournament: false,
  tournament_label: '',
})
const SERIES = { series: [series('s1', '2026-09-23T20:24:20.530751+00:00', false), series('s2', '2026-09-20T10:00:00+00:00', true)] }

describe('results', () => {
  it('asks both feeds for the bounded limit', async () => {
    const { app, fake } = makeApp({ '/series/recent-multimode': { entries: [] }, '/series/recent': { series: [] } })
    expect((await app.request('/api/results?limit=999')).status).toBe(200)
    const limit = (path: string) => fake.calls.find((c) => c.url.pathname === `/api/v1${path}`)!.url.searchParams.get('limit')
    expect(limit('/series/recent-multimode')).toBe('200')
    expect(limit('/series/recent')).toBe('200')
  })

  it('merges 1v1 series into the multimode feed, newest first, winner on the left', async () => {
    // Sid's multimode feed carries 2v2, FFA and 1v2 games only; without the merge "All" had no 1v1 games.
    const { app } = makeApp({ '/series/recent-multimode': MULTI, '/series/recent': SERIES })
    const res = await app.request('/api/results?limit=3')
    const body = await res.json()
    expect(body.data.entries.map((e: { id: string }) => e.id)).toEqual(['s1', 'f1', 's2'])
    expect(body.data.entries[0]).toEqual({
      mode: '1v1',
      id: 's1',
      ended_at: '2026-09-23T20:24:20.530751+00:00',
      left_label: 'galaxy ice',
      right_label: 'Spirit',
      score: '2-1',
      left_rating_change: 13.5,
      right_rating_change: -15.7,
      settings: null,
      bets: [],
    })
    expect(body.data.entries[2]).toMatchObject({ left_label: 'Spirit', right_label: 'galaxy ice', score: '2-0', left_rating_change: 12.1 })
    expect(JSON.stringify(body)).not.toContain('discord')
    expect(body.stale).toBe(false)
  })

  it('still serves one feed when the other fails, marked stale; fails only when both do', async () => {
    const onlyMulti = makeApp({ '/series/recent-multimode': MULTI })
    const a = await (await onlyMulti.app.request('/api/results')).json()
    expect(a.data.entries.map((e: { id: string }) => e.id)).toEqual(['f1', 't1'])
    expect(a.stale).toBe(true)
    const onlySeries = makeApp({ '/series/recent': SERIES })
    const b = await (await onlySeries.app.request('/api/results')).json()
    expect(b.data.entries.map((e: { id: string }) => e.id)).toEqual(['s1', 's2'])
    const neither = makeApp({})
    expect((await neither.app.request('/api/results')).status).toBe(404)
  })

  it('masks discord ids out of recent 1v1 series', async () => {
    const { app } = makeApp({ '/series/recent': { series: [{ series_id: 's', p1_name: 'A', p1_discord_id: '1', p2_name: 'B', p2_discord_id: null, bets: [] }] } })
    const body = await (await app.request('/api/results/1v1')).json()
    expect(body.data.series[0]).toEqual({ series_id: 's', p1_name: 'A', p2_name: 'B', bets: [] })
  })
})

describe('player search', () => {
  it('requires q of 1-40 chars and forwards limit=8', async () => {
    const { app, fake } = makeApp({ '/players/search': { results: [{ steam_id: '76561199311926326', display_name: 'NotNic', rating: 1101 }] } })
    expect((await app.request('/api/players/search')).status).toBe(400)
    expect((await app.request('/api/players/search?q=' + 'x'.repeat(41))).status).toBe(400)
    const body = await (await app.request('/api/players/search?q=nic')).json()
    expect(body.data.results[0].display_name).toBe('NotNic')
    expect(Object.fromEntries(fake.calls[0].url.searchParams)).toEqual({ q: 'nic', limit: '8' })
  })
})
