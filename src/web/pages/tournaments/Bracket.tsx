import { Link } from 'react-router'
import { useBracket } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { clock } from '../../lib/format'

function Chips({ joined }: { joined: string }) {
  const names = joined ? joined.split('|').filter(Boolean) : []
  if (!names.length) return <span className="faint">no picks</span>
  return (
    <span className="chip-row">
      {names.map((n, i) => (
        <span key={i} className="chip card-chip">
          {n}
        </span>
      ))}
    </span>
  )
}

export function Bracket({ id }: { id: string }) {
  const q = useBracket(id)
  return (
    <div className="card">
      <div className="card-head">
        <h2>Game details</h2>
        <Link to="/tournaments" className="muted">
          ← tournaments
        </Link>
      </div>
      <QueryState q={q} label="bracket games" empty={(d) => !d.matches?.length} emptyHint="No games have been played in this bracket yet.">
        {(d) => (
          <>
            {d.matches.map((m, i) => (
              <div key={m.match_id} className="round-group">
                <div className="faint">Match {i + 1}</div>
                {m.games.map((g) => (
                  <div key={g.n} className="game-row">
                    <div className="row">
                      <span className="faint">Game {g.n}</span>
                      <strong className="tnum">
                        {g.p1_rounds}–{g.p2_rounds}
                      </strong>
                      <span className="faint">
                        pts {g.p1_points}–{g.p2_points} · {clock(g.dur)} · hit {g.p1_hit_pct}% / {g.p2_hit_pct}% · block {g.p1_blk_pct}% / {g.p2_blk_pct}%
                      </span>
                    </div>
                    <div className="subline">
                      <span className="faint">P1: </span>
                      <Chips joined={g.p1_cards} />
                    </div>
                    <div className="subline">
                      <span className="faint">P2: </span>
                      <Chips joined={g.p2_cards} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </QueryState>
    </div>
  )
}
