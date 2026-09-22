import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { makeApp } from './helpers/makeApp'
import { registerStatic } from '../../src/server/static'

let root: string
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'scr-static-'))
  await writeFile(path.join(root, 'index.html'), '<!doctype html><title>SCR Hub</title><div id="root"></div>')
  await mkdir(path.join(root, 'assets'))
  await writeFile(path.join(root, 'assets', 'app-abc123.js'), 'console.log("hi")')
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

  it('keeps unknown API and auth paths as JSON 404s', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root, basePath: '/' })
    const res = await app.request('/api/nope')
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('not_found')
    expect((await app.request('/auth/nope')).status).toBe(404)
  })

  it('refuses path traversal', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root, basePath: '/' })
    const res = await app.request('/assets/../../etc/passwd')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('SCR Hub') // falls back to the SPA, never reads outside root
  })

  it('works under a BASE_PATH', async () => {
    const { app } = makeApp({}, { BASE_PATH: '/hub' })
    registerStatic(app, { root, basePath: '/hub' })
    expect(await (await app.request('/hub/')).text()).toContain('SCR Hub')
    expect((await app.request('/hub/assets/app-abc123.js')).status).toBe(200)
    expect((await app.request('/hub/api/nope')).status).toBe(404)
  })
})
