import { useId, useState } from 'react'
import { useStream } from '../api/hooks'
import { relTime, num } from '../lib/format'
import { Icon } from './Icon'

const PLATFORM = { twitch: 'Twitch', youtube: 'YouTube' } as const

/**
 * The community's live stream, when there is one. Nothing is requested from Twitch or YouTube until the visitor
 * presses play: until then the card is one compact row in the site's own style, and the player opens under it.
 */
export function StreamCard() {
  const q = useStream()
  const [playing, setPlaying] = useState(false)
  const id = useId()
  const live = q.data?.data.live
  if (!live) return null
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
        {playing ? null : (
          <button type="button" className="btn" onClick={() => setPlaying(true)} aria-label={`Watch here: ${live.title}`}>
            <Icon name="play" size={18} /> Watch here
          </button>
        )}
      </div>
      {playing ? (
        <div className="stream-frame">
          <iframe src={src} title={`${live.title} on ${platform}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      ) : null}
      <p className="subline">
        <a href={live.url} rel="noopener">
          Open on {platform}
        </a>
      </p>
    </section>
  )
}

/** The latest ranked matches the channel broadcast, when nothing is live right now. */
export function RecentBroadcasts() {
  const q = useStream()
  const d = q.data?.data
  if (!d || d.live || !d.recent.length) return null
  return (
    <section className="card">
      <div className="card-head">
        <h2>Recent broadcasts</h2>
        <a href={d.links.youtube} className="muted" rel="noopener">
          YouTube →
        </a>
      </div>
      <ul className="plain-list">
        {d.recent.map((v) => (
          <li key={v.videoId} className="row list-row">
            <a href={v.url} rel="noopener">
              {v.title}
            </a>
            <span className="spacer" />
            <span className="faint">{relTime(v.published_at)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
