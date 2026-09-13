import { expect, test } from 'bun:test'
import { Box3, Mesh, Raycaster, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'
import { compileCatalogEntry } from '../kk-core/compile.ts'
import { entry } from './catalog.ts'
import { entry as walkwayEntry } from '../kk-021-wall-cat-walkway/catalog.ts'

test('kk-024 doorway and vents are true holes; sliding panel exposes service access', () => {
  const model = createModel(); const ray = new Raycaster()
  for (const entranceLeft of [false, true]) {
    const side = entranceLeft ? -1 : 1
    model.configure({ entranceLeft, serviceOpen: 0 }); model.root.updateMatrixWorld(true)
    const doorway = model.root.getObjectByName('kk-024-ventilated-litter-enclosure / round cat doorway panel') as Mesh
    ray.set(new Vector3(side * 0.151, 0.2815, 0.5), new Vector3(0, 0, -1))
    expect(ray.intersectObject(doorway)).toHaveLength(0)
    expect(ray.intersectObject(model.root, true)[0]!.distance).toBeGreaterThan(0.65)
    // The face around the hole is a real, thick board.
    ray.set(new Vector3(side * 0.151, 0.44, 0.5), new Vector3(0, 0, -1))
    expect(ray.intersectObject(doorway)[0]!.distance).toBeCloseTo(0.2585, 4)
    // A clear line across both side walls midway between two slats.
    ray.set(new Vector3(0.5, 0.28, -0.1575), new Vector3(-1, 0, 0))
    expect(ray.intersectObject(model.root, true)).toHaveLength(0)
    ray.set(new Vector3(-side * 0.1575, 0.282, 0.5), new Vector3(0, 0, -1))
    expect(ray.intersectObject(model.root, true)[0]!.distance).toBeLessThan(0.30)
    const anchor = model.parts.serviceDoor
    model.configure({ serviceOpen: 1 }); model.root.updateMatrixWorld(true)
    expect(model.parts.serviceDoor).toBe(anchor)
    expect(ray.intersectObject(model.root, true)[0]!.distance).toBeGreaterThan(0.65)
    expect(anchor.position.x).toBeCloseTo(side * 0.296, 6)
  }
  model.dispose()
})

test('kk-024 tray is hollow, seated on the floor and can clear its rear withdrawal slot', () => {
  const model = createModel(); model.root.updateMatrixWorld(true)
  const named = (name: string) => model.root.getObjectByName('kk-024-ventilated-litter-enclosure / ' + name) as Mesh
  const floor = new Box3().setFromObject(named('cabinet floor'))
  const trayFloor = new Box3().setFromObject(named('tray floor'))
  expect(trayFloor.min.y).toBeCloseTo(floor.max.y, 6)
  const ray = new Raycaster(new Vector3(0, 0.3, -0.008), new Vector3(0, -1, 0))
  const hit = ray.intersectObject(model.parts.tray, true)[0]!
  expect(hit.object.name).toEndWith('contained litter bed')
  expect(hit.point.y).toBeLessThan(0.12)
  const meshes: Mesh[] = []; model.parts.tray.traverse(o => { if (o instanceof Mesh) meshes.push(o) })
  for (const wall of meshes.filter(mesh => mesh.name.includes('wall'))) expect(new Box3().setFromObject(wall).intersectsBox(trayFloor)).toBe(true)
  const anchor = model.parts.tray
  for (const trayExtension of [0, 0.25, 0.5, 1]) {
    model.configure({ trayExtension }); model.root.updateMatrixWorld(true)
    expect(model.parts.tray).toBe(anchor)
    const box = new Box3().setFromObject(model.parts.tray)
    const header = new Box3().setFromObject(named('rear maintenance header'))
    expect(box.max.y).toBeLessThan(header.min.y)
    expect(box.min.x).toBeGreaterThan(-0.2925); expect(box.max.x).toBeLessThan(0.2925)
    expect(box.min.z).toBeCloseTo(-0.182 - trayExtension * 0.4, 5)
  }
  model.root.position.set(1, 2, -3); model.root.rotation.y = 0.7; model.root.scale.set(1.1, 0.9, 1.2)
  model.configure({ trayExtension: 0 }); model.root.updateMatrixWorld(true)
  const probe = model.root.localToWorld(new Vector3(0, 0.3, -0.008))
  ray.set(probe, new Vector3(0, -1, 0).transformDirection(model.root.matrixWorld))
  expect(ray.intersectObject(model.parts.tray, true)[0]!.distance).toBeCloseTo((0.3 - 0.1085) * 0.9, 5)
  model.dispose()
})

test('kk-024 numeric configuration is finite, bounded and validated before mutation', () => {
  const model = createModel(); const before = model.getConfig(); const original = model.parts.carcass.children[0]!.children[0]
  for (const invalid of [NaN, Infinity, -Infinity]) {
    expect(() => model.configure({ entranceLeft: true, serviceOpen: invalid })).toThrow()
    expect(() => model.configure({ serviceOpen: 1, trayExtension: invalid })).toThrow()
    expect(() => createModel({ trayExtension: invalid })).toThrow()
    expect(model.getConfig()).toEqual(before)
    expect(model.parts.carcass.children[0]!.children[0]).toBe(original)
  }
  model.configure({ serviceOpen: 99, trayExtension: -2 })
  expect(model.getConfig()).toEqual({ entranceLeft: false, serviceOpen: 1, trayExtension: 0 })
  model.dispose()
})

for (const catalog of [entry, walkwayEntry]) test(`${catalog.id}: topology keeps assemblies without AABB fallback`, async () => {
  const compiled = await compileCatalogEntry(catalog)
  try {
    expect(compiled.topology.claims.manifold).toBe(true)
    expect(compiled.topology.claims.boundaryMode).toBe('closed')
    expect(compiled.topology.topologyKey.includes('|aabb-hull')).toBe(false)
    expect(catalog.pruneToLargest).toBe(false); expect(catalog.keepOpenings).toBe(true)
    expect(compiled.topology.indices.length / 3).toBeLessThanOrEqual(6000)
  } finally { compiled.dispose() }
})
