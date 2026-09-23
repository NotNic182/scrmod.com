import { useTitle } from '../lib/title'
import { useStream } from '../api/hooks'
import { EmptyState } from '../components/EmptyState'
import { RecentBroadcasts, StreamCard } from '../components/Stream'
import { LINKS } from '../../shared/links'
import { INTROS, pageMeta } from '../../shared/seo'

/** The stream's own tab: live if someone is on, an empty state if not, and the latest broadcasts either way. */
export function Watch() {
  useTitle(pageMeta({ kind: 'watch' }).title)
  const q = useStream()
  const live = q.data?.data.live

  return (
    <>
      <h1>Watch</h1>
      <p className="page-intro">{INTROS.watch}</p>
      {live ? <StreamCard /> : live === null ? <EmptyState title="Nobody is streaming right now." hint="Follow the channels to hear when the next ranked games go live." /> : null}
      <section className="card">
        <p>
          Follow on{' '}
          <a href={LINKS.twitch} rel="noopener">
            Twitch
          </a>{' '}
          ·{' '}
          <a href={LINKS.youtube} rel="noopener">
            YouTube
          </a>
        </p>
      </section>
      <RecentBroadcasts whileLive />
    </>
  )
}
