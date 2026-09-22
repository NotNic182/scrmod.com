import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { clientIp, rateLimit } from '../../src/server/ratelimit'
import { makeApp } from './helpers/makeApp'

const BOARD = { '/leaderboard': { entries: [], total_players: 0 } }
const IP = (ip: string) => ({ headers: { 'x-forwarded-for': ip } })
/** What an edge proxy actually sends: the client's claim first, its own view appended last. */
const EDGE = (claimed: string, seen: string) => ({ headers: { 'x-forwarded-for': `${claimed}, ${seen}` } })

interface Requestable {
  request: (path: string, init?: RequestInit) => Response | Promise<Response>
}

async function drain(app: Requestable, path: string, n: number, init?: RequestInit): Promise<Response> {
  let last: Response | undefined
  for (let i = 0; i < n; i++) last = await app.request(path, init)
  if (!last) throw new Error('drain needs at least one request')
  return last
}

describe('rate limit', () => {
  it('lets a client through while it is under budget', async () => {
    const { app } = makeApp(BOARD, {}, { now: 1_000_000 })
    const last = await drain(app, '/api/leaderboard/1v1', 60, IP('1.1.1.1'))
    expect(last.status).toBe(200)
  })

  it('answers 429 with a Retry-After header once the budget is gone', async () => {
    const { app } = makeApp(BOARD, {}, { now: 1_000_000 })
    await drain(app, '/api/leaderboard/1v1', 60, IP('1.1.1.1'))
    const res = await app.request('/api/leaderboard/1v1', IP('1.1.1.1'))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('1')
    expect(await res.json()).toEqual({ error: 'rate_limited', retry_after: 1 })
  })

  it('keeps clients independent', async () => {
    const { app } = makeApp(BOARD, {}, { now: 1_000_000 })
    await drain(app, '/api/leaderboard/1v1', 61, IP('1.1.1.1'))
    expect((await app.request('/api/leaderboard/1v1', IP('2.2.2.2'))).status).toBe(200)
    expect((await app.request('/api/leaderboard/1v1', { headers: { 'x-real-ip': '3.3.3.3' } })).status).toBe(200)
  })

  it('never limits the health check', async () => {
    const { app } = makeApp(BOARD, {}, { now: 1_000_000 })
    await drain(app, '/api/leaderboard/1v1', 61, IP('1.1.1.1'))
    expect((await app.request('/api/_status', IP('1.1.1.1'))).status).toBe(200)
  })

  it('refills after the window', async () => {
    const nowRef = { now: 1_000_000 }
    const { app } = makeApp(BOARD, {}, nowRef)
    await drain(app, '/api/leaderboard/1v1', 60, IP('1.1.1.1'))
    expect((await app.request('/api/leaderboard/1v1', IP('1.1.1.1'))).status).toBe(429)
    nowRef.now += 10_000
    expect((await app.request('/api/leaderboard/1v1', IP('1.1.1.1'))).status).toBe(200)
  })

  it('gives /auth/* its own tighter budget', async () => {
    const { app } = makeApp(BOARD, {}, { now: 1_000_000 })
    const last = await drain(app, '/auth/discord/login', 10, IP('1.1.1.1'))
    expect(last.status).toBe(404) // sign-in is not configured here, but the request still counts
    const res = await app.request('/auth/discord/login', IP('1.1.1.1'))
    expect(res.status).toBe(429)
    expect((await res.json()).retry_after).toBe(6)
    // The /api budget is separate.
    expect((await app.request('/api/leaderboard/1v1', IP('1.1.1.1'))).status).toBe(200)
  })

  it('honours BASE_PATH when classifying the route', async () => {
    const { app } = makeApp(BOARD, { BASE_PATH: '/hub' }, { now: 1_000_000 })
    await drain(app, '/hub/api/leaderboard/1v1', 60, IP('1.1.1.1'))
    expect((await app.request('/hub/api/leaderboard/1v1', IP('1.1.1.1'))).status).toBe(429)
    expect((await app.request('/hub/api/_status', IP('1.1.1.1'))).status).toBe(200)
  })

  it('is disabled by SCR_RATE_LIMIT=off', async () => {
    const { app } = makeApp(BOARD, { SCR_RATE_LIMIT: 'off' }, { now: 1_000_000 })
    const last = await drain(app, '/api/leaderboard/1v1', 100, IP('1.1.1.1'))
    expect(last.status).toBe(200)
  })

  it('leaves everything that is not /api or /auth alone', async () => {
    let now = 1_000_000
    const mw = rateLimit({ now: () => now })
    const app = new Hono()
    app.use('*', mw)
    app.get('/anything', (c) => c.text('ok'))
    for (let i = 0; i < 200; i++) expect((await app.request('/anything')).status).toBe(200)
    expect(mw.buckets()).toBe(0)
  })

  it('prunes buckets that have been idle for over ten minutes', async () => {
    let now = 1_000_000
    const mw = rateLimit({ now: () => now })
    const app = new Hono()
    app.use('*', mw)
    app.get('/api/x', (c) => c.text('ok'))
    await app.request('/api/x', IP('1.1.1.1'))
    expect(mw.buckets()).toBe(1)
    now += 600_001
    await app.request('/api/x', IP('2.2.2.2'))
    expect(mw.buckets()).toBe(1)
  })

  it('reads the client address from the last forwarded hop, then x-real-ip, and rejects the rest', async () => {
    const app = new Hono()
    app.get('/ip', (c) => c.text(String(clientIp(c))))
    const ip = async (headers?: Record<string, string>) => (await app.request('/ip', headers ? { headers } : undefined)).text()
    // The last hop is the one the trusted proxy appended; everything before it is the client's claim.
    expect(await ip({ 'x-forwarded-for': ' 9.9.9.9 , 10.0.0.1 ' })).toBe('10.0.0.1')
    expect(await ip({ 'x-real-ip': '8.8.8.8' })).toBe('8.8.8.8')
    expect(await ip({ 'x-real-ip': '2001:db8::1' })).toBe('2001:db8::1')
    expect(await ip({ 'x-forwarded-for': 'not-an-ip', 'x-real-ip': '8.8.8.8' })).toBe('8.8.8.8')
    expect(await ip({ 'x-forwarded-for': '<script>' })).toBe('null')
    expect(await ip({ 'x-forwarded-for': '1.1.1.1'.repeat(10) })).toBe('null')
    expect(await ip()).toBe('null')
  })

  it('keys on the last forwarded hop, so a client cannot mint buckets for itself', async () => {
    const { app } = makeApp(BOARD, {}, { now: 1_000_000 })
    await drain(app, '/api/leaderboard/1v1', 60, EDGE('1.1.1.1', '203.0.113.9'))
    expect((await app.request('/api/leaderboard/1v1', EDGE('1.1.1.1', '203.0.113.9'))).status).toBe(429)
    // A different claimed address behind the same proxy hop is the same client.
    expect((await app.request('/api/leaderboard/1v1', EDGE('9.9.9.9', '203.0.113.9'))).status).toBe(429)
    // A genuinely different proxy hop is a different client.
    expect((await app.request('/api/leaderboard/1v1', EDGE('9.9.9.9', '203.0.113.10'))).status).toBe(200)
  })

  it('fails open, with one warning, when the proxy forwards no client address', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { app } = makeApp(BOARD, {}, { now: 1_000_000 })
    const last = await drain(app, '/api/leaderboard/1v1', 200)
    expect(last.status).toBe(200)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('X-Forwarded-For')
    warn.mockRestore()
  })

  it('treats an address that is not IP-shaped as absent rather than as a bucket key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let now = 1_000_000
    const mw = rateLimit({ now: () => now })
    const app = new Hono()
    app.use('*', mw)
    app.get('/api/x', (c) => c.text('ok'))
    for (let i = 0; i < 100; i++) {
      expect((await app.request('/api/x', { headers: { 'x-forwarded-for': '<script>' } })).status).toBe(200)
    }
    expect(mw.buckets()).toBe(0)
    warn.mockRestore()
  })

  it('bounds the bucket map however many addresses turn up', async () => {
    let now = 1_000_000
    const mw = rateLimit({ now: () => now, maxBuckets: 3 })
    const app = new Hono()
    app.use('*', mw)
    app.get('/api/x', (c) => c.text('ok'))
    for (let i = 1; i <= 4; i++) await app.request('/api/x', IP(`10.0.0.${i}`))
    expect(mw.buckets()).toBe(3)
    for (let i = 5; i <= 40; i++) await app.request('/api/x', IP(`10.0.0.${i}`))
    expect(mw.buckets()).toBe(3)
  })
})
