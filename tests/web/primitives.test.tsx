import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { PlayerLink } from '../../src/web/components/PlayerLink'
import { RankChip } from '../../src/web/components/RankChip'
import { StatTile } from '../../src/web/components/StatTile'
import { FormStrip } from '../../src/web/components/FormStrip'

describe('primitives', () => {
  it('PlayerLink links to the profile and shows the title in its color', () => {
    renderApp(<PlayerLink steamId="76561198040410653" name="Sid" title="FFA 1st Place" titleColor="#FFD700" online />)
    const link = screen.getByRole('link', { name: /Sid/ })
    expect(link).toHaveAttribute('href', '/players/76561198040410653')
    // The server color feeds the legibility guard (.api-color clamps its lightness per theme in CSS).
    const tag = screen.getByText('FFA 1st Place')
    expect(tag).toHaveClass('api-color')
    expect(tag.style.getPropertyValue('--api-c')).toBe('#FFD700')
    expect(screen.getByLabelText('online')).toBeInTheDocument()
  })

  it('RankChip uses the server name and color when given, else derives the tier from the rating', () => {
    renderApp(<RankChip name="Grand Master IV" color="#E52745" />)
    const chip = screen.getByText('Grand Master IV')
    expect(chip).toHaveClass('api-color')
    expect(chip.style.getPropertyValue('--api-c')).toBe('#E52745')
    renderApp(<RankChip rating={1700} />)
    expect(screen.getByText('Advanced')).toBeInTheDocument()
  })

  it('StatTile and FormStrip render', () => {
    renderApp(<StatTile label="Rating" value="1102" sub="peak 1338" />)
    expect(screen.getByText('Rating')).toBeInTheDocument()
    expect(screen.getByText('1102')).toBeInTheDocument()
    renderApp(<FormStrip form={[{ result: 'W', ranked: true, opponent: 'A', score: '5-2', date: '2026-09-21' }, { result: 'L', ranked: false, opponent: 'B', score: '3-5', date: '2026-09-20' }]} />)
    expect(screen.getAllByText('W').length).toBe(1)
    expect(screen.getAllByText('L').length).toBe(1)
  })
})
