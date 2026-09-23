// The ROUNDS menu backdrop: big, faint low-poly shards over the teal gradient. Fixed to the viewport so
// content scrolls over it like the game's menu. Tints come from --facet-light / --facet-dark / --facet-deep
// (class l / d / x), so the same geometry serves the dark theme and Mist.
const SHARDS: Array<[cls: 'l' | 'd' | 'x', points: string]> = [
  ['l', '0,0 420,0 180,300'],
  ['d', '420,0 860,0 600,220'],
  ['l', '860,0 1600,0 1600,120 1180,210'],
  ['x', '0,300 180,300 0,620'],
  ['d', '180,300 600,220 470,560'],
  ['l', '600,220 1180,210 900,470'],
  ['d', '1180,210 1600,120 1600,520 1380,430'],
  ['x', '900,470 1380,430 1160,760'],
  ['l', '470,560 900,470 760,820'],
  ['d', '0,620 470,560 260,1000 0,1000'],
  ['l', '1380,430 1600,520 1600,900'],
  ['x', '760,820 1160,760 1080,1000 640,1000'],
  ['l', '1160,760 1600,900 1600,1000 1080,1000'],
  ['d', '260,1000 470,560 640,1000'],
]

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
        {SHARDS.map(([cls, points]) => (
          <polygon key={points} className={cls} points={points} />
        ))}
      </svg>
    </div>
  )
}
