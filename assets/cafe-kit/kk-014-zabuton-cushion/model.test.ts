import { expect, test } from 'bun:test'
import { Box3, Group, Mesh, MeshStandardMaterial, Raycaster, Texture, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-014 tuft, threads, welt and tails are visible against a genuinely compressed shell', () => {
  const model = createModel(); model.root.updateMatrixWorld(true)
  const shell = model.parts.cushion.children[0]!.children[0] as Mesh
  const ray = new Raycaster()
  const surface = (x: number, z: number): number => {
    ray.set(new Vector3(x, 0.2, z), new Vector3(0, -1, 0))
    return ray.intersectObject(shell)[0]!.point.y
  }
  expect(surface(0.10, 0.10) - surface(0, 0)).toBeGreaterThan(0.014)
  const tuft = model.root.getObjectByName('kk-014-zabuton-cushion / centre tuft knot') as Mesh
  const knotBounds = new Box3().setFromObject(tuft)
  expect(knotBounds.max.y).toBeGreaterThan(surface(0.006, 0))
  expect(knotBounds.min.y).toBeLessThan(surface(0.006, 0) + 0.004)
  let tails = 0; let visible = 0
  model.parts.ties.traverse(o => {
    if (!(o instanceof Mesh) || !o.name.endsWith('/ corner tie tail')) return
    tails++
    const p = o.geometry.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      ray.set(new Vector3(p.getX(i), 0.2, p.getZ(i)), new Vector3(0, -1, 0))
      const hit = ray.intersectObject(shell)[0]
      if (!hit || p.getY(i) > hit.point.y) visible++
    }
  })
  expect(tails).toBe(8); expect(visible).toBeGreaterThan(200)
  const welt = model.root.getObjectByName('kk-014-zabuton-cushion / closed perimeter welt')!
  const wb = new Box3().setFromObject(welt); const sb = new Box3().setFromObject(shell)
  expect(wb.max.x).toBeGreaterThan(sb.max.x); expect(wb.max.z).toBeGreaterThan(sb.max.z)
  const b = new Box3().setFromObject(model.root); const size = b.getSize(new Vector3())
  expect(size.x).toBeCloseTo(0.5, 5); expect(size.y).toBeCloseTo(0.1, 5); expect(size.z).toBeCloseTo(0.5, 5); expect(b.min.y).toBeCloseTo(0, 5)
  model.dispose()
})
test('kk-014 preserves all consumer texture maps', () => {
  const texture = new Texture(); const material = new MeshStandardMaterial({ map: texture, normalMap: texture, roughnessMap: texture })
  const model = createModel({ materials: { brass: material, indigoFaded: material } })
  model.configure({ tufted: false }); model.dispose(); model.dispose()
  expect(material.map).toBe(texture); expect(material.normalMap).toBe(texture); expect(material.roughnessMap).toBe(texture)
  material.dispose(); texture.dispose()
})

test('kk-014 rebuild samples local cloth after consumer world matrices have been updated', () => {
  const model = createModel()
  const samples = (): number[][] => {
    const result: number[][] = []
    model.parts.seams.children[0]!.traverse(o => { if (o instanceof Mesh) result.push(Array.from(o.geometry.getAttribute('position').array)) })
    return result
  }
  const before = samples()
  const parent = new Group(); parent.position.set(-3, 2, 7); parent.rotation.set(0.2, -0.3, 0.1); parent.add(model.root)
  model.root.position.set(2, 3, -4); model.root.rotation.set(0.1, 0.4, -0.2); model.root.scale.set(1.2, 0.9, 1.1)
  const attachment = new Group(); model.parts.cushion.add(attachment)
  parent.updateMatrixWorld(true)
  const world = model.root.matrixWorld.clone()
  model.configure({ tufted: true }); parent.updateMatrixWorld(true)
  expect(model.root.matrixWorld.equals(world)).toBe(true)
  expect(attachment.parent).toBe(model.parts.cushion)
  expect(samples()).toEqual(before)
  model.dispose()
})
