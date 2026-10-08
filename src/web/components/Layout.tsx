import { Suspense, useEffect, useRef, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useOnline } from '../lib/online'
import { useTheme } from '../lib/theme'
import { FOOTER_NOTE, NAV_LINKS } from '../../shared/brand'
import { LINKS } from '../../shared/links'
import { Backdrop } from './Backdrop'
import { ErrorBoundary } from './ErrorBoundary'
import { Icon, type IconName } from './Icon'
import { Wordmark } from './Wordmark'

const NAV_DETAILS: Record<string, { icon: IconName; end?: boolean; match?: string }> = {
  '/': { icon: 'home', end: true },
  '/leaderboards/1v1': { icon: 'boards', match: '/leaderboards' },
  '/results': { icon: 'results' },
  '/tournaments': { icon: 'tournaments' },
  '/cards': { icon: 'cards' },
  '/watch': { icon: 'play' },
}
const NAV = NAV_LINKS.map((n) => ({ ...n, ...NAV_DETAILS[n.to] }))

/** Boards links to 1v1 but stays lit on every mode. */
function isActive(n: (typeof NAV)[number], pathname: string) {
  const section = n.match ?? n.to
  return pathname === section || (!n.end && pathname.startsWith(`${section}/`))
}

function PageLoading() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <div className="skeleton" style={{ width: '40%', height: 28 }} />
      <div className="skeleton" style={{ width: '90%' }} />
      <div className="skeleton" style={{ width: '70%' }} />
    </div>
  )
}

export function Layout({ identity }: { identity?: ReactNode }) {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const online = useOnline()
  const queries = useQueryClient()
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)

  // A new page starts at the top, and keyboard/screen-reader focus lands on it rather than staying on the
  // link that was clicked (which may now be gone). Tab and filter changes (?tab=) don't count as new pages.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, 0)
    main.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <>
      <Backdrop />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <NavLink to="/" className="brand" end aria-label="SCRmod home">
          <Wordmark />
        </NavLink>
        {/* Wide screens: links live in the top bar. Narrow screens: the bottom tab bar below. */}
        <nav className="topnav" aria-label="Primary">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} aria-current={isActive(n, pathname) ? 'page' : undefined} className={`item${isActive(n, pathname) ? ' active' : ''}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <span className="spacer" />
        {identity}
        <button className="btn icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Theme">
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} />
        </button>
      </header>
      <main className="page" id="main" tabIndex={-1} ref={main}>
        {!online ? (
          <div className="banner warn row" role="status">
            <Icon name="offline" size={18} />
            You're offline. Showing the last data this page loaded; it will refresh when you reconnect.
          </div>
        ) : null}
        <ErrorBoundary resetKey={pathname} onRetry={() => {
          // The crashed page's observers are unmounted: reset their cache before rendering it again.
          void queries.resetQueries({ type: 'inactive' })
          main.current?.focus({ preventScroll: true })
        }}>
          {/* Pages load as separate chunks: the nav stays put while one arrives. */}
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className="footer">
        {FOOTER_NOTE} <NavLink to="/about">About &amp; privacy</NavLink> · <NavLink to="/guide">Guide</NavLink> · Watch on{' '}
        <a href={LINKS.twitch} rel="noopener">
          Twitch
        </a>{' '}
        ·{' '}
        <a href={LINKS.youtube} rel="noopener">
          YouTube
        </a>
      </footer>
      <nav className="tabbar" aria-label="Primary">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} aria-current={isActive(n, pathname) ? 'page' : undefined} className={isActive(n, pathname) ? 'active' : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
