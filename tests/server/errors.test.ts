import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { errorResponse } from '../../src/server/routes/common'
import { UpstreamError, UpstreamNetworkError } from '../../src/server/upstream'

const app = new Hono()
app.get('/network', (c) => errorResponse(c, new UpstreamNetworkError('https://up.test/x', new TypeError('fetch failed'))))
app.get('/bug', (c) => errorResponse(c, new TypeError('bug')))
app.get('/rate-limited', (c) => errorResponse(c, new UpstreamError(429, '/x')))

describe('errorResponse', () => {
  it('maps UpstreamNetworkError to a 503 upstream_unreachable response', async () => {
    const res = await app.request('/network')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'upstream_unreachable' })
  })

  it('maps a plain bug (a TypeError that is not a wrapped network failure) to a 500 internal response', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await app.request('/bug')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal' })
    spy.mockRestore()
  })

  it('maps a 429 UpstreamError to 503 upstream_rate_limited with a Retry-After header', async () => {
    const res = await app.request('/rate-limited')
    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('10')
    expect(await res.json()).toEqual({ error: 'upstream_rate_limited', retry_after: 10 })
  })
})
