import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three/webgpu'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { collectMergedParts, requirePartCoverage } from './coplanar-parts.ts'

test('cafe naming and premerged geometry retain component coverage and transforms', () => {
  const a = new BoxGeometry(1, 1, 1)
  const b = new BoxGeometry(1, 1, 1).translate(2, 0, 0)
  const geometry = mergeGeometries([a, b], false)!
  const material = new MeshStandardMaterial()
  const mesh = new Mesh(geometry, material)
  mesh.name = 'kk-011-cafe-table / batch'
  const root = new Group()
  root.position.y = 3
  root.add(mesh)
  const parts = collectMergedParts(root)
  assert.equal(parts.length, 2)
  assert.equal(parts[0]!.box.min.y, 2.5)
  assert.equal(parts[1]!.box.min.x, 1.5)
  assert.doesNotThrow(() => requirePartCoverage(parts, 'fixture'))
  a.dispose(); b.dispose(); geometry.dispose(); material.dispose()
})

test('an empty inspection fails closed instead of reporting clean', () => {
  assert.throws(() => requirePartCoverage(collectMergedParts(new Group()), 'empty'), /zero inspected parts/)
})
