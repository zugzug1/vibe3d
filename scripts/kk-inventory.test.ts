import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
test('delivery manifest connects stable reference IDs to actual model artifacts', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'cafe-inventory-test-'))
  try {
    const result = run('--only', 'kk-020-shoe-cubby-rack', '--write', join(temporary, 'inventory.md'))
    assert.equal(result.status, 0, result.stderr)
    const manifest = JSON.parse(readFileSync(join(temporary, 'delivery-manifest.json'), 'utf8'))
    assert.equal(Object.keys(manifest.assets).length, 50)
    assert.equal(manifest.assets['kk-020'].modelId, 'kk-020-shoe-cubby-rack')
    assert.equal(manifest.assets['kk-020'].artifacts.source, 'assets/cafe-kit/kk-020-shoe-cubby-rack/model.ts')
    assert.equal(manifest.assets['kk-020'].appearance, 'pending')
    assert.match(manifest.assets['kk-020'].referenceImage.sha256, /^[a-f0-9]{64}$/)
    assert.equal(manifest.assets['kk-050'].modelId, null)
  } finally { rmSync(temporary, { recursive: true }) }
})
