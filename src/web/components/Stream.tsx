import { useId, useState } from 'react'
import { Link } from 'react-router'
import { useStream } from '../api/hooks'
import { relTime, num } from '../lib/format'
import { Icon } from './Icon'
import { QueryFeedback } from './QueryState'
import { EmptyState } from './EmptyState'
import type { StreamData, StreamLive } from '../../shared/hub-types'

const PLATFORM = { twitch: 'Twitch', youtube: 'YouTube' } as const

/**
 * The community's live stream, when there is one. Nothing is requested from Twitch or YouTube until the visitor
 * presses play: until then the card is one compact row in the site's own style, and the player opens under it.
 */
export function StreamCard({ watchLink = false }: { watchLink?: boolean } = {}) {
  const q = useStream()
  return (
    <QueryFeedback q={q} label="stream status" pending={null}>
      {(body) => body.data.live ? <LiveStream live={body.data.live} watchLink={watchLink} /> : body.data.live_status === 'unknown' ? (
        <div className="banner warn" role="status">
          Couldn't check stream availability. <Link to="/watch">Check the channels or try again on Watch →</Link>
        </div>
      ) : null}
    </QueryFeedback>
  )
}

export function LiveStream({ live, watchLink = false }: { live: StreamLive; watchLink?: boolean }) {
  const [playing, setPlaying] = useState(false)
  const id = useId()
  const frameId = `${id}-player`
  const platform = PLATFORM[live.platform]
  const since = relTime(live.started_at)
  const src =
    live.embed.kind === 'twitch'
      ? `https://player.twitch.tv/?channel=${encodeURIComponent(live.embed.channel)}&parent=${encodeURIComponent(location.hostname)}&autoplay=true`
      : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(live.embed.videoId)}?autoplay=1`
  return (
    <section className="card stream" aria-labelledby={id}>
      <div className="card-head">
        <h2 id={id}>Live on stream</h2>
      </div>
      <div className="panel stream-row">
        <div className="stream-info">
          <div className="row">
            <span className="chip live-pill">LIVE</span>
            <span className="stream-title">{live.title}</span>
          </div>
          <span className="muted stream-meta">
            {platform}
            {live.viewers != null ? ` · ${num(live.viewers)} watching` : ''}
            {since ? ` · started ${since}` : ''}
          </span>
        </div>
        {/* The accessible name starts with the visible words, so a voice user can say what they see (WCAG 2.5.3). */}
        <button type="button" className="btn" onClick={() => setPlaying((p) => !p)} aria-expanded={playing} aria-controls={frameId} aria-label={`${playing ? 'Close player' : 'Watch here'}: ${live.title}`}>
          <Icon name={playing ? 'close' : 'play'} size={18} /> {playing ? 'Close player' : 'Watch here'}
        </button>
      </div>
      <div className="stream-frame" id={frameId} hidden={!playing}>
        {playing ? <iframe src={src} title={`${live.title} on ${platform}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /> : null}
      </div>
      <p className="subline">
        <a href={live.url} rel="noopener">
          Open on {platform}
        </a>
        {watchLink ? (
          <>
            {' '}
            · <Link to="/watch">More on Watch</Link>
          </>
        ) : null}
      </p>
    </section>
  )
}

/** The latest ranked matches the channel broadcast. Hidden while live unless `whileLive` says otherwise (the Watch tab shows it either way). */
export function RecentBroadcasts({ whileLive = false }: { whileLive?: boolean } = {}) {
  const q = useStream()
  return <QueryFeedback q={q} label="recent broadcasts" pending={null}>{(body) => <BroadcastList data={body.data} whileLive={whileLive} />}</QueryFeedback>
}

export function StreamAvailability({ status }: { status: StreamData['live_status'] }) {
  if (status === 'unknown') return <EmptyState title="Couldn't check stream availability." hint="Open Twitch or YouTube to see what's live, or try again." />
  if (status === 'unavailable') return <EmptyState title="Live stream status isn't available here." hint="Open Twitch or YouTube to see what's live." />
  return <EmptyState title="Nobody is streaming right now." hint="Follow the channels to hear when the next ranked games go live." />
}

export function BroadcastList({ data: d, whileLive = false }: { data: StreamData; whileLive?: boolean }) {
  if ((d.live && !whileLive) || !d.recent.length) return null
  return (
    <section className="card">
      <div className="card-head">
        <h2>Recent broadcasts</h2>
        <a href={d.links.youtube} className="muted" rel="noopener">
          YouTube →
        </a>
      </div>
      <ul className="plain-list broadcast-list">
        {d.recent.map((v) => (
          <li key={v.videoId}>
            <a href={v.url} rel="noopener">
              {v.title}
            </a>
            <time className="faint" dateTime={v.published_at}>{relTime(v.published_at)}</time>
          </li>
        ))}
      </ul>
    </section>
  )
}
