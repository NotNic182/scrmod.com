import type { Hono } from 'hono'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { brotliCompress, constants as zlib, gzip } from 'node:zlib'
import type { RouteDeps } from './routes/common'
import { resolvePage } from './seo/page'
import { fillTemplate } from './seo/html'

const brotli = promisify(brotliCompress)
const gz = promisify(gzip)

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.map', '.svg', '.txt', '.webmanifest'])
/** Below this, headers outweigh the savings. */
const MIN_COMPRESS = 1024

type Encoding = 'br' | 'gzip'

/** Picks br over gzip when the client takes both; q=0 opts out. */
export function pickEncoding(accept: string | undefined): Encoding | null {
  if (!accept) return null
  const q = new Map<string, number>()
  for (const part of accept.split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';')
    const qParam = params.map((x) => x.trim()).find((x) => x.startsWith('q='))
    q.set(name.trim(), qParam ? Number(qParam.slice(2)) || 0 : 1)
  }
  const weight = (name: string) => q.get(name) ?? q.get('*') ?? 0
  if (weight('br') > 0) return 'br'
  if (weight('gzip') > 0) return 'gzip'
  return null
}

/**
 * Compressed copies of files, made once per file version (path + mtime) and kept in memory: the built SPA is a
 * handful of files, and hashed assets never change, so compressing per request would be wasted CPU.
 */
type Bytes = Uint8Array<ArrayBuffer>
const compressed = new Map<string, Promise<Bytes>>()
function compressedCopy(file: string, mtimeMs: number, body: Bytes, enc: Encoding): Promise<Bytes> {
  const key = `${file}|${mtimeMs}|${enc}`
  let hit = compressed.get(key)
  if (!hit) {
    // zlib hands back plain (never shared) buffers.
    hit = (
      enc === 'br'
        ? brotli(body, { params: { [zlib.BROTLI_PARAM_QUALITY]: 11, [zlib.BROTLI_PARAM_SIZE_HINT]: body.length } })
        : gz(body, { level: 9 })
    ) as Promise<Bytes>
    // A failure must not be cached forever: drop it so the next request tries again.
    hit.catch(() => compressed.delete(key))
    compressed.set(key, hit)
  }
  return hit
}

const PLACEHOLDER =
  '<!doctype html><meta charset="utf-8"><title>SCRmod</title>' +
  '<p>SCRmod server is running. The frontend is not built yet: run <code>npm run build:web</code>.</p>'

/** Serves the built SPA from `root` (Node only). Register after all API routes. */
export function registerStatic(app: Hono, opts: { root: string; basePath: string; deps?: RouteDeps }) {
  const root = path.resolve(opts.root)
  const prefix = opts.basePath === '/' ? '' : opts.basePath

  app.get('/*', async (c) => {
    let p = c.req.path
    if (prefix && p.startsWith(prefix)) p = p.slice(prefix.length) || '/'
    if (p.startsWith('/api/') || p.startsWith('/auth/')) return c.json({ error: 'not_found' }, 404)

    let rel = ''
    try {
      rel = decodeURIComponent(p).replace(/^\/+/, '')
    } catch {
      rel = ''
    }
    if (rel) {
      const target = path.resolve(root, rel)
      if (target.startsWith(root + path.sep)) {
        try {
          const s = await stat(target)
          if (s.isFile()) {
            let body: Bytes = await readFile(target)
            const ext = path.extname(target).toLowerCase()
            c.header('Content-Type', TYPES[ext] ?? 'application/octet-stream')
            if (COMPRESSIBLE.has(ext) && body.length >= MIN_COMPRESS) {
              c.header('Vary', 'Accept-Encoding')
              const enc = pickEncoding(c.req.header('Accept-Encoding'))
              if (enc) {
                body = await compressedCopy(target, s.mtimeMs, body, enc)
                c.header('Content-Encoding', enc)
              }
            }
            const cacheControl = rel.startsWith('assets/')
              ? 'public, max-age=31536000, immutable'
              : ext === '.html'
                ? 'no-cache'
                : 'public, max-age=300'
            c.header('Cache-Control', cacheControl)
            return c.body(body)
          }
        } catch {
          // not a file: fall through to the SPA shell
        }
      }
    }
    let template: string
    try {
      template = await readFile(path.join(root, 'index.html'), 'utf8')
    } catch {
      return c.html(PLACEHOLDER)
    }
    c.header('Cache-Control', 'no-cache')
    c.header('Content-Type', TYPES['.html'])
    c.header('Vary', 'Accept-Encoding')
    let status: 200 | 404 = 200
    let html = template
    if (opts.deps) {
      try {
        const page = await resolvePage(opts.deps, p, c)
        if ('redirect' in page) return c.redirect(page.redirect, 301)
        status = page.status
        if (!page.index) c.header('X-Robots-Tag', 'noindex, follow')
        html = fillTemplate(template, page.head, page.body)
      } catch (err) {
        // Never an error page: a page-render failure falls back to the plain template, status 200.
        console.error('[hub] page render failed', err)
      }
    }
    let body: Bytes = new TextEncoder().encode(html) as Bytes
    const enc = body.length >= MIN_COMPRESS ? pickEncoding(c.req.header('Accept-Encoding')) : null
    if (enc) {
      // Every page is different now, so compress per request at fast settings (brotli 5 / gzip 6).
      body = (await (enc === 'br' ? brotli(body, { params: { [zlib.BROTLI_PARAM_QUALITY]: 5 } }) : gz(body, { level: 6 }))) as Bytes
      c.header('Content-Encoding', enc)
    }
    return c.body(body, status)
  })
}
