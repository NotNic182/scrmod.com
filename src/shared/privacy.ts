// Spec 6.4 and 12. Pure functions; the server applies them before any object leaves,
// so the frontend never receives private fields.

type Obj = Record<string, unknown>

const PROFILE_ALWAYS_DROP = ['discord_id', 'discord_username', 'appear_offline', 'hide_gold'] as const
const PROFILE_GOLD_FIELDS = ['gold_earned', 'gold_spent', 'bet_gold_net'] as const
/**
 * Casual games stay off profiles (Sid's call). Every profile field about them has "casual" as a word in its name
 * (casual_wins, best_casual_streak, h2h_casual_losses, casual_dc_count, ...), including ones the upstream adds later.
 */
const CASUAL_FIELD = /(^|_)casual(_|$)/

/** Keys no hub response may carry, in whatever shape they turn up. */
export const PRIVATE_KEYS: ReadonlySet<string> = new Set([
  'discord_id',
  'discord_username',
  'hide_gold',
  'appear_offline',
  'p1_discord_id',
  'p2_discord_id',
])

/** The one key a profile loader must keep back, because `maskProfile` reads it later. */
export const KEEP_FOR_PROFILE_MASK: ReadonlySet<string> = new Set(['hide_gold'])

/**
 * Recursive key-drop over objects and arrays: the enforcement point for shapes no
 * shape-specific mask has looked at (spec 12). `discord_display_name` survives here;
 * `maskProfile` still decides it from `show_discord`.
 *
 * `keep` leaves named keys in place for a mask that runs afterwards. Only the profile
 * loader uses it, so `maskProfile` can still read `hide_gold` out of a cached row.
 */
export function scrubPrivate<T>(value: T, keep?: ReadonlySet<string>): T {
  if (Array.isArray(value)) return value.map((v) => scrubPrivate(v, keep)) as unknown as T
  if (value === null || typeof value !== 'object') return value
  const out: Obj = {}
  for (const [k, v] of Object.entries(value as Obj)) {
    if (PRIVATE_KEYS.has(k) && !keep?.has(k)) continue
    out[k] = scrubPrivate(v, keep)
  }
  return out as T
}

export function maskProfile<T extends object>(p: T): Obj {
  const src = p as Obj
  const out: Obj = { ...src }
  const hideGold = src.hide_gold === true
  const showDiscord = src.show_discord === true
  for (const k of PROFILE_ALWAYS_DROP) delete out[k]
  for (const k of Object.keys(out)) if (CASUAL_FIELD.test(k)) delete out[k]
  if (Array.isArray(src.recent_form)) out.recent_form = src.recent_form.filter((f) => (f as Obj | null)?.ranked === true)
  if (!showDiscord) delete out.discord_display_name
  if (hideGold) for (const k of PROFILE_GOLD_FIELDS) delete out[k]
  out.gold_hidden = hideGold
  return out
}

/** Match history lists ranked games only; a row the API doesn't mark as ranked counts as casual. */
export function isRankedMatch(m: object): boolean {
  return (m as Obj).is_ranked === true
}

/** The match summary without its casual count: the total becomes the ranked total. */
export function rankedSummary<T extends object>(s: T): Obj {
  const out: Obj = { ...(s as Obj) }
  delete out.casual_matches
  if (typeof out.ranked_matches === 'number') out.total = out.ranked_matches
  return out
}

export function maskRecentSeries<T extends object>(s: T): Omit<T, 'p1_discord_id' | 'p2_discord_id'> {
  const out: Obj = { ...(s as Obj) }
  delete out.p1_discord_id
  delete out.p2_discord_id
  return out as Omit<T, 'p1_discord_id' | 'p2_discord_id'>
}

export function maskChatMessage<T extends object>(m: T): Omit<T, 'discord_id'> {
  const out: Obj = { ...(m as Obj) }
  delete out.discord_id
  return out as Omit<T, 'discord_id'>
}

const SLIM_DROP = /(_timeline|_timelines|_end_stats|point_times)$/

/** Drops the per-second telemetry strings that make a match row several KB. */
export function slimMatch<T extends object>(m: T): Partial<T> {
  const out: Obj = {}
  for (const [k, v] of Object.entries(m as Obj)) if (!SLIM_DROP.test(k)) out[k] = v
  return out as Partial<T>
}
