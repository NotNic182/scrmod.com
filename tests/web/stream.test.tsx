import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './helpers/render'
import { mockHub, env } from './helpers/mockHub'
import { RecentBroadcasts, StreamCard } from '../../src/web/components/Stream'

const links = { twitch: 'https://www.twitch.tv/sidscompetitiverounds', youtube: 'https://www.youtube.com/@SidsCompetitiveRounds' }
const recent = [{ title: 'Spirit vs galaxy ice', url: 'https://www.youtube.com/watch?v=v1', videoId: 'v1', published_at: '2026-09-23T07:06:15Z' }]

describe('stream', () => {
  it('shows a live Twitch stream but loads no player until play is pressed', async () => {
    mockHub({ '/stream': env({ live: { platform: 'twitch', title: 'Ranked night', viewers: 42, started_at: null, url: links.twitch, embed: { kind: 'twitch', channel: 'sidscompetitiverounds' } }, recent: [], links }) })
    renderApp(<StreamCard />)
    const play = await screen.findByRole('button', { name: /watch ranked night here/i })
    expect(screen.getByText(/Twitch · 42 watching/)).toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
    await userEvent.click(play)
    const frame = document.querySelector('iframe')!
    expect(frame.src).toContain('https://player.twitch.tv/?channel=sidscompetitiverounds&parent=localhost')
    expect(frame).toHaveAttribute('title', 'Ranked night on Twitch')
  })

  it('uses YouTube privacy-enhanced mode', async () => {
    mockHub({ '/stream': env({ live: { platform: 'youtube', title: 'Live', viewers: null, started_at: null, url: 'https://www.youtube.com/watch?v=v9', embed: { kind: 'youtube', videoId: 'v9' } }, recent, links }) })
    renderApp(<StreamCard />)
    await userEvent.click(await screen.findByRole('button', { name: /watch live here/i }))
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
