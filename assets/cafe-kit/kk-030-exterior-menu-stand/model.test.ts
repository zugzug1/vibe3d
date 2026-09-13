import { expect, test } from 'bun:test'
import { Box3, Mesh, Raycaster, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'
import { compileCatalogEntry } from '../kk-core/compile.ts'
import { entry as registerEntry } from '../kk-026-cash-register-counter/catalog.ts'
import { entry as coatEntry } from '../kk-028-coat-and-bag-stand/catalog.ts'
import { entry } from './catalog.ts'
test('kk-030 panel, clips, roof and feet stay joined for every structural corner', () => {
  const model = createModel(); const writing = model.root.getObjectByName('writing-surface')!
  for (const panelWidth of [0.32, 0.44]) for (const panelHeight of [0.50, 0.68]) for (const footDepth of [0.36, 0.60]) {
    model.configure({ panelWidth, panelHeight, footDepth }); model.root.updateMatrixWorld(true)
    const list: Mesh[] = []; model.root.traverse(o => { if (o instanceof Mesh) list.push(o) })
    const named = (name: string) => list.filter(mesh => mesh.name.endsWith('/ ' + name))
    const box = (mesh: Mesh) => new Box3().setFromObject(mesh)
    const paper = named('blank writing panel')[0]!; const backing = named('replaceable panel backing')[0]!
    expect(box(paper).intersectsBox(box(backing))).toBe(true)
    for (const clip of named('retaining panel clip')) expect(box(clip).intersectsBox(box(paper))).toBe(true)
    for (const upright of named('continuous upright')) {
      expect(named('weighted long foot').some(foot => box(foot).intersectsBox(box(upright)))).toBe(true)
      expect(box(backing).intersectsBox(box(upright))).toBe(true)
    }
    for (const rafter of named('seated roof rafter')) {
      expect(box(rafter).intersectsBox(box(named('pitched weather roof')[0]!))).toBe(true)
      expect(named('continuous upright').some(upright => box(upright).intersectsBox(box(rafter)))).toBe(true)
    }
    const bearing = box(named('housed roof ridge bearing')[0]!)
    for (const capital of named('housed post capital')) {
      expect(box(capital).intersectsBox(bearing)).toBe(true)
      expect(named('continuous upright').some(post => box(post).intersectsBox(box(capital)))).toBe(true)
    }
    expect(bearing.intersectsBox(box(named('pitched weather roof')[0]!))).toBe(true)
    expect(box(named('continuous seated ridge cap')[0]!).intersectsBox(box(named('pitched weather roof')[0]!))).toBe(true)
    for (const charm of named('plain ceramic charm')) expect(named('hanging ornament ring').some(ring => box(ring).intersectsBox(box(charm)))).toBe(true)
    const ray = new Raycaster(new Vector3(0, 0.145, 0.4), new Vector3(0, 0, -1))
    expect(ray.intersectObject(model.root, true)).toHaveLength(0)
    expect(writing.position.y).toBeCloseTo(0.22 + panelHeight / 2, 6)
  }
  model.root.position.set(1, 2, -3); model.root.rotation.set(0.1, 0.6, 0.2); model.root.scale.set(1.2, 0.9, 1.1)
  model.configure({ panelHeight: 0.60 }); model.root.updateMatrixWorld(true)
  const origin = model.root.localToWorld(new Vector3(0, 0.52, 0.3))
  const ray = new Raycaster(origin, new Vector3(0, 0, -1).transformDirection(model.root.matrixWorld))
  const hit = ray.intersectObject(model.parts.panel, true)[0]!
  expect(hit.object.name).toEndWith('blank writing panel')
  expect(hit.distance).toBeCloseTo((0.3 - 0.0098) * 1.1, 5)
  model.dispose()
})
for (const catalog of [registerEntry, coatEntry, entry]) test(`${catalog.id} compiles a closed manifold without dropping structural islands`, async () => {
  const result = await compileCatalogEntry(catalog)
  try {
    expect(result.topology.claims.manifold).toBe(true)
    expect(result.topology.claims.boundaryMode).toBe('closed')
    expect(result.topology.topologyKey.includes('|aabb-hull')).toBe(false)
    expect(catalog.keepOpenings).toBe(true); expect(catalog.pruneToLargest).toBe(false)
    expect(result.topology.indices.length / 3).toBeLessThanOrEqual(6000)
  } finally { result.dispose() }
})
