import { LINKS } from '../../shared/links'

const url = (site: string, path: string) => (path === '/' ? `${site}/` : `${site}${path}`)

/**
 * The site-wide graph: SCRmod is about the game ROUNDS and the mod Sid's Competitive Rounds, whose community
 * publishes on Twitch, YouTube and Discord. These links are what tie the site to ROUNDS searches.
 */
export function siteGraph(site: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site}/#site`,
    name: 'SCRmod',
    alternateName: ['SCR mod', "Sid's Competitive Rounds stats"],
    url: `${site}/`,
    inLanguage: 'en',
    about: [
      { '@type': 'VideoGame', '@id': `${site}/#rounds`, name: 'ROUNDS', sameAs: [LINKS.steam], publisher: { '@type': 'Organization', name: 'Landfall' } },
      {
        '@type': 'SoftwareApplication',
        '@id': `${site}/#mod`,
        name: "Sid's Competitive Rounds",
        applicationCategory: 'GameApplication',
        operatingSystem: 'Windows',
        sameAs: [LINKS.thunderstore, LINKS.github],
        publisher: { '@type': 'Organization', name: "Sid's Competitive Rounds", sameAs: [LINKS.twitch, LINKS.youtube, LINKS.discord] },
      },
    ],
  }
}

export function breadcrumbs(site: string, items: Array<{ name: string; path: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: url(site, it.path) })),
  }
}

export function article(site: string, a: { headline: string; description: string; path: string; dateModified: string }): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.headline,
    description: a.description,
    dateModified: a.dateModified,
    mainEntityOfPage: url(site, a.path),
    about: { '@id': `${site}/#mod` },
    publisher: { '@type': 'Organization', name: 'SCRmod', url: `${site}/` },
  }
}

export function itemList(site: string, items: Array<{ name: string; path: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: url(site, it.path) })),
  }
}
