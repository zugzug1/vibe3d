import { expect, test } from 'bun:test'
import { ExtrudeGeometry, Mesh, Raycaster, Shape, ShapeUtils, Vector2, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

const cross = (a: Vector2, b: Vector2, c: Vector2): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
function inside(p: Vector2, ring: Vector2[]): boolean {
  let result = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result
  }
  return result
}
function distance(p: Vector2, a: Vector2, b: Vector2): number {
  const edge = b.clone().sub(a)
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(edge) / Math.max(edge.lengthSq(), 1e-20)))
  return p.distanceTo(a.clone().addScaledVector(edge, t))
}
const crosses = (a: Vector2, b: Vector2, c: Vector2, d: Vector2): boolean => {
  // Geometry positions are Float32; shared contour endpoints may differ by ~3e-8 m.
  const opposite = (x: number, y: number, tolerance: number): boolean => (x > tolerance && y < -tolerance) || (y > tolerance && x < -tolerance)
  return opposite(cross(a, b, c), cross(a, b, d), a.distanceTo(b) * 1e-7)
    && opposite(cross(c, d, a), cross(c, d, b), c.distanceTo(d) * 1e-7)
}

test('027 all paw vertices and edges are inside the actual sampled cheek profile with wood clearance', () => {
  const model = createModel()
  try {
    const cheeks: Mesh[] = []; model.parts.carcass.traverse((o) => { if (o instanceof Mesh && o.name.endsWith('/ swept paw-cut side cheek')) cheeks.push(o) })
    expect(cheeks.length).toBe(2)
    for (const cheek of cheeks) {
      const geometry = cheek.geometry as ExtrudeGeometry
      const shape = geometry.parameters.shapes as Shape
      const { shape: contour, holes } = shape.extractPoints(geometry.parameters.options.curveSegments)
      expect(holes.length).toBe(5)
      for (const hole of holes) for (let i = 0; i < hole.length; i++) {
        const p = hole[i]!, q = hole[(i + 1) % hole.length]!
        expect(inside(p, contour)).toBe(true)
        let clearance = Infinity
        for (let j = 0; j < contour.length; j++) {
          const a = contour[j]!, b = contour[(j + 1) % contour.length]!
          clearance = Math.min(clearance, distance(p, a, b)); expect(crosses(p, q, a, b)).toBe(false)
        }
        expect(clearance).toBeGreaterThan(0.006)
      }
    }
  } finally { model.dispose() }
})

test('027 actual cap triangles cover profile minus holes without crossing cut boundaries; both faces stay open', () => {
  const model = createModel(); model.root.updateMatrixWorld(true)
  try {
    const cheeks: Mesh[] = []; model.parts.carcass.traverse((o) => { if (o instanceof Mesh && o.name.endsWith('/ swept paw-cut side cheek')) cheeks.push(o) })
    for (const cheek of cheeks) {
      const g = cheek.geometry as ExtrudeGeometry, p = g.getAttribute('position'), index = g.index
      const { shape: contour, holes } = (g.parameters.shapes as Shape).extractPoints(g.parameters.options.curveSegments)
      const expectedArea = Math.abs(ShapeUtils.area(contour)) - holes.reduce((sum, hole) => sum + Math.abs(ShapeUtils.area(hole)), 0)
      const areas = [0, 0]
      for (let i = 0; i < (index?.count ?? p.count); i += 3) {
        const vs = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j))
        if (Math.abs(vs[0]!.x - vs[1]!.x) > 1e-7 || Math.abs(vs[0]!.x - vs[2]!.x) > 1e-7) continue
        // Undo the cheek's -90 degree Y rotation: authored XY maps to local ZY.
        const tri = vs.map((v) => new Vector2(v.z, v.y))
        const centre = tri.reduce((sum, v) => sum.add(v), new Vector2()).multiplyScalar(1 / 3)
        expect(inside(centre, contour)).toBe(true); expect(holes.some((h) => inside(centre, h))).toBe(false)
        for (const ring of [contour, ...holes]) for (let j = 0; j < ring.length; j++) for (let k = 0; k < 3; k++) {
          expect(crosses(tri[k]!, tri[(k + 1) % 3]!, ring[j]!, ring[(j + 1) % ring.length]!)).toBe(false)
        }
        areas[vs[0]!.x > 0 ? 1 : 0]! += Math.abs(cross(tri[0]!, tri[1]!, tri[2]!)) / 2
      }
      for (const area of areas) expect(area).toBeCloseTo(expectedArea, 7)
      for (const hole of holes) {
        const c = hole.reduce((sum, v) => sum.add(v), new Vector2()).multiplyScalar(1 / hole.length)
        for (const side of [-1, 1]) {
          const ray = new Raycaster(new Vector3(cheek.position.x + side * 0.06, c.y, c.x), new Vector3(-side, 0, 0))
          expect(ray.intersectObject(cheek).length).toBe(0)
          // Solid wood immediately above each perforation must still have a cap.
          ray.ray.origin.y = Math.max(...hole.map((v) => v.y)) + 0.003
          expect(ray.intersectObject(cheek).length).toBeGreaterThan(0)
        }
      }
    }
  } finally { model.dispose() }
})
