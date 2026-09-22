import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { makeApp } from './helpers/makeApp'
import { registerStatic } from '../../src/server/static'

let root: string
let outsideDir: string
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'scr-static-'))
  await writeFile(path.join(root, 'index.html'), '<!doctype html><title>SCR Hub</title><div id="root"></div>')
  await mkdir(path.join(root, 'assets'))
  await writeFile(path.join(root, 'assets', 'app-abc123.js'), 'console.log("hi")')

  outsideDir = await mkdtemp(path.join(tmpdir(), 'scr-outside-'))
  await writeFile(path.join(outsideDir, 'secret.txt'), 'TOP SECRET')
})

describe('static serving', () => {
  it('serves index.html at / and for client routes, and real files by path', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root, basePath: '/' })
    const home = await app.request('/')
    expect(home.status).toBe(200)
    expect(home.headers.get('content-type')).toContain('text/html')
    expect(await home.text()).toContain('SCR Hub')
    expect(await (await app.request('/leaderboards/1v1')).text()).toContain('SCR Hub')
    const js = await app.request('/assets/app-abc123.js')
    expect(js.status).toBe(200)
    expect(js.headers.get('content-type')).toContain('javascript')
    expect(js.headers.get('cache-control')).toContain('immutable')
  })

  it('falls back to the built-in placeholder when the web root has not been built', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root: path.join(root, 'not-built-yet'), basePath: '/' })
    const home = await app.request('/')
    expect(home.status).toBe(200)
    expect(await home.text()).toContain('SCR Hub server is running')
  })

  it('keeps unknown API and auth paths as JSON 404s', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root, basePath: '/' })
    const res = await app.request('/api/nope')
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('not_found')
    expect((await app.request('/auth/nope')).status).toBe(404)
  })

  it('serves index.html directly with no-cache (never long-cached like assets)', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root, basePath: '/' })
    const res = await app.request('/index.html')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(res.headers.get('cache-control')).toBe('no-cache')
  })

  it('refuses to read an absolute path outside root, even URL-encoded', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root, basePath: '/' })
    const secretPath = path.join(outsideDir, 'secret.txt')
    const res = await app.request('/' + encodeURIComponent(secretPath))
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('SCR Hub') // falls back to the SPA, never reads outside root
    expect(body).not.toContain('TOP SECRET')
  })

  it('refuses a backslash-encoded traversal that would escape root', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root, basePath: '/' })
    // %5c decodes to '\'; on Windows this makes path.resolve walk up out of root the same
    // way '../..' would on POSIX. The URL parser does not collapse these (they are escaped),
    // so the request survives to the handler's own traversal guard.
    const target = '/assets/..%5c..%5c' + encodeURIComponent(path.basename(outsideDir)) + '%5csecret.txt'
    const res = await app.request(target)
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('SCR Hub') // falls back to the SPA, never reads outside root
    expect(body).not.toContain('TOP SECRET')
  })

  it('works under a BASE_PATH', async () => {
    const { app } = makeApp({}, { BASE_PATH: '/hub' })
    registerStatic(app, { root, basePath: '/hub' })
    expect(await (await app.request('/hub/')).text()).toContain('SCR Hub')
    expect((await app.request('/hub/assets/app-abc123.js')).status).toBe(200)
    expect((await app.request('/hub/api/nope')).status).toBe(404)
  })
})
