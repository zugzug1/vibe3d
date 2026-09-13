import { expect, test } from 'bun:test'
import { Box3, Mesh, Raycaster, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-015 continuous posts intersect both trays and seated caster assemblies', () => {
  const model = createModel(); model.root.updateMatrixWorld(true)
  const find = (name: string): Mesh => model.root.getObjectByName('kk-015-service-trolley / ' + name) as Mesh
  const posts = find('cedar-uprights'); const trays = find('two-raised-service-trays')
  const forks = find('fitted caster forks and axles'); const tires = find('vertical rubber tires')
  const ray = new Raycaster()
  for (const x of [-0.30, 0.30]) for (const z of [-0.174, 0.174]) {
    // A horizontal probe must hit the same upright at every height between mount and top tray.
    for (const y of [0.15, 0.20, 0.225, 0.29, 0.40, 0.59, 0.625, 0.675]) {
      ray.set(new Vector3(x, y, z + 0.1), new Vector3(0, 0, -1))
      expect(ray.intersectObject(posts).some(hit => hit.distance < 0.1)).toBe(true)
    }
    ray.set(new Vector3(x, 0.8, z), new Vector3(0, -1, 0))
    const shelfHeights = ray.intersectObject(trays).map(hit => hit.point.y)
    expect(shelfHeights.some(y => Math.abs(y - 0.639) < 0.001)).toBe(true)
    expect(shelfHeights.some(y => Math.abs(y - 0.239) < 0.001)).toBe(true)
    expect(ray.intersectObject(forks)[0]!.point.y).toBeGreaterThan(0.144)
    // Side-on axle and tread probes prove vertical wheels and paired fork cheeks.
    ray.set(new Vector3(x - 0.1, 0.05, z), new Vector3(1, 0, 0))
    expect(ray.intersectObject(forks).length).toBeGreaterThan(0)
    expect(ray.intersectObject(tires).length).toBeGreaterThan(0)
    ray.set(new Vector3(x, 0.12, z), new Vector3(0, -1, 0))
    expect(ray.intersectObject(tires)[0]!.point.y).toBeCloseTo(0.10, 4)
  }
  const handle = find('curved-push-handle')
  const hb = new Box3().setFromObject(handle)
  expect(hb.min.y).toBeLessThan(0.68); expect(hb.max.y).toBeCloseTo(0.85, 5)
  let triangles = 0
  model.root.traverse(o => {
    if (!(o instanceof Mesh)) return
    const p = o.geometry.getAttribute('position'); const index = o.geometry.index; const count = index?.count ?? p.count; triangles += count / 3
    for (let i = 0; i < count; i += 3) {
      const a = new Vector3().fromBufferAttribute(p, index ? index.getX(i) : i)
      const b = new Vector3().fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1)
      const c = new Vector3().fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2)
      expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-22)
    }
  })
  expect(triangles).toBeLessThanOrEqual(6000)
  const size = new Box3().setFromObject(model.root).getSize(new Vector3())
  expect(size.x).toBeCloseTo(0.7, 5); expect(size.y).toBeCloseTo(0.85, 5); expect(size.z).toBeCloseTo(0.45, 5)
  model.dispose()
})
