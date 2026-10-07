import { useTitle } from '../lib/title'
import { useStream } from '../api/hooks'
import { BroadcastList, LiveStream, StreamAvailability } from '../components/Stream'
import { QueryState } from '../components/QueryState'
import { LINKS } from '../../shared/links'
import { INTROS, pageMeta } from '../../shared/seo'

/** The stream's own tab: live if someone is on, an empty state if not, and the latest broadcasts either way. */
export function Watch() {
  useTitle(pageMeta({ kind: 'watch' }).title)
  const q = useStream()

  return (
    <>
      <h1>Watch</h1>
      <p className="page-intro">{INTROS.watch}</p>
      <QueryState q={q} label="stream data">
        {(d, meta) => (
          <>
            {meta.errors.length ? (
              <div className="banner warn row" role="status">
                <span>Couldn't refresh {meta.errors.join(', ')}.</span>
                <button className="btn btn-sm" aria-disabled={q.isFetching || undefined} onClick={() => { if (!q.isFetching) void q.refetch() }}>
                  {q.isFetching ? 'Retrying…' : 'Try again'}
                </button>
              </div>
            ) : null}
            {d.live ? <LiveStream live={d.live} /> : <StreamAvailability status={d.live_status} />}
            <BroadcastList data={d} whileLive />
          </>
        )}
      </QueryState>
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
    </>
  )
}
