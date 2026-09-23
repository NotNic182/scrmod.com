import { describe, it, expect } from 'vitest'
import { renderHead } from '../../src/server/seo/head'
import { pageMeta } from '../../src/shared/seo'

const SITE = 'https://scrmod.com'

describe('renderHead', () => {
  it('writes title, description, canonical, robots and link-preview tags', () => {
    const html = renderHead({ meta: pageMeta({ kind: 'cards' }), site: SITE, jsonLd: [{ '@type': 'WebSite' }] })
    expect(html).toContain('<title>ROUNDS card win rates: the best cards in ranked play · SCRmod</title>')
    expect(html).toContain('<link rel="canonical" href="https://scrmod.com/cards" />')
    expect(html).toContain('<meta name="robots" content="index, follow" />')
    expect(html).toContain('<meta property="og:url" content="https://scrmod.com/cards" />')
    expect(html).toContain('<meta property="og:image" content="https://scrmod.com/og.png" />')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(html.match(/application\/ld\+json/g)).toHaveLength(1)
    expect(html).not.toContain('google-site-verification')
  })

  it('marks noindex pages, drops the canonical when there is none, and escapes names', () => {
    const player = renderHead({ meta: pageMeta({ kind: 'player', id: '76561199311926326' }, { player: { display_name: '"><script>x</script>' } }), site: SITE, jsonLd: [] })
    expect(player).toContain('<meta name="robots" content="noindex, follow" />')
    expect(player).toContain('<meta property="og:type" content="profile" />')
    expect(player).not.toContain('<script>x')
    expect(player).toContain('&quot;&gt;&lt;script&gt;x&lt;/script&gt;')
    expect(renderHead({ meta: pageMeta({ kind: 'not-found' }), site: SITE, jsonLd: [] })).not.toContain('rel="canonical"')
  })

  it('adds verification tags when configured', () => {
    const html = renderHead({ meta: pageMeta({ kind: 'home' }), site: SITE, jsonLd: [], verification: { google: 'abc', bing: 'def' } })
    expect(html).toContain('<meta name="google-site-verification" content="abc" />')
    expect(html).toContain('<meta name="msvalidate.01" content="def" />')
    expect(html).toContain('<link rel="canonical" href="https://scrmod.com/" />')
  })
})
