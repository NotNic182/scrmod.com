import { Link } from 'react-router'
import { TitleTag } from './TitleTag'

interface Props {
  steamId: string
  name: string
  title?: string | null
  titleColor?: string | null
  online?: boolean
  me?: boolean
  bold?: boolean
}

export function PlayerLink({ steamId, name, title, titleColor, online, me, bold }: Props) {
  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex' }}>
      {online !== undefined ? <span className={`dot${online ? ' on' : ''}`} aria-label={online ? 'online' : 'offline'} /> : null}
      <Link to={`/players/${steamId}`} style={{ fontWeight: bold || me ? 800 : 600 }}>
        {name}
        {me ? <span className="faint"> (you)</span> : null}
      </Link>
      <TitleTag title={title} color={titleColor} />
    </span>
  )
}
