import { vi } from 'vitest'

export type HubRoutes = Record<string, unknown | (() => Response)>

export function env<T>(data: T, extra: Record<string, unknown> = {}) {
  return { data, fetched_at: new Date().toISOString(), stale: false, ...extra }
}

/** Replaces global fetch. Keys are hub paths without the /api prefix, e.g. '/home', '/leaderboard/1v1'. */
export function mockHub(routes: HubRoutes) {
  const calls: string[] = []
  const impl = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url, 'http://localhost')
    const key = url.pathname.replace(/^\/api/, '') + (url.search ? url.search : '')
    calls.push(key)
    const exact = routes[key] ?? routes[url.pathname.replace(/^\/api/, '')]
    if (exact === undefined) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    if (typeof exact === 'function') return (exact as () => Response)()
    return new Response(JSON.stringify(exact), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  globalThis.fetch = impl as unknown as typeof fetch
  return { calls, impl }
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
