import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { Guide } from '../../src/web/pages/Guide'
import { GUIDE } from '../../src/shared/guide'

describe('Guide', () => {
  it('renders every section with its links, internal ones as app links', () => {
    renderApp(<Guide />)
    expect(document.title).toBe("How to play ranked ROUNDS: install Sid's Competitive Rounds · SCRmod")
    expect(screen.getByRole('heading', { level: 1, name: 'How to play ranked ROUNDS' })).toBeInTheDocument()
    for (const s of GUIDE) expect(screen.getByRole('heading', { level: 2, name: s.heading })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: "Sid's Competitive Rounds on Thunderstore" })[0]).toHaveAttribute('href', 'https://thunderstore.io/c/rounds/p/Team_Sid/SidsCompetitiveRounds/')
    expect(screen.getByRole('link', { name: 'SCRmod leaderboards' })).toHaveAttribute('href', '/leaderboards/1v1')
    expect(screen.getByRole('cell', { name: 'F5' })).toBeInTheDocument()
    expect(screen.getByText(/Checked against mod v1\.40\.3/)).toBeInTheDocument()
  })
})
