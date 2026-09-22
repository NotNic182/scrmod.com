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

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init.headers ?? {}) },
    credentials: 'same-origin',
  })
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
