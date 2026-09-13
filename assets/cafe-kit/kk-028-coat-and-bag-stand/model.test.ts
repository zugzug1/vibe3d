import { expect, test } from 'bun:test'
import { Box3, Group, Mesh, Raycaster, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'
test('kk-028 branch roots bury in the trunk and each foot tenon seats in the socket hub', () => {
  const model = createModel(); const hooks = [...model.hooks]
  const attached = hooks.map(hook => { const hanger = new Group(); hook.add(hanger); return hanger })
  for (const pegReach of [0.13, 0.215]) for (const pegRise of [0.06, 0.15]) {
    model.configure({ pegReach, pegRise }); model.root.updateMatrixWorld(true)
    const trunk = model.root.getObjectByName('kk-028-coat-and-bag-stand / tapered timber trunk') as Mesh
    const tb = new Box3().setFromObject(trunk)
    const hub = model.root.getObjectByName('kk-028-coat-and-bag-stand / octagonal mortised foot socket') as Mesh
    const hb = new Box3().setFromObject(hub)
    expect(hb.intersectsBox(tb)).toBe(true)
    model.parts.foot.traverse(o => { if (o instanceof Mesh && o !== hub) expect(new Box3().setFromObject(o).intersectsBox(hb)).toBe(true) })
    const ray = new Raycaster()
    ray.set(new Vector3(0, 0.05, 0), new Vector3(1, 0, 0))
    // The 2 mm extrusion bevel offsets the nominal 44 mm bore inward at its straight wall.
    expect(ray.intersectObject(hub)[0]!.distance).toBeGreaterThan(0.041)
    expect(ray.intersectObject(hub)[0]!.distance).toBeLessThan(0.0445)
    for (let i = 0; i < 4; i++) {
      expect(model.hooks[i]).toBe(hooks[i]); expect(attached[i]!.parent).toBe(hooks[i]!)
      const peg = model.root.getObjectByName(`kk-028-coat-and-bag-stand / upturned branch peg ${i}`) as Mesh
      expect(new Box3().setFromObject(peg).intersectsBox(tb)).toBe(true)
      const p = hooks[i]!.position
      ray.set(p.clone().add(new Vector3(0, 0.1, 0)), new Vector3(0, -1, 0))
      expect(ray.intersectObject(peg)[0]!.distance).toBeLessThan(0.10)
      // At the shared root station both trunk and peg intersect a horizontal cross-section.
      const y = [1.32, 1.29, 1.03, 0.77][i]!
      ray.set(new Vector3(0.2, y, 0), new Vector3(-1, 0, 0))
      expect(ray.intersectObject(trunk).length).toBeGreaterThan(0)
      expect(ray.intersectObject(peg).length).toBeGreaterThan(0)
    }
  }
  model.dispose()
})
