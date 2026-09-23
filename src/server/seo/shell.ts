import type { CardStat, MultimodeEntry, TournamentCurrent, TournamentHistoryRow } from '../../shared/api-types'
import { FOOTER_NOTE, NAV_LINKS, WORDMARK } from '../../shared/brand'
import { GUIDE, GUIDE_INTRO, GUIDE_TITLE, type GuideBlock, type GuideInline } from '../../shared/guide'
import type { CardPageData, HomeData } from '../../shared/hub-types'
import { LINKS } from '../../shared/links'
import { BOARD_MODES, INTROS, cardSlug, slugToName, type PlayerFacts } from '../../shared/seo'
import type { BoardData } from '../routes/boards'
import { esc } from './html'

export type ShellData =
  | { kind: 'home'; home?: HomeData }
  | { kind: 'leaderboard'; mode: string; board?: BoardData }
  | { kind: 'results'; results?: MultimodeEntry[] }
  | { kind: 'tournaments'; current?: { sync: TournamentCurrent | null; async: TournamentCurrent | null }; history?: TournamentHistoryRow[] }
  | { kind: 'tournament'; id: string }
  | { kind: 'cards'; cards?: CardStat[] }
  | { kind: 'card'; slug: string; page?: CardPageData }
  | { kind: 'guide' }
  | { kind: 'about' }
  | { kind: 'player'; id: string; player?: PlayerFacts }
  | { kind: 'not-found' }

const pct = (f: number | null | undefined) => (f === null || f === undefined || !Number.isFinite(f) ? '–' : `${Math.round(f * 100)}%`)
const num = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '–' : n.toLocaleString('en-US'))
/** The upstream calls 1v2 "ovt"; the app shows 1v2. */
const MODE_LABEL: Record<string, string> = { '1v1': '1v1', '2v2': '2v2', ffa: 'FFA', ovt: '1v2', '1v2': '1v2' }
const resultLine = (e: MultimodeEntry) => `${esc(MODE_LABEL[e.mode] ?? e.mode)} · ${esc(e.left_label)} ${esc(e.score)} ${esc(e.right_label)}`

