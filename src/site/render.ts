/**
 * Turns `content.ts` into the files a crawler and a stranger both read.
 *
 * Deliberately dependency-free and string-based. These pages are the first
 * thing anyone sees, they carry no application logic, and they must render
 * with the network half-connected on a phone that has never heard of this
 * site — so they ship as one small document with their own styles inside it
 * and no script at all. The app is one link away and stays that way.
 */

import {
  PAGES,
  REPOSITORY,
  SITE_NAME,
  TAGLINE,
  type Section,
  type SitePage,
} from './content'

/** Everything the renderer needs to know about where the site is served. */
export type SiteContext = {
  /** Scheme and host, no trailing slash: `https://cvree.github.io`. */
  origin: string
  /** The app's base path, with both slashes: `/Manifester/`. */
  base: string
}

export const DEFAULT_ORIGIN = 'https://cvree.github.io'

/** The five characters that can end a page early if a stray quote appears. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** The absolute URL of a page, which is also its canonical. */
export function pageUrl(slug: string, { origin, base }: SiteContext): string {
  return slug === '' ? `${origin}${base}` : `${origin}${base}${slug}/`
}

/**
 * A link *out* of a generated page, written relative to the site root.
 *
 * Not relative to the current page: these documents are served from a
 * directory each (`/affirmations/index.html`), and a sibling written as
 * `../voices/` breaks the moment the same file is previewed from anywhere
 * else. The base path is known at build time, so the honest thing is to say
 * the whole path.
 */
function href(slug: string, { base }: SiteContext): string {
  return slug === '' ? base : `${base}${slug}/`
}

/**
 * The site's own stylesheet, inlined into every page.
 *
 * The palette is the app's — warm cream and moonlit lavender, dusty rose lead
 * — so arriving at the app from one of these pages does not feel like leaving
 * a different website. It answers to the reader's system theme and to nothing
 * else; there is no theme toggle here, because there is no script here.
 */
const STYLES = `
:root {
  color-scheme: light dark;
  --bg: #f8f3ec;
  --bg-2: #efe9f3;
  --panel: #fffdf9;
  --border: rgb(58 50 44 / 0.1);
  --ink: #2f2823;
  --ink-muted: #5f544b;
  --ink-faint: #8a7c71;
  --rose: #9d5a65;
  --shadow: 0 1px 2px rgb(58 50 44 / 0.05), 0 18px 40px -28px rgb(58 50 44 / 0.5);
  --display: ui-serif, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  --sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14111f;
    --bg-2: #1a1728;
    --panel: #221e33;
    --border: rgb(247 241 232 / 0.12);
    --ink: #ece6f3;
    --ink-muted: #b6adc4;
    --ink-faint: #8d84a0;
    --rose: #dda3ac;
    --shadow: 0 1px 1px rgb(0 0 0 / 0.3), 0 18px 44px -28px rgb(0 0 0 / 0.8);
  }
}
* { box-sizing: border-box; }
html { background: var(--bg-2); }
body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(175deg, var(--bg) 0%, var(--bg-2) 100%) no-repeat;
  color: var(--ink);
  font-family: var(--sans);
  font-size: 17px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 46rem; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
a { color: var(--rose); text-underline-offset: 2px; }
a:focus-visible { outline: 2px solid var(--rose); outline-offset: 3px; border-radius: 4px; }
h1, h2 { font-family: var(--display); font-weight: 600; line-height: 1.2; margin: 0; text-wrap: balance; }
h1 { font-size: clamp(2rem, 6vw, 2.9rem); letter-spacing: -0.015em; }
h2 { font-size: clamp(1.35rem, 3.6vw, 1.6rem); }
p { margin: 0; max-width: 62ch; }
nav.top { display: flex; align-items: baseline; gap: 1rem; padding: 0.5rem 0 2.5rem; }
nav.top a.name { font-family: var(--display); font-size: 1.1rem; font-weight: 600; color: var(--ink); text-decoration: none; }
nav.top span { color: var(--ink-faint); font-size: 0.92rem; }
header.masthead { display: flex; flex-direction: column; gap: 1rem; }
header.masthead .lede { font-size: 1.16rem; color: var(--ink-muted); max-width: 58ch; }
section { display: flex; flex-direction: column; gap: 0.9rem; margin-top: 3rem; }
section p { color: var(--ink-muted); }
ul { margin: 0; padding-left: 1.15rem; color: var(--ink-muted); display: flex; flex-direction: column; gap: 0.55rem; }
ul li { max-width: 60ch; }
.cta {
  margin-top: 3rem;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 1.25rem;
  box-shadow: var(--shadow);
  padding: 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.cta p { color: var(--ink-muted); }
.cta a.open {
  align-self: flex-start;
  background: var(--rose);
  color: var(--panel);
  text-decoration: none;
  font-weight: 600;
  padding: 0.7rem 1.4rem;
  border-radius: 999px;
}
footer { margin-top: 3.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.9rem; }
footer .links { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; }
footer p { font-size: 0.88rem; color: var(--ink-faint); }
`.trim()

