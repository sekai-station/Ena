import { strict as assert } from 'node:assert'
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const source = stripTypeScriptTypes(
  readFileSync(new URL('../src/utils/client-id.ts', import.meta.url), 'utf8'),
).replace(/^export /gm, '')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function storage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

function page(localStorage, locks, crypto = webcrypto) {
  return runInNewContext(`${source}\ngetClientId`, {
    localStorage, navigator: { locks }, crypto,
  })
}

test('simultaneous tabs, reconnects and reloads share the persisted UUID', async () => {
  const localStorage = storage()
  let queue = Promise.resolve()
  const locks = {
    request: (_name, callback) => {
      const result = queue.then(callback)
      queue = result.catch(() => {})
      return result
    },
  }
  const first = page(localStorage, locks)
  const second = page(localStorage, locks)
  const [a, b] = await Promise.all([first(), second()])
  assert.match(a, uuid)
  assert.equal(a, b)
  assert.equal(await first(), a)
  assert.equal(await page(localStorage, locks)(), a)
})

test('invalid persisted values are replaced', async () => {
  const localStorage = storage()
  localStorage.setItem('station.client-id', 'invalid')
  const id = await page(localStorage)()
  assert.match(id, uuid)
  assert.equal(localStorage.getItem('station.client-id'), id)
})

test('unavailable storage still gives a stable ID for reconnects', async () => {
  const unavailable = {
    getItem() { throw new Error('storage blocked') },
    setItem() { throw new Error('storage blocked') },
  }
  const getId = page(unavailable)
  const id = await getId()
  assert.match(id, uuid)
  assert.equal(await getId(), id)
})

test('lock failure and missing randomUUID use supported fallbacks', async () => {
  const localStorage = storage()
  const locks = { request: () => Promise.reject(new Error('locks unavailable')) }
  const crypto = { getRandomValues: array => webcrypto.getRandomValues(array) }
  const id = await page(localStorage, locks, crypto)()
  assert.match(id, uuid)
  assert.equal(localStorage.getItem('station.client-id'), id)
})
