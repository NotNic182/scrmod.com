import { vi } from 'vitest'

export type Responder = (url: URL) => Response | Promise<Response>
export type RouteMap = Record<string, unknown | Responder>

export interface Call {
  url: URL
  headers: Record<string, string>
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/**
 * A fetch() stand-in keyed by upstream path (relative to /api/v1).
 * Values are JSON bodies, or functions returning a Response for status/latency control.
 */
export function fakeUpstream(map: RouteMap) {
  const calls: Call[] = []
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k.toLowerCase()] = v))
    calls.push({ url, headers })
    const key = url.pathname.replace(/^\/api\/v1/, '')
    if (!(key in map)) return json({ detail: `fake upstream: no route ${key}` }, 404)
    const hit = map[key]
    if (typeof hit === 'function') return await (hit as Responder)(url)
    return json(hit)
  }) as unknown as typeof fetch
  return { fetchImpl, calls, map }
}

/** A promise you resolve by hand, for concurrency tests. */
export function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
