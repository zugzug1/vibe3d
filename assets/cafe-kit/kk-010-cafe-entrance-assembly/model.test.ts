import { expect, test } from 'bun:test'
import { Box3, Mesh, Raycaster, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-010 roof, rod supports, cloth straps and ink have actual seated geometry', () => {
  const model = createModel(); model.root.updateMatrixWorld(true)
  const meshes: Mesh[] = []; model.root.traverse(o => { if (o instanceof Mesh) meshes.push(o) })
  const named = (suffix: string): Mesh => meshes.find(m => m.name.endsWith('/ ' + suffix))!
  const bounds = (suffix: string): Box3 => new Box3().setFromObject(named(suffix))
  const roof = named('connected pitched roof')
  const ray = new Raycaster(new Vector3(0, 2.3, 0), new Vector3(0, -1, 0))
  expect(ray.intersectObject(roof)[0]!.point.y).toBeCloseTo(2.185, 5)
  expect(bounds('continuous roof support').max.y).toBeGreaterThan(2.157)
  expect(bounds('continuous roof support').min.y).toBeLessThan(bounds('lintel beam').max.y)
  const rod = bounds('noren rod')
  for (const socket of meshes.filter(m => m.name.endsWith('/ rod bracket socket'))) {
    const b = new Box3().setFromObject(socket)
    expect(b.intersectsBox(rod)).toBe(true)
    const plate = meshes.find(m => m.name.endsWith('/ rod bracket plate') && Math.sign(m.position.x) === Math.sign(socket.position.x))!
    const post = meshes.find(m => m.name.endsWith('/ cedar portal post') && Math.sign(m.position.x) === Math.sign(socket.position.x))!
    expect(b.intersectsBox(new Box3().setFromObject(plate))).toBe(true)
    expect(new Box3().setFromObject(plate).intersectsBox(new Box3().setFromObject(post))).toBe(true)
  }
  const panels = meshes.filter(m => m.name.endsWith('/ split indigo noren'))
  for (const loop of meshes.filter(m => m.name.endsWith('/ wrapped cloth loop'))) {
    const b = new Box3().setFromObject(loop)
    expect(b.min.y).toBeLessThan(1.73)
    expect(b.max.y - rod.max.y).toBeGreaterThan(0)
    expect(b.max.y - rod.max.y).toBeLessThan(0.003)
    // Through the strap opening along the rod axis: no block masquerading as a loop.
    ray.set(new Vector3(b.min.x - 0.01, 1.767, 0.108), new Vector3(1, 0, 0))
    expect(ray.intersectObject(loop).length).toBe(0)
  }
  for (const ink of meshes.filter(m => m.name.endsWith('/ seated cat ink') || m.name.endsWith('/ cat seal border'))) {
    const p = ink.geometry.getAttribute('position')
    const panel = panels.find(m => m.position.x > 0)!
    // Check triangle centroids as well as vertices; a flat badge can pass vertex-only checks.
    for (let i = 0; i < p.count; i += 3) {
      const point = new Vector3().fromBufferAttribute(p, i).add(new Vector3().fromBufferAttribute(p, i + 1)).add(new Vector3().fromBufferAttribute(p, i + 2)).divideScalar(3).add(ink.position)
      ray.set(new Vector3(point.x, point.y, 0.2), new Vector3(0, 0, -1))
      const hit = ray.intersectObject(panel)[0]!
      expect(hit).toBeDefined()
      expect(point.z - hit.point.z).toBeGreaterThan(0.00015)
      expect(point.z - hit.point.z).toBeLessThan(0.002)
    }
  }
  model.configure({ emblem: false })
  expect(model.parts.noren.children[0]!.children.some(o => o instanceof Mesh && o.material === model.materials.vermilion)).toBe(false)
  model.dispose()
})
