import { createApp } from '../../../src/server/app'
import { parseEnv } from '../../../src/server/env'
import { type CacheStore, MemoryCacheStore } from '../../../src/server/cache'
import { fakeUpstream, type RouteMap } from './fakeUpstream'

export function makeApp(
  map: RouteMap,
  envOverrides: Record<string, string | undefined> = {},
  nowRef?: { now: number },
  store: CacheStore = new MemoryCacheStore(),
) {
  const fake = fakeUpstream(map)
  const env = parseEnv({ SCR_UPSTREAM_BASE: 'https://up.test', SCR_MOD_VERSION_OVERRIDE: '1.40.3', ...envOverrides })
  const built = createApp({
    env,
    fetchImpl: fake.fetchImpl,
    store,
    now: nowRef ? () => nowRef.now : undefined,
  })
  return { ...built, fake, env, store }
}
