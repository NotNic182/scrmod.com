import type { HubProfile } from '../../api/types'
import { FormStrip } from '../../components/FormStrip'
import { RatingGraph } from '../../components/RatingGraph'
import { StatTile } from '../../components/StatTile'
import { goldText, num, pct, plural, signed } from '../../lib/format'

function ratio(a: number | undefined, b: number | undefined): string {
  if (!a || !b) return '–'
  return pct(a / b)
}

export function Overview({ p }: { p: HubProfile }) {
  const gold = p.gold_hidden ? undefined : (p.gold_earned ?? 0) - (p.gold_spent ?? 0)
  const streak = p.current_ranked_series_streak ?? 0
  return (
    <>
      <div className="tiles" style={{ marginBottom: 14 }}>
        <StatTile label="Rating" value={Math.round(p.rating)} sub={`peak ${Math.round(p.peak_rating)}`} />
        <StatTile label="Standing" value={p.standing ? `#${p.standing}` : '–'} sub={p.standing_population ? `of ${p.standing_population}` : undefined} />
        <StatTile label="Ranked series" value={`${p.ranked_series_wins}-${p.ranked_series_losses}`} sub={ratio(p.ranked_series_wins, p.ranked_series_wins + p.ranked_series_losses) + ' win rate'} />
        <StatTile label="Streak" value={signed(streak)} sub="series" tone={streak > 0 ? 'good' : streak < 0 ? 'bad' : undefined} />
        <StatTile label="Level" value={p.level} sub={`${num(p.xp_into_level)} / ${num(p.xp_for_next_level)} xp`} />
        <StatTile label="Casual" value={`${p.casual_wins ?? 0}-${p.casual_losses ?? 0}`} sub="games" />
        <StatTile label="Accuracy" value={ratio(p.bullets_hit, p.bullets_fired)} sub={`block ${ratio(p.blocks_successful, p.blocks_activated)}`} />
        <StatTile label="Gold" value={goldText(gold, p.gold_hidden)} sub={p.gold_hidden ? 'player hides gold' : 'balance'} />
        {p.team_completed_series ? <StatTile label="2v2 rating" value={Math.round(p.team_rating)} sub={plural(p.team_completed_series, 'series', 'series')} /> : null}
        {p.ffa_games ? <StatTile label="FFA" value={p.ffa_rating ? Math.round(p.ffa_rating) : plural(p.ffa_wins, 'win')} sub={`avg place ${p.ffa_avg_placement?.toFixed(2) ?? '–'} · ${plural(p.ffa_games, 'game')}`} /> : null}
        {p.ovt_solo_wins + p.ovt_solo_losses + p.ovt_duo_wins + p.ovt_duo_losses > 0 ? <StatTile label="1v2" value={`${p.ovt_solo_wins + p.ovt_duo_wins}-${p.ovt_solo_losses + p.ovt_duo_losses}`} sub={`solo ${p.ovt_solo_wins}-${p.ovt_solo_losses} · duo ${p.ovt_duo_wins}-${p.ovt_duo_losses}`} /> : null}
        <StatTile label="Sweeps" value={`${p.sweeps_given ?? 0} / ${p.sweeps_taken ?? 0}`} sub="given / taken" />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent form</h2>
          <span className="muted">newest first</span>
        </div>
        <FormStrip form={p.recent_form} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Rating over time</h2>
        </div>
        <RatingGraph history={p.recent_rating_history} ffa={p.ffa_rating_history} />
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Top cards</h2>
          <CardList cards={p.top_cards} />
        </div>
        <div className="card">
          <h2>Worst cards</h2>
          <CardList cards={p.worst_cards} />
        </div>
      </div>
    </>
  )
}

function CardList({ cards }: { cards: HubProfile['top_cards'] | undefined }) {
  if (!cards?.length) return <div className="empty">No card data yet.</div>
  return (
    <table className="t">
      <thead>
        <tr>
          <th>Card</th>
          <th className="num">Picks</th>
          <th className="num">Win %</th>
        </tr>
      </thead>
      <tbody>
        {cards.slice(0, 10).map((c) => (
          <tr key={c.card_name}>
            <td>{c.card_name}</td>
            <td className="num">{c.times_picked}</td>
            <td className={`num ${c.win_rate >= 0.55 ? 'good' : c.win_rate <= 0.45 ? 'bad' : ''}`}>{pct(c.win_rate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
