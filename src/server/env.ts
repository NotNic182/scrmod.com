export interface DiscordConfig {
  clientId: string
  clientSecret: string
  sessionSecret: string
}

export interface Env {
  upstreamBase: string
  internalKey?: string
  modVersionOverride?: string
  features: Set<string>
  basePath: string
  /** Always an origin: the base path is stripped, because redirect URIs append it themselves. */
  publicBaseUrl?: string
  discord?: DiscordConfig
  fixtures: boolean
  fixturesDir: string
  appVersion: string
  userAgent: string
  webRoot: string
  port: number
  rateLimit: boolean
}

export const DEFAULT_UPSTREAM = 'https://competitive-rounds.duckdns.org:8444'

/** A signing secret shorter than this is not worth the false sense of a signed session. */
export const MIN_SESSION_SECRET = 32

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '')
}

/**
 * Spec 9.2's compose snippet sets `PUBLIC_BASE_URL` with `BASE_PATH` already on the end,
 * while spec 6.5 calls it the site URL. Reduce it to an origin either way, so nothing
 * that appends the prefix can produce `/hub/hub/...`.
 */
function stripBasePath(value: string, basePath: string): string {
  if (basePath === '/') return value
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return value
  }
  const path = trimSlash(url.pathname)
  if (!path.endsWith(basePath)) return value
  return trimSlash(url.origin + path.slice(0, path.length - basePath.length))
}

function parsePort(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10)
  return Number.isInteger(n) && n >= 0 && n <= 65535 ? n : 8080
}

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const appVersion = raw.SCR_APP_VERSION || '0.1.0'
  let basePath = raw.BASE_PATH || '/'
  if (!basePath.startsWith('/')) basePath = '/' + basePath
  basePath = basePath.length > 1 ? trimSlash(basePath) : '/'
  const publicBaseUrl = raw.PUBLIC_BASE_URL ? stripBasePath(trimSlash(raw.PUBLIC_BASE_URL), basePath) : undefined

  const clientId = raw.DISCORD_CLIENT_ID
  const clientSecret = raw.DISCORD_CLIENT_SECRET
  const sessionSecret = raw.SESSION_SECRET
  let discord: DiscordConfig | undefined
  if (clientId && clientSecret && sessionSecret) {
    if (sessionSecret.length >= MIN_SESSION_SECRET) discord = { clientId, clientSecret, sessionSecret }
    else
      console.warn(
        `[hub] Discord sign-in is DISABLED: SESSION_SECRET is ${sessionSecret.length} characters, ` +
          `at least ${MIN_SESSION_SECRET} are required. Set a longer secret and restart.`,
      )
  }

  return {
    upstreamBase: trimSlash(raw.SCR_UPSTREAM_BASE || DEFAULT_UPSTREAM),
    internalKey: raw.SCR_INTERNAL_KEY || undefined,
    modVersionOverride: raw.SCR_MOD_VERSION_OVERRIDE || undefined,
    features: new Set(
      (raw.SCR_FEATURES || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    basePath,
    publicBaseUrl,
    discord,
    fixtures: raw.SCR_FIXTURES === '1' || raw.SCR_FIXTURES === 'true',
    fixturesDir: raw.SCR_FIXTURES_DIR || 'fixtures',
    appVersion,
    userAgent: publicBaseUrl ? `scrmod/${appVersion} (+${publicBaseUrl})` : `scrmod/${appVersion}`,
    webRoot: raw.SCR_WEB_ROOT || 'dist/web',
    port: parsePort(raw.PORT),
    rateLimit: raw.SCR_RATE_LIMIT !== 'off',
  }
}

export function modeOf(env: Env): 'community' | 'hosted' | 'fixtures' {
  if (env.fixtures) return 'fixtures'
  return env.internalKey ? 'hosted' : 'community'
}
