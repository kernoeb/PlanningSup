import { describe, expect, it } from 'bun:test'
import { renderRobotsTxt, renderSitemapXml, rewriteIndexHtmlSeoMeta } from '@api/utils/seo'

describe('SEO utils', () => {
  it('rewriteIndexHtmlSeoMeta() should absolutize canonical, og:url, and image meta', () => {
    const html = [
      '<!doctype html>',
      '<html>',
      '  <head>',
      '    <link rel="canonical" href="/index.html" />',
      '    <meta property="og:url" content="/" />',
      '    <meta property="og:image" content="/banner.png" />',
      '    <meta name="twitter:image" content="/banner.png" />',
      '    <meta property="og:title" content="PlanningSup" />',
      '  </head>',
      '  <body></body>',
      '</html>',
    ].join('\n')

    const out = rewriteIndexHtmlSeoMeta(html, 'https://example.com/')

    expect(out).toContain('<link rel="canonical" href="https://example.com/"')
    expect(out).toMatch(/<meta(?=[^>]*property="og:url")(?=[^>]*content="https:\/\/example\.com\/")[^>]*>/)
    expect(out).toMatch(/<meta(?=[^>]*property="og:image")(?=[^>]*content="https:\/\/example\.com\/banner\.png")[^>]*>/)
    expect(out).toMatch(/<meta(?=[^>]*name="twitter:image")(?=[^>]*content="https:\/\/example\.com\/banner\.png")[^>]*>/)
    expect(out).toContain('<meta property="og:title" content="PlanningSup" />')
  })

  it('rewriteIndexHtmlSeoMeta() should handle attribute order and single quotes', () => {
    const html = [
      '<head>',
      '  <link href="/index.html" rel=\'canonical\'>',
      '  <meta content="/" property="og:url">',
      '  <meta content=\'/banner.png\' property="og:image">',
      '  <meta name="twitter:image" content=\'/banner.png\'>',
      '</head>',
    ].join('\n')

    const out = rewriteIndexHtmlSeoMeta(html, 'https://example.com')

    expect(out).toContain('href="https://example.com/"')
    expect(out).toMatch(/<meta(?=[^>]*property="og:url")(?=[^>]*content="https:\/\/example\.com\/")[^>]*>/)
    expect(out).toMatch(/<meta(?=[^>]*property="og:image")(?=[^>]*content="https:\/\/example\.com\/banner\.png")[^>]*>/)
    expect(out).toMatch(/<meta(?=[^>]*name="twitter:image")(?=[^>]*content="https:\/\/example\.com\/banner\.png")[^>]*>/)
  })

  it('rewriteIndexHtmlSeoMeta() should not rewrite already-absolute image URLs', () => {
    const html = '<meta property="og:image" content="https://cdn.example.com/banner.png" />'
    const out = rewriteIndexHtmlSeoMeta(html, 'https://example.com')
    expect(out).toContain('content="https://cdn.example.com/banner.png"')
    expect(out).not.toContain('https://example.comhttps://')
  })

  it('rewriteIndexHtmlSeoMeta() should escape attribute values defensively', () => {
    const html = '<link rel="canonical" href="/index.html" />'
    const out = rewriteIndexHtmlSeoMeta(html, 'https://example.com" onload="alert(1)')
    expect(out).toContain('href="https://example.com&quot; onload=&quot;alert(1)/"')
    expect(out).not.toContain('" onload="')
  })

  it('renderRobotsTxt() should normalize the origin and include sitemap', () => {
    expect(renderRobotsTxt('https://example.com/')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\n',
    )
  })

  it('renderSitemapXml() should normalize the origin and emit a single URL', () => {
    const now = new Date('2025-12-18T12:34:56.000Z')
    const xml = renderSitemapXml('https://example.com/', now)
    expect(xml).toContain('<loc>https://example.com/</loc>')
    expect(xml).toContain('<lastmod>2025-12-18</lastmod>')
  })
})
