import { describe, it, expect, vi } from 'vitest'
import { makeApp } from './helpers/makeApp'

describe('canonical host', () => {
  it('redirects page requests on another host to the public one, keeping path and query', async () => {
    const { app } = makeApp({}, { PUBLIC_BASE_URL: 'https://scrmod.com' })
    const res = await app.request('http://scr-hub.up.railway.app/leaderboards/1v1?x=1')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://scrmod.com/leaderboards/1v1?x=1')
    expect((await app.request('http://www.scrmod.com/')).headers.get('location')).toBe('https://scrmod.com/')
  })

  it('leaves the API, auth, files, other methods and the right host alone', async () => {
    const { app } = makeApp({}, { PUBLIC_BASE_URL: 'https://scrmod.com' })
    expect((await app.request('http://scr-hub.up.railway.app/api/_status')).status).not.toBe(301)
    expect((await app.request('http://scr-hub.up.railway.app/auth/me')).status).not.toBe(301)
    expect((await app.request('http://scr-hub.up.railway.app/robots.txt')).status).not.toBe(301)
    expect((await app.request('http://scr-hub.up.railway.app/x', { method: 'POST' })).status).not.toBe(301)
    expect((await app.request('https://scrmod.com/robots.txt')).status).toBe(200)
  })

  it('does nothing without PUBLIC_BASE_URL', async () => {
    const { app } = makeApp({})
    expect((await app.request('http://anything.test/robots.txt')).status).toBe(200)
  })

  it('tolerates a malformed PUBLIC_BASE_URL and disables redirect', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { app } = makeApp({}, { PUBLIC_BASE_URL: 'scrmod.com' })
    expect(spy).toHaveBeenCalledWith(
      '[hub] PUBLIC_BASE_URL is not a URL; canonical host redirect disabled:',
      'scrmod.com',
    )
    const res = await app.request('http://anything.test/leaderboards/1v1')
    expect(res.status).not.toBe(301)
    spy.mockRestore()
  })
})
