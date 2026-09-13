import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listModelIds } from '../assets/cafe-kit/kk-core/catalog.ts'

test('discovery skips unwritten directories but rejects broken model imports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cafe-catalog-test-'))
  try {
    await mkdir(join(root, 'kk-001-good'))
    await mkdir(join(root, 'kk-002-unwritten'))
    await writeFile(join(root, 'kk-001-good/model.ts'), 'export const createModel = () => ({})\n')
    assert.deepEqual(await listModelIds(root), ['kk-001-good'])
    await writeFile(join(root, 'kk-002-unwritten/model.ts'), 'throw new Error("broken model fixture")\n')
    await assert.rejects(listModelIds(root), /broken model fixture/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
