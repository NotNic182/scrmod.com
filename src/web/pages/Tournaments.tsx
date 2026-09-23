import { useTitle } from '../lib/title'
import { useParams } from 'react-router'
import { useTournaments } from '../api/hooks'
import { QueryState } from '../components/QueryState'
import { Bracket } from './tournaments/Bracket'
import { CurrentCard } from './tournaments/CurrentCard'
import { History } from './tournaments/History'
import { INTROS, pageMeta } from '../../shared/seo'

export function Tournaments() {
  useTitle(pageMeta({ kind: 'tournaments' }).title)
  const { id } = useParams()
  const q = useTournaments()
  return (
    <>
      <h1>Tournaments</h1>
      <p className="page-intro">{INTROS.tournaments} Sign up, vote and play from the game (F5 → Tournaments).</p>
      {id && /^[0-9a-f-]{36}$/i.test(id) ? <Bracket id={id} /> : null}
      <QueryState q={q} label="tournaments">
        {(d, meta) => (
          <>
            {meta.errors.length ? <div className="banner bad">Could not load: {meta.errors.join(', ')}.</div> : null}
            <div className="grid-2">
              <CurrentCard t={d.sync} kind="sync" />
              <CurrentCard t={d.async} kind="async" />
            </div>
          </>
        )}
      </QueryState>
      <History />
    </>
  )
}
