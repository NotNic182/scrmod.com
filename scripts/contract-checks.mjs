// Shape checks for the upstream endpoints the hub depends on (spec 10, "live contract check").
// Each check returns a list of problems; an empty list is a pass.

const ME = process.env.SCR_SAMPLE_STEAM_ID || '76561199311926326'
const OPP = process.env.SCR_SAMPLE_OPPONENT_ID || '76561198040410653'
const TOURNAMENT = process.env.SCR_SAMPLE_TOURNAMENT_ID || 'a2d3c090-54c9-46ae-a4e2-fa1b85f0f10c'
const DISCORD = process.env.SCR_SAMPLE_DISCORD_ID

const has = (o, keys) => keys.filter((k) => !(o && typeof o === 'object' && k in o)).map((k) => `missing ${k}`)
const arr = (o, k) => (Array.isArray(o?.[k]) ? [] : [`${k} is not an array`])
const first = (o, k, keys) => (Array.isArray(o?.[k]) && o[k].length ? has(o[k][0], keys).map((p) => `${k}[0] ${p}`) : [])

export const CHECKS = [
  { path: '/mod-version', fixture: 'mod-version', check: (b) => has(b, ['version', 'min_version']) },
  { path: '/health', fixture: 'health', check: (b) => has(b, ['status']) },
  { path: '/admin/maintenance/status', fixture: 'admin__maintenance__status', check: (b) => has(b, ['in_maintenance']) },
  { path: '/alerts/active', fixture: 'alerts__active', check: (b) => [...has(b, ['rev']), ...arr(b, 'alerts')] },
  { path: '/rank-tiers', fixture: 'rank-tiers', check: (b) => [...arr(b, 'tiers'), ...first(b, 'tiers', ['floor', 'name', 'color'])] },
  { path: '/leaderboard?limit=5', fixture: 'leaderboard', check: (b) => [...has(b, ['total_players']), ...arr(b, 'entries'), ...first(b, 'entries', ['rank', 'steam_id', 'display_name', 'is_online', 'inactive', 'rating', 'rd', 'wins', 'losses', 'win_rate', 'level', 'gold', 'title', 'title_color', 'rank_name', 'rank_color'])] },
  { path: '/team/leaderboard?limit=5', fixture: 'team__leaderboard', check: (b) => [...arr(b, 'entries'), ...first(b, 'entries', ['rank', 'steam_id', 'display_name', 'rating', 'completed_series', 'series_wins', 'series_losses', 'win_rate'])] },
  { path: '/ffa/leaderboard?limit=5', fixture: 'ffa__leaderboard', check: (b) => [...arr(b, 'entries'), ...first(b, 'entries', ['rank', 'steam_id', 'display_name', 'rating', 'games_played', 'wins', 'top3', 'avg_placement'])] },
  { path: '/ovt/leaderboard?limit=5', fixture: 'ovt__leaderboard', check: (b) => [...arr(b, 'entries'), ...first(b, 'entries', ['rank', 'steam_id', 'display_name', 'games_played', 'wins', 'losses', 'solo_games', 'duo_games'])] },
  { path: '/presence/online', fixture: 'presence__online', check: (b) => [...has(b, ['online_count']), ...arr(b, 'online'), ...arr(b, 'recent')] },
  { path: '/queue/count', fixture: 'queue__count', check: (b) => has(b, ['searching', 'online']) },
  { path: '/team/queue/count', fixture: 'team__queue__count', check: (b) => has(b, ['searching']) },
  { path: '/series/active', fixture: 'series__active', check: (b) => [...arr(b, 'series'), ...first(b, 'series', ['series_id', 'p1_steam_id', 'p1_name', 'p1_rating', 'p1_wins', 'p2_steam_id', 'p2_name', 'p2_rating', 'p2_wins', 'live_p1_points', 'live_p2_points', 'phase'])] },
  { path: '/team/series/active', fixture: 'team__series__active', check: (b) => [...arr(b, 'series'), ...first(b, 'series', ['series_id', 't1a_name', 't1b_name', 't2a_name', 't2b_name', 't1_wins', 't2_wins'])] },
  { path: '/ffa/lobbies', fixture: 'ffa__lobbies', check: (b) => [...arr(b, 'lobbies'), ...first(b, 'lobbies', ['lobby_id', 'host_name', 'player_count', 'max_players', 'members'])] },
  { path: '/spectate/games', fixture: 'spectate__games', check: (b) => [...arr(b, 'games'), ...first(b, 'games', ['game_id', 'mode', 'names', 'spectatable'])] },
  { path: '/series/recent-multimode?limit=5', fixture: 'series__recent-multimode', check: (b) => [...arr(b, 'entries'), ...first(b, 'entries', ['mode', 'id', 'ended_at', 'left_label', 'right_label', 'score'])] },
  { path: '/series/recent?minutes=43200&limit=5', fixture: 'series__recent', check: (b) => [...arr(b, 'series'), ...first(b, 'series', ['series_id', 'p1_name', 'p2_name', 'p1_series_wins', 'p2_series_wins', 'winner_name', 'completed_at'])] },
  { path: '/players/search?q=nic', fixture: 'players__search', check: (b) => [...arr(b, 'results'), ...first(b, 'results', ['steam_id', 'display_name', 'rating'])] },
  { path: `/players/${ME}?viewer_steam_id=${OPP}`, fixture: 'players__ID', check: (b) => has(b, ['steam_id', 'display_name', 'rating', 'peak_rating', 'wins', 'losses', 'level', 'recent_form', 'top_cards', 'recent_rating_history', 'rank_name', 'rank_color', 'h2h_ranked_wins', 'h2h_series_wins', 'show_discord', 'hide_gold']) },
  { path: `/players/${ME}/matches?limit=5`, fixture: 'players__ID__matches', check: (b) => (Array.isArray(b) ? (b.length ? has(b[0], ['match_id', 'opponent_name', 'won', 'is_ranked', 'ended_at', 'cards_picked', 'player_rounds_won', 'opponent_rounds_won']) : []) : ['not an array']) },
  { path: `/players/${ME}/matches/summary`, fixture: 'players__ID__matches__summary', check: (b) => has(b, ['total', 'ranked_matches', 'casual_matches', 'ranked_groups']) },
  { path: `/players/${ME}/rating-history`, fixture: 'players__ID__rating-history', check: (b) => [...arr(b, 'history'), ...first(b, 'history', ['rating', 'rd', 'date'])] },
  { path: `/players/${ME}/team-history`, fixture: 'players__ID__team-history', check: (b) => [...arr(b, 'series'), ...first(b, 'series', ['series_id', 'won', 'score', 'mate', 'opponents'])] },
  { path: `/players/${ME}/ffa-history`, fixture: 'players__ID__ffa-history', check: (b) => [...arr(b, 'games'), ...first(b, 'games', ['match_id', 'placement', 'player_count', 'rating_change', 'ended_at'])] },
  { path: `/players/${ME}/ovt-history`, fixture: 'players__ID__ovt-history', check: (b) => [...arr(b, 'games'), ...first(b, 'games', ['match_id', 'role', 'won', 'score', 'solo', 'duo'])] },
  { path: `/players/${ME}/vs/${OPP}/top-cards`, fixture: 'players__ID__vs__ID__top-cards', check: (b) => [...arr(b, 'player_cards'), ...arr(b, 'opponent_cards')] },
  { path: `/team/players/${ME}/team-stats`, fixture: 'team__players__ID__team-stats', check: (b) => has(b, ['rating', 'completed_series', 'series_wins', 'series_losses']) },
  { path: '/achievements/definitions', fixture: 'achievements__definitions', check: (b) => (b && b.achievements !== null && typeof b.achievements === 'object' ? [] : ['achievements missing']) },
  { path: `/achievements/${ME}`, fixture: 'achievements__ID', check: (b) => [...arr(b, 'achievements'), ...first(b, 'achievements', ['achievement_key', 'unlocked', 'name', 'global_pct', 'gold'])] },
  { path: '/cards?limit=5', fixture: 'cards', check: (b) => (Array.isArray(b) ? (b.length ? has(b[0], ['card_name', 'card_rarity', 'times_picked', 'win_rate', 'pass_rate']) : []) : ['not an array']) },
  { path: '/cards/leaders-summary', fixture: 'cards__leaders-summary', check: (b) => [...arr(b, 'sweepers'), ...arr(b, 'winners')] },
  { path: '/cards/top-pickers?card_name=Poison', fixture: 'cards__top-pickers', check: (b) => [...has(b, ['card_name']), ...arr(b, 'display_names'), ...arr(b, 'steam_ids'), ...arr(b, 'picks'), ...arr(b, 'win_rates')] },
  { path: '/tournaments/current?kind=sync', fixture: 'tournaments__current', check: (b) => [...has(b, ['status', 'kind', 'min_players', 'max_players']), ...arr(b, 'signups'), ...arr(b, 'matches')] },
  { path: '/tournaments/history', fixture: 'tournaments__history', check: (b) => (Array.isArray(b) ? (b.length ? has(b[0], ['tournament_id', 'kind', 'format', 'winner_display_name', 'signup_count']) : []) : ['not an array']) },
  { path: '/tournaments/history-detail?limit=8', fixture: 'tournaments__history-detail', check: (b) => [...arr(b, 'tournaments'), ...first(b, 'tournaments', ['tournament_id', 'kind', 'participants'])] },
  { path: `/tournaments/${TOURNAMENT}/bracket-detail`, fixture: 'tournaments__UUID__bracket-detail', check: (b) => [...arr(b, 'matches'), ...first(b, 'matches', ['match_id', 'games'])] },
  { path: `/tournaments/players/${ME}/tournaments`, fixture: 'tournaments__players__ID__tournaments', check: (b) => has(b, ['winner_count', 'runner_up_count', 'third_place_count', 'participant_count']) },
  { path: '/chat/recent?limit=3', fixture: 'chat__recent', check: (b) => [...arr(b, 'messages'), ...first(b, 'messages', ['id', 'steam_id', 'display_name', 'channel', 'message', 'timestamp'])] },
  { path: '/releases/recent?limit=3', fixture: 'releases__recent', check: (b) => [...arr(b, 'posts'), ...first(b, 'posts', ['author', 'content', 'posted_at'])] },
]

// Opt-in: needs a real Discord id, which we don't want to hardcode here or back with a committed fixture.
if (DISCORD) {
  CHECKS.push({ path: `/players/by-discord/${DISCORD}`, fixture: 'players__by-discord__ID', check: (b) => has(b, ['steam_id', 'display_name', 'rating', 'peak_rating', 'level']) })
}
