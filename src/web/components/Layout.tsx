import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useTheme } from '../lib/theme'

const NAV: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Home', end: true },
  { to: '/leaderboards/1v1', label: 'Boards' },
  { to: '/results', label: 'Results' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/cards', label: 'Cards' },
]

export function Layout({ identity }: { identity?: ReactNode }) {
  const { theme, toggle } = useTheme()
  return (
    <>
      <nav className="nav" aria-label="Primary">
        <NavLink to="/" className="brand" end>
          SCR Hub
        </NavLink>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `item${isActive ? ' active' : ''}`}>
            {n.label}
          </NavLink>
        ))}
        <span className="spacer" />
        {identity}
        <button className="btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Theme">
          {theme === 'dark' ? '☾' : '☀'}
        </button>
      </nav>
      <main className="page">
        <Outlet />
      </main>
      <footer className="footer">
        Data from the Sid's Competitive Rounds mod API, refreshed every few seconds. Not affiliated with Landfall.{' '}
        <NavLink to="/about">About &amp; privacy</NavLink>
      </footer>
    </>
  )
}
