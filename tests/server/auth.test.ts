import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/server/app'
import { parseEnv } from '../../src/server/env'
import { MemoryCacheStore } from '../../src/server/cache'
import { fakeUpstream, json } from './helpers/fakeUpstream'

const DISCORD_ID = '1299197810780143656'
const AUTH_ENV = { DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'csecret', SESSION_SECRET: 'ssecret', SCR_MOD_VERSION_OVERRIDE: '1.40.3', SCR_UPSTREAM_BASE: 'https://up.test', PUBLIC_BASE_URL: 'https://hub.test' }

function discordFake() {
  const calls: Array<{ url: string; body?: string; auth?: string }> = []
  const discordFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    calls.push({ url, body: init?.body ? String(init.body) : undefined, auth: new Headers(init?.headers).get('authorization') ?? undefined })
    if (url === 'https://discord.com/api/oauth2/token') return json({ access_token: 'tok', token_type: 'Bearer' })
    if (url === 'https://discord.com/api/users/@me') return json({ id: DISCORD_ID, username: 'ntnic', avatar: null, global_name: 'Nic' })
    return json({ message: 'nope' }, 404)
  }) as typeof fetch
  return { discordFetch, calls }
}

function cookieOf(res: Response, name: string): string | undefined {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith(name + '='))
  return raw?.split(';')[0].slice(name.length + 1)
}

function make(envExtra: Record<string, string> = {}) {
  const fake = fakeUpstream({ [`/players/by-discord/${DISCORD_ID}`]: { steam_id: '76561199311926326', display_name: 'NotNic', discord_id: DISCORD_ID, rating: 1101.8, peak_rating: 1337.7, level: 40 } })
  const discord = discordFake()
  const { app } = createApp({ env: parseEnv({ ...AUTH_ENV, ...envExtra }), fetchImpl: fake.fetchImpl, store: new MemoryCacheStore(), discordFetch: discord.discordFetch })
  return { app, fake, discord }
}

describe('Discord sign-in', () => {
  it('redirects to Discord with client id, redirect uri, identify scope and a state cookie', async () => {
    const { app } = make()
    const res = await app.request('/auth/discord/login')
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('location')!)
    expect(loc.origin + loc.pathname).toBe('https://discord.com/oauth2/authorize')
    expect(loc.searchParams.get('client_id')).toBe('cid')
    expect(loc.searchParams.get('scope')).toBe('identify')
    expect(loc.searchParams.get('redirect_uri')).toBe('https://hub.test/auth/discord/callback')
    const state = cookieOf(res, 'scrhub_oauth_state')
    expect(state).toBeTruthy()
    expect(loc.searchParams.get('state')).toBe(state)
  })

  it('completes the code exchange, sets the session cookie and resolves the linked player', async () => {
    const { app, discord } = make()
    const login = await app.request('/auth/discord/login')
    const state = cookieOf(login, 'scrhub_oauth_state')!
    const cb = await app.request(`/auth/discord/callback?code=abc&state=${state}`, { headers: { cookie: `scrhub_oauth_state=${state}` } })
    expect(cb.status).toBe(302)
    expect(cb.headers.get('location')).toBe('/?auth=ok')
    const session = cookieOf(cb, 'scrhub_session')
    expect(session).toBeTruthy()
    expect(discord.calls[0].body).toContain('client_secret=csecret')
    expect(discord.calls[0].body).toContain('code=abc')
    expect(discord.calls[1].auth).toBe('Bearer tok')

    const me = await (await app.request('/api/me', { headers: { cookie: `scrhub_session=${session}` } })).json()
    expect(me.auth_enabled).toBe(true)
    expect(me.data.discord).toEqual({ id: DISCORD_ID, username: 'ntnic', avatar: null, global_name: 'Nic' })
    expect(me.data.player).toEqual({ steam_id: '76561199311926326', display_name: 'NotNic', rating: 1101.8, peak_rating: 1337.7, level: 40 })
    expect(JSON.stringify(me)).not.toContain('discord_id')
  })

  it('rejects a state mismatch without setting a session', async () => {
    const { app, discord } = make()
    const cb = await app.request('/auth/discord/callback?code=abc&state=wrong', { headers: { cookie: 'scrhub_oauth_state=right' } })
    expect(cb.headers.get('location')).toBe('/?auth=failed')
    expect(cookieOf(cb, 'scrhub_session')).toBeUndefined()
    expect(discord.calls.length).toBe(0)
  })

  it('reports an unlinked player as null and an invalid cookie as signed out', async () => {
    const { app, fake } = make()
    fake.map[`/players/by-discord/${DISCORD_ID}`] = () => json({ detail: 'No player linked' }, 404)
    const login = await app.request('/auth/discord/login')
    const state = cookieOf(login, 'scrhub_oauth_state')!
    const cb = await app.request(`/auth/discord/callback?code=abc&state=${state}`, { headers: { cookie: `scrhub_oauth_state=${state}` } })
    const session = cookieOf(cb, 'scrhub_session')
    const me = await (await app.request('/api/me', { headers: { cookie: `scrhub_session=${session}` } })).json()
    expect(me.data.discord?.username).toBe('ntnic')
    expect(me.data.player).toBeNull()
    const bad = await (await app.request('/api/me', { headers: { cookie: 'scrhub_session=garbage' } })).json()
    expect(bad.data).toEqual({ discord: null, player: null })
  })

  it('logout clears the cookie', async () => {
    const { app } = make()
    const res = await app.request('/auth/logout', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(res.headers.getSetCookie().find((c) => c.startsWith('scrhub_session='))).toContain('Max-Age=0')
  })

  it('is disabled without the three variables', async () => {
    const fake = fakeUpstream({})
    const { app } = createApp({ env: parseEnv({ SCR_MOD_VERSION_OVERRIDE: '1.40.3' }), fetchImpl: fake.fetchImpl })
    expect((await app.request('/auth/discord/login')).status).toBe(404)
    const me = await (await app.request('/api/me')).json()
    expect(me).toEqual({ data: { discord: null, player: null }, auth_enabled: false })
  })

  it('honours BASE_PATH in the redirect uri and post-login redirect', async () => {
    const { app } = make({ BASE_PATH: '/hub' })
    const res = await app.request('/hub/auth/discord/login')
    expect(new URL(res.headers.get('location')!).searchParams.get('redirect_uri')).toBe('https://hub.test/hub/auth/discord/callback')
  })
})
