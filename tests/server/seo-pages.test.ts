import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { brotliDecompressSync } from 'node:zlib'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'
import { registerStatic } from '../../src/server/static'
import type { RouteMap } from './helpers/fakeUpstream'

const ID = '76561199311926326'
let root: string
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'scr-seo-'))
  await writeFile(
    path.join(root, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8" /><!--seo:head:start--><title>SCRmod</title><!--seo:head:end--></head><body><div id="root"><!--seo:body--></div></body></html>',
  )
})

// Requests go to the canonical host, so Task 12's host redirect leaves these tests alone.
const ORIGIN = 'https://scrmod.com'
function site(map: RouteMap) {
  const built = makeApp(map, { PUBLIC_BASE_URL: ORIGIN })
  registerStatic(built.app, { root, basePath: built.env.basePath, deps: built.deps })
  return { request: (p: string, init?: RequestInit) => built.app.request(`${ORIGIN}${p}`, init) }
}

const board = { entries: [{ rank: 1, steam_id: ID, display_name: 'Sid</title>', rating: 2564 }], total_players: 1 }
const cards = [{ card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 800, win_rate: 0.52, pass_rate: 0.31, times_offered: 1500, unique_players: 70, sweeps_with_card: 9 }]

describe('server-rendered pages', () => {
  it('home: head, structured data and shell', async () => {
    const res = await site({ '/presence/online': { online_count: 7, online: [], recent: [] } }).request('/')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<title>SCRmod: ROUNDS ranked stats, live games and leaderboards</title>')
    expect(html).toContain('<link rel="canonical" href="https://scrmod.com/" />')
    expect(html).toContain('"@type":"WebSite"')
    expect(html).toContain('Online now: 7')
    expect(html).not.toContain('<!--seo:')
  })

  it('a board lists its players with names escaped', async () => {
    const html = await (await site({ '/leaderboard': board }).request('/leaderboards/1v1')).text()
    expect(html).toContain('ROUNDS 1v1 ranked leaderboard: top players by rating · SCRmod')
    expect(html).toContain('Sid&lt;/title&gt;')
    expect(html).not.toContain('Sid</title>')
  })

  it('redirects /leaderboards and card aliases, 404s the unknown', async () => {
    const app = site({ '/cards': cards })
    const r1 = await app.request('/leaderboards')
    expect(r1.status).toBe(301)
    expect(r1.headers.get('location')).toBe('/leaderboards/1v1')
    const r2 = await app.request('/cards/Big%20Bullet')
    expect(r2.status).toBe(301)
    expect(r2.headers.get('location')).toBe('/cards/big-bullet')
    expect((await app.request('/cards/nope')).status).toBe(404)
    const nf = await app.request('/wp-login.php')
    expect(nf.status).toBe(404)
    expect(await nf.text()).toContain('<meta name="robots" content="noindex, follow" />')
    expect((await app.request('/players/123')).status).toBe(404)
  })

  it('a card page carries its facts in the description and the shell', async () => {
    const res = await site({ '/cards': cards }).request('/cards/big-bullet')
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toContain('Big Bullet (Common) in ROUNDS: 52% win rate')
    expect(html).toContain('"@type":"BreadcrumbList"')
    expect(html).toContain('<h1>Big Bullet</h1>')
  })

  it('a profile stays out of the index but gets a rich preview; a deleted one 404s', async () => {
    const app = site({ [`/players/${ID}`]: { steam_id: ID, display_name: 'NotNic', rating: 1101.8, rank_name: 'Beginner I' } })
    const res = await app.request(`/players/${ID}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-robots-tag')).toBe('noindex, follow')
    expect(await res.text()).toContain('<meta property="og:description" content="1102 rating · Beginner I" />')
    const gone = site({ [`/players/${ID}`]: () => json({ detail: 'not found' }, 404) })
    expect((await gone.request(`/players/${ID}`)).status).toBe(404)
  })

  it('does not wait more than the cap on a slow upstream', async () => {
    const slow = () => new Promise<Response>((r) => setTimeout(() => r(json(board)), 2000))
    const t0 = Date.now()
    const res = await site({ '/leaderboard': slow }).request('/leaderboards/1v1')
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<h1>Leaderboards</h1>')
  })

  it('works under a base path and compresses', async () => {
    const built = makeApp({}, { BASE_PATH: '/hub', PUBLIC_BASE_URL: 'https://example.org/hub' })
    registerStatic(built.app, { root, basePath: '/hub', deps: built.deps })
    const html = await (await built.app.request('https://example.org/hub/guide')).text()
    expect(html).toContain('<link rel="canonical" href="https://example.org/hub/guide" />')
    expect(html).toContain('href="/hub/leaderboards/1v1"')
    const br = await built.app.request('https://example.org/hub/guide', { headers: { 'Accept-Encoding': 'br' } })
    expect(br.headers.get('content-encoding')).toBe('br')
    expect(brotliDecompressSync(Buffer.from(await br.arrayBuffer())).toString()).toContain('How to play ranked ROUNDS')
  })

  it('a null response from upstream renders the generic page rather than an error', async () => {
    const res = await site({ '/series/recent-multimode': null }).request('/results')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<h1>Results</h1>')
  })

  it('a well-formed tournament id 404s when upstream has none, and renders when found', async () => {
    const id = '11111111-1111-1111-1111-111111111111'
    const gone = site({ [`/tournaments/${id}/bracket-detail`]: () => json({ detail: 'not found' }, 404) })
    expect((await gone.request(`/tournaments/${id}`)).status).toBe(404)
    const found = site({ [`/tournaments/${id}/bracket-detail`]: { matches: [] } })
    expect((await found.request(`/tournaments/${id}`)).status).toBe(200)
  })

  it('without PUBLIC_BASE_URL, links the https address a TLS proxy was reached on', async () => {
    const built = makeApp({})
    registerStatic(built.app, { root, basePath: built.env.basePath, deps: built.deps })
    const html = await (await built.app.request('http://x.up.railway.app/guide', { headers: { 'x-forwarded-proto': 'https' } })).text()
    expect(html).toContain('<link rel="canonical" href="https://x.up.railway.app/guide" />')
    expect(html).toContain('"mainEntityOfPage":"https://x.up.railway.app/guide"')
  })

  it('redirects /leaderboards under a base path with the base path kept in the location', async () => {
    const built = makeApp({}, { BASE_PATH: '/hub', PUBLIC_BASE_URL: 'https://example.org/hub' })
    registerStatic(built.app, { root, basePath: '/hub', deps: built.deps })
    const res = await built.app.request('https://example.org/hub/leaderboards')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/hub/leaderboards/1v1')
  })
})
