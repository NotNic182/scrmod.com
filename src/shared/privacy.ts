// Spec 6.4. Pure functions; the server applies them before any profile-shaped
// object leaves, so the frontend never receives private fields.

type Obj = Record<string, unknown>

const PROFILE_ALWAYS_DROP = ['discord_id', 'discord_username', 'appear_offline', 'hide_gold'] as const
const PROFILE_GOLD_FIELDS = ['gold_earned', 'gold_spent', 'bet_gold_net'] as const

export function maskProfile(p: Obj): Obj {
  const out: Obj = { ...p }
  const hideGold = p.hide_gold === true
  const showDiscord = p.show_discord === true
  for (const k of PROFILE_ALWAYS_DROP) delete out[k]
  if (!showDiscord) delete out.discord_display_name
  if (hideGold) for (const k of PROFILE_GOLD_FIELDS) delete out[k]
  out.gold_hidden = hideGold
  return out
}

export function maskRecentSeries(s: Obj): Obj {
  const out: Obj = { ...s }
  delete out.p1_discord_id
  delete out.p2_discord_id
  return out
}

export function maskChatMessage(m: Obj): Obj {
  const out: Obj = { ...m }
  delete out.discord_id
  return out
}

const SLIM_DROP = /(_timeline|_timelines|_end_stats|point_times)$/

/** Drops the per-second telemetry strings that make a match row several KB. */
export function slimMatch(m: Obj): Obj {
  const out: Obj = {}
  for (const [k, v] of Object.entries(m)) if (!SLIM_DROP.test(k)) out[k] = v
  return out
}
