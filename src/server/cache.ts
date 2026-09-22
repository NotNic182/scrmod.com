export interface CacheEntry<T> {
  value: T
  fetched_at: number // epoch ms
}

export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | undefined>
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>
  size(): number
  /** Approximate bytes held, when the store can measure them. */
  bytes?(): number
}

/** Approximate JSON size of a cached value; unserialisable values count as free. */
function approxBytes(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0
  } catch {
    return 0
  }
}

/** LRU in-memory store, bounded both by entry count and by an approximate byte budget. */
export class MemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, { entry: CacheEntry<unknown>; bytes: number }>()
  private total = 0

  constructor(
    private readonly max = 1000,
    private readonly maxBytes = 64 * 1024 * 1024,
  ) {}

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const held = this.map.get(key)
    if (!held) return undefined
    this.map.delete(key)
    this.map.set(key, held)
    return held.entry as CacheEntry<T>
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.drop(key)
    const bytes = approxBytes(entry.value)
    this.map.set(key, { entry, bytes })
    this.total += bytes
    while (this.map.size > this.max || this.total > this.maxBytes) {
      const oldest = this.map.keys().next().value
      // One entry larger than the whole budget stays: the count bound still caps growth.
      if (oldest === undefined || oldest === key) break
      this.drop(oldest)
    }
  }

  size(): number {
    return this.map.size
  }

  bytes(): number {
    return this.total
  }

  private drop(key: string): void {
    const held = this.map.get(key)
    if (!held) return
    this.total -= held.bytes
    this.map.delete(key)
  }
}

export interface TtlSpec {
  ttlMs: number
  staleMs: number
}

/** Spec 6.1 cache classes. */
export const TTL = {
  LIVE: { ttlMs: 10_000, staleMs: 60_000 },
  BOARD: { ttlMs: 30_000, staleMs: 120_000 },
  RESULTS: { ttlMs: 20_000, staleMs: 120_000 },
  PLAYER: { ttlMs: 60_000, staleMs: 300_000 },
  TOURNAMENT: { ttlMs: 30_000, staleMs: 300_000 },
  REF: { ttlMs: 600_000, staleMs: 3_600_000 },
} as const satisfies Record<string, TtlSpec>

export interface CachedResult<T> {
  value: T
  fetched_at: number
  stale: boolean
}

/**
 * Fresh within ttl; stale-while-revalidate within ttl+stale; single-flight loads;
 * stale-on-error at any age (spec 6.3).
 */
export class Cache {
  private readonly inflight = new Map<string, Promise<CacheEntry<unknown>>>()

  constructor(
    private readonly store: CacheStore,
    private readonly now: () => number = () => Date.now(),
    /** Test hook: receives every fire-and-forget background refresh, already caught. */
    private readonly onBackground?: (p: Promise<unknown>) => void,
  ) {}

  async get<T>(key: string, spec: TtlSpec, loader: () => Promise<T>): Promise<CachedResult<T>> {
    const entry = await this.store.get<T>(key)
    const age = entry ? this.now() - entry.fetched_at : Number.POSITIVE_INFINITY
    if (entry && age < spec.ttlMs) {
      return { value: entry.value, fetched_at: entry.fetched_at, stale: false }
    }
    if (entry && age < spec.ttlMs + spec.staleMs) {
      this.background(this.refresh(key, loader))
      return { value: entry.value, fetched_at: entry.fetched_at, stale: true }
    }
    try {
      const fresh = await this.refresh(key, loader)
      return { value: fresh.value, fetched_at: fresh.fetched_at, stale: false }
    } catch (err) {
      if (entry) return { value: entry.value, fetched_at: entry.fetched_at, stale: true }
      throw err
    }
  }

  /** Background refreshes are fire-and-forget: a failure leaves the stale entry in place. */
  private background(p: Promise<unknown>): void {
    const settled = p.catch(() => undefined)
    this.onBackground?.(settled)
  }

  private refresh<T>(key: string, loader: () => Promise<T>): Promise<CacheEntry<T>> {
    const existing = this.inflight.get(key) as Promise<CacheEntry<T>> | undefined
    if (existing) return existing
    const p = (async () => {
      try {
        const value = await loader()
        const entry: CacheEntry<T> = { value, fetched_at: this.now() }
        await this.store.set(key, entry)
        return entry
      } finally {
        this.inflight.delete(key)
      }
    })()
    this.inflight.set(key, p as Promise<CacheEntry<unknown>>)
    return p
  }

  size(): number {
    return this.store.size()
  }

  bytes(): number | undefined {
    return this.store.bytes?.()
  }
}
