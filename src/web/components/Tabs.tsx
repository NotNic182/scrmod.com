import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'

export interface Tab {
  id: string
  label: string
}

/** Keeps the selected item of a sideways-scrolling strip in view (deep links land on tabs past the edge on phones). */
export function useKeepActiveInView(ref: RefObject<HTMLElement | null>, selector: string, dep: unknown) {
  useEffect(() => {
    const strip = ref.current
    const el = strip?.querySelector<HTMLElement>(selector)
    if (!strip || !el || strip.scrollWidth <= strip.clientWidth) return
    strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2 })
  }, [ref, selector, dep])
}

const tabId = (panelId: string, id: string) => `${panelId}-tab-${id}`

/**
 * WAI-ARIA tabs with automatic activation: one Tab stop for the whole strip, arrows / Home / End move between
 * tabs. `panelId` ties the strip to its <TabPanel>.
 */
export function Tabs({ tabs, value, onChange, panelId, label }: { tabs: Tab[]; value: string; onChange: (id: string) => void; panelId: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useKeepActiveInView(ref, '[aria-selected="true"]', value)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === value)
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const target = tabs[(next + tabs.length) % tabs.length]
    onChange(target.id)
    document.getElementById(tabId(panelId, target.id))?.focus()
  }

  return (
    <div className="tabs" role="tablist" aria-label={label} ref={ref} onKeyDown={onKeyDown}>
      {tabs.map((t) => {
        const selected = t.id === value
        return (
          <button key={t.id} id={tabId(panelId, t.id)} role="tab" aria-selected={selected} aria-controls={panelId} tabIndex={selected ? 0 : -1} onClick={() => onChange(t.id)}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ id, value, children }: { id: string; value: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={id} aria-labelledby={tabId(id, value)}>
      {children}
    </div>
  )
}
