import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const ME = '76561199311926326'
const SID = '76561198040410653'
const PROFILE = {
  steam_id: ME, display_name: 'NotNic', rating: 1101.8, discord_id: '1299', discord_username: 'ntnic', discord_display_name: 'Nic',
  show_discord: false, gold_earned: 31818, gold_spent: 31445, hide_gold: true, appear_offline: true,
  h2h_ranked_wins: 0, h2h_ranked_losses: 8, recent_form: [], top_cards: [],
}
const MATCH = { match_id: 'm', opponent_name: 'TechTara', won: true, point_timeline: '1:0', player_fps_timeline: '300', player_end_stats: '1|2', cards_picked: [] }

describe('GET /api/players/:id', () => {
  it('returns the masked profile and forwards the viewer', async () => {
    const { app, fake } = makeApp({ [`/players/${ME}`]: PROFILE })
    const body = await (await app.request(`/api/players/${ME}?me=${SID}`)).json()
    expect(body.data.display_name).toBe('NotNic')
    expect(body.data).not.toHaveProperty('discord_id')
    expect(body.data).not.toHaveProperty('discord_username')
    expect(body.data).not.toHaveProperty('discord_display_name')
    expect(body.data).not.toHaveProperty('gold_earned')
    expect(body.data).not.toHaveProperty('appear_offline')
    expect(body.data).not.toHaveProperty('hide_gold')
    expect(body.data.gold_hidden).toBe(true)
    expect(body.data.h2h_ranked_losses).toBe(8)
    expect(fake.calls[0].url.searchParams.get('viewer_steam_id')).toBe(SID)
  })

  it('ignores a viewer equal to the player and rejects bad ids', async () => {
    const { app, fake } = makeApp({ [`/players/${ME}`]: PROFILE })
    await app.request(`/api/players/${ME}?me=${ME}`)
    expect(fake.calls[0].url.searchParams.get('viewer_steam_id')).toBeNull()
    expect((await app.request('/api/players/notanid')).status).toBe(400)
  })

  it('maps upstream 404 to 404', async () => {
    const { app } = makeApp({ [`/players/${ME}`]: () => json({ detail: 'Player not found' }, 404) })
    const res = await app.request(`/api/players/${ME}`)
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('not_found')
  })
})

describe('GET /api/players/:id/:sub', () => {
  it('slims match rows and bounds limit/offset', async () => {
    const { app, fake } = makeApp({ [`/players/${ME}/matches`]: [MATCH] })
    const body = await (await app.request(`/api/players/${ME}/matches?limit=5000&offset=-3`)).json()
    expect(body.data[0]).toEqual({ match_id: 'm', opponent_name: 'TechTara', won: true, cards_picked: [] })
    expect(Object.fromEntries(fake.calls[0].url.searchParams)).toEqual({ limit: '200', offset: '0' })
  })

  it.each([
    ['matches-summary', `/players/${ME}/matches/summary`],
    ['rating-history', `/players/${ME}/rating-history`],
    ['team-history', `/players/${ME}/team-history`],
    ['ffa-history', `/players/${ME}/ffa-history`],
    ['ovt-history', `/players/${ME}/ovt-history`],
    ['team-stats', `/team/players/${ME}/team-stats`],
    ['achievements', `/achievements/${ME}`],
    ['tournaments', `/tournaments/players/${ME}/tournaments`],
  ])('maps %s to %s', async (sub, upstreamPath) => {
    const { app, fake } = makeApp({ [upstreamPath]: { ok: sub } })
    const body = await (await app.request(`/api/players/${ME}/${sub}`)).json()
    expect(body.data).toEqual({ ok: sub })
    expect(fake.calls[0].url.pathname).toBe(`/api/v1${upstreamPath}`)
  })

  it('returns 404 for an unknown sub-resource and never proxies private ones', async () => {
    const { app, fake } = makeApp({})
    for (const sub of ['inventory', 'bets', 'blocks', 'gold-sources', 'card-tiers']) {
      expect((await app.request(`/api/players/${ME}/${sub}`)).status).toBe(404)
    }
    expect(fake.calls.length).toBe(0)
  })

  it('returns 404 for prototype-chain keys and never proxies them', async () => {
    const { app, fake } = makeApp({})
    for (const sub of ['constructor', '__proto__', 'toString']) {
      expect((await app.request(`/api/players/${ME}/${sub}`)).status).toBe(404)
    }
    expect(fake.calls.length).toBe(0)
  })
})

describe('GET /api/players/:id/vs/:opp', () => {
  it('returns the head-to-head top cards', async () => {
    const { app } = makeApp({ [`/players/${ME}/vs/${SID}/top-cards`]: { player_cards: [{ card_name: 'Poison', picks: 3, wins: 1 }], opponent_cards: [] } })
    const body = await (await app.request(`/api/players/${ME}/vs/${SID}`)).json()
    expect(body.data.player_cards[0].card_name).toBe('Poison')
    expect((await app.request(`/api/players/${ME}/vs/nope`)).status).toBe(400)
  })
})
