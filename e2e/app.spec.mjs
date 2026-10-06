// End-to-end tests against a production build of the default edition on :5199
// (see playwright.config.ts), talking to the mock API in mock.mjs.
//
// Each check() is a soft assertion: a failing check is reported and the test
// carries on, so one run lists everything that is broken.
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const BASE = 'http://127.0.0.1:5199/', CTL = 'http://127.0.0.1:8787/ctl/'
const ROOT = new URL('../', import.meta.url)
const file = path => new URL(path, ROOT)
const ctl = op => fetch(CTL + op).then(r => r.text())
const sleep = ms => new Promise(r => setTimeout(r, ms))
const check = (name, ok, extra = '') => expect.soft(ok, `${name} ${extra}`.trim()).toBeTruthy()

// Contexts are closed after each test so their streams do not linger on the mock
let browser
let contexts = []
const newContext = async opts => {
  const ctx = await browser.newContext(opts)
  contexts.push(ctx)
  return ctx
}

test.beforeEach(async ({ browser: b }) => {
  browser = b
  await ctl('up')
  await ctl('reset')
})

test.afterEach(async () => {
  await Promise.all(contexts.map(ctx => ctx.close()))
  contexts = []
})

const newPage = async (opts = {}, init = {}) => {
  const ctx = await newContext({ locale: 'en-US', viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'], ...opts })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if ((m.type() === 'error' && !/ERR_INCOMPLETE_CHUNKED/.test(m.text())) || (m.type() === 'warning' && /Vue warn/.test(m.text()))) errors.push(m.text()) })
  // Every test except the onboarding one starts as a returning visitor
  const seed = { 'pjsk-onboarding': 'done', ...init }
  for (const k of Object.keys(seed)) if (seed[k] === null) delete seed[k]
  await page.addInitScript(v => { for (const [k, val] of Object.entries(v)) localStorage.setItem(k, val) }, seed)
  page.errors = errors
  return page
}
const ids = async page => (await page.locator('button.font-mono').allTextContents()).map(t => t.trim())
const store = (page, expr) => page.evaluate(e => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('rooms'); return new Function('s', 'return ' + e)(s) }, expr)

test('burst + announcement + live + menu/copy', async () => {
  const page = await newPage()
  await page.goto(BASE)
  await page.waitForSelector('button.font-mono')
  check('burst sorted newest first, expired dropped', JSON.stringify(await ids(page)) === '["22222","11111","33333"]', JSON.stringify(await ids(page)))
  const first = await page.locator('main .border-b').first().innerText()
  check('announcement on top (not through fake room)', first.includes('English notice'), first.slice(0, 40))
  check('html lang set', await page.evaluate(() => document.documentElement.lang) === 'en')
  check('locale not persisted on detect', await page.evaluate(() => localStorage.getItem('pjsk-locale')) === null)
  await ctl('room?id=55555&msg=fresh')
  await page.waitForFunction(() => document.querySelector('button.font-mono')?.textContent.trim() === '55555')
  check('live room prepended', (await ids(page))[0] === '55555')
  // menu
  const more = page.getByRole('button', { name: 'More actions' }).first()
  await more.click()
  check('menu opens', await page.getByRole('menu').isVisible())
  const box = await page.getByRole('menu').boundingBox(), vb = page.viewportSize()
  check('menu inside viewport', box.x >= 0 && box.y >= 0 && box.x + box.width <= vb.width && box.y + box.height <= vb.height, JSON.stringify(box))
  await page.keyboard.press('Escape')
  await sleep(300)
  check('Escape closes menu', await page.getByRole('menu').count() === 0)
  await more.click(); await sleep(200)
  check('first menu item focused', await page.evaluate(() => document.activeElement?.getAttribute('role')) === 'menuitem')
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape'); await sleep(300)
  check('focus returns to trigger', await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup')) === 'menu')
  await more.click(); await page.mouse.click(700, 700)   // empty space outside the menu
  await sleep(300)
  check('outside click closes menu', await page.getByRole('menu').count() === 0)
  await more.click()
  await page.getByRole('menuitem', { name: 'Copy Text' }).click()
  await page.waitForSelector('[role=status] >> text=Copied')
  const copiedText = await page.evaluate(() => navigator.clipboard.readText())
  check('menu copy text works', copiedText.replaceAll('\r\n', '\n').startsWith('55555\n'), JSON.stringify(copiedText))
  await page.getByRole('button', { name: 'Copy Room ID 33333' }).click()
  await sleep(200)
  check('one-click copy of room id', await page.evaluate(() => navigator.clipboard.readText()) === '33333')
  check('copied state shown on the id', await page.locator('button.font-mono.text-primary-600').count() === 1)
  check('id rendered in monospace', /JetBrains|mono/i.test(await page.evaluate(() => getComputedStyle(document.querySelector('button.font-mono')).fontFamily)))
  check('no collapse toggle', await page.getByRole('button', { name: /Show (more|less)/ }).count() === 0)
  const longMsg = page.locator('main p.font-content', { hasText: '#プロセカ協力' })
  const fullyShown = await longMsg.evaluate(el => el.scrollHeight <= el.clientHeight + 1 && getComputedStyle(el).webkitLineClamp === 'none')
  check('long message fully expanded', fullyShown)
  check('no expiry bar', await page.locator('.expiry-bar').count() === 0)
  const sizes = await page.evaluate(() => {
    const px = el => parseFloat(getComputedStyle(el).fontSize)
    const card = [...document.querySelectorAll('main button.font-mono')].find(b => b.textContent.trim() === '33333').closest('.flex.items-start')
    return { id: px(card.querySelector('button.font-mono')), name: px(card.querySelector('span.font-medium.font-content')), msg: px(card.querySelector('p.font-content')) }
  })
  check('font sizes: name 14 / message 16 / room id 18', sizes.name === 14 && sizes.msg === 16 && sizes.id === 18, JSON.stringify(sizes))
  const sep = await page.evaluate(() => { const w = document.querySelector('main button.font-mono').closest('.border-b'); return getComputedStyle(w).borderBottomColor })
  check('separator is the plain gray border', sep === 'rgb(243, 244, 246)', sep)
  const hit = await page.getByRole('button', { name: 'Pin', exact: true }).first().boundingBox()
  check('action hit area >= 28px', hit.width >= 28 && hit.height >= 28, JSON.stringify(hit))
  // pin
  await page.getByRole('button', { name: 'Pin', exact: true }).nth(2).click() // 11111
  await sleep(200)
  const afterPin = await ids(page)
  check('pinned room floats to top', afterPin[0] === '11111', JSON.stringify(afterPin))
  // server drops the stream; browser auto-reconnects and server replays everything
  await ctl('drop'); await ctl('room?id=66666&msg=missed')
  await page.waitForFunction(() => [...document.querySelectorAll('button.font-mono')].some(e => e.textContent.trim() === '66666'), null, { timeout: 15000 })
  await sleep(1200)
  const after = await ids(page)
  check('no duplicates after replay', new Set(after).size === after.length && after.length === 5, JSON.stringify(after))
  check('pinned kept after reconnect', after[0] === '11111')
  const annCount = await page.locator('text=English notice').count()
  check('announcement not duplicated', annCount === 1, String(annCount))
  // locale switch refreshes announcement in place
  await page.locator('aside:visible button', { hasText: 'English' }).click()
  await page.getByRole('option', { name: '简体中文' }).click()
  await page.waitForSelector('text=中文公告')
  check('announcement follows locale', await page.locator('text=English notice').count() === 0)
  check('locale persisted on explicit choice', await page.evaluate(() => localStorage.getItem('pjsk-locale')) === 'zh-Hans')
  check('switching on the root page keeps the root address', await page.evaluate(() => location.pathname) === '/')
  check('relative time localized', /秒前|分钟前/.test(await page.locator('main').innerText()))
  // dismiss announcement, drop the stream: must not come back after the reconnect
  await page.getByRole('button', { name: '关闭' }).first().click()
  await sleep(900)
  await store(page, 's.dropStream()')
  await page.waitForSelector('[role=alert] >> text=已断开')
  await page.waitForFunction(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('rooms').connectionState === 'open', null, { timeout: 5000 })
  await sleep(1200)
  check('dismissed announcement stays dismissed', await page.locator('text=中文公告').count() === 0)
  check('no console errors', page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)))
})

