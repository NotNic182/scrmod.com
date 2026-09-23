import { LINKS } from './links'

/** When the guide's facts were last checked against the mod's README and Thunderstore page. */
export const GUIDE_CHECKED = '2026-09-23'
export const GUIDE_MOD_VERSION = '1.40.3'

export type GuideInline = string | { text: string; href: string } | { code: string } | { strong: string }
export type GuideBlock =
  | { type: 'p'; content: GuideInline[] }
  | { type: 'ul'; items: GuideInline[][] }
  | { type: 'ol'; items: GuideInline[][] }
  | { type: 'table'; head: [string, string]; rows: Array<[string, string]> }
export interface GuideSection {
  id: string
  heading: string
  blocks: GuideBlock[]
}

export const GUIDE_TITLE = 'How to play ranked ROUNDS'

export const GUIDE_INTRO: GuideInline[] = [
  { strong: "Sid's Competitive Rounds" },
  ' is the ranked mod for ROUNDS: 1v1 and 2v2 rating ladders, free-for-all, weekly tournaments, a shop and in-game betting, run for the Competitive Rounds Discord community. Here is how to install it and start playing ranked.',
]

export const GUIDE: GuideSection[] = [
  {
    id: 'before',
    heading: 'Before you install',
    blocks: [
      {
        type: 'ul',
        items: [
          ['It needs ROUNDS ', { strong: 'v1.1.2' }, ', the "Default Public Version" on Steam. Older versions and beta branches are not supported.'],
          ["It doesn't run alongside other BepInEx mods: if it finds any, it switches itself off. Keep other mods in a separate profile (see below)."],
          ['BepInEx 5.4.1901, the mod loader it needs, is installed for you.'],
        ],
      },
    ],
  },
  {
    id: 'install-r2modman',
    heading: 'Install with r2modman or Thunderstore Mod Manager',
    blocks: [
      {
        type: 'ol',
        items: [
          ['Install ', { strong: 'r2modman' }, ' or the ', { strong: 'Thunderstore Mod Manager' }, '.'],
          ['Choose ROUNDS and create a profile for ranked play.'],
          ['Search the online mods for "Sid\'s Competitive Rounds" and install it.'],
          ['Launch the game with ', { strong: 'Start modded' }, '.'],
        ],
      },
      { type: 'p', content: ['The mod\'s page: ', { text: "Sid's Competitive Rounds on Thunderstore", href: LINKS.thunderstore }, '.'] },
    ],
  },
  {
    id: 'install-windows',
    heading: 'Or use the Windows installer',
    blocks: [
      {
        type: 'ol',
        items: [
          ['Join the ', { text: 'Competitive Rounds Discord', href: LINKS.discord }, ' and download ', { code: 'CompetitiveRoundsInstaller.exe' }, '.'],
          ['Run it: it finds ROUNDS and installs BepInEx if needed.'],
          ['Launch ROUNDS. Updates install themselves.'],
        ],
      },
    ],
  },
  {
    id: 'ranked',
    heading: 'Playing ranked',
    blocks: [
      { type: 'p', content: ['Press ', { strong: 'F5' }, ' in game to open the competitive overlay and queue.'] },
      {
        type: 'ul',
        items: [
          [{ strong: '1v1' }, ': best-of-3 series on a Glicko-2 rating ladder.'],
          [{ strong: '2v2' }, ': best-of-3 series on its own Glicko-2 ladder.'],
          [{ strong: 'Free-for-all' }, ': 3 to 10 players; the first to 5 points wins.'],
          [{ strong: '1v2' }, ': one player against a duo, an unranked beta.'],
        ],
      },
      {
        type: 'p',
        content: [
          'Ratings map to 25 rank tiers, from Beginner I to Grand Master V. Your rating, record and match history appear on the ',
          { text: 'SCRmod leaderboards', href: '/leaderboards/1v1' },
          '.',
        ],
      },
    ],
  },
  {
    id: 'more',
    heading: 'Tournaments, betting, the shop and achievements',
    blocks: [
      {
        type: 'ul',
        items: [
          ['Weekly and async tournaments: sign up, vote on the start time and play from the game (F5 → Tournaments). Brackets and past winners are on the ', { text: 'tournaments page', href: '/tournaments' }, '.'],
          ["Bet gold on live ranked series; the odds come from the players' ratings."],
          ['Spend the gold you win in the in-game shop.'],
          ['Earn 50 achievements, worth 100 to 1,000 gold each.'],
        ],
      },
    ],
  },
  {
    id: 'controls',
    heading: 'Controls',
    blocks: [
      {
        type: 'table',
        head: ['Key', 'What it does'],
        rows: [
          ['F5', 'Open or close the competitive overlay'],
          ['T', 'Chat, bridged to the Discord'],
          ['Esc', 'Close the overlay'],
          ['Tab', 'Live match scoreboard'],
        ],
      },
    ],
  },
  {
    id: 'other-mods',
    heading: 'Keeping other ROUNDS mods',
    blocks: [
      {
        type: 'p',
        content: ['Because the mod switches itself off when other BepInEx mods are present, keep ranked play and your other mods in separate r2modman profiles, and launch the one you want.'],
      },
    ],
  },
  {
    id: 'links',
    heading: 'Links',
    blocks: [
      {
        type: 'ul',
        items: [
          [{ text: 'Thunderstore', href: LINKS.thunderstore }, ': install and version history.'],
          [{ text: 'GitHub', href: LINKS.github }, ': source code and the full feature list.'],
          [{ text: 'Discord', href: LINKS.discord }, ': the community, tournaments and the Windows installer.'],
          [{ text: 'ROUNDS card win rates', href: '/cards' }, ': which cards win most in ranked play.'],
        ],
      },
    ],
  },
]
