import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/server/app'
import { parseEnv } from '../../src/server/env'

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
