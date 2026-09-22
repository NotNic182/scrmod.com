import type { Hono } from 'hono'
import type { ChatRecent } from '../../shared/api-types'
import { maskChatMessage } from '../../shared/privacy'
import { TTL } from '../cache'
import { errorResponse, intParam, loaderFor, ok, type RouteDeps } from './common'

// Mirrors the server's CHAT_CHANNELS_ALLOWED; unknown tokens are dropped, never forwarded.
const CHAT_CHANNELS = new Set(['global', 'ru', 'es', 'uk', 'sv'])

export function registerChatRoutes(app: Hono, d: RouteDeps) {
  app.get('/api/chat/recent', async (c) => {
    if (!d.env.features.has('chat')) return c.json({ error: 'feature_disabled' }, 404)
    const limit = intParam(c, 'limit', 50, 1, 200)
    const channels = (c.req.query('channels') ?? '')
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter((s) => CHAT_CHANNELS.has(s))
      .join(',')
    try {
      const r = await loaderFor(d, c)<ChatRecent>(`chat:${limit}:${channels}`, TTL.LIVE, '/chat/recent', {
        limit,
        channels: channels || undefined,
      })
      const messages = (r.value.messages ?? []).map((m) => maskChatMessage(m as unknown as Record<string, unknown>))
      return ok(c, { ...r, value: { messages } })
    } catch (err) {
      return errorResponse(c, err)
    }
  })
}
