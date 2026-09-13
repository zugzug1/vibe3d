import { test } from 'node:test'
import assert from 'node:assert/strict'
import { controlValues } from './cafe-controls.ts'
test('structural fields need not be called archSpan', () => {
  const controls = { pegReach: { min: 0.13, max: 0.215, default: 0.19, step: 0.005, label: 'Peg reach' } }
  assert.deepEqual(controlValues(controls, { pegReach: 0.2, enabled: true }), { pegReach: 0.2 })
  assert.throws(() => controlValues(controls, { pegReach: NaN }))
  assert.throws(() => controlValues(controls, {}))
})