/** A crawlable, lightweight version of each page in the site's own markup; React replaces it on load. */
export function renderShell(data: ShellData, base: string): string {
  const a = (path: string, text: string, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(base + path)}">${esc(text)}</a>`
  const ext = (href: string, text: string) => `<a href="${esc(href)}" rel="noopener">${esc(text)}</a>`
  const inline = (parts: GuideInline[]) =>
    parts
      .map((p) =>
        typeof p === 'string' ? esc(p) : 'href' in p ? (p.href.startsWith('/') ? a(p.href, p.text) : ext(p.href, p.text)) : 'code' in p ? `<code>${esc(p.code)}</code>` : `<strong>${esc(p.strong)}</strong>`,
      )
      .join('')
  const block = (b: GuideBlock) => {
    if (b.type === 'p') return `<p>${inline(b.content)}</p>`
    if (b.type === 'table')
      return `<table class="t"><thead><tr><th>${esc(b.head[0])}</th><th>${esc(b.head[1])}</th></tr></thead><tbody>${b.rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`
    const tag = b.type
    return `<${tag} class="prose">${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`
  }
  const list = (items: string[]) => (items.length ? `<ul class="plain-list">${items.map((i) => `<li class="row list-row">${i}</li>`).join('')}</ul>` : '')
  const card = (heading: string, inner: string) => `<section class="card"><h2>${esc(heading)}</h2>${inner}</section>`
  const intro = (text: string) => `<p class="page-intro">${esc(text)}</p>`

  let main: string
  switch (data.kind) {
    case 'home': {
      const h = data.home
      const live = h ? [...h.live.series_1v1.map((s) => `${esc(s.p1_name)} ${s.p1_wins}–${s.p2_wins} ${esc(s.p2_name)}`)] : []
      const results = (h?.results ?? []).slice(0, 8).map(resultLine)
      main =
        `<h1>Right now</h1><p class="page-intro">${a('/guide', 'New to ranked ROUNDS? Start here →')}</p>` +
        (h ? `<ul class="plain-list"><li>Online now: ${num(h.presence.online_count)}</li><li>Ranked queue: ${num(h.queue.ranked_searching)} searching</li><li>Live games: ${num(h.live.series_1v1.length + h.live.series_2v2.length + h.live.ffa_lobbies.length)}</li></ul>` : '') +
        card('Live games', list(live) || '<p>No live games right now.</p>') +
        card('Latest results', list(results) + `<p>${a('/results', 'All results →')}</p>`)
      break
    }
    case 'leaderboard': {
      const mode = BOARD_MODES.find((m) => m.id === data.mode)
      const rows = (data.board?.entries ?? []).slice(0, 25).map((e) => {
        const rating = 'rating' in e && typeof e.rating === 'number' ? ` · ${Math.round(e.rating)}` : ''
        return `#${e.rank} ${a(`/players/${e.steam_id}`, e.display_name || 'Unnamed player')}${rating}`
      })
      main =
        `<h1>Leaderboards</h1>${intro(mode?.ranked === false ? INTROS.leaderboards1v2 : INTROS.leaderboards)}` +
        `<nav class="tabs" aria-label="Leaderboard mode">${BOARD_MODES.map((m) => a(`/leaderboards/${m.id}`, m.label)).join('')}</nav>` +
        `<section class="card">${list(rows)}</section>`
      break
    }
    case 'results':
      main = `<h1>Results</h1>${intro(INTROS.results)}<section class="card">${list((data.results ?? []).slice(0, 20).map(resultLine))}</section>`
      break
    case 'tournaments': {
      const status = (label: string, t: TournamentCurrent | null | undefined) => (t?.tournament_id ? `${esc(label)}: ${esc(t.status ?? '')} · ${num(t.signups?.length ?? 0)} signups` : `${esc(label)}: nothing scheduled`)
      const past = (data.history ?? []).slice(0, 10).map((r) => `${esc(r.kind)} · winner ${esc(r.winner_display_name ?? '–')} · ${esc((r.ended_at ?? '').slice(0, 10))}`)
      main =
        `<h1>Tournaments</h1>${intro(INTROS.tournaments)}` +
        (data.current ? `<ul class="plain-list"><li>${status('Weekly sync tournament', data.current.sync)}</li><li>${status('Async tournament', data.current.async)}</li></ul>` : '') +
        card('Past tournaments', list(past))
      break
    }
    case 'tournament':
      main = `<h1>Tournaments</h1><section class="card"><h2>Game details</h2><p>${a('/tournaments', '← tournaments')}</p></section>`
      break
    case 'cards':
      main = `<h1>Cards</h1>${intro(INTROS.cards)}<section class="card">${list((data.cards ?? []).map((c) => `${a(`/cards/${cardSlug(c.card_name)}`, c.card_name)} · ${pct(c.win_rate)} win rate · ${num(c.times_picked)} picks`))}</section>`
      break
    case 'card': {
      const p = data.page
      if (!p) {
        main = `<h1>${esc(slugToName(data.slug))}</h1><p>${a('/cards', '← All cards')}</p>`
        break
      }
      const c = p.card
      const stats = [`${pct(c.win_rate)} win rate`, `${num(c.times_picked)} picks`, `${num(c.times_offered)} times offered`, `${pct(c.pass_rate)} pass rate`, `${num(c.unique_players)} players`, `${num(c.sweeps_with_card)} 5-0 sweeps`]
      if (p.ranked) stats.push(`${pct(p.ranked.win_rate)} win rate in ranked games`)
      main =
        `<h1>${esc(c.card_name)}</h1><p class="page-intro">${esc(c.card_rarity)} card</p>` +
        `<section class="card">${list(stats.map(esc))}</section>` +
        (p.winners.length ? card('Most wins with it', list(p.winners.slice(0, 10).map((w) => `${esc(w.player)} · ${num(w.count)}`))) : '') +
        `<p>${p.prev ? a(`/cards/${p.prev.slug}`, `← ${p.prev.name}`) : ''} ${a('/cards', 'All cards')} ${p.next ? a(`/cards/${p.next.slug}`, `${p.next.name} →`) : ''}</p>`
      break
    }
    case 'guide':
      main = `<h1>${esc(GUIDE_TITLE)}</h1><p class="page-intro">${inline(GUIDE_INTRO)}</p>${GUIDE.map((s) => `<section class="card" id="${esc(s.id)}"><h2>${esc(s.heading)}</h2>${s.blocks.map(block).join('')}</section>`).join('')}`
      break
    case 'about':
      // Word for word from About.tsx (its first sentence and the guide link Task 14 adds), since the shell may only show what the app shows.
      main = `<h1>About SCRmod</h1><section class="card"><h2>What this is</h2><p>A browser companion for <strong>Sid&#39;s Competitive Rounds</strong>, the ranked mod for ROUNDS.</p><p>New to it? ${a('/guide', 'How to install the mod and play ranked')}.</p></section>`
      break
    case 'player': {
      const p = data.player
      // Only the real display name gets the site's casing-preserving class (base.css); the generic placeholder is a plain heading.
      const heading = p ? `<h1 class="player-name">${esc(p.display_name || 'Player')}</h1>` : '<h1>Player</h1>'
      main = heading + (p ? `<p>${[p.rank_name, p.rating != null ? `${Math.round(p.rating)} rating` : null].filter(Boolean).map(esc).join(' · ')}</p>` : '') + `<p>${a('/leaderboards/1v1', 'Leaderboards')}</p>`
      break
    }
    case 'not-found':
      main = `<section class="card"><h1>Nothing here</h1><p>That page doesn't exist.</p><p>${a('/', 'Back home')}</p></section>`
      break
  }

  const f = WORDMARK.face
  const wordmark = `<svg class="wordmark" viewBox="${WORDMARK.viewBox}" role="img" aria-label="SCRmod"><path d="${WORDMARK.left}" fill="currentColor"/><image href="${esc(base)}/logo.webp" x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}"/><path d="${WORDMARK.right}" fill="currentColor"/></svg>`
  return (
    `<header class="topbar"><a class="brand" href="${esc(base)}/" aria-label="SCRmod home">${wordmark}</a>` +
    `<nav class="topnav" aria-label="Primary">${NAV_LINKS.map((n) => a(n.to, n.label, 'item')).join('')}</nav></header>` +
    `<main class="page" id="main">${main}</main>` +
    `<footer class="footer">${esc(FOOTER_NOTE)} ${a('/about', 'About & privacy')} · ${a('/guide', 'Guide')} · Watch on ${ext(LINKS.twitch, 'Twitch')} · ${ext(LINKS.youtube, 'YouTube')}</footer>`
  )
}
