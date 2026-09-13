import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

function run(...args: string[]) {
  return spawnSync('node', ['--import', 'tsx', 'scripts/kk-inventory.ts', ...args], { encoding: 'utf8' })
}
test('inventory rejects zero model coverage', () => {
  const result = run('--check', '--only', 'kk-999-missing')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /No matching café model sources/)
})
test('complete inventory rejects a partial selection', () => {
  const result = run('--complete', '--only', 'kk-020-shoe-cubby-rack')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /requires all 50 distinct asset IDs/)
})
test('existing in-budget source can pass the technical-only inventory', () => {
  const result = run('--check', '--only', 'kk-020-shoe-cubby-rack')
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Models: 1/)
})
