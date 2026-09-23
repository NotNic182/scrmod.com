import { useId, useState } from 'react'
import { useStream } from '../api/hooks'
import { relTime, num } from '../lib/format'
import { Icon } from './Icon'

const PLATFORM = { twitch: 'Twitch', youtube: 'YouTube' } as const

/**
 * The community's live stream, when there is one. Nothing is requested from Twitch or YouTube until the visitor
 * presses play: the card is drawn in the site's own style, and the player replaces it on demand.
 */
export function StreamCard() {
  const q = useStream()
  const [playing, setPlaying] = useState(false)
  const id = useId()
  const live = q.data?.data.live
  if (!live) return null
  const platform = PLATFORM[live.platform]
  const src =
    live.embed.kind === 'twitch'
      ? `https://player.twitch.tv/?channel=${encodeURIComponent(live.embed.channel)}&parent=${encodeURIComponent(location.hostname)}&autoplay=true`
      : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(live.embed.videoId)}?autoplay=1`
  return (
    <section className="card stream" aria-labelledby={id}>
      <div className="card-head">
        <h2 id={id}>Live on stream</h2>
        <span className="muted">
          {platform}
          {live.viewers != null ? ` · ${num(live.viewers)} watching` : ''}
        </span>
      </div>
      {playing ? (
        <div className="stream-frame">
          <iframe src={src} title={`${live.title} on ${platform}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <button type="button" className="stream-play" onClick={() => setPlaying(true)} aria-label={`Watch ${live.title} here`}>
          <span className="chip live-pill">LIVE</span>
          <span className="stream-title">{live.title}</span>
          <span className="stream-cta">
            <Icon name="play" size={20} /> Watch here
          </span>
        </button>
      )}
      <p className="subline">
        <a href={live.url} rel="noopener">
          Open on {platform}
        </a>
        {live.started_at ? <span className="faint"> · started {relTime(live.started_at)}</span> : null}
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
