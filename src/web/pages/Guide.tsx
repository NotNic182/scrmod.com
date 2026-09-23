import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { GUIDE, GUIDE_CHECKED, GUIDE_INTRO, GUIDE_MOD_VERSION, GUIDE_TITLE, type GuideBlock, type GuideInline } from '../../shared/guide'
import { pageMeta } from '../../shared/seo'
import { useTitle } from '../lib/title'

function Inline({ parts }: { parts: GuideInline[] }) {
  return (
    <>
      {parts.map((p, i): ReactNode => {
        if (typeof p === 'string') return <Fragment key={i}>{p}</Fragment>
        if ('href' in p)
          return p.href.startsWith('/') ? (
            <Link key={i} to={p.href}>
              {p.text}
            </Link>
          ) : (
            <a key={i} href={p.href} rel="noopener">
              {p.text}
            </a>
          )
        if ('code' in p) return <code key={i}>{p.code}</code>
        return <strong key={i}>{p.strong}</strong>
      })}
    </>
  )
}

function Block({ b }: { b: GuideBlock }) {
  if (b.type === 'p')
    return (
      <p>
        <Inline parts={b.content} />
      </p>
    )
  if (b.type === 'table')
    return (
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>{b.head[0]}</th>
              <th>{b.head[1]}</th>
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r) => (
              <tr key={r[0]}>
                <td>{r[0]}</td>
                <td>{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  const List = b.type
  return (
    <List className="prose">
      {b.items.map((item, i) => (
        <li key={i}>
          <Inline parts={item} />
        </li>
      ))}
    </List>
  )
}

/** How to install Sid's Competitive Rounds and play ranked: the same content the server renders for crawlers. */
export function Guide() {
  useTitle(pageMeta({ kind: 'guide' }).title)
  const checked = new Date(`${GUIDE_CHECKED}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <>
      <h1>{GUIDE_TITLE}</h1>
      <p className="page-intro">
        <Inline parts={GUIDE_INTRO} />
      </p>
      {GUIDE.map((s) => (
        <section key={s.id} className="card guide" id={s.id} aria-labelledby={`${s.id}-h`}>
          <h2 id={`${s.id}-h`}>{s.heading}</h2>
          {s.blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
        </section>
      ))}
      <p className="faint">
        Checked against mod v{GUIDE_MOD_VERSION} on {checked}.
      </p>
    </>
  )
}