test('filter + sweep', async () => {
  const page = await newPage({}, { 'pjsk-expire-time': '10', 'pjsk-filter-keywords': '["sage"]' })
  await page.goto(BASE)
  await page.waitForSelector('text=English notice')
  check('legacy stored settings still read', await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('settings').expireTime) === 10)
  await ctl('room?id=77777&msg=sage%20live'); await ctl('room?id=88888&msg=plain'); await page.waitForSelector('button.font-mono')
  check('blacklisted room hidden', JSON.stringify(await ids(page)) === '["88888"]', JSON.stringify(await ids(page)))
  check('but held in store', (await store(page, 's.rooms.map(r => r.id)')).includes('77777'))
  check('filter bar mask var defined', (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--mask-bg'))).trim() !== '')
  await sleep(47000)
  const left = await store(page, 's.rooms.map(r => r.id)')
  check('sweep collected filtered + expired rooms', left.length === 0, JSON.stringify(left))
  check('no console errors', page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)))
})

test('connection: start, backoff, no buttons', async () => {
  // record every EventSource the page creates, and whether the app had rendered yet
  const recorder = () => {
    window.__esLog = []
    const Orig = window.EventSource
    window.__esBeforeMount = []
    window.EventSource = function (url, opts) {
      window.__esLog.push(Date.now())
      window.__esBeforeMount.push(!document.querySelector('#app')?.hasChildNodes())
      return new Orig(url, opts)
    }
    window.EventSource.prototype = Orig.prototype
    Object.assign(window.EventSource, { CONNECTING: 0, OPEN: 1, CLOSED: 2 })
  }
  const page = await newPage()
  await page.addInitScript(recorder)
  await page.goto(BASE); await page.waitForSelector('main button.font-mono'); await sleep(2500)
  check('one stream per page', await page.evaluate(() => window.__esLog.length) === 1)
  check('stream opened as soon as the app runs, before it renders', await page.evaluate(() => window.__esBeforeMount[0]) === true)
  check('index.html no longer opens a stream', !(await (await fetch(BASE)).text()).includes('EventSource'))

  // the server goes away mid-session
  await page.evaluate(() => { window.__esLog = [] })
  await ctl('down')
  await page.waitForSelector('[role=alert] >> text=Disconnected', { timeout: 5000 })
  const banner = await page.locator('[role=alert]').innerText()
  check('banner shows the wait, not a button', /Retrying in \d+s|Reconnecting/.test(banner) && await page.locator('[role=alert] button').count() === 0, banner.replace(/\n/g, ' '))
  await sleep(9500)   // third try lands 1+2+4 s ±25% after the drop: up to ~8.8 s
  const t = await page.evaluate(() => window.__esLog)
  const gaps = t.slice(1).map((x, k) => x - t[k])
  check('retries back off 1 s, 2 s, 4 s with jitter', t.length >= 3 && gaps[0] >= 1300 && gaps[0] <= 2800 && gaps[1] >= 2700 && gaps[1] <= 5400, JSON.stringify({ attempts: t.length, gaps }))
  await ctl('up')
  await page.waitForFunction(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('rooms').connectionState === 'open', null, { timeout: 15000 })
  await sleep(300)
  check('reconnects by itself once the server is back', await page.locator('[role=alert]').count() === 0)

  // Dev Tools' "Drop SSE connection" takes the same path as a real drop
  const before = await page.evaluate(() => window.__esLog.length)
  await store(page, 's.dropStream()')
  await page.waitForSelector('[role=alert] >> text=Disconnected', { timeout: 2000 })
  const dropBanner = await page.locator('[role=alert]').innerText()
  check('a dropped stream shows the banner with a countdown', /Retrying in \d+s|Reconnecting/.test(dropBanner), dropBanner.replace(/\n/g, ' '))
  await page.waitForFunction(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('rooms').connectionState === 'open', null, { timeout: 5000 })
  await sleep(300)
  check('and reconnects by itself', await page.locator('[role=alert]').count() === 0 && await page.evaluate(() => window.__esLog.length) === before + 1)

  // first visit while the server is down
  await ctl('down')
  const p2 = await newPage()
  await p2.goto(BASE)
  await p2.waitForSelector('text=Unable to reach the server', { timeout: 8000 })
  check('first load failure: countdown, no button', /Retrying in \d+s|Reconnecting/.test(await p2.locator('main').innerText()) && await p2.locator('main button').count() === 0)
  await ctl('up')
  await p2.waitForSelector('main button.font-mono', { timeout: 15000 })
  check('first load recovers without a click', (await ids(p2)).length === 3)
})

