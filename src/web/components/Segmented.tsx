export interface Segment<T extends string> {
  id: T
  label: string
}

/**
 * A filter over the data shown below it (not a switch between views, which is <Tabs>). One pressed button,
 * gold like every other selection in the app.
 */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: Segment<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
