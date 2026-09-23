import { useId } from 'react'
import { Link, useParams } from 'react-router'
import type { CardStat } from '../../shared/api-types'
import { pageMeta } from '../../shared/seo'
import { HubError } from '../api/client'
import { useCard } from '../api/hooks'
import { QueryState } from '../components/QueryState'
import { StatTile } from '../components/StatTile'
import { num, pct } from '../lib/format'
import { useTitle } from '../lib/title'
import { Pickers } from './Cards'

function StatStrip({ title, s }: { title: string; s: CardStat }) {
  const id = useId()
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="tiles">
        <StatTile label="Win rate" value={pct(s.win_rate)} />
        <StatTile label="Picks" value={num(s.times_picked)} />
        <StatTile label="Offered" value={num(s.times_offered)} />
        <StatTile label="Pass rate" value={pct(s.pass_rate)} />
        <StatTile label="Players" value={num(s.unique_players)} />
        <StatTile label="5-0 sweeps" value={num(s.sweeps_with_card)} />
      </div>
    </section>
  )
}

/** One card: how it does overall, in ranked and casual play, who picks it and who wins with it. */
export function Card() {
  const { slug } = useParams()
  const q = useCard(slug)
  const d = q.data?.data
  // A card that does not exist is the server's 404 page, so it takes that title.
  const missing = q.error instanceof HubError && q.error.status === 404
  useTitle(
    missing
      ? pageMeta({ kind: 'not-found' }).title
      : pageMeta({ kind: 'card', slug: slug ?? '' }, d ? { card: { name: d.card.card_name, rarity: d.card.card_rarity, win_rate: d.card.win_rate, times_picked: d.card.times_picked, pass_rate: d.card.pass_rate } } : {}).title,
  )
  return (
    <QueryState q={q} label="card">
      {(p) => (
        <>
          <h1>{p.card.card_name}</h1>
          <p className="page-intro">
            <span className={`rarity-${String(p.card.card_rarity).toLowerCase()}`}>{p.card.card_rarity}</span> card ·{' '}
            <Link to="/cards">All cards</Link>
          </p>
          <StatStrip title="All games" s={p.card} />
          {p.ranked ? <StatStrip title="Ranked games" s={p.ranked} /> : null}
          {p.casual ? <StatStrip title="Casual games" s={p.casual} /> : null}
          <div className="grid-2">
            <div className="card">
              <h2>Top pickers</h2>
              <Pickers name={p.card.card_name} />
            </div>
            <div className="card">
              <h2>Most wins with it</h2>
              {p.winners.length ? (
                <ul className="plain-list">
                  {p.winners.slice(0, 10).map((w, i) => (
                    <li key={i} className="row list-row">
                      <bdi>{w.player}</bdi>
                      <span className="spacer" />
                      <span className="tnum">{num(w.count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">No leaders for this card yet.</div>
              )}
            </div>
          </div>
          <nav className="row" aria-label="Other cards">
            {p.prev ? <Link to={`/cards/${p.prev.slug}`}>← {p.prev.name}</Link> : null}
            <span className="spacer" />
            {p.next ? <Link to={`/cards/${p.next.slug}`}>{p.next.name} →</Link> : null}
          </nav>
        </>
      )}
    </QueryState>
  )
}
