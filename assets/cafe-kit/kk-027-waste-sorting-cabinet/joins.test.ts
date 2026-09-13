import { expect, test } from 'bun:test'
import { Box3, Mesh, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

type Triangle = [Vector3, Vector3, Vector3]
type Point = [number, number]
const triangles = (mesh: Mesh): Triangle[] => {
  const p = mesh.geometry.getAttribute('position'), index = mesh.geometry.index
  const result: Triangle[] = []
  for (let i = 0; i < (index?.count ?? p.count); i += 3) result.push([0, 1, 2].map((j) =>
    new Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(mesh.matrixWorld)) as Triangle)
  return result
}
const normal = ([a, b, c]: Triangle): Vector3 => b.clone().sub(a).cross(c.clone().sub(a)).normalize()
const cross = (a: Point, b: Point, c: Point): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

/** Convex clipping of actual coplanar triangles; no bounding-box overlap inference. */
function overlap(a: Triangle, b: Triangle): number {
  const n = normal(a), other = normal(b)
  if (n.dot(other) < 1 - 1e-8 || b.some((p) => Math.abs(p.clone().sub(a[0]).dot(n)) > 1e-7)) return 0
  const axes = ['x', 'y', 'z'] as const
  const drop = axes.reduce((best, axis) => Math.abs(n[axis]) > Math.abs(n[best]) ? axis : best, 'x')
  const keep = axes.filter((axis) => axis !== drop)
  const project = (v: Vector3): Point => [v[keep[0]!], v[keep[1]!]]
  let polygon = a.map(project); const clip = b.map(project)
  const sign = Math.sign(cross(clip[0]!, clip[1]!, clip[2]!))
  for (let i = 0; i < 3; i++) {
    const start = clip[i]!, end = clip[(i + 1) % 3]!, output: Point[] = []
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j]!, q = polygon[(j + 1) % polygon.length]!
      const dp = sign * cross(start, end, p), dq = sign * cross(start, end, q)
      if (dp >= 0) output.push(p)
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq); output.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])
      }
    }
    polygon = output
  }
  let twiceArea = 0
  for (let i = 0; i < polygon.length; i++) { const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!; twiceArea += p[0] * q[1] - q[0] * p[1] }
  return Math.abs(twiceArea) / (2 * Math.abs(n[drop]))
}

test('027 actual front/shell triangles have no same-facing overlap on exposed walls', () => {
  const model = createModel(); model.root.updateMatrixWorld(true)
  try {
    let support: Mesh | undefined
    model.parts.carcass.traverse((o) => { if (o instanceof Mesh && o.name.endsWith('/ bin support shelf')) support = o })
    const shelf = new Box3().setFromObject(support!)
    for (const bin of [model.parts.leftBin, model.parts.rightBin]) {
      const meshes: Mesh[] = []; bin.traverse((o) => { if (o instanceof Mesh) meshes.push(o) })
      const shell = meshes.find((m) => m.name.endsWith('/ hollow tapered bin shell'))!
      const front = meshes.find((m) => m.name.endsWith('/ perforated bin front'))!
      const st = triangles(shell), ft = triangles(front)
      const bound = new Box3().setFromObject(shell).max.z
      expect(bound).toBeCloseTo(new Box3().setFromObject(front).max.z, 7)
      // Both AABBs terminate at this plane, but neither mesh has a triangle on it.
      for (const ts of [st, ft]) expect(ts.filter((t) => t.every((p) => Math.abs(p.z - bound) < 1e-7)).length).toBe(0)
      let exposedArea = 0, buriedArea = 0, buriedPairs = 0
      for (const a of st) for (const b of ft) {
        const area = overlap(a, b); if (area < 1e-10) continue
        const atFloor = a.every((p) => Math.abs(p.y - bin.position.y) < 1e-7)
        const underRim = a.every((p) => Math.abs(p.y - (bin.position.y + 0.435)) < 1e-7)
        if (atFloor) {
          // A 4 mm downward offset lies inside the supporting slab, well past its bevel.
          for (const p of b) expect(shelf.containsPoint(p.clone().add(new Vector3(0, -0.004, 0)))).toBe(true)
        }
        if (atFloor || underRim) { buriedArea += area; buriedPairs++ } else exposedArea += area
      }
      expect(exposedArea).toBeLessThan(1e-10)
      // Outer front edges meet the side-shell edges, rather than floating apart.
      for (const side of [-1, 1]) for (const y of [0, 0.435]) {
        const endpoint = new Vector3(bin.position.x + side * (0.103 + y * 0.022 / 0.435), bin.position.y + y, bin.position.z + 0.119 + y * 0.026 / 0.435)
        for (const ts of [st, ft]) expect(Math.min(...ts.flat().map((p) => p.distanceTo(endpoint)))).toBeLessThan(1e-7)
      }
      console.info(`${bin.name}: exposed coplanar overlap=${exposedArea} m2; buried horizontal overlap=${buriedArea.toFixed(9)} m2 (${buriedPairs} triangle pairs); no triangles on z=${bound.toFixed(3)}`)
    }
  } finally { model.dispose() }
})
