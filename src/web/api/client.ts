export class HubError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`hub responded ${status}`)
    this.name = 'HubError'
  }
}

/** Base path without trailing slash: '' at the root, '/hub' under BASE_PATH=/hub. */
export const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

/**
 * index.html starts the first page's main requests while the app is still downloading and leaves them here,
 * keyed by the path hubGet() will ask for. Each one answers a single GET; a failed one is retried normally.
 */
function takeEarly(path: string): Promise<Response> | undefined {
  const early = (window as { __scrEarly?: Record<string, Promise<Response>> }).__scrEarly
  const res = early?.[path]
  if (res) delete early[path]
  return res
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const go = () =>
    fetch(`${BASE}/api${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
      credentials: 'same-origin',
    })
  const early = init.method === 'GET' ? takeEarly(path) : undefined
  const res = await (early ? early.catch(go) : go())
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new HubError(res.status, body)
  return body as T
}

export function hubGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

export function hubPost<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'POST' })
}

/** Auth endpoints live beside /api, not under it. */
export function authUrl(path: string): string {
  return `${BASE}/auth${path}`
}
