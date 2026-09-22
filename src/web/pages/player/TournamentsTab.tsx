import { Link } from 'react-router'
import { usePlayerSub } from '../../api/hooks'
import { QueryState } from '../../components/QueryState'
import { StatTile } from '../../components/StatTile'

export function TournamentsTab({ steamId }: { steamId: string }) {
  const q = usePlayerSub(steamId, 'tournaments')
  return (
    <div className="card">
      <QueryState q={q} label="tournament record">
        {(d) => (
          <>
            <div className="tiles">
              <StatTile label="Wins" value={d.winner_count} />
              <StatTile label="Runner-up" value={d.runner_up_count} />
              <StatTile label="Third" value={d.third_place_count} />
              <StatTile label="Played" value={d.participant_count} />
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Upcoming and past brackets are on the <Link to="/tournaments">Tournaments</Link> page.
            </p>
          </>
        )}
      </QueryState>
    </div>
  )
}
