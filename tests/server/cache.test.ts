import { describe, it, expect, vi } from 'vitest'
import { Cache, MemoryCacheStore, TTL } from '../../src/server/cache'
import { deferred } from './helpers/fakeUpstream'

const SPEC = { ttlMs: 10_000, staleMs: 60_000 }

function make() {
  let now = 1_000_000
  const cache = new Cache(new MemoryCacheStore(), () => now)
  return { cache, tick: (ms: number) => (now += ms), now: () => now }
}

describe('Cache', () => {
  it('loads once and serves fresh within the TTL', async () => {
    const { cache, tick } = make()
    const loader = vi.fn(async () => ({ n: 1 }))
    const a = await cache.get('k', SPEC, loader)
    tick(9_999)
    const b = await cache.get('k', SPEC, loader)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(a).toMatchObject({ value: { n: 1 }, stale: false })
    expect(b).toMatchObject({ value: { n: 1 }, stale: false, fetched_at: 1_000_000 })
  })

  it('serves stale immediately inside the stale window and refreshes in the background', async () => {
    const { cache, tick } = make()
    let n = 0
    const loader = vi.fn(async () => ({ n: ++n }))
    const bg: Promise<unknown>[] = []
    await cache.get('k', SPEC, loader)
    tick(20_000)
    const r = await cache.get('k', SPEC, loader, (p) => bg.push(p))
    expect(r).toMatchObject({ value: { n: 1 }, stale: true })
    expect(bg.length).toBe(1)
    await Promise.all(bg)
    const r2 = await cache.get('k', SPEC, loader)
    expect(r2).toMatchObject({ value: { n: 2 }, stale: false })
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent misses into one load', async () => {
    const { cache } = make()
    const gate = deferred<{ n: number }>()
    const loader = vi.fn(() => gate.promise)
    const p1 = cache.get('k', SPEC, loader)
    const p2 = cache.get('k', SPEC, loader)
    gate.resolve({ n: 7 })
    const [a, b] = await Promise.all([p1, p2])
    expect(loader).toHaveBeenCalledTimes(1)
    expect(a.value).toEqual({ n: 7 })
    expect(b.value).toEqual({ n: 7 })
  })

  it('serves stale beyond the stale window when the loader fails, and rejects with nothing cached', async () => {
    const { cache, tick } = make()
    const good = vi.fn(async () => ({ n: 1 }))
    await cache.get('k', SPEC, good)
    tick(500_000)
    const bad = vi.fn(async () => {
      throw new Error('upstream down')
    })
    const r = await cache.get('k', SPEC, bad)
    expect(r).toMatchObject({ value: { n: 1 }, stale: true, fetched_at: 1_000_000 })
    await expect(cache.get('other', SPEC, bad)).rejects.toThrow('upstream down')
  })

  it('does not let a failed background refresh reject the caller', async () => {
    const { cache, tick } = make()
    await cache.get('k', SPEC, async () => ({ n: 1 }))
    tick(20_000)
    const r = await cache.get('k', SPEC, async () => {
      throw new Error('boom')
    })
    expect(r.stale).toBe(true)
    await new Promise((res) => setTimeout(res, 0))
    expect(cache.size()).toBe(1)
  })

  it('MemoryCacheStore evicts the least recently used entry past max', async () => {
    const store = new MemoryCacheStore(2)
    await store.set('a', { value: 1, fetched_at: 0 })
    await store.set('b', { value: 2, fetched_at: 0 })
    await store.get('a')
    await store.set('c', { value: 3, fetched_at: 0 })
    expect(await store.get('b')).toBeUndefined()
    expect((await store.get('a'))?.value).toBe(1)
    expect(store.size()).toBe(2)
  })

  it('exports the spec TTLs', () => {
    expect(TTL.LIVE).toEqual({ ttlMs: 10_000, staleMs: 60_000 })
    expect(TTL.BOARD).toEqual({ ttlMs: 30_000, staleMs: 120_000 })
    expect(TTL.RESULTS).toEqual({ ttlMs: 20_000, staleMs: 120_000 })
    expect(TTL.PLAYER).toEqual({ ttlMs: 60_000, staleMs: 300_000 })
    expect(TTL.REF).toEqual({ ttlMs: 600_000, staleMs: 3_600_000 })
  })
})
