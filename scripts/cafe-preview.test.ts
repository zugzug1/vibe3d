import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu'
import { createKkPreview } from '../assets/cafe-kit/kk-core/preview.ts'

test('close preview keeps corners inside margins even with a too-close override', () => {
  const geometry = new BoxGeometry(2, 1, 1)
  const material = new MeshStandardMaterial()
  const root = new Group()
  root.add(new Mesh(geometry, material))
  const preview = createKkPreview({ root, dispose() { geometry.dispose(); material.dispose() } },
    { distance: 0.3, aspect: 0.65 })
  const box = new Box3().setFromObject(root)
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) {
    for (const z of [box.min.z, box.max.z]) {
      const p = new Vector3(x, y, z).project(preview.camera)
      assert.ok(Math.abs(p.x) <= 0.90001 && Math.abs(p.y) <= 0.90001)
    }
  }
  preview.dispose()
})
