import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { makeApp } from './helpers/makeApp'
import { pickEncoding, registerStatic } from '../../src/server/static'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'

let root: string
let outsideDir: string
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'scr-static-'))
  await writeFile(path.join(root, 'index.html'), '<!doctype html><title>SCRmod</title><div id="root"></div>')
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
    expect(await home.text()).toContain('SCRmod')
    expect(await (await app.request('/leaderboards/1v1')).text()).toContain('SCRmod')
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
    expect(await home.text()).toContain('SCRmod server is running')
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
    expect(body).toContain('SCRmod') // falls back to the SPA, never reads outside root
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
    expect(body).toContain('SCRmod') // falls back to the SPA, never reads outside root
    expect(body).not.toContain('TOP SECRET')
  })

  it('works under a BASE_PATH', async () => {
    const { app } = makeApp({}, { BASE_PATH: '/hub' })
    registerStatic(app, { root, basePath: '/hub' })
    expect(await (await app.request('/hub/')).text()).toContain('SCRmod')
    expect((await app.request('/hub/assets/app-abc123.js')).status).toBe(200)
    expect((await app.request('/hub/api/nope')).status).toBe(404)
  })
})

describe('compression', () => {
  let big: string
  beforeAll(async () => {
    big = await mkdtemp(path.join(tmpdir(), 'scr-compress-'))
    await mkdir(path.join(big, 'assets'))
    await writeFile(path.join(big, 'index.html'), `<!doctype html><title>x</title>${'<p>filler</p>'.repeat(200)}`)
    await writeFile(path.join(big, 'assets', 'app-big.js'), 'console.log("x");'.repeat(500))
    await writeFile(path.join(big, 'assets', 'tiny.js'), 'console.log(1)')
  })

  it('picks br over gzip, honours q=0 and wildcards', () => {
    expect(pickEncoding('gzip, deflate, br')).toBe('br')
    expect(pickEncoding('gzip;q=1.0, br;q=0')).toBe('gzip')
    expect(pickEncoding('identity')).toBeNull()
    expect(pickEncoding('*')).toBe('br')
    expect(pickEncoding(undefined)).toBeNull()
  })

  it('serves assets and the shell compressed, and the decoded bytes match the file', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root: big, basePath: '/' })
    const br = await app.request('/assets/app-big.js', { headers: { 'Accept-Encoding': 'gzip, br' } })
    expect(br.headers.get('content-encoding')).toBe('br')
    expect(br.headers.get('vary')).toContain('Accept-Encoding')
    const raw = Buffer.from(await br.arrayBuffer())
    expect(raw.length).toBeLessThan(1000)
    expect(brotliDecompressSync(raw).toString()).toBe('console.log("x");'.repeat(500))

    const gz = await app.request('/assets/app-big.js', { headers: { 'Accept-Encoding': 'gzip' } })
    expect(gz.headers.get('content-encoding')).toBe('gzip')
    expect(gunzipSync(Buffer.from(await gz.arrayBuffer())).toString()).toContain('console.log')

    const shell = await app.request('/leaderboards/1v1', { headers: { 'Accept-Encoding': 'br' } })
    expect(shell.headers.get('content-encoding')).toBe('br')
    expect(shell.headers.get('content-type')).toContain('text/html')
    expect(brotliDecompressSync(Buffer.from(await shell.arrayBuffer())).toString()).toContain('filler')
  })

  it('leaves tiny files and clients without Accept-Encoding alone', async () => {
    const { app } = makeApp({})
    registerStatic(app, { root: big, basePath: '/' })
    expect((await app.request('/assets/tiny.js', { headers: { 'Accept-Encoding': 'br' } })).headers.get('content-encoding')).toBeNull()
    const plain = await app.request('/assets/app-big.js')
    expect(plain.headers.get('content-encoding')).toBeNull()
    expect(await plain.text()).toBe('console.log("x");'.repeat(500))
  })
})