test('status page refreshes', async () => {
  const page = await newPage()
  let calls = 0
  page.on('request', r => { if (r.url().endsWith('/status')) calls++ })
  await page.goto(BASE + '#/status'); await page.waitForSelector('text=x-crawler')
  check('shows the refresh interval and time', /Refreshes every 10s · updated \d{1,2}:\d{2}:\d{2}/.test(await page.locator('h1').locator('..').innerText()))
  await sleep(10800)
  check('refreshed after 10 s without reloading the page', calls === 2, String(calls))
  await page.goto(BASE + '#/'); await sleep(11000)
  check('stops when leaving the page', calls === 2, String(calls))
})

test('dark mode + pages', async () => {
  const page = await newPage({ colorScheme: 'dark' })
  await page.goto(BASE)
  check('follows system dark by default', await page.evaluate(() => document.documentElement.classList.contains('dark')))
  check('html has no stray background', await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor) === 'rgba(0, 0, 0, 0)')
  await page.goto(BASE + '#/status'); await page.waitForSelector('text=x-crawler', { timeout: 8000 })
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('h1').closest('.border-b')).backgroundColor)
  check('status page dark background', bg === 'rgb(17, 24, 39)', bg)
  await page.goto(BASE + '#/about'); await page.waitForSelector('.about-prose h1')
  const c = await page.evaluate(() => getComputedStyle(document.querySelector('.about-prose h1')).color)
  check('about heading colored in dark', c === 'rgb(243, 244, 246)', c)
  const fabs = await page.locator('.fixed.bottom-6 button').evaluateAll(bs => bs.map(b => { const r = b.getBoundingClientRect(); return [b.getAttribute('aria-label'), Math.round(r.left), Math.round(r.top)] }))
  check('focus button stacked above settings', fabs.length === 2 && fabs[0][0] === 'Focus Mode' && fabs[1][0] === 'Settings' && fabs[0][1] === fabs[1][1] && fabs[0][2] < fabs[1][2], JSON.stringify(fabs))
  await page.getByRole('button', { name: 'Settings' }).click()
  check('settings panel has no tabs', await page.getByRole('tab').count() === 0)
  check('theme defaults to System', await page.getByRole('radio', { name: 'System' }).getAttribute('aria-checked') === 'true')
  const selBg = await page.getByRole('radio', { name: 'System' }).evaluate(el => getComputedStyle(el).backgroundColor)
  check('selected option uses the site palette', selBg !== 'rgb(17, 24, 39)' && selBg !== 'rgb(243, 244, 246)' && /^rgba?\(/.test(selBg), selBg)
  await page.getByRole('radio', { name: 'Light' }).click()
  check('toggle overrides system', await page.evaluate(() => !document.documentElement.classList.contains('dark') && localStorage.getItem('pjsk-dark-mode') === 'false'))
  const c2 = await page.evaluate(() => getComputedStyle(document.querySelector('.about-prose h1')).color)
  check('about heading colored in light', c2 === 'rgb(17, 24, 39)', c2)
  await page.reload(); await page.waitForSelector('.about-prose h1')
  check('override survives reload', await page.evaluate(() => !document.documentElement.classList.contains('dark')))
  check('no console errors', page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)))
})

test('mobile', async () => {
  const page = await newPage({ viewport: { width: 390, height: 780 }, hasTouch: true })
  await page.goto(BASE); await page.waitForSelector('button.font-mono')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await sleep(400)
  check('sidebar opens', await page.locator('aside:visible').count() === 1)
  await page.keyboard.press('Escape'); await sleep(500)
  check('Escape closes sidebar', await page.locator('aside:visible').count() === 0)
  await page.getByRole('button', { name: 'More actions' }).first().click()
  const box = await page.getByRole('menu').boundingBox()
  check('menu inside mobile viewport', box.x >= 0 && box.x + box.width <= 390 && box.y >= 0, JSON.stringify(box))
  const hit = await page.getByRole('button', { name: 'More actions' }).first().boundingBox()
  check('touch target >= 32px', hit.width >= 32 && hit.height >= 32, JSON.stringify(hit))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('main *')].some(e => !e.closest('.app-bg') && e.getBoundingClientRect().right > innerWidth + 1))
  check('no horizontal overflow on mobile', !overflow)
  check('page itself does not scroll sideways', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth))
})

test('whitelist highlight + focus + sidebar', async () => {
  const page = await newPage({ colorScheme: 'dark' }, { 'pjsk-filter-mode': 'whitelist', 'pjsk-filter-keywords': '["MV"]' })
  await page.goto(BASE); await page.waitForSelector('button.font-mono')
  check('whitelist keeps matching rooms', JSON.stringify(await ids(page)) === '["11111","33333"]', JSON.stringify(await ids(page)))
  check('matched keyword highlighted', JSON.stringify(await page.locator('main mark').allTextContents()) === '["MV","MV"]', JSON.stringify(await page.locator('main mark').allTextContents()))
  await page.getByRole('button', { name: 'Toggle sidebar' }).click(); await sleep(200)
  check('sidebar collapses', await page.locator('aside:visible').count() === 0)
  await page.getByRole('button', { name: 'Toggle sidebar' }).click(); await sleep(200)
  check('sidebar reopens from visible button', await page.locator('aside:visible').count() === 1)
  await page.getByRole('button', { name: 'Focus Mode' }).click(); await sleep(300)
  check('focus mode entered from settings', await page.locator('aside:visible').count() === 0 && await page.getByRole('button', { name: 'Exit Focus' }).count() === 1)
  check('no console errors', page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)))
})

