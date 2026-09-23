import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { authUrl } from '../api/client'
import { useIdentity } from '../lib/identity'
import { Icon } from './Icon'
import { SearchBox } from './SearchBox'

export function IdentityMenu() {
  const id = useIdentity()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutFailed, setSignOutFailed] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const { pathname } = useLocation()

  const close = (refocus: boolean) => {
    setOpen(false)
    // After the commit: pinning swaps "Find me" for the options button, and focus belongs on the new one.
    if (refocus) setTimeout(() => trigger.current?.focus(), 0)
  }

  // Any navigation (a search pick, the name link) puts the panel away.
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true)
    }
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const toggleProps = { ref: trigger, 'aria-expanded': open, 'aria-controls': panelId, onClick: () => setOpen((o) => !o) }

  return (
    <div className="identity" ref={root}>
      {id.me ? (
        <span className="identity-pinned">
          <Link to={`/players/${id.me.steam_id}`} className="btn identity-name" title={id.source === 'discord' ? 'Linked through Discord' : 'Pinned in this browser'}>
            <Icon name={id.source === 'discord' ? 'link' : 'pin'} size={16} />
            <bdi className="identity-label">{id.me.display_name}</bdi>
          </Link>
          <button className="btn icon-btn" aria-label="Identity options" {...toggleProps}>
            <Icon name="chevron" size={18} />
          </button>
        </span>
      ) : (
        <button className="btn" {...toggleProps}>
          <Icon name="user" size={18} />
          Find me
        </button>
      )}
      {open ? (
        <>
          <div className="identity-scrim" onClick={() => close(false)} />
          <div className="card identity-panel" id={panelId}>
            {id.source === 'discord' ? (
              <>
                <p className="muted">Signed in as {id.discord?.global_name ?? id.discord?.username}.</p>
                <button
                  className="btn"
                  disabled={signingOut}
                  onClick={async () => {
                    setSigningOut(true)
                    setSignOutFailed(!(await id.signOut()))
                    setSigningOut(false)
                  }}
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
                {signOutFailed ? (
                  <p className="bad" role="alert">
                    Couldn't reach SCRmod to sign you out. Check your connection and try again.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {id.discord && !id.me ? <p className="muted">Signed in as {id.discord.username}, but no player is linked. Link your Discord in-game (F5 → Settings) or pin yourself below.</p> : null}
                <SearchBox
                  autoFocus
                  placeholder="Pin yourself: type your name"
                  onSelect={(r) => {
                    id.pin({ steam_id: r.steam_id, display_name: r.display_name })
                    close(true)
                  }}
                />
                {id.me ? (
                  <button className="btn" style={{ marginTop: 8 }} onClick={() => { id.unpin(); close(true) }}>
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
        </>
      ) : null}
    </div>
  )
}
