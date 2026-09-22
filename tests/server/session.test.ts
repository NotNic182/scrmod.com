import { describe, it, expect } from 'vitest'
import { signSession, verifySession, randomState } from '../../src/server/session'

const payload = { id: '1299197810780143656', username: 'ntnic', avatar: null, global_name: 'Nic', exp: Math.floor(Date.now() / 1000) + 3600 }

describe('session tokens', () => {
  it('round-trips a signed payload', async () => {
    const token = await signSession(payload, 'secret-1')
    expect(token.split('.').length).toBe(2)
    expect(await verifySession(token, 'secret-1')).toEqual(payload)
  })

  it('rejects a bad signature, a different secret, tampering and expiry', async () => {
    const token = await signSession(payload, 'secret-1')
    expect(await verifySession(token, 'secret-2')).toBeNull()
    expect(await verifySession(token + 'x', 'secret-1')).toBeNull()
    const [body, sig] = token.split('.')
    expect(await verifySession(`${body.slice(0, -2)}AA.${sig}`, 'secret-1')).toBeNull()
    const expired = await signSession({ ...payload, exp: Math.floor(Date.now() / 1000) - 1 }, 'secret-1')
    expect(await verifySession(expired, 'secret-1')).toBeNull()
    expect(await verifySession(undefined, 'secret-1')).toBeNull()
    expect(await verifySession('garbage', 'secret-1')).toBeNull()
  })

  it('makes unpredictable url-safe states', () => {
    const a = randomState()
    const b = randomState()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]{20,}$/)
  })
})