test('long-press block', async () => {
  const page = await newPage()
  await page.goto(BASE); await page.waitForSelector('button.font-mono')
  check('logo replaced', await page.locator('aside:visible img').evaluate(img => img.getAttribute('src') === '/logo.png' && img.naturalWidth === 512))
  check('room id hint mentions hold', (await page.locator('button.font-mono').first().getAttribute('title')).includes('hold 1 s'))
  await page.evaluate(() => navigator.clipboard.writeText('untouched'))
  const idBox = async id => (await page.locator('button.font-mono', { hasText: id }).boundingBox())
  const holdOn = async (id, ms, moveAway = false) => {
    const b = await idBox(id)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await sleep(Math.min(ms, 450))
    const filling = await page.locator('button.font-mono.is-holding').count()
    if (moveAway) await page.mouse.move(b.x + 400, b.y + 300)
    if (ms > 450) await sleep(ms - 450)
    await page.mouse.up()
    return filling
  }
  const shown = async id => (await ids(page)).includes(id)

  check('fill animation runs while holding', await holdOn('22222', 650) === 1)
  await sleep(700)
  check('released early: not blocked', await shown('22222'))
  check('released early: nothing copied', await page.evaluate(() => navigator.clipboard.readText()) === 'untouched')

  await holdOn('22222', 1500, true)
  await sleep(700)
  check('moving away cancels the hold', await shown('22222'))

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button.font-mono')].find(b => b.textContent.trim() === '22222')
    const card = btn.closest('.border-b')
    window.__hold = {}
    btn.addEventListener('pointerdown', () => { window.__hold.down = performance.now() }, { capture: true, once: true })
    const poll = () => { if (!document.contains(card)) { window.__hold.gone = performance.now(); return } requestAnimationFrame(poll) }
    requestAnimationFrame(poll)
  })
  await holdOn('22222', 1300)
  await sleep(400)
  const goneAfter = await page.evaluate(() => (window.__hold.gone - window.__hold.down) / 1000)
  check('held 1 s: room gone right after 1 s', goneAfter >= 1 && goneAfter <= 1.3, goneAfter.toFixed(2) + ' s')
  check('held 1 s: room hidden', !(await shown('22222')), JSON.stringify(await ids(page)))
  check('block toast with undo', await page.locator('[role=status]', { hasText: 'Hid 22222 for 10 minutes' }).count() === 1 && await page.getByRole('button', { name: 'Undo' }).count() === 1)
  check('hold does not copy', await page.evaluate(() => navigator.clipboard.readText()) === 'untouched')
  await page.getByRole('button', { name: 'Undo' }).click(); await sleep(300)
  check('undo brings it back', await shown('22222'))

  await holdOn('22222', 1300); await sleep(500)
  await ctl('room?id=22222&msg=same%20number%20again'); await sleep(500)
  check('new rooms with a blocked number stay hidden', !(await shown('22222')))
  const until = await page.evaluate(() => JSON.parse(localStorage.getItem('pjsk-blocked-ids'))['22222'] - Date.now())
  check('block lasts 10 minutes', until > 9.9 * 60_000 && until <= 10 * 60_000, String(until))

  await page.getByRole('button', { name: 'More actions' }).first().click()
  const itemPx = await page.getByRole('menuitem').first().evaluate(el => getComputedStyle(el).fontSize)
  check('menu text is 13px', itemPx === '13px', itemPx)
  const firstId = (await ids(page))[0]
  await page.getByRole('menuitem', { name: 'Hide for 10 min' }).click(); await sleep(900)
  check('menu item blocks too', !(await shown(firstId)), firstId)

  await page.reload(); await page.waitForSelector('button.font-mono')
  check('blocks survive a reload', !(await shown('22222')) && !(await shown(firstId)))
  await page.getByRole('button', { name: 'Settings' }).click()
  check('hidden numbers are not listed on the first level', await page.locator('[role=dialog] .font-mono', { hasText: '22222' }).count() === 0)
  await page.getByRole('button', { name: /Hidden for now/ }).click(); await sleep(250)
  const sub = page.getByRole('menu', { name: 'Hidden for now' })
  check('separate popup lists hidden numbers', await sub.isVisible() && await sub.locator('.font-mono', { hasText: '22222' }).count() === 1)
  const sb = await sub.boundingBox(), pb = await page.locator('[role=dialog]').boundingBox()
  check('popup opens beside the settings panel', sb.x + sb.width <= pb.x + 1, JSON.stringify({ sub: sb.x + sb.width, panel: pb.x }))
  await page.keyboard.press('Escape'); await sleep(200)
  check('Escape closes only the popup', await sub.count() === 0 && await page.locator('[role=dialog]').count() === 1)
  await page.getByRole('button', { name: /Hidden for now/ }).click(); await sleep(250)
  await page.getByRole('menuitem', { name: 'Unhide 22222' }).click(); await sleep(400)
  check('unhide from the popup', await shown('22222'))
  await page.getByRole('button', { name: /Hidden for now/ }).click(); await sleep(150)
  await page.getByRole('button', { name: 'Font Size increase' }).click(); await sleep(100)
  const msgPx = await page.locator('main p.font-content').first().evaluate(el => getComputedStyle(el).fontSize)
  check('font size stepper', await page.evaluate(() => localStorage.getItem('pjsk-font-size')) === '15' && msgPx === '17px', msgPx)
  await page.locator('#expire-select').selectOption('60')
  check('expire select', await page.evaluate(() => localStorage.getItem('pjsk-expire-time')) === '60')
  check('no console errors', page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)))
})

