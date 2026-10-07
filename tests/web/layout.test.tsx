import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { renderApp } from './helpers/render'
import { mockHub } from './helpers/mockHub'
import { Layout } from '../../src/web/components/Layout'

describe('Layout', () => {
  it('renders the primary navigation and the page outlet', () => {
    mockHub({ '/me': { data: { discord: null, player: null }, auth_enabled: false } })
    renderApp(
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>page body</p>} />
        </Route>
      </Routes>,
    )
    // Two copies by design: top bar links (wide screens) and the bottom tab bar (phones); CSS shows one.
    for (const label of ['Home', 'Boards', 'Results', 'Tournaments', 'Cards', 'Watch']) {
      expect(screen.getAllByRole('link', { name: label })).toHaveLength(2)
    }
    expect(screen.getByText('page body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
  })

  it.each(['/leaderboards/2v2', '/leaderboards/ffa', '/leaderboards/1v2-solo'])('marks Boards current in both navigation layouts on %s', (route) => {
    renderApp(<Layout />, { route })
    expect(screen.getAllByRole('link', { name: 'Boards' })).toHaveLength(2)
    for (const link of screen.getAllByRole('link', { name: 'Boards' })) {
      expect(link).toHaveAttribute('aria-current', 'page')
      expect(link).toHaveClass('active')
    }
    for (const link of screen.getAllByRole('link', { name: 'Home' })) expect(link).not.toHaveAttribute('aria-current')
  })
})
