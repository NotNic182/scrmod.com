import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const all = [
  { card_name: 'Poison', card_rarity: 'Common', times_picked: 900, win_rate: 0.43, pass_rate: 0.34, times_offered: 2000, unique_players: 80, sweeps_with_card: 5 },
  { card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 800, win_rate: 0.52, pass_rate: 0.31, times_offered: 1500, unique_players: 70, sweeps_with_card: 9 },
  { card_name: 'Glass Cannon', card_rarity: 'Uncommon', times_picked: 700, win_rate: 0.55, pass_rate: 0.2, times_offered: 1200, unique_players: 60, sweeps_with_card: 4 },
]
const cards = (url: URL) => {
  const r = url.searchParams.get('is_ranked')
  if (r === 'true') return json([{ ...all[1], win_rate: 0.6 }])
  if (r === 'false') return json([])
  return json(all)
}
const leaders = { winners: ['Big Bullet|Sid|42', 'Big Bullet|Stan|50', 'Poison|Nix|3'], sweepers: ['Big Bullet|Stan|7'] }

describe('/api/card/:slug', () => {
  it('returns one card with its ranked split, leaders and neighbours', async () => {
    const { app } = makeApp({ '/cards': cards, '/cards/leaders-summary': leaders })
    const res = await app.request('/api/card/big-bullet')
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.slug).toBe('big-bullet')
    expect(data.card.card_name).toBe('Big Bullet')
    expect(data.ranked.win_rate).toBe(0.6)
    expect(data.casual).toBeNull()
    expect(data.winners).toEqual([{ card: 'Big Bullet', player: 'Stan', count: 50 }, { card: 'Big Bullet', player: 'Sid', count: 42 }])
    expect(data.sweepers).toEqual([{ card: 'Big Bullet', player: 'Stan', count: 7 }])
    expect(data.prev).toEqual({ name: 'Poison', slug: 'poison' })
    expect(data.next).toEqual({ name: 'Glass Cannon', slug: 'glass-cannon' })
  })

  it('answers a display name or odd casing with the canonical card', async () => {
    const { app } = makeApp({ '/cards': cards, '/cards/leaders-summary': leaders })
    expect((await (await app.request('/api/card/Big%20Bullet')).json()).data.slug).toBe('big-bullet')
    expect((await (await app.request('/api/card/BIG-BULLET')).json()).data.slug).toBe('big-bullet')
  })

  it('404s an unknown card and survives a failing ranked list', async () => {
    const { app } = makeApp({ '/cards': (url: URL) => (url.searchParams.get('is_ranked') ? json({ detail: 'x' }, 500) : json(all)) })
    expect((await app.request('/api/card/nope')).status).toBe(404)
    const res = await app.request('/api/card/poison')
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.ranked).toBeNull()
    expect(data.winners).toEqual([])
    expect(data.prev).toBeNull()
  })
})
