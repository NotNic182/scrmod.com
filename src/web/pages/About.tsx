import { useTitle } from '../lib/title'
import { useStatus } from '../api/hooks'
import { LINKS } from '../../shared/links'
import { pageMeta } from '../../shared/seo'

export function About() {
  useTitle(pageMeta({ kind: 'about' }).title)
  const s = useStatus()
  const st = s.data
  return (
    <>
      <h1>About SCRmod</h1>
      <div className="card">
        <h2>What this is</h2>
        <p>
          A browser companion for <strong>Sid's Competitive Rounds</strong>, the ranked mod for ROUNDS. It shows the same things the in-game F5 menu and the Discord bot show,
          so you can check who is online, what is being played and where you stand without launching the game.
        </p>
        <p className="muted">
          It is a community project, not affiliated with Landfall. Playing, queueing, betting, chatting and tournament signups still happen in the game and on the{' '}
          <a href={LINKS.discord}>Competitive Rounds Discord</a>.
        </p>
      </div>
      <div className="card">
        <h2>Where the data comes from</h2>
        <p>
          Everything here is read from the mod's public API, the same data every mod client and the Discord bot receive. Nothing is collected beyond that. Live pages refresh every 15 seconds
          while the tab is visible, leaderboards every minute, and every panel shows how old its data is.
        </p>
        <ul className="prose">
          <li>
            <strong>Appear offline</strong> in the game (F5 → Settings) removes you from the online lists here too.
          </li>
          <li>
            <strong>Hide gold</strong> in the game hides your gold here as well.
          </li>
          <li>
            Your Discord name appears only if you switched on <strong>Show Discord</strong> in the game.
          </li>
          <li>Deleting your data in the game removes it here within a minute.</li>
        </ul>
      </div>
      <div className="card">
        <h2>Pinning and signing in</h2>
        <p>
          "Find me" lets you pin your own profile in this browser, nothing more. Signing in with Discord, where enabled, looks up the player you linked in-game with <code>/link</code> and pins that
          instead. The site keeps no account data of its own.
        </p>
      </div>
      <div className="card">
        <h2>Status</h2>
        {st ? (
          <p className="muted">
            Running in {st.mode} mode, version {st.app_version}. Talking to {st.upstream.base} as mod version {st.upstream.version.version ?? 'unknown'} ({st.upstream.version.source}).
          </p>
        ) : (
          <p className="faint">Loading status…</p>
        )}
        <p className="muted">
          Get the mod: <a href={LINKS.thunderstore}>Thunderstore</a> · <a href={LINKS.github}>GitHub</a>
        </p>
      </div>
    </>
  )
}
