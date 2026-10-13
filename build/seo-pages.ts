import type { Plugin, ResolvedConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SITE_LOCALES, DEFAULT_SITE_LOCALE, siteLocalePath, type SiteLocale } from '../src/i18n/site.ts'
import { localeFiles, readMessages } from './locales.ts'

/**
 * Writes one entry page per language (dist/ja/index.html, dist/zh-hans/…) with
 * its own lang, title, description and Open Graph tags, plus robots.txt.
 * A single-language build (VITE_LOCALE_FILE, see locales.ts) gets only the root
 * page, in that language.
 *
 * Set VITE_SITE_URL (in .env.production / .env.cn, or on the build command) to
 * also get canonical links, hreflang alternates, og:url/og:image and
 * sitemap.xml — those need absolute URLs, so they are skipped without it.
 *
 * index.html marks where tags go with <!-- seo:head --> and <!-- seo:body -->.
 */

interface PageText {
  title: string
  description: string
  siteName: string
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function seoPages(): Plugin {
  let config: ResolvedConfig
  let siteUrl = ''
  const texts = new Map<SiteLocale, PageText>()
  // The languages this build ships, in SITE_LOCALES order
  let locales: (typeof SITE_LOCALES)[number][] = []
  let rootLocale: SiteLocale = DEFAULT_SITE_LOCALE

  const href = (path: string) => `${siteUrl}/${path}`

  // The shared public manifest stays unchanged for single-language editions.
  function manifest(code: SiteLocale, path: string): string {
    const template = JSON.parse(readFileSync(resolve(config.publicDir, 'site.webmanifest'), 'utf8'))
    const name = texts.get(code)!.siteName
    return JSON.stringify({ ...template, name, short_name: name, lang: code, id: '/', start_url: `/${path}` }, null, 2) + '\n'
  }

  function head(code: SiteLocale, path: string): string {
    const text = texts.get(code)!
    const og = SITE_LOCALES.find(l => l.code === code)!.og
    const tags = [
      `<title>${escape(text.title)}</title>`,
      `<meta name="description" content="${escape(text.description)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${escape(text.siteName)}" />`,
      `<meta property="og:title" content="${escape(text.title)}" />`,
      `<meta property="og:description" content="${escape(text.description)}" />`,
      `<meta property="og:locale" content="${og}" />`,
      ...locales.filter(l => l.code !== code).map(l => `<meta property="og:locale:alternate" content="${l.og}" />`),
      `<meta name="twitter:card" content="summary" />`,
    ]
    if (siteUrl) {
      const canonicalPath = locales.length > 1 ? siteLocalePath(code) : path
      tags.push(
        `<link rel="canonical" href="${href(canonicalPath)}" />`,
        `<meta property="og:url" content="${href(canonicalPath)}" />`,
        `<meta property="og:image" content="${href('logo.png')}" />`,
      )
      const website = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${href('')}#website`,
        url: href(''),
        name: texts.get(rootLocale)!.siteName,
        alternateName: [...new Set(locales.map(l => texts.get(l.code)!.siteName))].filter(name => name !== texts.get(rootLocale)!.siteName),
        inLanguage: locales.map(l => l.code),
      }
      tags.push(`<script type="application/ld+json">${JSON.stringify(website).replace(/</g, '\\u003c')}</script>`)
    }
    if (siteUrl && locales.length > 1) {
      tags.push(
        ...locales.map(l => `<link rel="alternate" hreflang="${l.code}" href="${href(siteLocalePath(l.code))}" />`),
        `<link rel="alternate" hreflang="x-default" href="${href('')}" />`,
      )
    }
    return tags.join('\n    ')
  }

  // A useful initial page for visitors and crawlers, even when JavaScript or
  // the realtime API fails. Vue replaces this with the same visible heading.
  function body(code: SiteLocale): string {
    const text = texts.get(code)!
    const links = locales.length > 1
      ? `<nav aria-label="Language">${locales.map(l => `<a lang="${l.code}" hreflang="${l.code}" href="/${siteLocalePath(l.code)}">${escape(texts.get(l.code)!.siteName)} (${l.code})</a>`).join(' · ')}</nav>`
      : ''
    return `<main class="max-w-4xl mx-auto px-4 pt-3"><h1 class="text-sm font-semibold">${escape(text.title)}</h1><p class="mt-1 text-xs leading-relaxed">${escape(text.description)}</p>${links}</main>`
  }

  function render(html: string, code: SiteLocale, path: string): string {
    if (locales.length > 1) {
      const localePath = SITE_LOCALES.find(l => l.code === code)!.path
      html = html.replace('href="/site.webmanifest"', `href="/${localePath}/site.webmanifest"`)
    }
    return html
      .replace(/<html lang="[^"]*">/, `<html lang="${code}">`)
      .replace('<!-- seo:head -->', head(code, path))
      .replace('<!-- seo:body -->', body(code))
  }

  function sitemap(): string {
    const multi = locales.length > 1
    const alternates = multi
      ? [
          ...locales.map(l => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${href(siteLocalePath(l.code))}" />`),
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${href('')}" />`,
        ].map(line => `\n${line}`).join('')
      : ''
    const urls = (multi ? locales.map(l => siteLocalePath(l.code)) : [''])
      .map(path => `  <url>\n    <loc>${href(path)}</loc>${alternates}\n  </url>`)
      .join('\n')
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`
  }

  return {
    name: 'seo-pages',
    enforce: 'post',

    configResolved(resolved) {
      config = resolved
      siteUrl = String(resolved.env.VITE_SITE_URL ?? '').trim().replace(/\/+$/, '')
      const files = localeFiles(resolved.root, resolved.env)
      for (const { code, path } of files) {
        const messages = readMessages(path)
        texts.set(code, { title: messages.seo.title, description: messages.seo.description, siteName: messages.app.title })
      }
      locales = SITE_LOCALES.filter(l => texts.has(l.code))
      rootLocale = files.length > 1 ? DEFAULT_SITE_LOCALE : files[0].code
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (locales.length < 2) return next()
        const path = req.url?.split('?')[0]
        const locale = locales.find(l => path === `/${l.path}/site.webmanifest`)
        if (!locale && path !== '/site.webmanifest') return next()
        res.setHeader('Content-Type', 'application/manifest+json')
        res.end(manifest(locale?.code ?? rootLocale, locale ? `${locale.path}/` : ''))
      })
    },

    // The dev server serves the root page; the build fills the markers in generateBundle
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (config.command !== 'serve') return html
        const entry = locales.find(l => context.path === `/${l.path}/` || context.path === `/${l.path}/index.html`)
        return render(html, entry?.code ?? rootLocale, entry ? `${entry.path}/` : '')
      },
    },

    generateBundle(_, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset') return
      const template = String(index.source)
      if (!siteUrl) {
        config.logger.warn('[seo-pages] VITE_SITE_URL is not set: canonical links, hreflang and sitemap.xml are skipped (titles and descriptions are still written).')
      }
      index.source = render(template, rootLocale, '')
      if (locales.length > 1) {
        this.emitFile({ type: 'asset', fileName: 'site.webmanifest', source: manifest(rootLocale, '') })
        for (const l of locales) {
          this.emitFile({ type: 'asset', fileName: `${l.path}/index.html`, source: render(template, l.code, `${l.path}/`) })
          this.emitFile({ type: 'asset', fileName: `${l.path}/site.webmanifest`, source: manifest(l.code, `${l.path}/`) })
        }
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${href('sitemap.xml')}\n` : ''}` })
      if (siteUrl) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() })
    },
  }
}
