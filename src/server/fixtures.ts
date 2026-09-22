import { readFile } from 'node:fs/promises'
import path from 'node:path'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function fixtureNameFor(urlPath: string): string {
  const p = urlPath.replace(/^\/api\/v1\//, '').replace(/^\/+|\/+$/g, '')
  return p
    .split('/')
    .map((seg) => (/^\d+$/.test(seg) ? 'ID' : UUID_RE.test(seg) ? 'UUID' : seg))
    .join('__')
}

/**
 * A fetch() that answers from `<dir>/<fixtureName>.json` (spec 7.4). Node only.
 * Unknown paths get a 404 with a JSON body so routes degrade the same way as upstream 404s.
 */
export function createFixtureFetch(dir: string): typeof fetch {
  const impl = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
    const name = fixtureNameFor(url.pathname)
    try {
      const text = await readFile(path.join(dir, `${name}.json`), 'utf8')
      return new Response(text, { status: 200, headers: { 'content-type': 'application/json' } })
    } catch {
      return new Response(JSON.stringify({ detail: `no fixture ${name}` }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    }
  }
  return impl as typeof fetch
}
