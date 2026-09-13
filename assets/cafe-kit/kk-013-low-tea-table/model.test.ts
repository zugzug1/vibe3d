import { expect, test } from 'bun:test'
import { Box3, Mesh, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-013 is a closed two-end trestle with pegs and stretcher, not four loose legs', () => {
  const model = createModel(); let triangles = 0
  model.root.traverse((object) => { if (!(object instanceof Mesh)) return; const p = object.geometry.getAttribute('position'); const index = object.geometry.index; const count = index?.count ?? p.count; triangles += count / 3; for (let i = 0; i < count; i += 3) { const a = new Vector3().fromBufferAttribute(p, index ? index.getX(i) : i); const b = new Vector3().fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1); const c = new Vector3().fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2); expect([a, b, c].every((v) => [v.x, v.y, v.z].every(Number.isFinite))).toBe(true); expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-22) } })
  expect(model.root.getObjectByName('kk-013-low-tea-table / short-trestle-ends')).toBeTruthy()
  expect(model.root.getObjectByName('kk-013-low-tea-table / trestle-joinery-pegs')).toBeTruthy()
  expect(model.root.getObjectByName('kk-013-low-tea-table / low-long-stretcher')).toBeTruthy()
  expect(model.root.getObjectByName('kk-013-low-tea-table / four-legs')).toBeFalsy()
  const size = new Box3().setFromObject(model.root).getSize(new Vector3()); expect(size.x).toBeCloseTo(0.9, 4); expect(size.y).toBeCloseTo(0.35, 4); expect(size.z).toBeCloseTo(0.6, 4)
  expect(triangles).toBeLessThanOrEqual(6000); model.dispose()
})
