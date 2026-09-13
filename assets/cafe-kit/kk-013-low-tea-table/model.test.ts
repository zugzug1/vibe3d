import { expect, test } from 'bun:test'
import { Box3, Mesh, Raycaster, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-013 has finite nondegenerate trestle geometry within its original envelope', () => {
  const model = createModel(); let triangles = 0
  model.root.traverse((object) => { if (!(object instanceof Mesh)) return; const p = object.geometry.getAttribute('position'); const index = object.geometry.index; const count = index?.count ?? p.count; triangles += count / 3; for (let i = 0; i < count; i += 3) { const a = new Vector3().fromBufferAttribute(p, index ? index.getX(i) : i); const b = new Vector3().fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1); const c = new Vector3().fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2); expect([a, b, c].every((v) => [v.x, v.y, v.z].every(Number.isFinite))).toBe(true); expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-22) } })
  expect(model.root.getObjectByName('kk-013-low-tea-table / short-trestle-ends')).toBeTruthy()
  expect(model.root.getObjectByName('kk-013-low-tea-table / trestle-joinery-pegs')).toBeTruthy()
  expect(model.root.getObjectByName('kk-013-low-tea-table / low-long-stretcher')).toBeTruthy()
  expect(model.root.getObjectByName('kk-013-low-tea-table / four-legs')).toBeFalsy()
  const size = new Box3().setFromObject(model.root).getSize(new Vector3()); expect(size.x).toBeCloseTo(0.9, 4); expect(size.y).toBeCloseTo(0.35, 4); expect(size.z).toBeCloseTo(0.6, 4)
  expect(triangles).toBeLessThanOrEqual(6000); model.dispose()
})

test('kk-013 end cleats intersect the tabletop and stretcher penetrates both end boards', () => {
  for (const planks of [true, false]) {
    const model = createModel({ planks }); model.root.updateMatrixWorld(true)
    const mesh = (name: string) => model.root.getObjectByName(`kk-013-low-tea-table / ${name}`) as Mesh
    try {
      const top = new Box3().setFromObject(mesh('planked-tabletop'))
      const ends = mesh('short-trestle-ends')
      for (const x of [-0.30, 0.30]) {
        const hits = new Raycaster(new Vector3(x, 1, 0), new Vector3(0, -1, 0)).intersectObject(ends)
        expect(hits.length).toBeGreaterThan(0)
        expect(hits[0]!.point.y).toBeGreaterThan(top.min.y)
        expect(hits[0]!.point.y).toBeLessThan(top.max.y)
      }
      const stretcher = new Box3().setFromObject(mesh('low-long-stretcher'))
      expect(stretcher.min.x).toBeLessThan(-0.332)
      expect(stretcher.max.x).toBeGreaterThan(0.332)
      expect(top.getSize(new Vector3()).z).toBeCloseTo(0.6, 4)
    } finally { model.dispose() }
  }
})
