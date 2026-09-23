import type { MiddlewareHandler } from 'hono'
import type { Env } from '../env'

/**
 * One address per page for search engines: a page request that reached the site through another host (the
 * Railway address, www.) is sent to the same path on PUBLIC_BASE_URL. The API, auth and files are never moved,
 * so health checks and API clients keep working on any host.
 */
export function canonicalHost(env: Env): MiddlewareHandler {
  let target: URL | null = null
  if (env.publicBaseUrl) {
    try {
      target = new URL(env.publicBaseUrl)
    } catch {
      console.warn('[hub] PUBLIC_BASE_URL is not a URL; canonical host redirect disabled:', env.publicBaseUrl)
    }
  }
  return async (c, next) => {
    if (!target || (c.req.method !== 'GET' && c.req.method !== 'HEAD')) return next()
    const url = new URL(c.req.url)
    if (url.host === target.host) return next()
    const rel = env.basePath === '/' ? url.pathname : url.pathname.slice(env.basePath.length) || '/'
    if (rel.startsWith('/api/') || rel.startsWith('/auth/') || /\.[a-z0-9]+$/i.test(rel)) return next()
    return c.redirect(`${target.origin}${url.pathname}${url.search}`, 301)
  }
}
