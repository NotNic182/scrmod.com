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

export interface UpstreamOptions {
  baseUrl: string
  userAgent: string
  internalKey?: string
  version: ModVersionSource
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxConcurrent?: number
}

/** Allowlisted, header-stamped, concurrency-capped JSON client for Sid's API (spec 6.2). */
export class Upstream {
  private active = 0
  private readonly waiters: Array<() => void> = []

  constructor(private readonly opts: UpstreamOptions) {}

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
        await this.opts.version.refresh()
        res = await this.doFetch(url)
      }
      if (!res.ok) {
        let body: unknown
        try {
          body = await res.json()
        } catch {
          body = undefined
        }
        throw new UpstreamError(res.status, path, body)
      }
      return (await res.json()) as T
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
    return f(url, { headers: await this.headers(), signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000) })
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
