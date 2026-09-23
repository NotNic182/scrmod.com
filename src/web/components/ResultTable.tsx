import type { MultimodeEntry } from '../../shared/api-types'
import { relTime, signed } from '../lib/format'

/** The API has called the 1v2 mode both "ovt" and "1v2"; the site calls it 1v2. */
export const modeOf = (e: Pick<MultimodeEntry, 'mode'>): string => (e.mode === 'ovt' ? '1v2' : e.mode)

const MODE_LABEL: Record<string, string> = { '1v1': '1v1', '2v2': '2v2', ffa: 'FFA', '1v2': '1v2' }

function Change({ n }: { n: number | null | undefined }) {
  if (n === null || n === undefined) return null
  return <span className={`tnum change ${n >= 0 ? 'good' : 'bad'}`}>{signed(n, 1)}</span>
}

function ResultRow({ e }: { e: MultimodeEntry }) {
  return (
    <tr role="row">
      <td role="cell">
        <span className="chip">{MODE_LABEL[modeOf(e)] ?? modeOf(e)}</span>
      </td>
      <td role="cell">
        <strong>
          <bdi>{e.left_label}</bdi>
        </strong>
        <Change n={e.left_rating_change} />
      </td>
      <td role="cell" className="tnum score">
        {e.score}
      </td>
      <td role="cell" className="against">
        <bdi>{e.right_label}</bdi>
        <Change n={e.right_rating_change} />
      </td>
      <td role="cell" className="faint when">
        {relTime(e.ended_at)}
      </td>
    </tr>
  )
}

/**
 * The mixed-mode results feed (Home and Results). It reads as a list, so the column names are there for screen
 * readers only: without them a row is five unlabelled cells. In a narrow card each row stacks onto two lines
 * (see .feed in base.css); the explicit roles keep it a table for screen readers once rows are display: grid.
 */
export function ResultTable({ rows }: { rows: MultimodeEntry[] }) {
  return (
    <div className="table-wrap feed-wrap">
      <table className="t feed" role="table">
        <thead className="sr-head" role="rowgroup">
          <tr role="row">
            {['Mode', 'Winner', 'Score', 'Against', 'When'].map((h) => (
              <th key={h} scope="col" role="columnheader">
                <span className="sr-only">{h}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((e) => (
            <ResultRow key={`${e.mode}-${e.id}`} e={e} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
