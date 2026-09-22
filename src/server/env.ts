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
  publicBaseUrl?: string
  discord?: DiscordConfig
  fixtures: boolean
  fixturesDir: string
  appVersion: string
  userAgent: string
}

export const DEFAULT_UPSTREAM = 'https://competitive-rounds.duckdns.org:8444'

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '')
}

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const appVersion = raw.SCR_APP_VERSION || '0.1.0'
  const publicBaseUrl = raw.PUBLIC_BASE_URL ? trimSlash(raw.PUBLIC_BASE_URL) : undefined
  let basePath = raw.BASE_PATH || '/'
  if (!basePath.startsWith('/')) basePath = '/' + basePath
  basePath = basePath.length > 1 ? trimSlash(basePath) : '/'
  const discord =
    raw.DISCORD_CLIENT_ID && raw.DISCORD_CLIENT_SECRET && raw.SESSION_SECRET
      ? {
          clientId: raw.DISCORD_CLIENT_ID,
          clientSecret: raw.DISCORD_CLIENT_SECRET,
          sessionSecret: raw.SESSION_SECRET,
        }
      : undefined
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
    userAgent: publicBaseUrl ? `scr-hub/${appVersion} (+${publicBaseUrl})` : `scr-hub/${appVersion}`,
  }
}

export function modeOf(env: Env): 'community' | 'hosted' | 'fixtures' {
  if (env.fixtures) return 'fixtures'
  return env.internalKey ? 'hosted' : 'community'
}
