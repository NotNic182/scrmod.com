/** Text and attribute escaping for everything the server writes into HTML. */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** A JSON-LD block that no string inside the data can close early. */
export function jsonLdScript(data: unknown): string {
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029')
  return `<script type="application/ld+json">${json}</script>`
}

export const HEAD_START = '<!--seo:head:start-->'
export const HEAD_END = '<!--seo:head:end-->'
export const BODY_MARK = '<!--seo:body-->'

/** Swaps the marked head region for `head` and the body marker for `body`; a template without markers is returned as is. */
export function fillTemplate(template: string, head: string, body: string): string {
  let out = template
  const a = out.indexOf(HEAD_START)
  const b = out.indexOf(HEAD_END)
  if (a >= 0 && b > a) out = out.slice(0, a) + head + out.slice(b + HEAD_END.length)
  const m = out.indexOf(BODY_MARK)
  if (m >= 0) out = out.slice(0, m) + body + out.slice(m + BODY_MARK.length)
  return out
}
