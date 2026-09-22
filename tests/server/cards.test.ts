import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'

const CARD = { card_name: 'Poison', card_rarity: 'Common', times_picked: 8619, win_rate: 0.4321, pass_rate: 0.3405 }

describe('cards', () => {
  it('maps filter to is_ranked and validates sort', async () => {
    const { app, fake } = makeApp({ '/cards': [CARD] })
    expect((await (await app.request('/api/cards')).json()).data[0].card_name).toBe('Poison')
    await app.request('/api/cards?filter=ranked&sort=win_rate&order=asc')
    await app.request('/api/cards?filter=casual')
    const q = fake.calls.map((c) => Object.fromEntries(c.url.searchParams))
    expect(q[0]).toEqual({ limit: '200', min_picks: '5', sort_by: 'times_picked', order: 'desc' })
    expect(q[1]).toEqual({ limit: '200', min_picks: '5', sort_by: 'win_rate', order: 'asc', is_ranked: 'true' })
    expect(q[2].is_ranked).toBe('false')
    expect((await app.request('/api/cards?filter=weird')).status).toBe(400)
    expect((await app.request('/api/cards?sort=drop_table')).status).toBe(400)
  })

  it('parses the pipe-joined leader strings', async () => {
    const { app } = makeApp({ '/cards/leaders-summary': { sweepers: ['Big Bullet|Stan|28'], winners: ['Careful Planning|Sid|42', 'broken'] } })
    const body = await (await app.request('/api/cards/leaders')).json()
    expect(body.data.sweepers).toEqual([{ card: 'Big Bullet', player: 'Stan', count: 28 }])
    expect(body.data.winners).toEqual([{ card: 'Careful Planning', player: 'Sid', count: 42 }])
  })

  it('looks up top pickers by card name', async () => {
    const { app, fake } = makeApp({ '/cards/top-pickers': { card_name: 'Poison', display_names: ['Sid'], steam_ids: ['76561198040410653'], picks: [537], win_rates: [0.95] } })
    const body = await (await app.request('/api/cards/Poison/pickers')).json()
    expect(body.data.display_names).toEqual(['Sid'])
    expect(Object.fromEntries(fake.calls[0].url.searchParams)).toEqual({ card_name: 'Poison', limit: '10' })
    expect((await app.request('/api/cards/' + 'x'.repeat(65) + '/pickers')).status).toBe(400)
  })
})
