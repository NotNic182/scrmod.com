import { describe, it, expect } from 'vitest'
import { hubGet, HubError } from '../../src/web/api/client'
import { mockHub, env, jsonResponse } from './helpers/mockHub'

describe('hubGet', () => {
  it('prefixes /api and parses the envelope', async () => {
    const { calls } = mockHub({ '/home': env({ ok: true }) })
    const body = await hubGet<{ data: { ok: boolean } }>('/home')
    expect(body.data.ok).toBe(true)
    expect(calls[0]).toBe('/home')
  })

  it('throws HubError with the status and body on non-2xx', async () => {
    mockHub({ '/players/1': () => jsonResponse({ error: 'not_found' }, 404) })
    // hubGet('/players/1') has no type argument here, so T infers as `unknown`; unioned with
    // the catch handler's result that stays `unknown` too, absorbing any cast attempted inside
    // the handler. Cast the settled value instead — compile-time only, no runtime effect.
    const err = (await hubGet('/players/1').catch((e) => e)) as HubError
    expect(err).toBeInstanceOf(HubError)
    expect(err.status).toBe(404)
    expect(err.body).toEqual({ error: 'not_found' })
  })
})
