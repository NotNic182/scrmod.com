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
  const panel = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (!open) return
    // On iOS the keyboard shrinks the visual viewport without necessarily changing 100dvh.
    // Leave the focused search and its results in a scrollable sheet above the keyboard.
    const viewport = window.visualViewport
    const fitPanel = () => {
      if (!panel.current) return
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
      const space = Math.max(0, bottom - panel.current.getBoundingClientRect().top - 16)
      panel.current.style.setProperty('--identity-space', `${space}px`)
    }
    fitPanel()
    viewport?.addEventListener('resize', fitPanel)
    viewport?.addEventListener('scroll', fitPanel)
    window.addEventListener('resize', fitPanel)
    return () => {
      viewport?.removeEventListener('resize', fitPanel)
      viewport?.removeEventListener('scroll', fitPanel)
      window.removeEventListener('resize', fitPanel)
    }
  }, [open])

  const toggleProps = { ref: trigger, 'aria-expanded': open, 'aria-controls': panelId, onClick: () => setOpen((o) => !o) }

  return (
    <div
      className="identity"
      ref={root}
      onBlur={(e) => {
        // Tab may leave this nonmodal popup, but the sheet must then stop covering the page.
        if (open && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) close(false)
      }}
    >
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
          <div className="card identity-panel" id={panelId} ref={panel} role="region" aria-label="Profile options">
            {id.discord ? (
              <p className="muted">
                Signed in as <bdi>{id.discord.global_name ?? id.discord.username}</bdi>.
                {id.source !== 'discord' ? ' No player is linked. Link your Discord in-game (F5 → Settings) or pin yourself below.' : null}
              </p>
            ) : null}
            {id.source !== 'discord' ? (
              <>
                <SearchBox
                  autoFocus
                  placeholder="Pin yourself: type your name"
                  onSelect={(r) => {
                    id.pin({ steam_id: r.steam_id, display_name: r.display_name })
                    close(true)
                  }}
                />
                {id.me ? (
                  <button className="btn trailing" onClick={() => { id.unpin(); close(true) }}>
                    Unpin <bdi className="player-name">{id.me.display_name}</bdi>
                  </button>
                ) : null}
              </>
            ) : null}
            {id.discord ? (
              <button
                className="btn trailing"
                autoFocus={id.source === 'discord'}
                aria-disabled={signingOut || undefined}
                onClick={async () => {
                  if (signingOut) return
                  setSigningOut(true)
                  setSignOutFailed(!(await id.signOut()))
                  setSigningOut(false)
                }}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            ) : id.authEnabled ? (
              <a className="btn btn-accent trailing" href={authUrl('/discord/login')}>
                Sign in with Discord
              </a>
            ) : null}
            {signOutFailed ? (
              <p className="bad" role="alert">
                Couldn't reach SCRmod to sign you out. Check your connection and try again.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
