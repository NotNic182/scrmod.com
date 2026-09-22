export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <div>{title}</div>
      {hint ? <div className="faint">{hint}</div> : null}
    </div>
  )
}
