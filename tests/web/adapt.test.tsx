import { useRef } from 'react'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IdentityMenu } from '../../src/web/components/IdentityMenu'
import { useKeepActiveInView } from '../../src/web/components/Tabs'
import { renderApp } from './helpers/render'
import { mockHub } from './helpers/mockHub'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('responsive interactions', () => {
  it('keeps profile search scrollable above the software keyboard and responds to viewport panning', async () => {
    const viewport = Object.assign(new EventTarget(), { height: 900, offsetTop: 0 })
    vi.stubGlobal('visualViewport', viewport)
    mockHub({ '/me': { data: { discord: null, player: null }, auth_enabled: true } })
    const { unmount } = renderApp(<IdentityMenu />)
    await userEvent.click(await screen.findByRole('button', { name: /find me/i }))
    const panel = screen.getByRole('region', { name: 'Profile options' })
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({ top: 64 } as DOMRect)
    act(() => viewport.dispatchEvent(new Event('resize')))
    expect(panel.style.getPropertyValue('--identity-space')).toBe('820px')
    expect(screen.getByRole('combobox')).toHaveFocus()

    viewport.height = 340
    act(() => viewport.dispatchEvent(new Event('resize')))
    expect(panel.style.getPropertyValue('--identity-space')).toBe('260px')
    viewport.offsetTop = 30
    act(() => viewport.dispatchEvent(new Event('scroll')))
    expect(panel.style.getPropertyValue('--identity-space')).toBe('290px')
    expect(screen.getByRole('link', { name: 'Sign in with Discord' })).toBeInTheDocument()

    const remove = vi.spyOn(viewport, 'removeEventListener')
    unmount()
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
  })

  it.each([true, false])('keeps a deep-linked tab visible after resizing (ResizeObserver: %s)', (withObserver) => {
    let width = 400
    let resize: ResizeObserverCallback | undefined
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', withObserver ? class {
      constructor(callback: ResizeObserverCallback) { resize = callback }
      observe() {}
      disconnect = disconnect
    } : undefined)
    const scrollTo = vi.fn()
    function Strip() {
      const ref = useRef<HTMLDivElement>(null)
      useKeepActiveInView(ref, '[aria-selected="true"]', 'last')
      return (
        <div ref={(node) => {
          ref.current = node
          if (!node) return
          Object.defineProperties(node, { clientWidth: { get: () => width }, scrollWidth: { value: 600 } })
          node.scrollTo = scrollTo
        }}>
          <span aria-selected="true" ref={(node) => {
            if (node) Object.defineProperties(node, { offsetLeft: { value: 200 }, offsetWidth: { value: 80 } })
          }}>Last tab</span>
        </div>
      )
    }
    const { unmount } = renderApp(<Strip />)
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 40 })
    width = 180
    act(() => {
      if (resize) resize([], {} as ResizeObserver)
      else window.dispatchEvent(new Event('resize'))
    })
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 150 })
    unmount()
    if (withObserver) expect(disconnect).toHaveBeenCalledOnce()
    scrollTo.mockClear()
    window.dispatchEvent(new Event('resize'))
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
