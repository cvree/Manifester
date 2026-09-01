import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PAGES, TAGLINE, pageFor } from './content'
import {
  DEFAULT_ORIGIN,
  escapeHtml,
  renderAppHead,
  pageUrl,
  renderPage,
  renderRobots,
  renderSitemap,
  type SiteContext,
} from './render'

const context: SiteContext = { origin: DEFAULT_ORIGIN, base: '/Manifester/' }
const rendered = PAGES.map((page) => ({ page, html: renderPage(page, context) }))

describe('the written pages', () => {
  it('gives every page its own address', () => {
    const slugs = PAGES.map((page) => page.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z][a-z-]*$/)
  })

  it('gives every page its own title and description', () => {
    const titles = PAGES.map((page) => page.title)
    const descriptions = PAGES.map((page) => page.description)
    expect(new Set(titles).size).toBe(titles.length)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  /*
   * Not style rules — these are the two lengths a search result actually
   * shows. A title past roughly 60 characters and a description past roughly
   * 160 are truncated mid-sentence, which is the one thing a page gets to say
   * before anyone clicks.
   */
  it('keeps titles and descriptions inside what a search result shows', () => {
    for (const page of PAGES) {
      expect(page.title.length, page.slug).toBeLessThanOrEqual(62)
      expect(page.description.length, page.slug).toBeGreaterThanOrEqual(90)
      expect(page.description.length, page.slug).toBeLessThanOrEqual(160)
    }
  })

  it('only points onward at pages that exist', () => {
    for (const page of PAGES) {
      for (const slug of page.next) {
        expect(pageFor(slug), `${page.slug} → ${slug}`).not.toBeNull()
        expect(slug).not.toBe(page.slug)
      }
    }
  })

  it('says something on every page', () => {
    for (const page of PAGES) {
      expect(page.sections.length, page.slug).toBeGreaterThanOrEqual(3)
      for (const section of page.sections) {
        expect(section.blocks.length, `${page.slug}#${section.id}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('rendering', () => {
  it('escapes the characters that would end a document early', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    )
  })

  it('declares one canonical per page, and it is that page', () => {
    for (const { page, html } of rendered) {
      const canonical = `<link rel="canonical" href="${pageUrl(page.slug, context)}" />`
      expect(html, page.slug).toContain(canonical)
      expect(html.match(/rel="canonical"/g)?.length, page.slug).toBe(1)
    }
  })

  it('carries a share card with an absolute image', () => {
    for (const { html, page } of rendered) {
      expect(html, page.slug).toContain('name="twitter:card" content="summary_large_image"')
      expect(html, page.slug).toContain(
        `<meta property="og:image" content="${DEFAULT_ORIGIN}/Manifester/og.png" />`,
      )
    }
  })

  it('writes structured data a parser can read', () => {
    for (const { html, page } of rendered) {
      const match = html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )
      expect(match, page.slug).not.toBeNull()
      const data = JSON.parse(match![1]) as { '@type': string }
      expect(data['@type']).toBe('BreadcrumbList')
    }
  })

  /*
   * A relative link would be resolved against the page's own directory, and
   * every one of these pages is served from a directory of its own. The site
   * is generated with the base path in hand, so the links are written out in
   * full rather than counted back to.
   */
  it('links to the app and onward with paths that start at the site root', () => {
    for (const { page, html } of rendered) {
      expect(html, page.slug).toContain('href="/Manifester/"')
      for (const slug of page.next) {
        expect(html, page.slug).toContain(`href="/Manifester/${slug}/"`)
      }
      expect(html, page.slug).not.toContain('href="../')
      expect(html, page.slug).not.toContain('href="./')
    }
  })

  it('ships no script beyond the structured data', () => {
    for (const { html, page } of rendered) {
      expect(html.match(/<script/g)?.length, page.slug).toBe(1)
      expect(html, page.slug).not.toContain('<script src')
    }
  })

  it('follows the base path when the site moves to a domain of its own', () => {
    const root: SiteContext = { origin: 'https://manifester.app', base: '/' }
    const html = renderPage(PAGES[0], root)
    expect(html).toContain('<link rel="canonical" href="https://manifester.app/affirmations/" />')
    expect(html).toContain('href="/"')
    expect(html).not.toContain('/Manifester/')
  })

  it('names the app and its promise on every page', () => {
    for (const { html, page } of rendered) {
      expect(html, page.slug).toContain(escapeHtml(TAGLINE))
    }
  })
})

describe('the crawler files', () => {
  it('lists the app and every page in the sitemap, once each', () => {
    const xml = renderSitemap(context, '2026-09-01')
    for (const page of PAGES) {
      const loc = `<loc>${pageUrl(page.slug, context)}</loc>`
      expect(xml.split(loc).length - 1, page.slug).toBe(1)
    }
    expect(xml).toContain(`<loc>${DEFAULT_ORIGIN}/Manifester/</loc>`)
    expect(xml.match(/<url>/g)?.length).toBe(PAGES.length + 1)
    expect(xml).toContain('http://www.sitemaps.org/schemas/sitemap/0.9')
  })

  it('points robots.txt at the sitemap it actually wrote', () => {
    const robots = renderRobots(context)
    expect(robots).toContain(`Sitemap: ${DEFAULT_ORIGIN}/Manifester/sitemap.xml`)
    expect(robots).toContain('Allow: /')
    expect(robots).not.toContain('Disallow: /\n')
  })
})

describe("the app's own page", () => {
  const indexHtml = readFileSync('index.html', 'utf8')

  /*
   * The no-JS fallback lists the written pages by hand, because it is plain
   * HTML in a file no build step assembles. This is the guard that keeps that
   * list from quietly falling behind the pages it names.
   */
  it('lists every written page in the no-JavaScript fallback', () => {
    const noscript = indexHtml.slice(
      indexHtml.indexOf('<noscript>'),
      indexHtml.indexOf('</noscript>'),
    )
    expect(noscript).not.toBe('')
    for (const page of PAGES) {
      expect(noscript, page.slug).toContain(`href="./${page.slug}/"`)
      expect(noscript, page.slug).toContain(escapeHtml(page.heading))
    }
    expect(noscript.match(/<li>/g)?.length).toBe(PAGES.length)
  })

  it('leaves a marker for the tags only the build can write', () => {
    expect(indexHtml).toContain('<!--seo-->')
    // The words a person edits stay in the file; the absolute URLs do not.
    expect(indexHtml).not.toContain('rel="canonical"')
    expect(indexHtml).not.toContain('og:image')
  })

  it('describes the app as free software a browser can run', () => {
    const head = renderAppHead(context)
    const data = JSON.parse(
      head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1],
    ) as Record<string, unknown>

    expect(data['@type']).toBe('SoftwareApplication')
    expect(data.isAccessibleForFree).toBe(true)
    expect(data.offers).toMatchObject({ price: '0' })
    // Nobody has rated it, so nothing here may claim anybody has.
    expect(data.aggregateRating).toBeUndefined()
    expect(head).toContain(`<link rel="canonical" href="${DEFAULT_ORIGIN}/Manifester/" />`)
  })
})
