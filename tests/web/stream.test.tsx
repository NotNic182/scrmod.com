import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { RecentBroadcasts, StreamCard } from '../../src/web/components/Stream'

const links = { twitch: 'https://www.twitch.tv/sidscompetitiverounds', youtube: 'https://www.youtube.com/@SidsCompetitiveRounds' }
const recent = [{ title: 'Spirit vs galaxy ice', url: 'https://www.youtube.com/watch?v=v1', videoId: 'v1', published_at: '2026-09-23T07:06:15Z' }]

describe('stream', () => {
  it('shows a live Twitch stream as a compact row, and loads no player until play is pressed', async () => {
    const started = new Date(Date.now() - 25 * 60_000).toISOString()
    mockHub({ '/stream': env({ live: { platform: 'twitch', title: 'Ranked night', viewers: 42, started_at: started, url: links.twitch, embed: { kind: 'twitch', channel: 'sidscompetitiverounds' } }, recent: [], links }) })
    renderApp(<StreamCard />)
    const play = await screen.findByRole('button', { name: 'Watch here: Ranked night' })
    // The accessible name starts with the words on the button, so "click Watch here" works by voice.
    expect(play).toHaveTextContent(/^Watch here$/)
    expect(play).toHaveClass('btn')
    const row = play.closest('.panel')!
    expect(row).toHaveTextContent('LIVE')
    expect(row).toHaveTextContent('Ranked night')
    expect(screen.getByText('Twitch · 42 watching · started 25m ago')).toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
    await userEvent.click(play)
    const frame = document.querySelector('iframe')!
    expect(frame.src).toContain('https://player.twitch.tv/?channel=sidscompetitiverounds&parent=localhost')
    expect(frame).toHaveAttribute('title', 'Ranked night on Twitch')
    expect(screen.queryByRole('button', { name: /watch here/i })).toBeNull()
    expect(screen.getByText('Ranked night')).toBeInTheDocument()
  })

  it('uses YouTube privacy-enhanced mode', async () => {
    mockHub({ '/stream': env({ live: { platform: 'youtube', title: 'Live', viewers: null, started_at: null, url: 'https://www.youtube.com/watch?v=v9', embed: { kind: 'youtube', videoId: 'v9' } }, recent, links }) })
    renderApp(<StreamCard />)
    expect(await screen.findByText('YouTube')).toHaveClass('stream-meta')
    await userEvent.click(await screen.findByRole('button', { name: 'Watch here: Live' }))
    expect(document.querySelector('iframe')!.src).toBe('https://www.youtube-nocookie.com/embed/v9?autoplay=1')
  })

  it('stays hidden when offline, and lists recent broadcasts instead', async () => {
    mockHub({ '/stream': env({ live: null, recent, links }) })
    renderApp(
      <>
        <StreamCard />
        <RecentBroadcasts />
      </>,
    )
    expect(await screen.findByRole('link', { name: 'Spirit vs galaxy ice' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=v1')
    expect(screen.queryByText(/live on stream/i)).toBeNull()
  })
})
