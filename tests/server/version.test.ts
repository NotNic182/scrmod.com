import { describe, it, expect, vi } from 'vitest'
import { ModVersionSource } from '../../src/server/version'

function fakeFetch(bodies: Array<{ status?: number; body: unknown }>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = []
  let i = 0
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k.toLowerCase()] = v))
    calls.push({ url, headers })
    const next = bodies[Math.min(i, bodies.length - 1)]
    i++
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

describe('ModVersionSource', () => {
  it('discovers the version from /api/v1/mod-version with the User-Agent header', async () => {
    const { fetchImpl, calls } = fakeFetch([{ body: { version: '1.40.3', min_version: '1.40.3' } }])
    const src = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'scr-hub/test', fetchImpl })
    expect(await src.current()).toBe('1.40.3')
    expect(calls[0].url).toBe('https://up.test/api/v1/mod-version')
    expect(calls[0].headers['user-agent']).toBe('scr-hub/test')
    expect(src.state()).toMatchObject({ version: '1.40.3', source: 'discovered' })
  })

  it('falls back to min_version when version is absent', async () => {
    const { fetchImpl } = fakeFetch([{ body: { min_version: '1.40.3' } }])
    const src = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl })
    expect(await src.current()).toBe('1.40.3')
    expect(src.state().source).toBe('discovered')
  })

  it('caches for refreshMs and refreshes afterwards', async () => {
    let now = 1_000_000
    const { fetchImpl } = fakeFetch([{ body: { version: '1.40.3' } }, { body: { version: '1.41.0' } }])
    const src = new ModVersionSource({
      baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl, refreshMs: 600_000, now: () => now,
    })
    expect(await src.current()).toBe('1.40.3')
    now += 599_000
    expect(await src.current()).toBe('1.40.3')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    now += 2_000
    expect(await src.current()).toBe('1.41.0')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('refresh() forces a fetch and coalesces concurrent refreshes', async () => {
    const { fetchImpl } = fakeFetch([{ body: { version: '1.40.3' } }])
    const src = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl })
    const [a, b] = await Promise.all([src.refresh(), src.refresh()])
    expect(a).toBe('1.40.3')
    expect(b).toBe('1.40.3')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('uses the override without ever fetching', async () => {
    const { fetchImpl } = fakeFetch([{ body: { version: '9.9.9' } }])
    const src = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl, override: '1.40.3' })
    expect(await src.current()).toBe('1.40.3')
    expect(await src.refresh()).toBe('1.40.3')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(src.state().source).toBe('override')
  })

  it('keeps the last known version when a refresh fails, and throws if nothing is known', async () => {
    const { fetchImpl } = fakeFetch([{ body: { version: '1.40.3' } }, { status: 500, body: { error: 'x' } }])
    let now = 0
    const src = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl, now: () => now, refreshMs: 10 })
    expect(await src.current()).toBe('1.40.3')
    now = 100
    expect(await src.current()).toBe('1.40.3') // refresh failed, last value kept

    const bad = fakeFetch([{ status: 500, body: {} }])
    const empty = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl: bad.fetchImpl })
    await expect(empty.current()).rejects.toThrow()
    expect(empty.state().source).toBe('none')
  })

  it('backs off for retryMs after a failed refresh instead of refetching every call', async () => {
    const { fetchImpl } = fakeFetch([{ body: { version: '1.40.3' } }, { status: 500, body: { error: 'x' } }])
    let now = 0
    const src = new ModVersionSource({
      baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl, now: () => now, refreshMs: 10, retryMs: 30_000,
    })
    expect(await src.current()).toBe('1.40.3')
    now = 100
    expect(await src.current()).toBe('1.40.3') // refresh fails here
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    now = 20_000
    expect(await src.current()).toBe('1.40.3') // still backing off, no fetch
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    now = 30_101
    expect(await src.current()).toBe('1.40.3')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('rejects during the backoff window when nothing is known yet', async () => {
    const { fetchImpl } = fakeFetch([{ status: 500, body: {} }])
    let now = 0
    const src = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl, now: () => now, retryMs: 30_000 })
    await expect(src.current()).rejects.toThrow()
    now = 1_000
    await expect(src.current()).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('reports min_version alongside the version', async () => {
    const { fetchImpl } = fakeFetch([{ body: { version: '1.40.3', min_version: '1.40.0' } }])
    const src = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'ua', fetchImpl })
    await src.current()
    expect(src.state()).toMatchObject({ version: '1.40.3', min_version: '1.40.0', source: 'discovered' })
  })
})
