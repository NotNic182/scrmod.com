import { useTitle } from '../lib/title'
import { useParams } from 'react-router'
import { useTournaments } from '../api/hooks'
import { QueryState } from '../components/QueryState'
import { StreamCard } from '../components/Stream'
import { Bracket } from './tournaments/Bracket'
import { CurrentCard } from './tournaments/CurrentCard'
import { History } from './tournaments/History'
import { INTROS, pageMeta, UUID } from '../../shared/seo'

export function Tournaments() {
  const { id } = useParams()
  // A well-formed id is a game-details page, titled as the server titles it; anything else keeps the list's title.
  const bracketId = id && UUID.test(id) ? id : undefined
  useTitle(pageMeta(bracketId ? { kind: 'tournament', id: bracketId } : { kind: 'tournaments' }).title)
  const q = useTournaments()
  return (
    <>
      <h1>Tournaments</h1>
      <p className="page-intro">{INTROS.tournaments} Sign up, vote and play from the game (F5 → Tournaments).</p>
      <StreamCard />
      {bracketId ? <Bracket id={bracketId} /> : null}
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