test('paper-plane background', async () => {
  const page = await newPage({ viewport: { width: 1600, height: 900 } })
  await page.goto(BASE); await page.waitForSelector('button.font-mono')
  check('six planes behind the list', await page.locator('main .app-bg .plane').count() === 6)
  const centre = () => page.evaluate(() => { const r = document.querySelectorAll('.app-bg .plane')[2].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  const a = await centre(); await sleep(2500); const b = await centre()
  const travel = Math.atan2(a.y - b.y, b.x - a.x) * 180 / Math.PI
  const nose = await page.evaluate(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('.app-bg .flight')).transform); return -Math.atan2(m.b, m.a) * 180 / Math.PI })
  check('planes fly the way their nose points', Math.abs(travel - nose) < 1, `travel ${travel.toFixed(1)}°, nose ${nose.toFixed(1)}°`)
  check('list column lets the background through', (await page.locator('main .min-h-screen').first().evaluate(el => getComputedStyle(el).backgroundColor)).startsWith('rgba('))
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: 'Off' }).click(); await sleep(200)
  check('setting turns the background off', await page.locator('.app-bg').count() === 0 && await page.evaluate(() => localStorage.getItem('pjsk-animated-bg')) === 'false')
  await page.getByRole('radio', { name: 'On' }).click(); await sleep(200)
  check('and back on', await page.locator('.app-bg .plane').count() === 6)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Focus Mode' }).click(); await sleep(200)
  check('focus mode stays plain', await page.locator('.app-bg').count() === 0)
  const still = await newPage({ reducedMotion: 'reduce' })
  await still.goto(BASE); await still.waitForSelector('button.font-mono')
  check('reduced motion: planes do not move', (await still.locator('.app-bg .plane').first().evaluate(el => getComputedStyle(el).animationName)) === 'none')
  check('no console errors', page.errors.length === 0 && still.errors.length === 0, JSON.stringify([...page.errors, ...still.errors].slice(0, 3)))
})

test('onboarding guide', async () => {
  const page = await newPage({}, { 'pjsk-onboarding': null })
  await page.goto(BASE)
  const welcome = page.getByRole('dialog', { name: 'Welcome to SEKAI Station' })
  await welcome.waitFor({ timeout: 5000 })
  const wb = await welcome.boundingBox(), vp = page.viewportSize()
  check('first visit: welcome box centred', Math.abs(wb.x + wb.width / 2 - vp.width / 2) < 2 && Math.abs(wb.y + wb.height / 2 - vp.height / 2) < 2)
  await page.getByRole('button', { name: 'Show me' }).click(); await sleep(400)
  const box = page.locator('[role=dialog][aria-live]')
  const feedIds = async () => (await page.locator('main button.font-mono').allTextContents()).map(t => t.trim())
  check('example is inside the box', (await box.locator('button.font-mono').innerText()).trim() === '00000')
  check('example text', (await box.innerText()).includes('This is an example'))
  check('feed has no example', !(await feedIds()).includes('00000'))
  const bb = await box.boundingBox()
  check('example steps use a centred box', Math.abs(bb.x + bb.width / 2 - vp.width / 2) < 2)
  check('step 1 explains copying', (await box.innerText()).includes('Copy a room number'))
  await page.evaluate(() => navigator.clipboard.writeText('untouched'))
  const real = await page.locator('main button.font-mono', { hasText: '22222' }).boundingBox()
  await page.mouse.click(real.x + real.width / 2, real.y + real.height / 2); await sleep(300)
  check('page behind the box is blocked', await page.evaluate(() => navigator.clipboard.readText()) === 'untouched')
  await box.locator('[data-tour="demo-id"]').click(); await sleep(400)
  check('copying the example moves to step 2', (await box.innerText()).includes('Pin to top') && await page.evaluate(() => navigator.clipboard.readText()) === '00000')
  await box.locator('[data-tour="demo-pin"]').click(); await sleep(400)
  check('pinning the example moves to step 3', (await box.innerText()).includes('Hide a room number'))
  check('example pin is not saved', await page.evaluate(() => !('tutorial-demo' in JSON.parse(localStorage.getItem('pjsk-pinned-rooms') || '{}'))))
  check('feed still has no example after pinning', !(await feedIds()).includes('00000'))
  const d = await box.locator('[data-tour="demo-id"]').boundingBox()
  await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2); await page.mouse.down(); await sleep(1150); await page.mouse.up(); await sleep(150)
  check('holding fades the example out', await box.locator('button.font-mono').count() === 0)
  check('block toast shown', await page.locator('[role=status]', { hasText: 'Hid 00000' }).count() === 1)
  await sleep(800)
  check('then moves to step 4 (focus mode)', (await box.innerText()).includes('Focus mode'))
  check('example never enters the block list', await page.evaluate(() => !('00000' in JSON.parse(localStorage.getItem('pjsk-blocked-ids') || '{}'))))
  await page.getByRole('button', { name: 'Next' }).click(); await sleep(300)
  check('step 5 points at settings', (await box.innerText()).includes('Settings'))
  const hb = await page.locator('[data-tour="settings"]').boundingBox(), bx = await box.boundingBox()
  check('step 5 bubble sits beside the settings button', bx.x + bx.width <= hb.x + 1, JSON.stringify({ bubbleRight: bx.x + bx.width, button: hb.x }))
  await page.getByRole('button', { name: 'Finish' }).click(); await sleep(400)
  check('finishing closes everything, no final box', await page.locator('[role=dialog]').count() === 0)
  check('remembered as done', await page.evaluate(() => localStorage.getItem('pjsk-onboarding')) === 'done')
  check('no pin left behind', await page.evaluate(() => !document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('rooms').pinnedKeys.has('tutorial-demo')))
  await page.reload(); await page.waitForSelector('main button.font-mono'); await sleep(1200)
  check('not shown again', await page.locator('[role=dialog]').count() === 0)
  check('no console errors', page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)))

  const p2 = await newPage({ viewport: { width: 390, height: 780 }, hasTouch: true }, { 'pjsk-onboarding': null, 'pjsk-locale': 'zh-Hans' })
  await p2.goto(BASE)
  await p2.getByRole('button', { name: '开始指引' }).click(); await sleep(400)
  const box2 = p2.locator('[role=dialog][aria-live]')
  const b2 = await box2.boundingBox()
  check('mobile: box fits the screen', b2.x >= 0 && b2.x + b2.width <= 390, JSON.stringify(b2))
  check('zh-Hans example text', (await box2.innerText()).includes('这是一个示例'))
  check('zh-Hans step 1 copy', (await box2.innerText()).includes('点一下房间号就会自动复制。点一下 00000 试试。'))
  await box2.getByRole('button', { name: '跳过这一步' }).click(); await sleep(200)
  check('zh-Hans step 2 copy', (await box2.innerText()).includes('可以点这个按钮置顶房间，它会固定在最上面，不会消失。'))
  await box2.getByRole('button', { name: '跳过这一步' }).click(); await sleep(200)
  check('zh-Hans step 3 copy', (await box2.innerText()).includes('暂时不想看到某个房间号？按住它 1 秒，这个房间号会被屏蔽 10 分钟。按住 00000 试试。'))
  await box2.getByRole('button', { name: '跳过这一步' }).click(); await sleep(300)
  check('zh-Hans step 4 is focus mode', (await box2.innerText()).includes('专注模式'))
  await box2.getByRole('button', { name: '下一步' }).click(); await sleep(300)
  check('zh-Hans step 5 copy', (await box2.innerText()).includes('关键词过滤、房间显示时长、字号和外观都在这里'))
  await p2.keyboard.press('Escape'); await sleep(300)
  check('Escape ends the guide', await p2.locator('[role=dialog]').count() === 0 && await p2.evaluate(() => localStorage.getItem('pjsk-onboarding')) === 'skipped')

  const p4 = await newPage({}, { 'pjsk-onboarding': null, 'pjsk-locale': 'zh-Hans' })
  await p4.goto(BASE)
  check('zh-Hans welcome copy', (await p4.getByRole('dialog').innerText()).includes('这里会实时刷新从社交平台获取到的多人游戏房间信息，需要花一分钟熟悉一下基本操作吗？'))

  const p3 = await newPage({}, { 'pjsk-onboarding': null })
  await p3.goto(BASE)
  await p3.getByRole('button', { name: 'Skip' }).click(); await sleep(300)
  check('skip closes and is remembered', await p3.locator('[role=dialog]').count() === 0 && await p3.evaluate(() => localStorage.getItem('pjsk-onboarding')) === 'skipped')
})

