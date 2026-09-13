import { describe, expect, test } from 'bun:test'
import { Mesh, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

const path = [
  new Vector3(-0.010, 0.057, 0.036),
  new Vector3(-0.011, 0.064, 0.053),
  new Vector3(-0.012, 0.073, 0.073),
  new Vector3(-0.014, 0.082, 0.092),
]

function nearestCenter(point: Vector3): Vector3 {
  let best = path[0]!.clone()
  let bestDistance = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const edge = path[i + 1]!.clone().sub(start)
    const t = Math.max(0, Math.min(1, point.clone().sub(start).dot(edge) / edge.lengthSq()))
    const candidate = start.clone().addScaledVector(edge, t)
    const distance = candidate.distanceToSquared(point)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best
}

describe('kk-033 axial spout', () => {
  test('side-face normals point away from the centerline for either handle side', () => {
    for (const handleSide of [1, -1] as const) {
      const model = createModel({ handleSide })
      let spout: Mesh | undefined
      model.root.traverse((object) => {
        if (object instanceof Mesh && object.name.endsWith(' / short-spout')) spout = object
      })
      expect(spout).toBeDefined()
      const geometry = spout!.geometry
      const position = geometry.getAttribute('position')
      const index = geometry.getIndex()!
      for (let i = 0; i < index.count; i += 3) {
        const a = new Vector3().fromBufferAttribute(position, index.getX(i))
        const b = new Vector3().fromBufferAttribute(position, index.getX(i + 1))
        const c = new Vector3().fromBufferAttribute(position, index.getX(i + 2))
        const normal = b.clone().sub(a).cross(c.clone().sub(a))
        const centroid = a.clone().add(b).add(c).multiplyScalar(1 / 3)
        const radial = centroid.sub(nearestCenter(centroid))
        expect(normal.dot(radial)).toBeGreaterThan(0)
      }
      model.dispose()
    }
  })
})
