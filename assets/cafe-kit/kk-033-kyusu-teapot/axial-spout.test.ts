import { describe, expect, test } from 'bun:test'
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

const path = [
  new Vector3(-0.010, 0.048, 0.039),
  new Vector3(-0.011, 0.054, 0.056),
  new Vector3(-0.012, 0.065, 0.066),
  new Vector3(-0.013, 0.078, 0.075),
  new Vector3(-0.014, 0.090, 0.086),
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
  test('all geometry is finite, nondegenerate and within the 2000 triangle budget', () => {
    const model = createModel()
    let triangles = 0
    model.root.traverse(object => {
      if (!(object instanceof Mesh)) return
      const p = object.geometry.getAttribute('position')
      const index = object.geometry.getIndex()!
      triangles += index.count / 3
      for (let i = 0; i < index.count; i += 3) {
        const [a, b, c] = [0, 1, 2].map(k => new Vector3().fromBufferAttribute(p, index.getX(i + k)))
        const area = b!.sub(a!).cross(c!.sub(a!)).lengthSq()
        expect(Number.isFinite(area)).toBe(true)
        expect(area).toBeGreaterThan(1e-20)
      }
    })
    expect(triangles).toBeLessThanOrEqual(2000)
    console.info(`kyusu triangle inventory: ${triangles}`)
    console.info('kyusu dimensions (m):', new Box3().setFromObject(model.root).getSize(new Vector3()).toArray())
    model.dispose()
  })
  test('configuration retains anchors, named meshes and consumer material ownership', () => {
    const model = createModel()
    const root = model.root
    const parts = { ...model.parts }
    const material = new MeshStandardMaterial()
    let releases = 0
    material.addEventListener('dispose', () => releases++)
    model.setMaterial('ceramic', material)
    model.configure({ lid: false, handleSide: -1 })
    expect(model.root).toBe(root)
    for (const key of ['body', 'lid', 'spout', 'handle'] as const) expect(model.parts[key]).toBe(parts[key])
    expect(parts.lid.children.length).toBe(0)
    const vessel = root.getObjectByName('kk-033-kyusu-teapot / rounded-vessel') as Mesh
    expect(vessel.material).toBe(material)
    model.configure({ lid: true, handleSide: 1 })
    expect(parts.lid.children.length).toBeGreaterThan(0)
    model.dispose()
    model.dispose()
    expect(releases).toBe(0)
    material.dispose()
  })
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
