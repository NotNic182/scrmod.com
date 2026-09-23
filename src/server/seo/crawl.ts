import type { Hono } from 'hono'
import { GUIDE_CHECKED } from '../../shared/guide'
import { BOARD_MODES, cardSlug } from '../../shared/seo'
import { loadCards } from '../routes/cards'
import type { RouteDeps } from '../routes/common'
import { esc } from './html'
import { basePrefix, siteUrl } from './site'

export function registerCrawlRoutes(app: Hono, d: RouteDeps) {
  app.get('/robots.txt', (c) => {
    const base = basePrefix(d.env)
    c.header('Content-Type', 'text/plain; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600')
    return c.body(`User-agent: *\nAllow: /\nDisallow: ${base}/api/\nDisallow: ${base}/auth/\n\nSitemap: ${siteUrl(d.env, c.req.url)}/sitemap.xml\n`)
  })

  app.get('/sitemap.xml', async (c) => {
    const site = siteUrl(d.env, c.req.url)
    const urls: Array<{ path: string; lastmod?: string }> = [
      { path: '/' },
      ...BOARD_MODES.map((m) => ({ path: `/leaderboards/${m.id}` })),
      { path: '/results' },
      { path: '/tournaments' },
      { path: '/cards' },
      { path: '/guide', lastmod: GUIDE_CHECKED },
      { path: '/about' },
    ]
    try {
      const cards = await loadCards(d, 'all')
      const day = new Date(cards.fetched_at).toISOString().slice(0, 10)
      for (const card of cards.value) urls.push({ path: `/cards/${cardSlug(card.card_name)}`, lastmod: day })
    } catch {
      // No card list right now: the sitemap still lists the site's own pages.
    }
    const body = urls
      .map((u) => `  <url><loc>${esc(u.path === '/' ? `${site}/` : `${site}${u.path}`)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
      .join('\n')
    c.header('Content-Type', 'application/xml; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600')
    return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`)
  })
}
