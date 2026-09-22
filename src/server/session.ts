// Signed, stateless session cookie for Discord identity (spec 8). Web Crypto only
// (Node 26 provides it natively), so no node-only dependency is needed.

export interface SessionPayload {
  id: string
  username: string
  avatar: string | null
  global_name: string | null
  exp: number // epoch seconds
}

const enc = new TextEncoder()
const dec = new TextDecoder()

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = b64url(await hmac(secret, body))
  return `${body}.${sig}`
}

export async function verifySession(token: string | undefined, secret: string, nowMs = Date.now()): Promise<SessionPayload | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [body, sig] = parts
  const expected = b64url(await hmac(secret, body))
  if (!constantTimeEqual(expected, sig)) return null
  try {
    const p = JSON.parse(dec.decode(fromB64url(body))) as SessionPayload
    if (typeof p.id !== 'string' || typeof p.exp !== 'number') return null
    if (p.exp * 1000 < nowMs) return null
    return p
  } catch {
    return null
  }
}

export function randomState(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(24)))
}
