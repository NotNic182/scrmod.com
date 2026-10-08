export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {hint ? <div className="faint empty-hint">{hint}</div> : null}
    </div>
  )
}
