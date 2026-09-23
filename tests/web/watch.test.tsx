import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { Watch } from '../../src/web/pages/Watch'
import { pageMeta } from '../../src/shared/seo'
import { LINKS } from '../../src/shared/links'

const links = { twitch: 'https://www.twitch.tv/sidscompetitiverounds', youtube: 'https://www.youtube.com/@SidsCompetitiveRounds' }
const recent = [{ title: 'Spirit vs galaxy ice', url: 'https://www.youtube.com/watch?v=v1', videoId: 'v1', published_at: '2026-09-23T07:06:15Z' }]

describe('Watch', () => {
  it('sets the watch title and always shows the follow links, pointing at LINKS', async () => {
    mockHub({ '/stream': env({ live: null, recent: [], links }) })
    renderApp(<Watch />)
    expect(document.title).toBe(pageMeta({ kind: 'watch' }).title)
    expect(screen.getByRole('heading', { level: 1, name: 'Watch' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Twitch' })).toHaveAttribute('href', LINKS.twitch)
    expect(screen.getByRole('link', { name: 'YouTube' })).toHaveAttribute('href', LINKS.youtube)
  })

  it('shows the play button and no iframe when live', async () => {
    const started = new Date(Date.now() - 10 * 60_000).toISOString()
    mockHub({
      '/stream': env({
        live: { platform: 'twitch', title: 'Ranked night', viewers: 10, started_at: started, url: links.twitch, embed: { kind: 'twitch', channel: 'sidscompetitiverounds' } },
        recent: [],
        links,
      }),
    })
    renderApp(<Watch />)
    expect(await screen.findByRole('button', { name: 'Watch here: Ranked night' })).toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('shows the empty state and recent broadcasts when nobody is live', async () => {
    mockHub({ '/stream': env({ live: null, recent, links }) })
    renderApp(<Watch />)
    expect(await screen.findByText('Nobody is streaming right now.')).toBeInTheDocument()
    expect(screen.getByText('Follow the channels to hear when the next ranked games go live.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Spirit vs galaxy ice' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=v1')
  })
})
