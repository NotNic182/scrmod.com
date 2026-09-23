import type { Context } from 'hono'
import type { Env } from '../env'

/** '' at the root, '/hub' under BASE_PATH=/hub: what page links start with. */
export function basePrefix(env: Env): string {
  return env.basePath === '/' ? '' : env.basePath
}

/**
 * The origin the visitor used. A TLS proxy (Railway's) hands the request on as plain http and says so in
 * x-forwarded-proto, so https in either counts.
 */
export function requestOrigin(c: Context): string {
  const url = new URL(c.req.url)
  const proto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim()
  const https = url.protocol === 'https:' || proto === 'https'
  return `${https ? 'https' : 'http'}://${c.req.header('host') ?? url.host}`
}

/** PUBLIC_BASE_URL when it is an absolute http(s) URL; anything else ("scrmod.com") would make every link relative. */
function publicOrigin(env: Env): string | null {
  if (!env.publicBaseUrl) return null
  try {
    return /^https?:$/.test(new URL(env.publicBaseUrl).protocol) ? env.publicBaseUrl : null
  } catch {
    return null
  }
}

/** The site's absolute URL (origin plus base path, no trailing slash): PUBLIC_BASE_URL when usable, else the request's origin. */
export function siteUrl(env: Env, c: Context): string {
  return (publicOrigin(env) ?? requestOrigin(c)) + basePrefix(env)
}
