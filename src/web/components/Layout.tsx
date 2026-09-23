import { Suspense, useEffect, useRef, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useOnline } from '../lib/online'
import { useTheme } from '../lib/theme'
import { FOOTER_NOTE, NAV_LINKS } from '../../shared/brand'
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
}
const NAV = NAV_LINKS.map((n) => ({ ...n, ...NAV_DETAILS[n.to] }))

/** Boards links to 1v1 but stays lit on every mode. */
function isActive(n: (typeof NAV)[number], pathname: string, active: boolean) {
  return n.match ? pathname.startsWith(n.match) : active
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
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive: a }) => `item${isActive(n, pathname, a) ? ' active' : ''}`}>
              {n.label}
            </NavLink>
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
        <ErrorBoundary resetKey={pathname}>
          {/* Pages load as separate chunks: the nav stays put while one arrives. */}
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className="footer">
        {FOOTER_NOTE} <NavLink to="/about">About &amp; privacy</NavLink>
      </footer>
      <nav className="tabbar" aria-label="Primary">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive: a }) => (isActive(n, pathname, a) ? 'active' : undefined)}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