test('language entry pages', async () => {
  const CODES = { ja: 'ja', 'zh-Hans': 'zh-hans', 'zh-Hant': 'zh-hant', en: 'en' }
  const seo = Object.fromEntries(Object.keys(CODES).map(c => [c, JSON.parse(readFileSync(file(`src/i18n/locales/${c}.json`), 'utf8')).seo]))
  const head = p => p.evaluate(() => ({ lang: document.documentElement.lang, title: document.title, desc: document.querySelector('meta[name="description"]')?.content, ogTitle: document.querySelector('meta[property="og:title"]')?.content, ogDesc: document.querySelector('meta[property="og:description"]')?.content, ogLocale: document.querySelector('meta[property="og:locale"]')?.content, path: location.pathname, hash: location.hash }))

  // What a crawler gets without running scripts
  const unescape = v => v.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  for (const [code, path] of [['ja', ''], ...Object.entries(CODES).map(([c, p]) => [c, p + '/'])]) {
    const html = await (await fetch(BASE + path)).text()
    const lang = html.match(/<html lang="([^"]*)"/)?.[1]
    const title = unescape(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '')
    const desc = unescape(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '')
    const titles = html.match(/<title>/g)?.length, descs = html.match(/name="description"/g)?.length
    check(`static /${path}: lang, title, description`, lang === code && title === seo[code].title && desc === seo[code].description && titles === 1 && descs === 1, JSON.stringify({ lang, titles, descs }))
    const manifestPath = html.match(/rel="manifest" href="([^"]*)"/)?.[1]
    const manifest = await (await fetch(new URL(manifestPath, BASE))).json()
    const name = code === 'ja' ? 'プロセカ Station' : 'SEKAI Station'
    check(`static /${path}: localized manifest`, manifest.name === name && manifest.short_name === name && manifest.lang === code && manifest.id === '/', JSON.stringify(manifest))
  }
  check('robots.txt served', /User-agent: \*/.test(await (await fetch(BASE + 'robots.txt')).text()))

  // A Japanese browser that follows the English link gets English
  const page = await newPage({ locale: 'ja-JP' })
  await page.goto(BASE + 'en/')
  await page.waitForSelector('main button.font-mono')
  let h = await head(page)
  check('/en/ in a Japanese browser shows English', h.lang === 'en' && await page.locator('aside:visible button', { hasText: 'English' }).count() === 1, JSON.stringify(h))
  check('/en/ keeps the English title and description', h.title === seo.en.title && h.desc === seo.en.description)
  check('/en/ uses the English manifest', await page.locator('link[rel="manifest"]').getAttribute('href') === '/en/site.webmanifest')
  check('/en/ receives rooms', JSON.stringify(await ids(page)) === '["22222","11111","33333"]', JSON.stringify(await ids(page)))
  check('following a language link is not saved as a choice', await page.evaluate(() => localStorage.getItem('pjsk-locale')) === null)

  await page.locator('aside:visible a', { hasText: 'Status' }).click()
  await page.waitForSelector('text=x-crawler')
  h = await head(page)
  check('other pages stay under /en/', h.path === '/en/' && h.hash === '#/status', h.path + h.hash)
  await page.goBack(); await page.waitForSelector('main button.font-mono')
  h = await head(page)
  check('back returns to the list under /en/', h.path === '/en/' && (h.hash === '#/' || h.hash === ''), h.path + h.hash)

  await page.locator('aside:visible button', { hasText: 'English' }).click()
  await page.getByRole('option', { name: '繁體中文' }).click()
  await page.waitForSelector('aside:visible a:has-text("運行狀態")')
  h = await head(page)
  check('switching language goes back to the root address', h.path === '/' && h.hash === '#/', h.path + h.hash)
  check('switching language saves the choice', await page.evaluate(() => localStorage.getItem('pjsk-locale')) === 'zh-Hant')
  check('switching language updates lang, title and description', h.lang === 'zh-Hant' && h.title === seo['zh-Hant'].title && h.desc === seo['zh-Hant'].description, JSON.stringify(h))
  check('switching language updates Open Graph', h.ogTitle === seo['zh-Hant'].title && h.ogDesc === seo['zh-Hant'].description && h.ogLocale === 'zh_TW', JSON.stringify(h))
  check('switching language updates the manifest', await page.locator('link[rel="manifest"]').getAttribute('href') === '/zh-hant/site.webmanifest')
  await page.locator('aside:visible a', { hasText: '運行狀態' }).click()
  await page.waitForSelector('text=x-crawler')
  check('navigation after switching stays on the root address', (await head(page)).path === '/' && (await head(page)).hash === '#/status')
  await page.reload(); await page.waitForSelector('text=x-crawler')
  h = await head(page)
  check('reload keeps the language and page', h.lang === 'zh-Hant' && h.hash === '#/status', JSON.stringify(h))
  // Switching on another page keeps that page
  await page.goto(BASE + 'en/#/about'); await page.waitForSelector('.about-prose h1')
  check('/en/ entry page wins over the saved choice', (await head(page)).lang === 'en')
  await page.locator('aside:visible button', { hasText: 'English' }).click()
  await page.getByRole('option', { name: '日本語' }).click()
  await page.waitForFunction(() => document.documentElement.lang === 'ja')
  h = await head(page)
  check('switching on the about page keeps the about page at the root address', h.path === '/' && h.hash === '#/about', h.path + h.hash)
  check('no console errors on language pages', page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)))

  // The root address still follows the browser, or the saved choice
  const root = await newPage({ locale: 'ja-JP' })
  await root.goto(BASE); await root.waitForSelector('main button.font-mono')
  h = await head(root)
  check('root follows the browser language and keeps its address', h.lang === 'ja' && h.title === seo.ja.title && h.path === '/', JSON.stringify(h))
  const saved = await newPage({ locale: 'ja-JP' }, { 'pjsk-locale': 'zh-Hans' })
  await saved.goto(BASE); await saved.waitForSelector('main button.font-mono')
  h = await head(saved)
  check('root uses a saved choice', h.lang === 'zh-Hans' && h.title === seo['zh-Hans'].title && h.desc === seo['zh-Hans'].description && h.path === '/', JSON.stringify(h))
  check('root Open Graph follows a saved choice', h.ogTitle === seo['zh-Hans'].title && h.ogDesc === seo['zh-Hans'].description && h.ogLocale === 'zh_CN', JSON.stringify(h))
})

