import type { Hono } from 'hono'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

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

const PLACEHOLDER =
  '<!doctype html><meta charset="utf-8"><title>SCR Hub</title>' +
  '<p>SCR Hub server is running. The frontend is not built yet: run <code>npm run build:web</code>.</p>'

/** Serves the built SPA from `root` (Node only). Register after all API routes. */
export function registerStatic(app: Hono, opts: { root: string; basePath: string }) {
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
            const body = await readFile(target)
            const ext = path.extname(target).toLowerCase()
            c.header('Content-Type', TYPES[ext] ?? 'application/octet-stream')
            c.header('Cache-Control', rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300')
            return c.body(body)
          }
        } catch {
          // not a file: fall through to the SPA shell
        }
      }
    }
    try {
      const html = await readFile(path.join(root, 'index.html'), 'utf8')
      c.header('Cache-Control', 'no-cache')
      return c.html(html)
    } catch {
      return c.html(PLACEHOLDER)
    }
  })
}
