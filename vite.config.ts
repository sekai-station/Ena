import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync } from 'node:fs'
import { appLocales } from './build/locales.ts'
import { seoPages } from './build/seo-pages.ts'

const root = import.meta.dirname
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

// The sidebar footer (VITE_FOOTER), with {version} filled in from package.json
function footerText(template: string): string {
  for (const [placeholder] of template.matchAll(/\{[^}]*\}/g)) {
    if (placeholder !== '{version}') console.warn(`[footer] unknown placeholder ${placeholder} in VITE_FOOTER (only {version} is replaced)`)
  }
  // Dashboard environment variables keep \n literal; dotenv may already decode it.
  return template.replaceAll('{version}', pkg.version).replaceAll('\\n', '\n').trim()
}

export default defineConfig(({ command, mode, isPreview }) => {
  // The dev server always talks to the backend set up in .env.development,
  // for `pnpm dev:cn` too; builds use their mode's env (.env.production, .env.cn)
  const dev = command === 'serve' && !isPreview
  const env = loadEnv(dev ? 'development' : mode, root, '')
  const apiBase = env.VITE_API_BASE?.trim()
  // Everything but the dev server's API comes from the mode's own env (dev:cn shows the CN footer)
  const modeEnv = dev ? loadEnv(mode, root, '') : env
  if (!apiBase && !isPreview) {
    throw new Error(`VITE_API_BASE is not set; put it in ${dev ? '.env.development' : `.env.${mode}`} (see .env)`)
  }

  return {
    plugins: [vue(), appLocales(), seoPages()],
    define: {
      // Sidebar footer lines, ready to show
      __FOOTER__: JSON.stringify(footerText(modeEnv.VITE_FOOTER ?? '')),
      ...(dev ? { 'import.meta.env.VITE_API_BASE': JSON.stringify(apiBase) } : {}),
    },
    resolve: {
      alias: {
        '@': resolve(root, 'src'),
      },
    },
    server: {
      // A relative API base (e.g. /station/api/v2) is forwarded to DEV_PROXY_TARGET
      proxy: dev && apiBase?.startsWith('/') && env.DEV_PROXY_TARGET
        ? { [apiBase]: { target: env.DEV_PROXY_TARGET, changeOrigin: true } }
        : undefined,
    },
    build: {
      outDir: 'dist',
    },
  }
})
