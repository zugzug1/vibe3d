import { expect, test } from 'bun:test'
import { Box3, Mesh, Raycaster, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-009 geometry is finite and nondegenerate within its original envelope', () => {
  const model = createModel(); let triangles = 0
  model.root.traverse((object) => { if (!(object instanceof Mesh)) return; const p = object.geometry.getAttribute('position'); const index = object.geometry.index; const count = index?.count ?? p.count; triangles += count / 3; for (let i = 0; i < count; i += 3) { const a = new Vector3().fromBufferAttribute(p, index ? index.getX(i) : i); const b = new Vector3().fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1); const c = new Vector3().fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2); expect([a, b, c].every((v) => [v.x, v.y, v.z].every(Number.isFinite))).toBe(true); expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-22) } })
  expect(model.root.getObjectByName('kk-009-engawa-lounge-platform / rounded-front-step')).toBeTruthy()
  expect(model.root.getObjectByName('kk-009-engawa-lounge-platform / tatami-edge-binding')).toBeTruthy()
  const size = new Box3().setFromObject(model.root).getSize(new Vector3()); expect(size.x).toBeCloseTo(2, 4); expect(size.y).toBeCloseTo(0.3, 4); expect(size.z).toBeCloseTo(1.5, 4)
  expect(triangles).toBeLessThanOrEqual(15000); model.dispose()
})

test('kk-009 mats rest on the substrate and textile binding remains visible above them', () => {
  const model = createModel(); model.root.updateMatrixWorld(true)
  const mesh = (name: string) => model.root.getObjectByName(`kk-009-engawa-lounge-platform / ${name}`) as Mesh
  const down = (target: Mesh, x: number, z: number) => new Raycaster(new Vector3(x, 1, z), new Vector3(0, -1, 0)).intersectObject(target)[0]?.point.y
  try {
    const mats = mesh('inset-tatami'); const deck = mesh('raised-cedar-deck')
    const matBottom = new Box3().setFromObject(mats).min.y
    for (const x of [-0.45, 0.45]) for (const z of [-0.375, 0.145]) {
      const supportTop = down(deck, x, z)!
      expect(supportTop).toBeGreaterThanOrEqual(matBottom)
      expect(supportTop - matBottom).toBeLessThan(0.003)
      const matTop = down(mats, x, z)!
      const bindingTop = down(mesh('tatami-edge-binding'), x, z - 0.247)!
      expect(bindingTop).toBeGreaterThan(matTop)
      expect(bindingTop - matTop).toBeLessThan(0.003)
    }
    const rail = new Box3().setFromObject(mesh('low-engawa-rail'))
    expect(rail.min.y).toBeLessThan(0.165)
    expect(rail.max.y).toBeCloseTo(0.30, 4)
    const towardBack = new Raycaster(new Vector3(0, 0.09, 1), new Vector3(0, 0, -1))
    const riser = towardBack.intersectObject(mesh('rounded-front-step'))[0]
    const apron = towardBack.intersectObject(deck)[0]
    expect(riser).toBeDefined(); expect(apron).toBeDefined()
    // Riser front is less than its physical thickness ahead of the host apron.
    expect(riser!.point.z - apron!.point.z).toBeGreaterThan(0)
    expect(riser!.point.z - apron!.point.z).toBeLessThan(0.045)
  } finally { model.dispose() }
})
