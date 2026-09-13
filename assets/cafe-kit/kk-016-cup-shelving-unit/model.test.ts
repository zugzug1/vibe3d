import { expect, test } from 'bun:test'
import { Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three/webgpu'
import { createModel, vesselGeometry } from './model.ts'

test('kk-016 cups and bowls have an open mouth, inner floor and outward underside', () => {
  const material = new MeshStandardMaterial()
  for (const bowl of [false, true]) {
    const geometry = vesselGeometry(0.07, 0.12, bowl)
    const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld(true)
    const down = new Raycaster(new Vector3(0.001, 0.2, 0.001), new Vector3(0, -1, 0)).intersectObject(mesh)
    expect(down.length).toBeGreaterThan(0)
    expect(down[0]!.point.y).toBeCloseTo(0.016, 5)
    const up = new Raycaster(new Vector3(0.001, -0.1, 0.001), new Vector3(0, 1, 0)).intersectObject(mesh)
    expect(up[0]!.point.y).toBeCloseTo(0, 5)
    geometry.dispose()
  }
  material.dispose()
})

test('kk-016 tiers rebuild complete roofed columns within 6000 triangles', () => {
  const model = createModel()
  for (const tiers of [2, 3, 4, Infinity]) {
    model.configure({ tiers })
    let roofs = 0; let triangles = 0
    model.root.traverse((object) => { if (object instanceof Mesh) {
      if (object.name.includes('closed crate roof')) roofs++
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3
    } })
    expect(roofs).toBe(3); expect(triangles).toBeLessThanOrEqual(6000)
  }
  model.dispose()
})
