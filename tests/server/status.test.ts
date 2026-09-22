import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/server/app'
import { MemoryCacheStore } from '../../src/server/cache'
import { parseEnv } from '../../src/server/env'
import { fakeUpstream } from './helpers/fakeUpstream'
import { makeApp } from './helpers/makeApp'

describe('GET /api/_status', () => {
  it('reports community mode when no internal key is configured', async () => {
    const { app } = createApp({ env: parseEnv({}) })
    const res = await app.request('/api/_status')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mode).toBe('community')
    expect(body.app_version).toBe('0.1.0')
  })

  it('reports hosted mode when SCR_INTERNAL_KEY is set and never echoes the key', async () => {
    const { app } = createApp({ env: parseEnv({ SCR_INTERNAL_KEY: 'sekrit' }) })
    const body = await (await app.request('/api/_status')).json()
    expect(body.mode).toBe('hosted')
    expect(JSON.stringify(body)).not.toContain('sekrit')
  })

  it('honours BASE_PATH', async () => {
    const { app } = createApp({ env: parseEnv({ BASE_PATH: '/hub/' }) })
    expect((await app.request('/hub/api/_status')).status).toBe(200)
    expect((await app.request('/api/_status')).status).toBe(404)
  })
})

describe('GET /api/_status (full)', () => {
  it('reports the version source, cache size and auth flag', async () => {
    const { app } = makeApp({})
    const body = await (await app.request('/api/_status')).json()
    expect(body.upstream.base).toBe('https://up.test')
    expect(body.upstream.version).toMatchObject({ version: '1.40.3', source: 'override' })
    expect(body.cache.size).toBe(0)
    expect(body.auth_enabled).toBe(false)
  })

  it('probes /health only when asked', async () => {
    const { app, fake } = makeApp({ '/health': { status: 'ok' } })
    await app.request('/api/_status')
    expect(fake.calls.length).toBe(0)
    const body = await (await app.request('/api/_status?probe=1')).json()
    expect(body.upstream.reachable).toBe(true)
  })

  it('reports the discovered version after a probe on a cold process', async () => {
    const fake = fakeUpstream({
      '/mod-version': { version: '1.40.3', min_version: '1.40.3' },
      '/health': { status: 'ok' },
    })
    const { app } = createApp({
      env: parseEnv({ SCR_UPSTREAM_BASE: 'https://up.test' }),
      fetchImpl: fake.fetchImpl,
      store: new MemoryCacheStore(),
    })
    const body = await (await app.request('/api/_status?probe=1')).json()
    expect(body.upstream.reachable).toBe(true)
    expect(body.upstream.version).toEqual({
      version: '1.40.3',
      fetched_at: expect.any(String),
      source: 'discovered',
    })
  })

  it('reports source "none" without a probe and makes no upstream calls', async () => {
    const fake = fakeUpstream({
      '/mod-version': { version: '1.40.3', min_version: '1.40.3' },
      '/health': { status: 'ok' },
    })
    const { app } = createApp({
      env: parseEnv({ SCR_UPSTREAM_BASE: 'https://up.test' }),
      fetchImpl: fake.fetchImpl,
      store: new MemoryCacheStore(),
    })
    const body = await (await app.request('/api/_status')).json()
    expect(body.upstream.version).toEqual({ version: null, fetched_at: null, source: 'none' })
    expect(fake.calls.length).toBe(0)
  })
})
