import { expect, test } from 'bun:test'
import { Box3, Mesh, Raycaster, TorusGeometry, TubeGeometry, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-007 every rib and repair seam follows the actual paper surface', () => {
  for (const ribCount of [8, 12, 18]) {
    const model = createModel({ ribCount }); model.root.updateMatrixWorld(true)
    const paper = model.parts.shade.children[0]!.children[0] as Mesh
    const ray = new Raycaster()
    let ribs = 0; let triangles = 0
    model.root.traverse(o => {
      if (!(o instanceof Mesh)) return
      triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3
      if (o.geometry instanceof TorusGeometry && o.name.endsWith('/ paper rib')) {
        ribs++
        for (const angle of [0, 0.55, 1.4, 2.2]) {
          const outward = new Vector3(Math.sin(angle), 0, Math.cos(angle))
          ray.set(outward.clone().multiplyScalar(0.4).setY(o.position.y), outward.clone().negate())
          const hit = ray.intersectObject(paper)[0]!
          expect(hit).toBeDefined()
          const r = Math.hypot(hit.point.x, hit.point.z)
          expect(Math.abs(o.geometry.parameters.radius - r)).toBeLessThan(0.002)
        }
      }
      if (o.geometry instanceof TubeGeometry && o.name.endsWith('/ repaired seam')) {
        for (let i = 0; i <= 24; i++) {
          const point = o.geometry.parameters.path.getPoint(i / 24)
          const direction = new Vector3(point.x, 0, point.z).normalize()
          ray.set(direction.clone().multiplyScalar(0.4).setY(point.y), direction.clone().negate())
          const hit = ray.intersectObject(paper)[0]!
          expect(hit).toBeDefined(); expect(hit.point.distanceTo(point)).toBeLessThan(0.003)
        }
      }
    })
    expect(ribs).toBe(ribCount); expect(triangles).toBeLessThanOrEqual(15000)
    const size = new Box3().setFromObject(model.root).getSize(new Vector3())
    expect(size.toArray()).toEqual([expect.closeTo(0.6, 5), expect.closeTo(0.5, 5), expect.closeTo(0.6, 5)])
    const cap = new Box3().setFromObject(model.root.getObjectByName('kk-007-washi-pendant-lantern / round ceiling cap')!)
    const shade = new Box3().setFromObject(paper)
    expect(cap.min.y - shade.max.y).toBeGreaterThan(0.10)
    model.dispose()
  }
})
