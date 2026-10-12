import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const source = stripTypeScriptTypes(
  readFileSync(new URL('../src/utils/online-history.ts', import.meta.url), 'utf8'),
).replace(/^export /gm, '')
const slots = runInNewContext(`${source}\nonlineHourSlots`)

test('only the most recent 48 hour buckets are displayed in chronological order', () => {
  const hour = 1791813600
  const result = slots([
    { hour, peak: 50, average: 12.5, samples: 2 },
    { hour: hour - 48 * 3600, peak: 99, average: 99, samples: 20 },
    { hour: hour - 3600, peak: 0, average: 0, samples: 20 },
  ])
  assert.equal(result.length, 48)
  assert.equal(result[0].hour, hour - 47 * 3600)
  assert.equal(result[0].peak, null)
  assert.equal(result[0].average, null)
  assert.equal(result[46].peak, 0)
  assert.equal(result[46].average, 0)
  assert.equal(result[47].peak, 50)
  assert.equal(result[47].average, 12.5)
  assert.equal(result.some(point => point.peak === 99), false)
})

test('no history produces an empty state', () => {
  assert.equal(slots([]).length, 0)
})
