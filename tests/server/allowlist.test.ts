import { describe, it, expect } from 'vitest'
import { isAllowed, assertAllowed, NotAllowedError } from '../../src/server/allowlist'

const ME = '76561199311926326'
const SID = '76561198040410653'

describe('allowlist', () => {
  it.each([
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
    `/players/${ME}`,
    `/players/${ME}/matches`,
    `/players/${ME}/matches/summary`,
    `/players/${ME}/rating-history`,
    `/players/${ME}/team-history`,
    `/players/${ME}/ffa-history`,
    `/players/${ME}/ovt-history`,
    `/players/${ME}/vs/${SID}/top-cards`,
    '/players/by-discord/1299197810780143656',
    `/team/players/${ME}/team-stats`,
    `/achievements/${ME}`,
    '/tournaments/a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c/bracket-detail',
    `/tournaments/players/${ME}/tournaments`,
  ])('allows %s', (p) => {
    expect(isAllowed(p)).toBe(true)
  })

  it.each([
    '/admin/actions',
    '/admin/banned-users',
    '/internal/linked-players',
    `/players/${ME}/inventory`,
    `/players/${ME}/bets`,
    `/players/${ME}/blocks`,
    `/players/${ME}/gold-sources`,
    `/players/${ME}/card-tiers`,
    '/mail/inbox',
    `/queue/poll/${ME}`,
    '/h2h/1/2',
    '/players/notanid',
    '/players/1234',
    '/players/76561199311926326/../../admin/actions',
    'players/search', // must start with /
    '/leaderboard?limit=5', // query strings are not part of the path
  ])('rejects %s', (p) => {
    expect(isAllowed(p)).toBe(false)
  })

  it('assertAllowed throws NotAllowedError', () => {
    expect(() => assertAllowed('/admin/actions')).toThrow(NotAllowedError)
    expect(() => assertAllowed('/leaderboard')).not.toThrow()
  })
})
