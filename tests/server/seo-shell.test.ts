import { describe, it, expect } from 'vitest'
import { renderShell } from '../../src/server/seo/shell'

const entry = (rank: number, name: string, rating: number) => ({ rank, steam_id: `7656119900000000${rank}`, display_name: name, rating })

describe('renderShell', () => {
  it('always carries the navigation as plain links, under the base path', () => {
    const html = renderShell({ kind: 'about' }, '/hub')
    expect(html).toContain('<a class="item" href="/hub/leaderboards/1v1">Boards</a>')
    expect(html).toContain('<a href="/hub/guide">Guide</a>')
    expect(html).toContain('<footer class="footer">')
    expect(html).toContain('aria-label="SCRmod"')
  })

  it('shows 2v2 and FFA live games on the home shell, and the 2v2 queue count', () => {
    const home = {
      presence: { online_count: 5, online: [], recent: [] },
      queue: { ranked_searching: 1, team_searching: 2, online: 5 },
      live: {
        series_1v1: [],
        series_2v2: [{ series_id: 's1', t1a_name: 'Ann', t1b_name: 'Bob', t2a_name: 'Cal', t2b_name: 'Dee', t1_wins: 1, t2_wins: 0 }],
        ffa_lobbies: [{ lobby_id: 'l1', host_name: 'Eve', player_count: 4, max_players: 8 }],
        spectate: [],
      },
      results: [],
      maintenance: false,
      alerts: [],
    }
    const html = renderShell({ kind: 'home', home: home as never }, '')
    expect(html).toContain('Ann &amp; Bob 1–0 Cal &amp; Dee')
    expect(html).toContain("Eve's lobby · 4/8")
    expect(html).toContain('2v2 queue: 2 searching')
    expect(html).not.toContain('No live games right now.')
  })

  it('escapes upstream numbers too: a string where a number belongs cannot become markup', () => {
    const x = '<b>x</b>'
    const home = {
      presence: { online_count: 1, online: [], recent: [] },
      queue: { ranked_searching: 0, team_searching: 0, online: 1 },
      live: {
        series_1v1: [{ series_id: 's1', p1_name: 'Ann', p2_name: 'Bob', p1_wins: x, p2_wins: x }],
        series_2v2: [],
        ffa_lobbies: [{ lobby_id: 'l1', host_name: 'Eve', player_count: x, max_players: x }],
        spectate: [],
      },
      results: [],
      maintenance: false,
      alerts: [],
    }
    const board = { entries: [{ rank: x, steam_id: '76561199000000001', display_name: 'Sid', rating: 2564 }], total_players: 1 }
    for (const html of [renderShell({ kind: 'home', home: home as never }, ''), renderShell({ kind: 'leaderboard', mode: '1v1', board: board as never }, '')]) {
      expect(html).not.toContain('<b>')
      expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    }
    expect(renderShell({ kind: 'home', home: home as never }, '')).toContain('Ann &lt;b&gt;x&lt;/b&gt;–&lt;b&gt;x&lt;/b&gt; Bob')
  })

  it('lists the top 25 of a board, escaped', () => {
    const board = { entries: [entry(1, 'Sid', 2564), entry(2, '</a><script>x</script>', 2352), ...Array.from({ length: 30 }, (_, i) => entry(i + 3, `P${i}`, 1500))], total_players: 32 }
    const html = renderShell({ kind: 'leaderboard', mode: '1v1', board: board as never }, '')
    expect(html).toContain('<h1>Leaderboards</h1>')
    expect(html).toContain("Ranked ROUNDS players in Sid&#39;s Competitive Rounds, ordered by rating.")
    expect(html).toContain('href="/players/76561199000000001">Sid</a> · 2564')
    expect(html).not.toContain('<script>x')
    expect(html.match(/<li class="row list-row">/g)).toHaveLength(25)
  })

  it('links every card, and renders a card page with its stats and neighbours', () => {
    const cards = [{ card_name: 'Big Bullet', card_rarity: 'Common', times_picked: 1234, win_rate: 0.523, pass_rate: 0.31 }]
    expect(renderShell({ kind: 'cards', cards: cards as never }, '')).toContain('<a href="/cards/big-bullet">Big Bullet</a>')
    const page = { slug: 'big-bullet', card: { ...cards[0], times_offered: 2000, unique_players: 70, sweeps_with_card: 9 }, ranked: null, casual: null, winners: [{ card: 'Big Bullet', player: 'Stan', count: 50 }], sweepers: [], prev: { name: 'Poison', slug: 'poison' }, next: null }
    const html = renderShell({ kind: 'card', slug: 'big-bullet', page: page as never }, '')
    expect(html).toContain('<h1>Big Bullet</h1>')
    expect(html).toContain('52% win rate')
    expect(html).toContain('Stan · 50')
    expect(html).toContain('<a href="/cards/poison">← Poison</a>')
  })

  it('renders the whole guide', () => {
    const html = renderShell({ kind: 'guide' }, '')
    expect(html).toContain('<h1>How to play ranked ROUNDS</h1>')
    expect(html).toContain('<h2>Install with r2modman or Thunderstore Mod Manager</h2>')
    expect(html).toContain('<code>CompetitiveRoundsInstaller.exe</code>')
    expect(html).toContain('<td>F5</td>')
    expect(html).toContain('href="/leaderboards/1v1"')
  })

  it('falls back to headings and links when the data did not arrive', () => {
    for (const d of [{ kind: 'home' }, { kind: 'leaderboard', mode: '2v2' }, { kind: 'results' }, { kind: 'tournaments' }, { kind: 'cards' }, { kind: 'card', slug: 'big-bullet' }, { kind: 'player', id: '76561199311926326' }, { kind: 'tournament', id: 'x' }, { kind: 'not-found' }] as const) {
      const html = renderShell(d, '')
      expect(html).toContain('<h1>')
      expect(html).toContain('<main class="page" id="main">')
    }
    expect(renderShell({ kind: 'not-found' }, '')).toContain('<h1>Nothing here</h1>')
  })
})
