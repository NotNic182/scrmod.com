import { describe, it, expect } from 'vitest'
import { article, breadcrumbs, itemList, siteGraph } from '../../src/server/seo/jsonld'

const SITE = 'https://scrmod.com'

describe('structured data', () => {
  it('describes the site as about ROUNDS and the mod, tied to their official accounts', () => {
    const g = siteGraph(SITE) as Record<string, any>
    expect(g['@type']).toBe('WebSite')
    expect(g.url).toBe('https://scrmod.com/')
    expect(g.alternateName).toContain("Sid's Competitive Rounds stats")
    const [game, mod] = g.about
    expect(game).toMatchObject({ '@type': 'VideoGame', name: 'ROUNDS', sameAs: ['https://store.steampowered.com/app/1557740/ROUNDS/'] })
    expect(mod['@type']).toBe('SoftwareApplication')
    expect(mod.sameAs).toContain('https://thunderstore.io/c/rounds/p/Team_Sid/SidsCompetitiveRounds/')
    expect(mod.publisher.sameAs).toEqual(['https://www.twitch.tv/sidscompetitiverounds', 'https://www.youtube.com/@SidsCompetitiveRounds', 'https://discord.gg/4tsWadH6tc'])
  })

  it('builds breadcrumbs, an article and an item list with absolute URLs', () => {
    const b = breadcrumbs(SITE, [{ name: 'Home', path: '/' }, { name: 'Cards', path: '/cards' }]) as Record<string, any>
    expect(b.itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, name: 'Cards', item: 'https://scrmod.com/cards' })
    const a = article(SITE, { headline: 'H', description: 'D', path: '/guide', dateModified: '2026-09-23' }) as Record<string, any>
    expect(a).toMatchObject({ '@type': 'Article', headline: 'H', dateModified: '2026-09-23', mainEntityOfPage: 'https://scrmod.com/guide' })
    const l = itemList(SITE, [{ name: 'Big Bullet', path: '/cards/big-bullet' }]) as Record<string, any>
    expect(l.itemListElement[0]).toEqual({ '@type': 'ListItem', position: 1, name: 'Big Bullet', url: 'https://scrmod.com/cards/big-bullet' })
  })
})
