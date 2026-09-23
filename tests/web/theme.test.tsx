import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTheme } from '../../src/web/lib/theme'

const KEY = 'scrhub.theme'

/** A controllable operating-system color scheme behind window.matchMedia. */
function stubSystem(initial: 'light' | 'dark') {
  let scheme = initial
  const listeners = new Set<[string, (e: { matches: boolean; media: string }) => void]>()
  const matches = (q: string) => (q.includes('light') ? scheme === 'light' : q.includes('dark') ? scheme === 'dark' : false)
  const original = window.matchMedia
  window.matchMedia = ((q: string) => ({
    media: q,
    get matches() {
      return matches(q)
    },
    onchange: null,
    addEventListener: (_: string, l: (e: { matches: boolean; media: string }) => void) => listeners.add([q, l]),
    removeEventListener: (_: string, l: (e: { matches: boolean; media: string }) => void) => {
      for (const entry of listeners) if (entry[1] === l) listeners.delete(entry)
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia
  return {
    set(next: 'light' | 'dark') {
      scheme = next
      act(() => listeners.forEach(([q, l]) => l({ matches: matches(q), media: q })))
    },
    restore() {
      window.matchMedia = original
    },
  }
}

function Harness() {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle}>{theme}</button>
}

const applied = () => document.documentElement.dataset.theme

describe('theme', () => {
  let sys: ReturnType<typeof stubSystem> | null = null
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    sys?.restore()
    sys = null
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('a visitor who never chose follows the system, and nothing is saved', () => {
    sys = stubSystem('light')
    render(<Harness />)
    expect(applied()).toBe('light')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('the system switching mid-visit re-themes a visitor who never chose', () => {
    sys = stubSystem('dark')
    render(<Harness />)
    expect(applied()).toBe('dark')
    sys.set('light')
    expect(applied()).toBe('light')
    expect(screen.getByRole('button')).toHaveTextContent('light')
  })

  it('toggling away from the system saves the choice; toggling back to it clears the choice', async () => {
    sys = stubSystem('dark')
    render(<Harness />)
    await userEvent.click(screen.getByRole('button'))
    expect(applied()).toBe('light')
    expect(localStorage.getItem(KEY)).toBe('light')
    await userEvent.click(screen.getByRole('button'))
    expect(applied()).toBe('dark')
    expect(localStorage.getItem(KEY)).toBeNull()
    sys.set('light')
    expect(applied()).toBe('light')
  })

  it('a saved theme equal to the system is dropped, so the page follows the system again', () => {
    localStorage.setItem(KEY, 'dark')
    sys = stubSystem('dark')
    render(<Harness />)
    expect(localStorage.getItem(KEY)).toBeNull()
    sys.set('light')
    expect(applied()).toBe('light')
  })

  it('a saved choice that differs from the system is kept and outlasts system switches', () => {
    localStorage.setItem(KEY, 'light')
    sys = stubSystem('dark')
    render(<Harness />)
    expect(applied()).toBe('light')
    sys.set('light')
    sys.set('dark')
    expect(applied()).toBe('light')
    expect(localStorage.getItem(KEY)).toBe('light')
  })
})
