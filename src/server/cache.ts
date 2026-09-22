export interface CacheEntry<T> {
  value: T
  fetched_at: number // epoch ms
}

export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | undefined>
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>
  size(): number
}

/** LRU in-memory store. Node uses it directly; the Worker layers the Cache API on top. */
export class MemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, CacheEntry<unknown>>()

  constructor(private readonly max = 1000) {}

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const e = this.map.get(key) as CacheEntry<T> | undefined
    if (e) {
      this.map.delete(key)
      this.map.set(key, e)
    }
    return e
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.map.delete(key)
    this.map.set(key, entry)
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }

  size(): number {
    return this.map.size
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
  REF: { ttlMs: 600_000, staleMs: 3_600_000 },
} as const satisfies Record<string, TtlSpec>

export interface CachedResult<T> {
  value: T
  fetched_at: number
  stale: boolean
}

export type Background = (p: Promise<unknown>) => void

/**
 * Fresh within ttl; stale-while-revalidate within ttl+stale; single-flight loads;
 * stale-on-error at any age (spec 6.3).
 */
export class Cache {
  private readonly inflight = new Map<string, Promise<CacheEntry<unknown>>>()
  /** Used when a caller passes no `background`. Swallows rejections. */
  defaultBackground: Background = (p) => {
    p.catch(() => {})
  }

  constructor(
    private readonly store: CacheStore,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async get<T>(
    key: string,
    spec: TtlSpec,
    loader: () => Promise<T>,
    background: Background = this.defaultBackground,
  ): Promise<CachedResult<T>> {
    const entry = await this.store.get<T>(key)
    const age = entry ? this.now() - entry.fetched_at : Number.POSITIVE_INFINITY
    if (entry && age < spec.ttlMs) {
      return { value: entry.value, fetched_at: entry.fetched_at, stale: false }
    }
    if (entry && age < spec.ttlMs + spec.staleMs) {
      background(this.refresh(key, loader).catch(() => undefined))
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
}
