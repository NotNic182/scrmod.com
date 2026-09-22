import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fixtureNameFor } from '../shared/fixture-name.mjs'

export { fixtureNameFor }

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
