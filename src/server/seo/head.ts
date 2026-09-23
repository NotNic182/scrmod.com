import type { PageMeta } from '../../shared/seo'
import { esc, jsonLdScript } from './html'

export interface HeadInput {
  meta: PageMeta
  /** Origin plus base path, no trailing slash. */
  site: string
  jsonLd: object[]
  verification?: { google?: string; bing?: string }
}

/** Everything that goes between the head markers: title, description, canonical, robots, previews, structured data. */
export function renderHead({ meta, site, jsonLd, verification }: HeadInput): string {
  const url = meta.path === null ? null : meta.path === '/' ? `${site}/` : `${site}${meta.path}`
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${meta.index ? 'index, follow' : 'noindex, follow'}" />`,
    url ? `<link rel="canonical" href="${esc(url)}" />` : '',
    `<meta property="og:site_name" content="SCRmod" />`,
    `<meta property="og:type" content="${meta.ogType}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    url ? `<meta property="og:url" content="${esc(url)}" />` : '',
    `<meta property="og:image" content="${esc(`${site}/og.png`)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    verification?.google ? `<meta name="google-site-verification" content="${esc(verification.google)}" />` : '',
    verification?.bing ? `<meta name="msvalidate.01" content="${esc(verification.bing)}" />` : '',
    ...jsonLd.map(jsonLdScript),
  ]
  return tags.filter(Boolean).join('\n    ')
}
