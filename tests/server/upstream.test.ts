import { describe, it, expect } from 'vitest'
import { Upstream, UpstreamError, UpstreamNetworkError } from '../../src/server/upstream'
import { ModVersionSource } from '../../src/server/version'
import { NotAllowedError } from '../../src/server/allowlist'
import { fakeUpstream, json, deferred } from './helpers/fakeUpstream'

function make(map: Parameters<typeof fakeUpstream>[0], opts: Partial<ConstructorParameters<typeof Upstream>[0]> = {}) {
  const fake = fakeUpstream({ '/mod-version': { version: '1.40.3', min_version: '1.40.3' }, ...map })
  const version = new ModVersionSource({ baseUrl: 'https://up.test', userAgent: 'scr-hub/test', fetchImpl: fake.fetchImpl })
  const up = new Upstream({ baseUrl: 'https://up.test', userAgent: 'scr-hub/test', version, fetchImpl: fake.fetchImpl, ...opts })
  return { up, fake, version }
}

describe('Upstream', () => {
  it('builds URLs under /api/v1 and encodes query values, skipping undefined', () => {
    const { up } = make({})
    expect(up.buildUrl('/leaderboard', { limit: 500, include_inactive: undefined, role: 'solo' })).toBe(
      'https://up.test/api/v1/leaderboard?limit=500&role=solo',
    )
  })

  it('sends X-Mod-Version and User-Agent in community mode', async () => {
    const { up, fake } = make({ '/queue/count': { searching: 1, total: 1, online: 2 } })
    const body = await up.getJson<{ searching: number }>('/queue/count')
    expect(body.searching).toBe(1)
    const call = fake.calls.find((c) => c.url.pathname === '/api/v1/queue/count')!
    expect(call.headers['x-mod-version']).toBe('1.40.3')
    expect(call.headers['user-agent']).toBe('scr-hub/test')
    expect(call.headers['x-internal-key']).toBeUndefined()
  })

  it('sends X-Internal-Key instead of X-Mod-Version in hosted mode', async () => {
    const { up, fake } = make({ '/queue/count': { searching: 0 } }, { internalKey: 'k' })
    await up.getJson('/queue/count')
    const call = fake.calls.find((c) => c.url.pathname === '/api/v1/queue/count')!
    expect(call.headers['x-internal-key']).toBe('k')
    expect(call.headers['x-mod-version']).toBeUndefined()
    expect(fake.calls.some((c) => c.url.pathname === '/api/v1/mod-version')).toBe(false)
  })

  it('refuses paths that are not allowlisted before touching the network', async () => {
    const { up, fake } = make({})
    await expect(up.getJson('/admin/actions')).rejects.toThrow(NotAllowedError)
    expect(fake.calls.length).toBe(0)
  })

  it('on 426 refreshes the version and retries exactly once', async () => {
    let versionCalls = 0
    let lbCalls = 0
    const { up, fake } = make({
      '/mod-version': () => json({ version: versionCalls++ === 0 ? '1.40.3' : '1.41.0' }),
      '/leaderboard': () => (lbCalls++ === 0 ? json({ error: 'outdated', required: '1.41.0' }, 426) : json({ entries: [] })),
    })
    const body = await up.getJson<{ entries: unknown[] }>('/leaderboard')
    expect(body.entries).toEqual([])
    const lb = fake.calls.filter((c) => c.url.pathname === '/api/v1/leaderboard')
    expect(lb.length).toBe(2)
    expect(lb[1].headers['x-mod-version']).toBe('1.41.0')
  })

  it('does not retry a 426 in hosted mode', async () => {
    const { up, fake } = make({ '/leaderboard': () => json({ error: 'outdated' }, 426) }, { internalKey: 'k' })
    const err = await up.getJson('/leaderboard').catch((e) => e)
    expect(err).toBeInstanceOf(UpstreamError)
    expect((err as UpstreamError).status).toBe(426)
    const lb = fake.calls.filter((c) => c.url.pathname === '/api/v1/leaderboard')
    expect(lb.length).toBe(1)
    expect(fake.calls.some((c) => c.url.pathname === '/api/v1/mod-version')).toBe(false)
  })

  it('throws UpstreamError with the status for non-2xx responses (after the single 426 retry)', async () => {
    const { up } = make({ '/leaderboard': () => json({ error: 'outdated' }, 426) })
    await expect(up.getJson('/leaderboard')).rejects.toMatchObject({ status: 426, path: '/leaderboard' })
    const { up: up2 } = make({ '/players/search': () => json({ detail: 'nope' }, 404) })
    const err = await up2.getJson('/players/search').catch((e) => e)
    expect(err).toBeInstanceOf(UpstreamError)
    expect((err as UpstreamError).status).toBe(404)
  })

  it('wraps a bare fetch failure in UpstreamNetworkError, preserving the cause', async () => {
    const networkErr = new TypeError('fetch failed')
    const { up } = make({
      '/queue/count': () => {
        throw networkErr
      },
    })
    const err = await up.getJson('/queue/count').catch((e) => e)
    expect(err).toBeInstanceOf(UpstreamNetworkError)
    expect((err as UpstreamNetworkError).cause).toBe(networkErr)
  })

  it('does not wrap a TimeoutError from fetch', async () => {
    const timeoutErr = new Error('timed out')
    timeoutErr.name = 'TimeoutError'
    const { up } = make({
      '/queue/count': () => {
        throw timeoutErr
      },
    })
    const err = await up.getJson('/queue/count').catch((e) => e)
    expect(err).toBe(timeoutErr)
  })

  it('never has more than maxConcurrent requests in flight', async () => {
    let inFlight = 0
    let peak = 0
    const gate = deferred<void>()
    const { up } = make(
      {
        '/queue/count': async () => {
          inFlight++
          peak = Math.max(peak, inFlight)
          await gate.promise
          inFlight--
          return json({ searching: 0 })
        },
      },
      { maxConcurrent: 3 },
    )
    const all = Promise.all(Array.from({ length: 10 }, () => up.getJson('/queue/count')))
    await new Promise((r) => setTimeout(r, 10))
    expect(peak).toBe(3)
    gate.resolve()
    await all
    expect(peak).toBe(3)
  })
})
