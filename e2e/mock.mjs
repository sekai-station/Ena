// Mock of the station backend: REST + SSE with replay-on-connect, plus /ctl endpoints for the test.
import http from 'node:http'
const P = '/station/api/v2'
let rooms = []          // recent rooms, replayed on every SSE connect
let clients = new Set()
let down = false
const now = () => Math.floor(Date.now() / 1000)
const wire = r => `event: room\ndata: ${JSON.stringify(r)}\n\n`
const mk = (id, age, msg, name = 'user' + id) => ({ time: now() - age, id, msg, name, source: 'x', info: { handle: '@' + name, url: `https://x.com/${name}/status/1${id}`, avatar: null } })
function reset() {
  rooms = [mk('11111', 20, 'veteran MV'), mk('22222', 5, 'sage only'), mk('33333', 60, 'ベテラン MV周回 23時まで‼️\n@ 2\n主 )☕️\n募 )お着替えしたあなたの推し様♡\n\n揃うまで待てる方 じゃんじゃん選曲してください🎶\n主のおつさきで解散です\n\n#プロセカ協力 #プロセカ募集'), mk('44444', 100000, 'ancient expired')]
}
reset()
const ANN = { en: 'English notice', ja: '日本語のお知らせ', 'zh-Hans': '中文公告', 'zh-Hant': '中文公告(繁)' }
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  res.setHeader('Access-Control-Allow-Origin', '*')
  const json = d => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ code: 200, data: d })) }
  // A 1x1 PNG for avatar tests
  if (url.pathname === '/avatar.png') { res.setHeader('Content-Type', 'image/png'); return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')) }
  if (url.pathname.startsWith('/ctl/')) {
    const op = url.pathname.slice(5)
    if (op === 'room') {
      const q = url.searchParams, r = mk(q.get('id'), 0, q.get('msg') || 'live')
      // Optional info overrides: ?handle=&url=&avatar= (an empty value means none)
      for (const k of ['handle', 'url', 'avatar']) if (q.has(k)) r.info[k] = q.get(k) || (k === 'avatar' ? null : '')
      rooms.push(r); for (const c of clients) c.write(wire(r))
    }
    if (op === 'drop') { for (const c of clients) c.destroy(); clients.clear() }
    if (op === 'down') { down = true; for (const c of clients) c.destroy(); clients.clear() }
    if (op === 'up') down = false
    if (op === 'reset') reset()
    return res.end('ok ' + clients.size)
  }
  if (down) { res.statusCode = 503; return res.end('down') }
  if (url.pathname === P + '/ping') return json({ time: Date.now() })
  if (url.pathname === P + '/announcement') return json({ time: 1777576669, msg: ANN[url.searchParams.get('lang')] ?? ANN.en })
  if (url.pathname === P + '/status') return json({ pastCount: { past15m: 12, past1h: 40, past24h: 900 }, channelHealth: [{ name: 'x-crawler', tick: Array.from({ length: 60 }, (_, i) => i % 7) }] })
  if (url.pathname === P + '/realtime') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    res.write('retry: 500\n\n')
    for (const r of rooms) res.write(wire(r))
    res.write(`event: statistic\ndata: {"online":7,"past15m":3}\n\n`)
    res.write(`event: heartbeat\ndata: {"time":${Date.now()}}\n\n`)
    clients.add(res); req.on('close', () => clients.delete(res))
    return
  }
  res.statusCode = 404; res.end('nf')
}).listen(8787, '127.0.0.1', () => console.log('mock on 8787'))
