import { useState, type ReactNode } from 'react'

/**
 * An expandable row (<details class="acc">). `children` is always there; `deferred` (the heavy part: game rows,
 * standings) is built the first time the row opens. Match history lists dozens of these, and building every closed
 * one up front tripled the page's DOM for rows nobody opened.
 */
export function Disclosure({ summary, children, deferred }: { summary: ReactNode; children?: ReactNode; deferred: () => ReactNode }) {
  const [opened, setOpened] = useState(false)
  return (
    <details className="acc" onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      {summary}
      {children}
      {opened ? deferred() : null}
    </details>
  )
}
