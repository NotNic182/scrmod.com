import { describe, it, expect } from 'vitest'
import { cardSlug, matchRoute, pageMeta, slugToName } from '../../src/shared/seo'
import { GUIDE, GUIDE_INTRO } from '../../src/shared/guide'

describe('cardSlug', () => {
  it('lowercases, strips accents and joins words with single dashes', () => {
    expect(cardSlug('Big Bullet')).toBe('big-bullet')
    expect(cardSlug('Glass Cannon!')).toBe('glass-cannon')
    expect(cardSlug('Défense')).toBe('defense')
    expect(cardSlug('  --A   B--  ')).toBe('a-b')
    expect(slugToName('big-bullet')).toBe('Big Bullet')
  })
})

describe('matchRoute', () => {
  it('knows every page and rejects everything else', () => {
    expect(matchRoute('/')).toEqual({ kind: 'home' })
    expect(matchRoute('/leaderboards')).toEqual({ kind: 'leaderboards-root' })
    expect(matchRoute('/leaderboards/1v2-duo/')).toEqual({ kind: 'leaderboard', mode: '1v2-duo' })
    expect(matchRoute('/leaderboards/3v3')).toEqual({ kind: 'not-found' })
    expect(matchRoute('/results')).toEqual({ kind: 'results' })
    expect(matchRoute('/tournaments')).toEqual({ kind: 'tournaments' })
    expect(matchRoute('/tournaments/0B7C0A6E-1F2D-4C5E-9A8B-7C6D5E4F3A2B')).toEqual({ kind: 'tournament', id: '0b7c0a6e-1f2d-4c5e-9a8b-7c6d5e4f3a2b' })
    expect(matchRoute('/tournaments/nope')).toEqual({ kind: 'not-found' })
    expect(matchRoute('/cards')).toEqual({ kind: 'cards' })
    expect(matchRoute('/cards/Big%20Bullet')).toEqual({ kind: 'card', slug: 'Big Bullet' })
    expect(matchRoute('/cards/%E0%A4%A')).toEqual({ kind: 'not-found' })
    expect(matchRoute('/guide')).toEqual({ kind: 'guide' })
    expect(matchRoute('/about')).toEqual({ kind: 'about' })
    expect(matchRoute('/players/76561199311926326')).toEqual({ kind: 'player', id: '76561199311926326' })
    expect(matchRoute('/players/123')).toEqual({ kind: 'not-found' })
    expect(matchRoute('/cards/a/b')).toEqual({ kind: 'not-found' })
    expect(matchRoute('/wp-admin')).toEqual({ kind: 'not-found' })
  })
})

