# Ena

Web frontend of Sekai Station.

## Architecture

- Vue 3
- Pinia
- vue-i18n
- Tailwind CSS 3
- VueUse
- Floating UI

## Development

We use **pnpm** to manage packages.

```bash
pnpm install --frozen-lockfile
pnpm dev            # dev server
pnpm dev:cn         # dev server for zh-cn server
pnpm build          # default build
pnpm build:cn       # web for zh-cn server (dist-zh)
pnpm preview        # serve dist/ (or preview:cn serves dist-zh/)
pnpm test:e2e       # test the default build via Playwright (before first run: pnpm exec playwright install chromium)
```

Build options are read from environment variables. Env files mappings are:
- `.env` : all builds default options
- `.env.development` : `pnpm dev` and `pnpm dev:cn` (local backend)
- `.env.production` : default `pnpm build`
- `.env.*` : region-specific `pnpm build:*`

See all build options details in `.env` file.