test('build option: preset tags', async () => {
  const want = readFileSync(file('.env'), 'utf8').match(/^VITE_PRESET_TAGS=(.*)$/m)[1].trim().split(',')
  // Filter by the first preset tag of the build, plus a saved tag it does not offer
  const page = await newPage({}, { 'pjsk-filter-tags': JSON.stringify([want[0], 'user33333']) })
  await page.goto(BASE); await page.waitForSelector('main button.font-mono')
  await ctl(`room?id=60001&msg=${encodeURIComponent(want[0] + ' run')}`)
  await ctl('room?id=60002&msg=plain')
  await page.waitForFunction(() => [...document.querySelectorAll('main button.font-mono')].some(b => b.textContent.trim() === '60002'))
  const shown = await ids(page)
  check('a preset tag filters', !shown.includes('60001'), JSON.stringify(shown))
  check('a saved tag the build no longer offers is ignored', shown.includes('33333'), JSON.stringify(shown))
  await page.getByRole('button', { name: 'Settings' }).click()
  const chips = (await page.locator('div.flex-wrap > button[aria-pressed]').allTextContents()).map(t => t.trim())
  check('preset chips come from VITE_PRESET_TAGS', JSON.stringify(chips) === JSON.stringify(want), JSON.stringify(chips))
  check('no console errors', page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)))
})

test('self-hosted fonts', async () => {
  const editions = [
    { name: 'international', base: BASE, ui: 'Noto Sans JP Variable', css: ['noto-sans-jp', 'noto-sans-sc', 'noto-sans-tc'] },
  ]
  for (const e of editions) {
    const page = await newPage()
    const requests = []
    page.on('request', r => requests.push(r.url()))
    await page.goto(e.base); await page.waitForSelector('main button.font-mono')
    await page.waitForFunction(() => [...document.fonts].some(f => f.family === 'JetBrains Mono' && f.status === 'loaded'))
    await page.evaluate(() => document.fonts.ready)
    const foreign = requests.filter(u => !u.startsWith(e.base) && !u.startsWith('http://127.0.0.1:8787/'))
    check(`${e.name}: nothing is fetched from other hosts`, foreign.length === 0, JSON.stringify(foreign.slice(0, 3)))
    const css = requests.map(u => new URL(u).pathname.split('/').pop()).filter(f => f.startsWith('noto-sans-') && f.endsWith('.css')).map(f => f.replace(/-[\w-]{8}\.css$/, ''))
    check(`${e.name}: loads the fonts its languages need`, JSON.stringify(css.sort()) === JSON.stringify(e.css), JSON.stringify(css))
    const loaded = await page.evaluate(() => [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family))])
    check(`${e.name}: UI and room numbers render in the web fonts`, loaded.includes(e.ui) && loaded.includes('JetBrains Mono'), JSON.stringify(loaded))
    check(`${e.name}: only a few font slices are downloaded`, requests.filter(u => u.endsWith('.woff2')).length < 30, String(requests.filter(u => u.endsWith('.woff2')).length))
    const content = await page.locator('main p.font-content').first().evaluate(el => getComputedStyle(el).fontFamily)
    check(`${e.name}: posts use the Japanese font first`, content.startsWith('"Noto Sans JP Variable"'), content)
  }
})

test('about page follows the language', async () => {
  const heading = name => readFileSync(file(`src/assets/${name}.md`), 'utf8').match(/^# (.+)$/m)[1].trim()
  const page = await newPage()
  await page.goto(BASE + '#/about')
  await page.waitForSelector('.about-prose h1')
  check('English page in an English browser', (await page.locator('.about-prose h1').innerText()).trim() === heading('about_en'))
  await page.locator('aside:visible button', { hasText: 'English' }).click()
  await page.getByRole('option', { name: '日本語' }).click()
  await page.waitForFunction(h => document.querySelector('.about-prose h1')?.textContent.trim() === h, heading('about_ja'), { timeout: 5000 })
  check('switching language switches the page', (await page.locator('.about-prose h1').innerText()).trim() === heading('about_ja'))
  check('links open in a new tab', await page.locator('.about-prose a').first().getAttribute('target') === '_blank')
  check('no console errors', page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)))
})

