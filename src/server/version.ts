export interface VersionState {
  version: string | null
  min_version: string | null
  fetched_at: string | null
  source: 'override' | 'discovered' | 'none'
}

export interface ModVersionSourceOptions {
  baseUrl: string
  userAgent: string
  override?: string
  fetchImpl?: typeof fetch
  refreshMs?: number
  /** How long `current()` stays quiet after a failed refresh (default 30 s). */
  retryMs?: number
  now?: () => number
  timeoutMs?: number
}

/**
 * Discovers the mod version the upstream currently expects (spec 6.2).
 * `current()` serves a cached value for refreshMs (default 10 min); `refresh()` forces
 * a fetch and coalesces concurrent callers. `current()` keeps serving the last value
 * when a refresh fails and then backs off for retryMs before trying again;
 * `refresh()` itself always tries, and rejects.
 */
export class ModVersionSource {
  private version: string | null
  private minVersion: string | null = null
  private fetchedAt: number | null = null
  private inflight: Promise<string> | null = null
  private nextRetryAt: number | null = null
  private lastError: unknown = null

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
    if (this.nextRetryAt !== null && this.now() < this.nextRetryAt) {
      // A refresh just failed: do not hammer /mod-version once per request.
      if (this.version) return this.version
      throw this.lastError instanceof Error ? this.lastError : new Error('mod-version unavailable')
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
        this.minVersion = body.min_version ?? null
        this.fetchedAt = this.now()
        this.nextRetryAt = null
        this.lastError = null
        return v
      } catch (err) {
        this.nextRetryAt = this.now() + (this.opts.retryMs ?? 30_000)
        this.lastError = err
        throw err
      } finally {
        this.inflight = null
      }
    })()
    return this.inflight
  }

  state(): VersionState {
    if (this.opts.override) {
      return { version: this.opts.override, min_version: null, fetched_at: null, source: 'override' }
    }
    if (this.version) {
      return {
        version: this.version,
        min_version: this.minVersion,
        fetched_at: this.fetchedAt === null ? null : new Date(this.fetchedAt).toISOString(),
        source: 'discovered',
      }
    }
    return { version: null, min_version: null, fetched_at: null, source: 'none' }
  }
}
