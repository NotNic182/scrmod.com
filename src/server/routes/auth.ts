import type { Context, Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { PlayerByDiscord } from '../../shared/api-types'
import type { MeResponse } from '../../shared/hub-types'
import { TTL } from '../cache'
import { randomState, signSession, verifySession } from '../session'
import { UpstreamError } from '../upstream'
import { errorResponse, type RouteDeps } from './common'

export const SESSION_COOKIE = 'scrhub_session'
const STATE_COOKIE = 'scrhub_oauth_state'
const SESSION_DAYS = 30
const DISCORD_ID_RE = /^\d{1,32}$/

function isHttps(c: Context): boolean {
  if (c.req.url.startsWith('https://')) return true
  const proto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim()
  return proto === 'https'
}

export function registerAuthRoutes(app: Hono, d: RouteDeps & { discordFetch?: typeof fetch }) {
  const cfg = d.env.discord
  const prefix = d.env.basePath === '/' ? '' : d.env.basePath
  const home = prefix ? `${prefix}/` : '/'

  if (!cfg) {
    app.get('/auth/*', (c) => c.json({ error: 'auth_disabled' }, 404))
    app.post('/auth/*', (c) => c.json({ error: 'auth_disabled' }, 404))
    app.get('/api/me', (c) => c.json({ data: { discord: null, player: null }, auth_enabled: false } satisfies MeResponse))
    return
  }

  const f = d.discordFetch ?? fetch
  const redirectUri = (c: Context) => {
    const origin = d.env.publicBaseUrl ?? `${isHttps(c) ? 'https' : 'http'}://${c.req.header('host') ?? new URL(c.req.url).host}`
    return `${origin}${prefix}/auth/discord/callback`
  }

  app.get('/auth/discord/login', (c) => {
    const state = randomState()
    setCookie(c, STATE_COOKIE, state, { httpOnly: true, sameSite: 'Lax', secure: isHttps(c), path: '/', maxAge: 600 })
    const u = new URL('https://discord.com/oauth2/authorize')
    u.searchParams.set('client_id', cfg.clientId)
    u.searchParams.set('redirect_uri', redirectUri(c))
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', 'identify')
    u.searchParams.set('state', state)
    return c.redirect(u.toString())
  })

  app.get('/auth/discord/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const expected = getCookie(c, STATE_COOKIE)
    deleteCookie(c, STATE_COOKIE, { path: '/' })
    if (!code || !state || !expected || state !== expected) return c.redirect(`${home}?auth=failed`)
    try {
      const tokenRes = await f('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri(c),
        }).toString(),
        signal: AbortSignal.timeout(8000),
      })
      if (!tokenRes.ok) return c.redirect(`${home}?auth=failed`)
      const { access_token } = (await tokenRes.json()) as { access_token?: string }
      if (!access_token) return c.redirect(`${home}?auth=failed`)
      const meRes = await f('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(8000),
      })
      if (!meRes.ok) return c.redirect(`${home}?auth=failed`)
      const u = (await meRes.json()) as { id: string; username: string; avatar?: string | null; global_name?: string | null }
      if (!DISCORD_ID_RE.test(u.id)) return c.redirect(`${home}?auth=failed`)
      const token = await signSession(
        {
          id: u.id,
          username: u.username,
          avatar: u.avatar ?? null,
          global_name: u.global_name ?? null,
          exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
          typ: 'session',
        },
        cfg.sessionSecret,
      )
      setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: 'Lax', secure: isHttps(c), path: '/', maxAge: SESSION_DAYS * 86400 })
      return c.redirect(`${home}?auth=ok`)
    } catch (err) {
      console.error('[auth] discord exchange failed', err)
      return c.redirect(`${home}?auth=failed`)
    }
  })

  app.post('/auth/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  app.get('/api/me', async (c) => {
    c.header('Cache-Control', 'no-store')
    const s = await verifySession(getCookie(c, SESSION_COOKIE), cfg.sessionSecret)
    if (!s || !DISCORD_ID_RE.test(s.id)) {
      return c.json({ data: { discord: null, player: null }, auth_enabled: true } satisfies MeResponse)
    }
    let player: MeResponse['data']['player'] = null
    try {
      const r = await d.cache.get<PlayerByDiscord>(
        `by-discord:${s.id}`,
        TTL.PLAYER,
        () => d.upstream.getJson<PlayerByDiscord>(`/players/by-discord/${s.id}`),
      )
      const p = r.value
      player = { steam_id: p.steam_id, display_name: p.display_name, rating: p.rating, peak_rating: p.peak_rating, level: p.level }
    } catch (err) {
      if (!(err instanceof UpstreamError && err.status === 404)) return errorResponse(c, err)
    }
    const body: MeResponse = {
      data: { discord: { id: s.id, username: s.username, avatar: s.avatar, global_name: s.global_name }, player },
      auth_enabled: true,
    }
    return c.json(body)
  })
}
