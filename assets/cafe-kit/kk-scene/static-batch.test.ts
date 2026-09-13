import { test, expect } from 'bun:test'
import { Box3, BoxGeometry, DataTexture, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu'
import { batchStaticScene } from './static-batch.ts'

test('static batching preserves bounds, material identity and source ownership', () => {
  const root = new Group(); const model = new Group(); root.add(model)
  const material = new MeshStandardMaterial(); const geometry = new BoxGeometry()
  for (let i = 0; i < 3; i++) { const mesh = new Mesh(geometry, material); mesh.position.x = i; model.add(mesh) }
  let sourceDisposals = 0; geometry.addEventListener('dispose', () => sourceDisposals++)
  const batch = batchStaticScene(root)
  expect(batch.root.children.filter(child => child instanceof Mesh).length).toBe(1)
  const mesh = batch.root.children.find(child => child instanceof Mesh) as Mesh
  expect(mesh.material).toBe(material)
  expect(mesh.geometry.getAttribute('position').count).toBe(108)
  const before = new Box3().setFromObject(root), after = new Box3().setFromObject(batch.root)
  expect(after.min.distanceTo(before.min)).toBeLessThan(1e-6)
  expect(after.max.distanceTo(before.max)).toBeLessThan(1e-6)
  expect(model.children.length).toBe(3)
  let disposed = 0; mesh.geometry.addEventListener('dispose', () => disposed++)
  batch.dispose(); batch.dispose()
  expect(disposed).toBe(1); expect(sourceDisposals).toBe(0)
  geometry.dispose(); material.dispose()
})

test('transparent meshes stay separately sortable and hidden children remain hidden', () => {
  const root = new Group(); const model = new Group(); root.add(model)
  const material = new MeshStandardMaterial({ transparent: true, opacity: 0.3 })
  const geometry = new BoxGeometry()
  for (let i = 0; i < 3; i++) { const mesh = new Mesh(geometry, material); mesh.visible = i !== 2; model.add(mesh) }
  const batch = batchStaticScene(root)
  expect(batch.root.children[0]!.children.length).toBe(2)
  expect(new Box3().setFromObject(batch.root).getSize(new Vector3()).x).toBe(1)
  batch.dispose(); geometry.dispose(); material.dispose()
})

test('equivalent owned PBR copies batch together but distinct pixels and finishes do not', () => {
  const root = new Group(), geometry = new BoxGeometry()
  const materials: MeshStandardMaterial[] = []
  for (const [r, roughness] of [[255, 0.7], [255, 0.7], [128, 0.7], [255, 0.9]]) {
    const map = new DataTexture(new Uint8Array([r!, 0, 0, 255]), 1, 1)
    const material = new MeshStandardMaterial({ map, roughness }); materials.push(material)
    const group = new Group(); group.add(new Mesh(geometry, material)); root.add(group)
  }
  const batch = batchStaticScene(root)
  expect(batch.root.userData.modelCount).toBe(4)
  expect(batch.root.children.filter(child => child instanceof Mesh).length).toBe(3)
  expect(materials[0]!.map).not.toBe(materials[1]!.map)
  batch.dispose(); geometry.dispose()
  for (const material of materials) { material.map!.dispose(); material.dispose() }
})
