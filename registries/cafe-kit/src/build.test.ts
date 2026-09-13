import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { collectShippedFiles } from './build.js'

test('registry ships runtime sources without test-only imports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cafe-registry-source-'))
  try {
    for (const name of ['model.ts', 'surface-detail.ts', 'model.test.ts', 'helper.spec.ts', 'compile.ts', 'README.md']) {
      await writeFile(join(root, name), '')
    }
    await mkdir(join(root, 'review'))
    const paths = await collectShippedFiles(root, new Set(['compile.ts']))
    assert.deepEqual(paths.map(path => basename(path)), ['model.ts', 'surface-detail.ts'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