describe('pageMeta', () => {
  it('writes the planned titles', () => {
    expect(pageMeta({ kind: 'home' }).title).toBe('SCRmod: ROUNDS ranked stats, live games and leaderboards')
    expect(pageMeta({ kind: 'leaderboard', mode: '2v2' }).title).toBe('ROUNDS 2v2 ranked leaderboard: top players by rating · SCRmod')
    expect(pageMeta({ kind: 'leaderboard', mode: '1v2-solo' }).title).toBe('ROUNDS 1v2 solo leaderboard: top players · SCRmod')
    expect(pageMeta({ kind: 'cards' }).title).toBe('ROUNDS card win rates: the best cards in ranked play · SCRmod')
    expect(pageMeta({ kind: 'guide' }).title).toBe("How to play ranked ROUNDS: install Sid's Competitive Rounds · SCRmod")
    expect(pageMeta({ kind: 'leaderboards-root' }).path).toBe('/leaderboards/1v1')
    expect(pageMeta({ kind: 'leaderboard', mode: 'zzz' }).index).toBe(false)
  })

  it('builds a card page from its facts, canonical slug included', () => {
    const m = pageMeta({ kind: 'card', slug: 'Big Bullet' }, { card: { name: 'Big Bullet', rarity: 'Common', win_rate: 0.523, times_picked: 1234, pass_rate: 0.31 } })
    expect(m.title).toBe('Big Bullet: ROUNDS card win rate and stats · SCRmod')
    expect(m.description).toBe("Big Bullet (Common) in ROUNDS: 52% win rate, picked 1,234 times and passed 31% of the time in Sid's Competitive Rounds ranked and casual games.")
    expect(m.path).toBe('/cards/big-bullet')
    expect(pageMeta({ kind: 'card', slug: 'big-bullet' }).title).toBe('Big Bullet: ROUNDS card win rate and stats · SCRmod')
  })

  it('keeps player pages out of the index and summarises them for link previews', () => {
    const m = pageMeta({ kind: 'player', id: '76561199311926326' }, { player: { display_name: 'NotNic', rating: 1101.8, rank_name: 'Beginner I', standing: 189, standing_population: 198, ranked_series_wins: 45, ranked_series_losses: 95 } })
    expect(m.title).toBe('NotNic: ROUNDS ranked stats · SCRmod')
    expect(m.description).toBe('1102 rating · Beginner I · #189 of 198 · 45-95 ranked series')
    expect(m.index).toBe(false)
    expect(m.ogType).toBe('profile')
    expect(pageMeta({ kind: 'player', id: '76561199311926326' }).title).toBe('Player: ROUNDS ranked stats · SCRmod')
  })

  it('gives every indexed page a 120-160 character description', () => {
    const pages = [{ kind: 'home' }, { kind: 'leaderboard', mode: '1v1' }, { kind: 'leaderboard', mode: '1v2' }, { kind: 'results' }, { kind: 'tournaments' }, { kind: 'cards' }, { kind: 'guide' }, { kind: 'about' }] as const
    for (const p of pages) {
      const m = pageMeta(p)
      expect(m.index).toBe(true)
      expect(m.description.length).toBeGreaterThanOrEqual(120)
      expect(m.description.length).toBeLessThanOrEqual(160)
    }
    // Card descriptions with facts
    const empMeta = pageMeta({ kind: 'card', slug: 'Emp' }, { card: { name: 'Emp', rarity: 'Rare', win_rate: 0.05, times_picked: 5, pass_rate: 0.05 } })
    expect(empMeta.index).toBe(true)
    expect(empMeta.description.length).toBeGreaterThanOrEqual(120)
    expect(empMeta.description.length).toBeLessThanOrEqual(160)
    const pristineMeta = pageMeta({ kind: 'card', slug: 'Pristine Perseverance' }, { card: { name: 'Pristine Perseverance', rarity: 'Uncommon', win_rate: 1, times_picked: 99999, pass_rate: 1 } })
    expect(pristineMeta.index).toBe(true)
    expect(pristineMeta.description.length).toBeGreaterThanOrEqual(120)
    expect(pristineMeta.description.length).toBeLessThanOrEqual(160)
    // Card descriptions without facts
    const empNoFacts = pageMeta({ kind: 'card', slug: 'emp' })
    expect(empNoFacts.index).toBe(true)
    expect(empNoFacts.description.length).toBeGreaterThanOrEqual(120)
    expect(empNoFacts.description.length).toBeLessThanOrEqual(160)
    const pristineNoFacts = pageMeta({ kind: 'card', slug: 'pristine-perseverance' })
    expect(pristineNoFacts.index).toBe(true)
    expect(pristineNoFacts.description.length).toBeGreaterThanOrEqual(120)
    expect(pristineNoFacts.description.length).toBeLessThanOrEqual(160)
    expect(pageMeta({ kind: 'not-found' })).toMatchObject({ index: false, path: null })
    expect(pageMeta({ kind: 'tournament', id: 'x' }).index).toBe(false)
  })
})

describe('guide content', () => {
  it('covers the planned sections and links to the mod', () => {
    expect(GUIDE.map((s) => s.id)).toEqual(['before', 'install-r2modman', 'install-windows', 'ranked', 'more', 'controls', 'other-mods', 'links'])
    const links = JSON.stringify([GUIDE_INTRO, GUIDE])
    expect(links).toContain('https://thunderstore.io/c/rounds/p/Team_Sid/SidsCompetitiveRounds/')
    expect(links).toContain('https://github.com/SidNDeed/SidsCompetitiveRounds')
    expect(links).toContain('https://discord.gg/4tsWadH6tc')
    expect(links).toContain('v1.1.2')
    expect(links).toContain('Grand Master V')
  })
})
