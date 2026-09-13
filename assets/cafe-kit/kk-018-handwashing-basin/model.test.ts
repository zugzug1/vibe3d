import { expect, test } from 'bun:test'
import { Box3, Mesh, Raycaster, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-018 cavity, drain, outlet and towel fold are geometrically open and seated', () => {
  const model = createModel(); model.root.updateMatrixWorld(true)
  const mesh = (name: string): Mesh => model.root.getObjectByName('kk-018-handwashing-basin / ' + name) as Mesh
  const bowl = mesh('hollow ceramic basin'); const ray = new Raycaster()
  // Several clear paths into the cavity would all stop at the old flat cap.
  for (const [x, z] of [[0, 0], [0.08, 0], [-0.08, 0.03], [0, 0.08]]) {
    ray.set(new Vector3(x!, 0.8, z!), new Vector3(0, -1, 0))
    const hit = ray.intersectObject(model.parts.bowl, true)[0]!
    expect(hit).toBeDefined(); expect(hit.point.y).toBeLessThan(0.69)
    expect(hit.point.y).toBeGreaterThan(0.628)
  }
  const drain = new Box3().setFromObject(mesh('seated basin drain'))
  ray.set(new Vector3(0, 0.8, 0), new Vector3(0, -1, 0))
  expect(Math.abs(drain.min.y - ray.intersectObject(bowl)[0]!.point.y)).toBeLessThan(0.002)
  const mouth = mesh('open spout mouth')
  const axis = new Vector3(0, 0, 1).applyQuaternion(mouth.quaternion)
  expect(axis.y).toBeLessThan(-0.6)
  ray.set(mouth.position.clone().addScaledVector(axis, 0.004), axis)
  expect(ray.intersectObject(bowl)[0]).toBeDefined()
  // Looking backwards into the opening must pass its rim instead of hitting a cap.
  ray.set(mouth.position.clone().addScaledVector(axis, 0.03), axis.clone().negate())
  const hit = ray.intersectObject(model.parts.tap, true)[0]
  expect(!hit || hit.distance > 0.035).toBe(true)
  const towel = mesh('towel folded over bar'); const bar = mesh('supported towel bar')
  const tb = new Box3().setFromObject(towel); const bb = new Box3().setFromObject(bar)
  expect(tb.min.z).toBeLessThan(bb.min.z); expect(tb.max.z).toBeGreaterThan(bb.max.z)
  expect(tb.max.y - bb.max.y).toBeGreaterThan(0); expect(tb.max.y - bb.max.y).toBeLessThan(0.004)
  ray.set(new Vector3(0.03, 0.50, 0.203), new Vector3(0, -1, 0))
  expect(ray.intersectObject(towel)[0]!.point.y).toBeGreaterThan(bb.max.y)
  // Both hanging faces exist below the supported crown, separated by the bar diameter.
  const p = towel.geometry.getAttribute('position')
  let front = 0; let back = 0
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.4) { if (p.getZ(i) > 0.21) front++; if (p.getZ(i) < 0.195) back++ }
  expect(front).toBeGreaterThan(40); expect(back).toBeGreaterThan(40)
  for (const bracket of model.parts.towel.children[0]!.children.filter(o => o.name.endsWith('/ towel bar bracket'))) {
    expect(new Box3().setFromObject(bracket).intersectsBox(bb)).toBe(true)
  }
  expect(new Box3().setFromObject(bowl).min.y).toBeCloseTo(new Box3().setFromObject(mesh('cedar basin top')).max.y, 5)
  model.dispose()
})
