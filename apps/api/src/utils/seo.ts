function escapeAttrValue(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function normalizeOrigin(publicOrigin: string) {
  return publicOrigin.replace(/\/$/, '')
}

interface HtmlAttr {
  name: string
  value: string | null
}

function parseTagNameInfo(tag: string) {
  let i = 1
  while (i < tag.length && /\s/.test(tag[i]!)) i++

  const start = i
  while (i < tag.length) {
    const c = tag[i]!
    if (c === '>' || c === '/' || /\s/.test(c)) break
    i++
  }
  return { name: tag.slice(start, i).toLowerCase(), end: i }
}

function parseTagName(tag: string) {
  return parseTagNameInfo(tag).name
}

function parseAttributes(tag: string): HtmlAttr[] {
  const attrs: HtmlAttr[] = []
  const { end: tagNameEnd } = parseTagNameInfo(tag)

  let i = tagNameEnd
  while (i < tag.length) {
    const c = tag[i]!
    if (c === '>' || (c === '/' && tag[i + 1] === '>')) break
    if (/\s/.test(c)) {
      i++
      continue
    }

    const nameStart = i
    while (i < tag.length) {
      const cc = tag[i]!
      if (cc === '>' || cc === '/' || cc === '=' || /\s/.test(cc)) break
      i++
    }
    const rawName = tag.slice(nameStart, i)
    const name = rawName.toLowerCase()
    if (!name) break

    while (i < tag.length && /\s/.test(tag[i]!)) i++

    if (tag[i] !== '=') {
      attrs.push({ name: rawName, value: null })
      continue
    }

    i++ // skip '='
    while (i < tag.length && /\s/.test(tag[i]!)) i++

    if (i >= tag.length) {
      attrs.push({ name: rawName, value: '' })
      break
    }

    const quote = tag[i]
    if (quote === '"' || quote === '\'') {
      i++
      const valueStart = i
      while (i < tag.length && tag[i] !== quote) i++
      const value = tag.slice(valueStart, i)
      if (tag[i] === quote) i++
      attrs.push({ name: rawName, value })
      continue
    }

    const valueStart = i
    while (i < tag.length) {
      const cc = tag[i]!
      if (cc === '>' || /\s/.test(cc)) break
      i++
    }
    const value = tag.slice(valueStart, i)
    attrs.push({ name: rawName, value })
  }

  return attrs
}

function getAttrValue(attrs: HtmlAttr[], nameLower: string) {
  const found = attrs.find(a => a.name.toLowerCase() === nameLower)
  return found?.value ?? null
}

function setAttrValue(attrs: HtmlAttr[], name: string, value: string) {
  const idx = attrs.findIndex(a => a.name.toLowerCase() === name.toLowerCase())
  if (idx >= 0) attrs[idx] = { name: attrs[idx]!.name, value }
  else attrs.push({ name, value })
}

function buildTag(tagName: string, attrs: HtmlAttr[], selfClosing: boolean) {
  const renderedAttrs = attrs
    .map(({ name, value }) => {
      if (value === null) return ` ${name}`
      return ` ${name}="${escapeAttrValue(value)}"`
    })
    .join('')

  return selfClosing ? `<${tagName}${renderedAttrs} />` : `<${tagName}${renderedAttrs}>`
}

function findTagEnd(html: string, start: number) {
  let quote: '"' | '\'' | null = null
  for (let i = start; i < html.length; i++) {
    const c = html[i]!
    if (quote) {
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === '\'') {
      quote = c
      continue
    }
    if (c === '>') return i
  }
  return -1
}

function rewriteIndexHtmlSeoMeta(html: string, publicOrigin: string) {
  const origin = normalizeOrigin(publicOrigin)

  let out = ''
  let cursor = 0

  while (cursor < html.length) {
    const lt = html.indexOf('<', cursor)
    if (lt === -1) {
      out += html.slice(cursor)
      break
    }

    out += html.slice(cursor, lt)

    const tagEnd = findTagEnd(html, lt + 1)
    if (tagEnd === -1) {
      out += html.slice(lt)
      break
    }

    const rawTag = html.slice(lt, tagEnd + 1)
    const tagName = parseTagName(rawTag)
    const lowerTagName = tagName.toLowerCase()

    if (lowerTagName !== 'meta' && lowerTagName !== 'link') {
      out += rawTag
      cursor = tagEnd + 1
      continue
    }

    const attrs = parseAttributes(rawTag)

    if (lowerTagName === 'link') {
      const rel = (getAttrValue(attrs, 'rel') ?? '').toLowerCase()
      if (rel === 'canonical') {
        setAttrValue(attrs, 'href', `${origin}/`)
        out += buildTag('link', attrs, true)
        cursor = tagEnd + 1
        continue
      }
    }

    if (lowerTagName === 'meta') {
      const property = (getAttrValue(attrs, 'property') ?? '').toLowerCase()
      const name = (getAttrValue(attrs, 'name') ?? '').toLowerCase()

      if (property === 'og:url') {
        setAttrValue(attrs, 'content', `${origin}/`)
        out += buildTag('meta', attrs, true)
        cursor = tagEnd + 1
        continue
      }

      const isOgImage = property === 'og:image'
      const isTwitterImage = name === 'twitter:image'
      if (isOgImage || isTwitterImage) {
        const content = getAttrValue(attrs, 'content')
        if (content && content.startsWith('/')) {
          setAttrValue(attrs, 'content', `${origin}${content}`)
          out += buildTag('meta', attrs, true)
          cursor = tagEnd + 1
          continue
        }
      }
    }

    out += rawTag
    cursor = tagEnd + 1
  }

  return out
}

function renderRobotsTxt(publicOrigin: string) {
  const origin = normalizeOrigin(publicOrigin)
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`
}

function renderSitemapXml(publicOrigin: string, now = new Date()) {
  const origin = normalizeOrigin(publicOrigin)
  const lastmod = now.toISOString().slice(0, 10)

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + `  <url>\n`
    + `    <loc>${origin}/</loc>\n`
    + `    <lastmod>${lastmod}</lastmod>\n`
    + `  </url>\n`
    + `</urlset>\n`
  )
}

export { renderRobotsTxt, renderSitemapXml, rewriteIndexHtmlSeoMeta }