/** The head shared by every page: theme, icons, canonical, cards. */
function head(page: SitePage, context: SiteContext): string {
  const url = pageUrl(page.slug, context)
  const image = `${context.origin}${context.base}og.png`

  return `    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <link rel="canonical" href="${url}" />

    <link rel="icon" href="${context.base}favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="${context.base}apple-touch-icon.png" />
    <meta name="theme-color" content="#EFE7DC" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#171423" media="(prefers-color-scheme: dark)" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeHtml(page.heading)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(`${SITE_NAME} — ${TAGLINE}`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.heading)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${image}" />

    <script type="application/ld+json">${breadcrumbs(page, context)}</script>

    <style>${STYLES}</style>`
}

/** Tells search engines this page sits one level under the app, and where. */
function breadcrumbs(page: SitePage, context: SiteContext): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: SITE_NAME,
        item: pageUrl('', context),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: page.heading,
        item: pageUrl(page.slug, context),
      },
    ],
  })
}

function renderSection(section: Section): string {
  const blocks = section.blocks
    .map((block) =>
      block.kind === 'prose'
        ? `        <p>${escapeHtml(block.text)}</p>`
        : `        <ul>\n${block.items
            .map((item) => `          <li>${escapeHtml(item)}</li>`)
            .join('\n')}\n        </ul>`,
    )
    .join('\n')

  return `      <section>
        <h2 id="${escapeHtml(section.id)}">${escapeHtml(section.heading)}</h2>
${blocks}
      </section>`
}

/** One complete page, ready to be written to disk. */
export function renderPage(page: SitePage, context: SiteContext): string {
  const app = href('', context)
  const onward = page.next
    .map((slug) => PAGES.find((candidate) => candidate.slug === slug))
    .filter((candidate): candidate is SitePage => candidate != null)

  return `<!doctype html>
<html lang="en">
  <head>
${head(page, context)}
  </head>
  <body>
    <div class="wrap">
      <nav class="top">
        <a class="name" href="${app}">${SITE_NAME}</a>
        <span>${escapeHtml(TAGLINE)}</span>
      </nav>

      <header class="masthead">
        <h1>${escapeHtml(page.heading)}</h1>
        <p class="lede">${escapeHtml(page.lede)}</p>
      </header>

${page.sections.map(renderSection).join('\n\n')}

      <div class="cta">
        <p>It opens in the browser, works offline once installed, and asks for nothing — no account, no card, no trial.</p>
        <a class="open" href="${app}">Open ${SITE_NAME}</a>
      </div>

      <footer>
        <div class="links">
${onward
  .map(
    (candidate) =>
      `          <a href="${href(candidate.slug, context)}">${escapeHtml(candidate.heading)}</a>`,
  )
  .join('\n')}
          <a href="${REPOSITORY}">Source on GitHub</a>
        </div>
        <p>${SITE_NAME} is free and MIT licensed. Nothing you write here leaves your device.</p>
      </footer>
    </div>
  </body>
</html>
`
}

/**
 * The sitemap.
 *
 * It lists the app's own address first — that is the page people link to and
 * the one the manifest starts at — then each written page. On a project site
 * the sitemap cannot live at the domain root, so this one is submitted by
 * hand in Search Console; a sitemap under the sub-path is still valid for
 * every URL under that sub-path, which is all of them.
 */
export function renderSitemap(context: SiteContext, lastModified: string): string {
  const urls = ['', ...PAGES.map((page) => page.slug)]
    .map(
      (slug) =>
        `  <url>\n    <loc>${pageUrl(slug, context)}</loc>\n    <lastmod>${lastModified}</lastmod>\n  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

/**
 * `robots.txt`.
 *
 * Only the one at a domain's root is obeyed, so this file does its job when
 * the site is deployed to a domain of its own (`MANIFESTER_BASE=/`) and is
 * inert under a project sub-path. It is emitted either way: an inert file
 * costs nothing, and the alternative is remembering to add it on the day the
 * domain changes.
 */
export function renderRobots(context: SiteContext): string {
  return `User-agent: *
Allow: /

Sitemap: ${context.origin}${context.base}sitemap.xml
`
}

/**
 * The tags the app's own `index.html` cannot write for itself.
 *
 * Everything here needs an absolute URL — a canonical link, a share image, the
 * structured data — and `index.html` is a static file with no idea which
 * origin or base path it was built for. So the readable half (title,
 * description, the words) stays in the file where a person can edit it, and
 * the half that depends on where the site is deployed is injected at build
 * time from the same context that renders every other page.
 */
export function renderAppHead(context: SiteContext): string {
  const url = pageUrl('', context)
  const image = `${context.origin}${context.base}og.png`

  return `<link rel="canonical" href="${url}" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${escapeHtml(`${SITE_NAME} — ${TAGLINE}`)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(SITE_NAME)}" />
<meta name="twitter:description" content="${escapeHtml(TAGLINE)}" />
<meta name="twitter:image" content="${image}" />
<script type="application/ld+json">${appStructuredData(context)}</script>`
}

/**
 * What the app is, in the vocabulary a search engine already has.
 *
 * `price: '0'` is a statement of fact rather than a marketing claim — there is
 * no payment code in the repository — and there is deliberately no
 * `aggregateRating`, because the app collects no ratings and inventing one is
 * the exact thing this markup exists to make checkable.
 */
function appStructuredData(context: SiteContext): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: pageUrl('', context),
    description: TAGLINE,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Any — runs in a web browser',
    isAccessibleForFree: true,
    license: 'https://opensource.org/licenses/MIT',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: PAGES.map((page) => page.heading),
    sameAs: [REPOSITORY],
  })
}
