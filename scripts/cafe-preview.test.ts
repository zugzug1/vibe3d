import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Box3, BoxGeometry, DirectionalLight, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu'
import { createKkPreview } from '../assets/cafe-kit/kk-core/preview.ts'

test('contrast preview respects explicit thin-shell shadow opt-outs', () => {
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshStandardMaterial()
  const root = new Group()
  const shell = new Mesh(geometry, material)
  shell.userData.cafeCastShadow = false
  root.add(shell)
  const preview = createKkPreview({ root, dispose() { geometry.dispose(); material.dispose() } }, { lighting: 'contrast' })
  assert.equal(shell.castShadow, false)
  assert.equal(shell.receiveShadow, true)
  preview.dispose()
})

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

test('contrast review lighting is opt-in and leaves material and geometry defaults intact', () => {
  for (const lighting of ['legacy', 'contrast'] as const) {
    const geometry = new BoxGeometry(1, 1, 1)
    const material = new MeshStandardMaterial({ color: '#946b61', roughness: 0.78 })
    const color = material.color.clone(); const root = new Group(); const mesh = new Mesh(geometry, material)
    root.add(mesh)
    const preview = createKkPreview({ root, dispose() { geometry.dispose(); material.dispose() } }, { lighting })
    const key = preview.scene.children.find((object) => object instanceof DirectionalLight) as DirectionalLight
    assert.equal(key.castShadow, lighting === 'contrast')
    assert.equal(mesh.castShadow, lighting === 'contrast')
    assert.equal(mesh.geometry, geometry); assert.equal(mesh.material, material)
    assert.ok(material.color.equals(color)); assert.equal(material.roughness, 0.78)
    preview.dispose()
  }
})