test('room info: handle, link and avatar only when present', async () => {
  const page = await newPage()
  await page.goto(BASE); await page.waitForSelector('main button.font-mono')
  // Record every avatar element ever inserted, to catch one that shows up and is removed again
  await page.evaluate(() => {
    window.__avatarsInserted = []
    new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) for (const img of [n, ...n.querySelectorAll('img')]) if (img.tagName === 'IMG') window.__avatarsInserted.push(img.getAttribute('src')) })
      .observe(document.querySelector('main'), { childList: true, subtree: true })
  })
  await ctl(`room?id=70001&msg=with%20avatar&avatar=${encodeURIComponent('http://127.0.0.1:8787/none.png')}`)
  await ctl('room?id=70002&msg=bare&handle=&url=&avatar=')
  await ctl(`room?id=70003&msg=unsafe&url=${encodeURIComponent('javascript:alert(1)')}`)
  await ctl(`room?id=70004&msg=good%20avatar&avatar=${encodeURIComponent('http://127.0.0.1:8787/avatar.png')}`)
  await page.waitForFunction(() => document.querySelectorAll('main button.font-mono').length >= 7)
  const card = id => page.locator('main .border-b', { has: page.locator('button.font-mono', { hasText: id }) })
  check('no avatar sent: no avatar element', await card('22222').locator('img').count() === 0)
  check('handle shown', (await card('22222').innerText()).includes('@user22222'))
  check('original link comes from info.url', await card('22222').locator('a[target=_blank]').getAttribute('href') === 'https://x.com/user22222/status/122222')
  check('no handle, no link: neither is shown', !(await card('70002').innerText()).includes('@') && await card('70002').locator('a[target=_blank]').count() === 0)
  check('non-web link is dropped', await card('70003').locator('a[target=_blank]').count() === 0)
  await page.waitForTimeout(500)
  check('broken avatar is never inserted', await card('70001').locator('img').count() === 0 && !(await page.evaluate(() => window.__avatarsInserted)).some(src => src.includes('none.png')), JSON.stringify(await page.evaluate(() => window.__avatarsInserted)))
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].some(i => i.src.includes('avatar.png')), null, { timeout: 5000 })
  check('working avatar is shown once loaded', await card('70004').locator('img').isVisible())
  // Phones do not show avatars, so they are not even downloaded there
  const phone = await newPage({ viewport: { width: 390, height: 780 } })
  const fetched = []
  phone.on('request', r => { if (r.url().includes('avatar.png')) fetched.push(r.url()) })
  await phone.goto(BASE); await phone.waitForFunction(() => document.querySelectorAll('main button.font-mono').length >= 7)
  await phone.waitForTimeout(800)
  check('no avatar download on narrow screens', fetched.length === 0 && await phone.locator('main img').count() === 0, JSON.stringify(fetched))
  check('no placeholder letter circles', await page.locator('main .rounded-full.bg-primary-100').count() === 0)
  check('no console errors besides the missing avatar', page.errors.filter(e => !/404|none\.png|Failed to load resource/.test(e)).length === 0, JSON.stringify(page.errors.slice(0, 3)))
})

test('sidebar footer comes from VITE_FOOTER', async () => {
  const raw = loadEnv('production', fileURLToPath(ROOT), '').VITE_FOOTER ?? ''
  const version = JSON.parse(readFileSync(file('package.json'), 'utf8')).version
  const want = raw.replaceAll('{version}', version).replaceAll('\\n', '\n').split('\n').map(line => line.trim()).filter(Boolean)
  const page = await newPage()
  await page.goto(BASE); await page.waitForSelector('main button.font-mono')
  const got = (await page.locator('aside:visible > div:last-child p').allTextContents()).map(t => t.trim())
  check('footer lines, with the version filled in', JSON.stringify(got) === JSON.stringify(want), JSON.stringify({ got, want }))
  check('no placeholder left', !got.join(' ').includes('{'))
})

test('pinned rooms persist', async () => {
  const ctx = await newContext({ locale: 'en-US', viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript(() => localStorage.setItem('pjsk-onboarding', 'done'))
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto(BASE); await page.waitForSelector('main button.font-mono')
  await ctl('room?id=91234&msg=keep%20me%20pinned'); await page.waitForFunction(() => document.querySelector('main button.font-mono')?.textContent.trim() === '91234')
  await page.getByRole('button', { name: 'Pin', exact: true }).first().click(); await sleep(200)
  const saved = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('pjsk-pinned-rooms') || '{}')).map(p => p.room.id + ':' + p.room.msg))
  check('pin is saved with its text', JSON.stringify(saved) === '["91234:keep me pinned"]', JSON.stringify(saved))

  await ctl('reset')   // the server no longer has this room
  await page.reload(); await page.waitForSelector('main button.font-mono')
  const first = await page.locator('main .border-b').first().innerText()
  check('after reopening: still pinned on top with the same text', first.includes('91234') && first.includes('keep me pinned') && await page.locator('main .border-amber-400').count() === 1, first.slice(0, 60))

  const tab2 = await ctx.newPage(); await tab2.goto(BASE); await tab2.waitForSelector('main button.font-mono')
  // pinned rooms show before the first batch is merged; wait for the full list
  await tab2.waitForFunction(() => document.querySelectorAll('main button.font-mono').length > 1)
  check('another tab shows the same pin', (await tab2.locator('main button.font-mono').first().innerText()).trim() === '91234')
  await tab2.getByRole('button', { name: 'Unpin' }).first().click(); await sleep(400)
  check('unpinning in one tab updates the other', await page.locator('main .border-amber-400').count() === 0)
  check('a fresh room stays as a normal room after unpinning', (await tab2.locator('main button.font-mono').allTextContents()).map(t => t.trim()).includes('91234'))
  await tab2.close()

  const pinnedId = (await page.locator('main button.font-mono').first().innerText()).trim()
  await page.getByRole('button', { name: 'Pin', exact: true }).first().click(); await sleep(200)
  await ctl('down')
  await page.reload(); await sleep(1500)
  check('server down: pinned room still shows', (await page.locator('main button.font-mono').allTextContents()).map(t => t.trim()).includes(pinnedId), pinnedId)
  check('server down: no endless spinner in its place', await page.locator('main .animate-spin').count() === 0)
  await ctl('up')
  check('no console errors', errors.length === 0, JSON.stringify(errors.slice(0, 3)))
})
