import { expect, test } from 'bun:test'
import { Box3, Group, Mesh, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('shoe rack keeps original envelope, finite triangles and useful cubbies', () => {
  for (const columns of [2, 3, 4]) {
    const model = createModel({ columns }); let triangles = 0
    model.root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const positions = object.geometry.getAttribute('position'); const index = object.geometry.index
      const count = index?.count ?? positions.count; triangles += count / 3
      for (let i = 0; i < count; i += 3) {
        const points = [0, 1, 2].map((offset) => new Vector3().fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset))
        expect(points.every((point) => point.toArray().every(Number.isFinite))).toBe(true)
        expect(points[1]!.sub(points[0]!).cross(points[2]!.sub(points[0]!)).lengthSq()).toBeGreaterThan(1e-22)
      }
    })
    const bounds = new Box3().setFromObject(model.root); const size = bounds.getSize(new Vector3())
    expect(size.x).toBeCloseTo(0.9, 4); expect(size.y).toBeCloseTo(0.6, 4); expect(size.z).toBeCloseTo(0.3, 4)
    expect(bounds.min.y).toBeCloseTo(0, 5); expect(triangles).toBeLessThanOrEqual(6000)
    model.dispose()
  }
})

test('configuration preserves root transforms, anchors and consumer attachments', () => {
  const model = createModel(); const attachment = new Group()
  model.parts.shelves.add(attachment); model.root.position.set(2, 3, 4)
  const root = model.root; const shelves = model.parts.shelves
  model.configure({ columns: 4 }); model.root.updateMatrixWorld(true)
  expect(model.root).toBe(root); expect(model.parts.shelves).toBe(shelves)
  expect(attachment.parent).toBe(shelves); expect(model.root.position.toArray()).toEqual([2, 3, 4])
  expect(() => model.configure({ columns: NaN })).toThrow()
  expect(model.getConfig().columns).toBe(4)
  model.dispose(); model.dispose()
})
