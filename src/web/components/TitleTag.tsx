import type { CSSProperties } from 'react'

export function TitleTag({ title, color }: { title?: string | null; color?: string | null }) {
  if (!title) return null
  return (
    <span className="chip api-color title-tag" style={{ '--api-c': color || undefined } as CSSProperties}>
      {title}
    </span>
  )
}
