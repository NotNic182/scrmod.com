// The complete set of upstream paths (relative to /api/v1) the hub may ever request.
// Spec 6.1: anything not listed here cannot be requested, no matter what a route does.

export class NotAllowedError extends Error {
  constructor(path: string) {
    super(`upstream path not allowlisted: ${path}`)
    this.name = 'NotAllowedError'
  }
}

export const ALLOWED_EXACT: ReadonlySet<string> = new Set([
  '/mod-version',
  '/health',
  '/admin/maintenance/status',
  '/alerts/active',
  '/rank-tiers',
  '/leaderboard',
  '/team/leaderboard',
  '/ffa/leaderboard',
  '/ovt/leaderboard',
  '/presence/online',
  '/queue/count',
  '/team/queue/count',
  '/series/active',
  '/team/series/active',
  '/ffa/lobbies',
  '/spectate/games',
  '/series/recent',
  '/series/recent-multimode',
  '/players/search',
  '/achievements/definitions',
  '/cards',
  '/cards/leaders-summary',
  '/cards/top-pickers',
  '/tournaments/current',
  '/tournaments/history',
  '/tournaments/history-detail',
  '/chat/recent',
  '/releases/recent',
])

const STEAM = String.raw`\d{17}`
const UUID = String.raw`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`

export const ALLOWED_PATTERNS: readonly RegExp[] = [
  new RegExp(`^/players/${STEAM}$`),
  new RegExp(`^/players/${STEAM}/(matches|matches/summary|rating-history|team-history|ffa-history|ovt-history)$`),
  new RegExp(`^/players/${STEAM}/vs/${STEAM}/top-cards$`),
  new RegExp(String.raw`^/players/by-discord/\d{1,32}$`),
  new RegExp(`^/team/players/${STEAM}/team-stats$`),
  new RegExp(`^/achievements/${STEAM}$`),
  new RegExp(`^/tournaments/${UUID}/bracket-detail$`),
  new RegExp(`^/tournaments/players/${STEAM}/tournaments$`),
]

export function isAllowed(path: string): boolean {
  if (typeof path !== 'string' || !path.startsWith('/')) return false
  if (path.includes('?') || path.includes('#') || path.includes('..')) return false
  if (ALLOWED_EXACT.has(path)) return true
  return ALLOWED_PATTERNS.some((re) => re.test(path))
}

export function assertAllowed(path: string): void {
  if (!isAllowed(path)) throw new NotAllowedError(path)
}
