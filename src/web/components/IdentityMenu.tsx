import { useState } from 'react'
import { Link } from 'react-router'
import { authUrl } from '../api/client'
import { useIdentity } from '../lib/identity'
import { SearchBox } from './SearchBox'

export function IdentityMenu() {
  const id = useIdentity()
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      {id.me ? (
        <span className="row" style={{ gap: 6 }}>
          <Link to={`/players/${id.me.steam_id}`} className="btn" title={id.source === 'discord' ? 'Linked through Discord' : 'Pinned in this browser'}>
            {id.source === 'discord' ? '◈ ' : '📌 '}
            {id.me.display_name}
          </Link>
          <button className="btn" onClick={() => setOpen((o) => !o)} aria-label="Identity options">
            ▾
          </button>
        </span>
      ) : (
        <button className="btn" onClick={() => setOpen((o) => !o)}>
          Find me
        </button>
      )}
      {open ? (
        <div className="card" style={{ position: 'absolute', right: 0, top: 44, width: 'min(320px, 90vw)', boxShadow: 'var(--shadow)', zIndex: 20 }}>
          {id.source === 'discord' ? (
            <>
              <p className="muted">Signed in as {id.discord?.global_name ?? id.discord?.username}.</p>
              <button className="btn" onClick={() => void id.signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              {id.discord && !id.me ? <p className="muted">Signed in as {id.discord.username}, but no player is linked. Link your Discord in-game (F5 → Settings) or pin yourself below.</p> : null}
              <SearchBox
                autoFocus
                placeholder="Pin yourself: type your name"
                onSelect={(r) => {
                  id.pin({ steam_id: r.steam_id, display_name: r.display_name })
                  setOpen(false)
                }}
              />
              {id.me ? (
                <button className="btn" style={{ marginTop: 8 }} onClick={() => { id.unpin(); setOpen(false) }}>
                  Unpin {id.me.display_name}
                </button>
              ) : null}
              {id.authEnabled && !id.discord ? (
                <a className="btn btn-accent" style={{ marginTop: 8 }} href={authUrl('/discord/login')}>
                  Sign in with Discord
                </a>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
