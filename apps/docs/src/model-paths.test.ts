import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installedImport, registryScope } from './model-paths.ts'

test('café installation and import examples use the café registry', () => {
  const model = { id: 'kk-020-shoe-cubby-rack', kind: 'cafe-kit' as const }
  assert.equal(registryScope(model), '@cafe-kit')
  assert.equal(installedImport(model), '@/models/cafe-kit/kk-020-shoe-cubby-rack/model')
  assert.equal(registryScope({ kind: 'f1' }), '@f1-kit')
  assert.equal(registryScope({ kind: 'prototype' }), '@scifi-kit')
})
