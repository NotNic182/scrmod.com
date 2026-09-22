import { assertAllowed } from './allowlist'
import type { ModVersionSource } from './version'

export type Query = Record<string, string | number | boolean | undefined>

export class UpstreamError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: unknown = undefined,
  ) {
    super(`upstream responded ${status} for ${path}`)
    this.name = 'UpstreamError'
  }
}

export class UpstreamNetworkError extends Error {
  constructor(
    public readonly url: string,
    public readonly cause: unknown,
  ) {
    super(`upstream request failed for ${url}`)
    this.name = 'UpstreamNetworkError'
  }
}

export interface UpstreamOptions {
  baseUrl: string
  userAgent: string
  internalKey?: string
  version: ModVersionSource
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxConcurrent?: number
  now?: () => number
}

/** What `_status` reports about the version gate (spec 11). */
export interface UpstreamStats {
  last_426_at: string | null
  count_426: number
}

/** Allowlisted, header-stamped, concurrency-capped JSON client for Sid's API (spec 6.2). */
export class Upstream {
  private active = 0
  private readonly waiters: Array<() => void> = []
  private last426: number | null = null
  private count426 = 0

  constructor(private readonly opts: UpstreamOptions) {}

  stats(): UpstreamStats {
    return {
      last_426_at: this.last426 === null ? null : new Date(this.last426).toISOString(),
      count_426: this.count426,
    }
  }

  private now(): number {
    return (this.opts.now ?? Date.now)()
  }

  /** A version gate we could not get past: recorded so `_status` can surface it. */
  private gate426(path: string, body?: unknown): UpstreamError {
    this.count426++
    this.last426 = this.now()
    return new UpstreamError(426, path, body)
  }

  buildUrl(path: string, query?: Query): string {
    assertAllowed(path)
    const url = new URL(`${this.opts.baseUrl}/api/v1${path}`)
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
    return url.toString()
  }

  async getJson<T>(path: string, query?: Query): Promise<T> {
    const url = this.buildUrl(path, query)
    await this.acquire()
    try {
      let res = await this.doFetch(url)
      if (res.status === 426 && !this.opts.internalKey) {
        try {
          await this.opts.version.refresh()
        } catch {
          // /mod-version is down too: this is still the version gate, not a hub bug.
          throw this.gate426(path)
        }
        res = await this.doFetch(url)
      }
      if (!res.ok) {
        let body: unknown
        try {
          body = await res.json()
        } catch {
          body = undefined
        }
        if (res.status === 426) throw this.gate426(path, body)
        throw new UpstreamError(res.status, path, body)
      }
      try {
        return (await res.json()) as T
      } catch {
        // A 200 that is not JSON (a proxy error page, say) is an upstream fault, not a crash.
        throw new UpstreamError(502, path, 'invalid_json')
      }
    } finally {
      this.release()
    }
  }

  private async headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = { 'User-Agent': this.opts.userAgent, Accept: 'application/json' }
    if (this.opts.internalKey) h['X-Internal-Key'] = this.opts.internalKey
    else h['X-Mod-Version'] = await this.opts.version.current()
    return h
  }

  private async doFetch(url: string): Promise<Response> {
    const f = this.opts.fetchImpl ?? fetch
    try {
      return await f(url, { headers: await this.headers(), signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000) })
    } catch (err) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) throw err
      throw new UpstreamNetworkError(url, err)
    }
  }

  private acquire(): Promise<void> {
    const max = this.opts.maxConcurrent ?? 8
    if (this.active < max) {
      this.active++
      return Promise.resolve()
    }
    return new Promise((resolve) =>
      this.waiters.push(() => {
        this.active++
        resolve()
      }),
    )
  }

  private release(): void {
    this.active--
    const next = this.waiters.shift()
    if (next) next()
  }
}
