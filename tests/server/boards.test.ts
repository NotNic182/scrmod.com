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

describe('results', () => {
  it('proxies the multimode feed with a bounded limit', async () => {
    const { app, fake } = makeApp({ '/series/recent-multimode': { entries: [] } })
    expect((await app.request('/api/results?limit=999')).status).toBe(200)
    expect(fake.calls[0].url.searchParams.get('limit')).toBe('200')
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
