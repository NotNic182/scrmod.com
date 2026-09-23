import { describe, it, expect } from 'vitest'
import { makeApp } from './helpers/makeApp'
import { json } from './helpers/fakeUpstream'

const cards = [{ card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 1, win_rate: 0.5, pass_rate: 0.3 }]

describe('crawl files', () => {
  it('robots.txt allows pages, blocks the API and points to the sitemap', async () => {
    const { app } = makeApp({}, { PUBLIC_BASE_URL: 'https://scrmod.com' })
    const res = await app.request('/robots.txt')
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(await res.text()).toBe('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\n\nSitemap: https://scrmod.com/sitemap.xml\n')
  })

  it('without PUBLIC_BASE_URL, points to the sitemap on the https address a TLS proxy was reached on', async () => {
    const { app } = makeApp({})
    const res = await app.request('http://x.up.railway.app/robots.txt', { headers: { 'x-forwarded-proto': 'https' } })
    expect(await res.text()).toContain('Sitemap: https://x.up.railway.app/sitemap.xml')
  })

  it('the sitemap lists the pages and every card, never players', async () => {
    const { app } = makeApp({ '/cards': cards }, { PUBLIC_BASE_URL: 'https://scrmod.com' })
    const res = await app.request('/sitemap.xml')
    expect(res.headers.get('content-type')).toContain('application/xml')
    const xml = await res.text()
    for (const p of ['/', '/leaderboards/1v1', '/leaderboards/1v2-duo', '/results', '/tournaments', '/cards', '/guide', '/about', '/cards/big-bullet']) {
      expect(xml).toContain(`<loc>https://scrmod.com${p}</loc>`)
    }
    expect(xml).toMatch(/<loc>https:\/\/scrmod\.com\/cards\/big-bullet<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/)
    expect(xml).toContain('<loc>https://scrmod.com/guide</loc><lastmod>2026-09-23</lastmod>')
    expect(xml).not.toContain('/players/')
    expect(xml.match(/<url>/g)).toHaveLength(13) // 12 site pages (home, 6 boards, results, tournaments, cards, guide, about) + 1 card
  })

  it('still serves the pages when the card list fails', async () => {
    const { app } = makeApp({ '/cards': () => json({ detail: 'down' }, 500) }, { PUBLIC_BASE_URL: 'https://scrmod.com' })
    const res = await app.request('/sitemap.xml')
    expect(res.status).toBe(200)
    expect((await res.text()).match(/<url>/g)).toHaveLength(12)
  })

  it('respects a base path', async () => {
    const { app } = makeApp({}, { BASE_PATH: '/hub', PUBLIC_BASE_URL: 'https://example.org/hub' })
    expect(await (await app.request('/hub/robots.txt')).text()).toContain('Disallow: /hub/api/\nDisallow: /hub/auth/\n\nSitemap: https://example.org/hub/sitemap.xml')
  })
})
