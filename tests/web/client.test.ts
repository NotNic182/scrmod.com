import { afterEach, describe, it, expect } from 'vitest'
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

  describe('a response index.html started before the app loaded', () => {
    type EarlyWindow = { __scrEarly?: Record<string, Promise<Response>> }
    afterEach(() => delete (window as EarlyWindow).__scrEarly)

    it('answers the first request for its path, once; later requests go to the network', async () => {
      const { calls } = mockHub({ '/home': env({ from: 'network' }) })
      ;(window as EarlyWindow).__scrEarly = { '/home': Promise.resolve(jsonResponse(env({ from: 'early' }))) }
      expect((await hubGet<{ data: { from: string } }>('/home')).data.from).toBe('early')
      expect(calls).toEqual([])
      expect((await hubGet<{ data: { from: string } }>('/home')).data.from).toBe('network')
      expect(calls).toEqual(['/home'])
    })

    it('is ignored for other paths', async () => {
      const { calls } = mockHub({ '/leaderboard/2v2': env({ from: 'network' }) })
      ;(window as EarlyWindow).__scrEarly = { '/leaderboard/1v1': Promise.resolve(jsonResponse(env({ from: 'early' }))) }
      expect((await hubGet<{ data: { from: string } }>('/leaderboard/2v2')).data.from).toBe('network')
      expect(calls).toEqual(['/leaderboard/2v2'])
    })

    it('that failed to connect is retried on the network instead of failing the page', async () => {
      const { calls } = mockHub({ '/home': env({ from: 'network' }) })
      ;(window as EarlyWindow).__scrEarly = { '/home': Promise.reject(new TypeError('Failed to fetch')) }
      expect((await hubGet<{ data: { from: string } }>('/home')).data.from).toBe('network')
      expect(calls).toEqual(['/home'])
    })
  })
})
