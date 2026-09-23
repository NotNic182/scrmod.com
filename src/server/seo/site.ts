import type { Env } from '../env'

/** '' at the root, '/hub' under BASE_PATH=/hub: what page links start with. */
export function basePrefix(env: Env): string {
  return env.basePath === '/' ? '' : env.basePath
}

/** The site's absolute URL (origin plus base path, no trailing slash): PUBLIC_BASE_URL when set, else the request's origin. */
export function siteUrl(env: Env, requestUrl: string): string {
  return (env.publicBaseUrl ?? new URL(requestUrl).origin) + basePrefix(env)
}
