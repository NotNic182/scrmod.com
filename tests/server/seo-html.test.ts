import { describe, it, expect } from 'vitest'
import { BODY_MARK, HEAD_END, HEAD_START, esc, fillTemplate, jsonLdScript } from '../../src/server/seo/html'

describe('esc', () => {
  it('escapes everything that could break out of text or an attribute', () => {
    expect(esc(`</title><script>alert("x")</script> & 'y'`)).toBe('&lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;')
    expect(esc(42)).toBe('42')
    expect(esc(null)).toBe('')
  })
})

describe('jsonLdScript', () => {
  it('cannot be closed early by the data', () => {
    const out = jsonLdScript({ name: '</script><script>alert(1)</script>', sep: '\u2028' })
    expect(out.startsWith('<script type="application/ld+json">')).toBe(true)
    expect(out.match(/<\/script>/g)).toHaveLength(1)
    expect(out).toContain('\\u003c/script>')
    expect(out).toContain('\\u2028')
    expect(JSON.parse(out.slice(35, -9).replace(/\\u003c/g, '<'))).toMatchObject({ name: '</script><script>alert(1)</script>' })
  })
})

describe('fillTemplate', () => {
  const template = `<head>${HEAD_START}<title>SCRmod</title>${HEAD_END}</head><body><div id="root">${BODY_MARK}</div></body>`
  it('replaces the head region and fills the root', () => {
    expect(fillTemplate(template, '<title>X</title>', '<main>hi</main>')).toBe('<head><title>X</title></head><body><div id="root"><main>hi</main></div></body>')
  })
  it('leaves a template without markers alone', () => {
    expect(fillTemplate('<title>SCRmod</title><div id="root"></div>', '<title>X</title>', '<main/>')).toBe('<title>SCRmod</title><div id="root"></div>')
  })
})
