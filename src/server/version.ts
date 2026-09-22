export interface VersionState {
  version: string | null
  fetched_at: string | null
  source: 'override' | 'discovered' | 'none'
}

export interface ModVersionSourceOptions {
  baseUrl: string
  userAgent: string
  override?: string
  fetchImpl?: typeof fetch
  refreshMs?: number
  now?: () => number
  timeoutMs?: number
}

/**
 * Discovers the mod version the upstream currently expects (spec 6.2).
 * `current()` serves a cached value for refreshMs (default 10 min); `refresh()` forces
 * a fetch and coalesces concurrent callers. `current()` keeps serving the last value
 * when a refresh fails; `refresh()` itself rejects.
 */
export class ModVersionSource {
  private version: string | null
  private fetchedAt: number | null = null
  private inflight: Promise<string> | null = null

  constructor(private readonly opts: ModVersionSourceOptions) {
    this.version = opts.override ?? null
  }

  private now(): number {
    return (this.opts.now ?? Date.now)()
  }

  async current(): Promise<string> {
    if (this.opts.override) return this.opts.override
    const refreshMs = this.opts.refreshMs ?? 600_000
    if (this.version && this.fetchedAt !== null && this.now() - this.fetchedAt < refreshMs) {
      return this.version
    }
    try {
      return await this.refresh()
    } catch (err) {
      if (this.version) return this.version
      throw err
    }
  }

  refresh(): Promise<string> {
    if (this.opts.override) return Promise.resolve(this.opts.override)
    if (this.inflight) return this.inflight
    this.inflight = (async () => {
      try {
        const f = this.opts.fetchImpl ?? fetch
        const res = await f(`${this.opts.baseUrl}/api/v1/mod-version`, {
          headers: { 'User-Agent': this.opts.userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000),
        })
        if (!res.ok) throw new Error(`mod-version responded ${res.status}`)
        const body = (await res.json()) as { version?: string; min_version?: string }
        const v = body.version || body.min_version
        if (!v) throw new Error('mod-version: body has no version')
        this.version = v
        this.fetchedAt = this.now()
        return v
      } finally {
        this.inflight = null
      }
    })()
    return this.inflight
  }

  state(): VersionState {
    if (this.opts.override) return { version: this.opts.override, fetched_at: null, source: 'override' }
    if (this.version) {
      return {
        version: this.version,
        fetched_at: this.fetchedAt === null ? null : new Date(this.fetchedAt).toISOString(),
        source: 'discovered',
      }
    }
    return { version: null, fetched_at: null, source: 'none' }
  }
}
