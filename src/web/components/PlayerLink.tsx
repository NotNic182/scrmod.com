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
    <span className="player">
      {online !== undefined ? <span className={`dot${online ? ' on' : ''}`} role="img" aria-label={online ? 'online' : 'offline'} title={online ? 'Online' : 'Offline'} /> : null}
      <Link to={`/players/${steamId}`} className="plink" style={{ fontWeight: bold || me ? 800 : 600 }}>
        {/* bdi: a right-to-left name (Arabic, Hebrew) must not reorder the "(you)" or numbers around it. */}
        <bdi>{name || 'Unnamed player'}</bdi>
        {me ? <span className="faint"> (you)</span> : null}
      </Link>
      <TitleTag title={title} color={titleColor} />
    </span>
  )
}
