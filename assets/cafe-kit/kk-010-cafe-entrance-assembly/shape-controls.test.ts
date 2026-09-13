import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { Box3, DoubleSide, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three/webgpu'
import * as entrance from './model.ts'
import * as chair from '../kk-012-spindle-back-chair/model.ts'
import * as trolley from '../kk-015-service-trolley/model.ts'

const modules = [entrance, chair, trolley]
const ids = ['kk-010-cafe-entrance-assembly', 'kk-012-spindle-back-chair', 'kk-015-service-trolley']
// Captured from 2f0726c and compared against its factories before recording these fixtures.
const baselineHashes = ['f2afa0db3c53e4c066c7702becfd6afd3a9c6e1f55ac4f63dc7d3d9496483b84', '9f198695a3d607aa9517f6a53cd9593951a9e3ded9cd9e271f131669b09ac4e1', 'd95f8c67a6e31f7a48ea05c4fde0c64ad6e0a14fb3d954fe67ab82b6ca3f66df']
const keys = ['archSpan', 'archRise', 'archThickness'] as const
const meshes = (root: Group): Mesh[] => { const result: Mesh[] = []; root.traverse(o => { if (o instanceof Mesh) result.push(o) }); return result }
function degenerateCount(mesh: Mesh): number {
  const p = mesh.geometry.getAttribute('position'); const index = mesh.geometry.index
  let count = 0
  for (let j = 0; j < (index?.count ?? p.count); j += 3) {
    const a = new Vector3().fromBufferAttribute(p, index ? index.getX(j) : j)
    const b = new Vector3().fromBufferAttribute(p, index ? index.getX(j + 1) : j + 1)
    const c = new Vector3().fromBufferAttribute(p, index ? index.getX(j + 2) : j + 2)
    if (b.sub(a).cross(c.sub(a)).lengthSq() <= 1e-22) count++
  }
  return count
}
function fingerprint(root: Group): string {
  root.updateMatrixWorld(true)
  const hash = createHash('sha256')
  for (const mesh of meshes(root)) {
    hash.update(mesh.name); hash.update(JSON.stringify(mesh.matrixWorld.elements))
    for (const key of Object.keys(mesh.geometry.attributes).sort()) hash.update(Buffer.from(mesh.geometry.getAttribute(key).array.buffer))
    if (mesh.geometry.index) hash.update(Buffer.from(mesh.geometry.index.array.buffer))
  }
  return hash.digest('hex')
}

for (const [i, module] of modules.entries()) {
  const id = ids[i]!
  test(`${id}: defaults match baseline geometry byte for byte`, () => {
    const current = module.createModel()
    expect(fingerprint(current.root)).toBe(baselineHashes[i])
    current.dispose()
  })

  test(`${id}: corners, atomic validation, stable attachments, disposal and budgets`, () => {
    const supplied = new MeshStandardMaterial(); let materialDisposals = 0
    supplied.addEventListener('dispose', () => materialDisposals++)
    const model = module.createModel({ materials: { cedar: supplied } })
    const root = model.root; const anchors = Object.values(model.parts)
    const baselineDegeneracies = new Map(meshes(root).map(mesh => [mesh.name, degenerateCount(mesh)]))
    const attachments = anchors.map(part => { const attachment = new Group(); part.add(attachment); return attachment })
    root.position.set(2, 3, -4); root.rotation.set(0.1, 0.3, 0.2); root.scale.set(1.2, 0.9, 1.1)
    root.updateMatrixWorld(true); const matrix = root.matrixWorld.clone()
    let geometryDisposals = 0; let expectedDisposals = 0
    const track = () => { for (const mesh of meshes(root)) { expectedDisposals++; mesh.geometry.addEventListener('dispose', () => geometryDisposals++) } }
    track()
    for (let corner = 0; corner < 8; corner++) {
      const patch = Object.fromEntries(keys.map((key, index) => [key, module.cafeShapeControls[key][corner & (1 << index) ? 'max' : 'min']]))
      model.configure(patch); track(); root.updateMatrixWorld(true)
      expect(root.matrixWorld.equals(matrix)).toBe(true)
      anchors.forEach((anchor, index) => expect(attachments[index]!.parent).toBe(anchor))
      expect(model.getConfig()).toMatchObject(patch)
      let triangles = 0
      for (const mesh of meshes(root)) {
        const p = mesh.geometry.getAttribute('position'); const idx = mesh.geometry.index
        const count = idx?.count ?? p.count; triangles += count / 3
        for (let j = 0; j < p.array.length; j++) expect(Number.isFinite(p.array[j])).toBe(true)
        for (let j = 0; j < count; j += 3) {
          const a = new Vector3().fromBufferAttribute(p, idx ? idx.getX(j) : j)
          const b = new Vector3().fromBufferAttribute(p, idx ? idx.getX(j + 1) : j + 1)
          const c = new Vector3().fromBufferAttribute(p, idx ? idx.getX(j + 2) : j + 2)
          // Preserve existing entrance degeneracies, but never introduce additional ones.
          if (i !== 0) expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-22)
        }
        expect(degenerateCount(mesh)).toBe(baselineDegeneracies.get(mesh.name))
      }
      expect(triangles).toBeLessThanOrEqual(i === 0 ? 16000 : i === 1 ? 14000 : 6000)
      const config = model.getConfig(); const before = fingerprint(root)
      for (const invalid of [NaN, Infinity, -Infinity]) for (const key of keys) {
        expect(() => model.configure({ archSpan: 0.1, [key]: invalid })).toThrow()
        expect(() => module.createModel({ [key]: invalid })).toThrow()
        expect(model.getConfig()).toEqual(config); expect(fingerprint(root)).toBe(before)
      }
    }
    model.configure({ archSpan: -100, archRise: 100 }); track()
    expect(model.getConfig().archSpan).toBe(module.cafeShapeControls.archSpan.min)
    expect(model.getConfig().archRise).toBe(module.cafeShapeControls.archRise.max)
    model.configure({ archSpan: undefined }); track()
    expect(model.getConfig().archSpan).toBe(module.cafeShapeControls.archSpan.min)
    model.dispose(); model.dispose()
    expect(geometryDisposals).toBe(expectedDisposals)
    expect(materialDisposals).toBe(0)
    const finalConfig = model.getConfig(); model.configure({ archSpan: 1 }); expect(model.getConfig()).toEqual(finalConfig)
    supplied.dispose()
  })
}

test('chair rejects invalid old numeric options atomically', () => {
  const model = chair.createModel(); const before = fingerprint(model.root)
  for (const patch of [{ spindles: NaN }, { rake: Infinity }, { archRise: 0.4, rake: NaN }]) {
    expect(() => model.configure(patch)).toThrow(); expect(fingerprint(model.root)).toBe(before)
    expect(() => chair.createModel(patch)).toThrow()
  }
  model.dispose()
})

test('chair corner spindle tips are inside the actual swept bow and feet seat in the plank', () => {
  const material = new MeshStandardMaterial({ side: DoubleSide })
  for (let corner = 0; corner < 8; corner++) for (const rake of [0, 0.4]) for (const spindles of [3, 7]) {
    const model = chair.createModel({ ...Object.fromEntries(keys.map((key, i) => [key, chair.cafeShapeControls[key][corner & (1 << i) ? 'max' : 'min']])), rake, spindles })
    model.root.position.set(2, 0.3, -1); model.root.rotation.y = 0.4; model.root.updateMatrixWorld(true)
    const config = model.getConfig()
    const merged = model.root.getObjectByName('kk-012-spindle-back-chair / bow-and-spindles') as Mesh
    const geometry = merged.geometry.clone()
    // First batch is the swept hoop: 60 segments × 8 sides plus its two buried caps.
    geometry.setDrawRange(0, 60 * 8 * 6 + 2 * 6 * 3)
    const bow = new Mesh(geometry, material); bow.matrixAutoUpdate = false; bow.matrixWorld.copy(merged.matrixWorld)
    const ray = new Raycaster()
    for (let i = 0; i < spindles; i++) {
      const x0 = (i / (spindles - 1) * 2 - 1) * 0.132
      const y = 0.415 + (0.668 + Math.sqrt(0.161 ** 2 - x0 ** 2) - 0.415) * config.archRise / 0.421
      const point = new Vector3(x0 * config.archSpan / 0.336, y, -0.145 + rake * (0.445 - y))
      // Opposed surface hits bracket the tip, proving it is buried, not merely near an AABB.
      for (const sign of [-1, 1]) {
        const origin = model.root.localToWorld(point.clone().add(new Vector3(0, 0, sign * 0.1)))
        const direction = new Vector3(0, 0, -sign).transformDirection(model.root.matrixWorld)
        ray.set(origin, direction)
        const hit = ray.intersectObject(bow)[0]
        expect(hit).toBeDefined(); expect(hit!.distance).toBeLessThan(0.1)
      }
    }
    const seat = model.root.getObjectByName('kk-012-spindle-back-chair / seat-plank') as Mesh
    for (const x of [-config.archSpan / 2, config.archSpan / 2]) {
      const origin = model.root.localToWorld(new Vector3(x, 0.5, -0.145 + rake * (0.445 - 0.415)))
      ray.set(origin, new Vector3(0, -1, 0).transformDirection(model.root.matrixWorld))
      expect(ray.intersectObject(seat)[0]!.distance).toBeCloseTo(0.055, 4)
    }
    geometry.dispose(); model.dispose()
  }
  material.dispose()
})

test('entrance corner contacts follow rebuilt opening with fresh world matrices', () => {
  for (let corner = 0; corner < 8; corner++) {
    const model = entrance.createModel(Object.fromEntries(keys.map((key, i) => [key, entrance.cafeShapeControls[key][corner & (1 << i) ? 'max' : 'min']])))
    model.root.updateMatrixWorld(true)
    const list = meshes(model.root); const named = (suffix: string) => list.filter(m => m.name.endsWith('/ ' + suffix))
    const box = (m: Mesh) => new Box3().setFromObject(m)
    const rod = box(named('noren rod')[0]!); const posts = named('cedar portal post'); const lintel = box(named('lintel beam')[0]!)
    expect(lintel.min.y).toBeCloseTo(model.getConfig().archRise, 5)
    expect(box(posts[1]!).min.x - box(posts[0]!).max.x).toBeCloseTo(model.getConfig().archSpan, 5)
    for (const post of posts) expect(box(post).intersectsBox(lintel)).toBe(true)
    for (const socket of named('rod bracket socket')) expect(box(socket).intersectsBox(rod)).toBe(true)
    for (const plate of named('rod bracket plate')) expect(posts.some(post => box(post).intersectsBox(box(plate)))).toBe(true)
    for (const loop of named('wrapped cloth loop')) {
      expect(box(loop).max.y - rod.max.y).toBeGreaterThan(0)
      expect(box(loop).max.y - rod.max.y).toBeLessThan(0.003)
      expect(named('split indigo noren').some(panel => box(panel).intersectsBox(box(loop)))).toBe(true)
    }
    model.dispose()
  }
})

test('trolley corner handle feet and casters stay on their support axes', () => {
  for (let corner = 0; corner < 8; corner++) {
    const model = trolley.createModel(Object.fromEntries(keys.map((key, i) => [key, trolley.cafeShapeControls[key][corner & (1 << i) ? 'max' : 'min']])))
    model.root.updateMatrixWorld(true)
    const find = (name: string) => model.root.getObjectByName('kk-015-service-trolley / ' + name) as Mesh
    const ray = new Raycaster()
    for (const x of [-model.getConfig().archSpan / 2, model.getConfig().archSpan / 2]) {
      ray.set(new Vector3(x, 0.67, -0.05), new Vector3(0, 0, -1))
      expect(ray.intersectObject(find('cedar-uprights')).length).toBeGreaterThan(0)
      expect(ray.intersectObject(find('curved-push-handle')).length).toBeGreaterThan(0)
      for (const z of [-0.174, 0.174]) {
        ray.set(new Vector3(x, 0.8, z), new Vector3(0, -1, 0))
        expect(ray.intersectObject(find('two-raised-service-trays')).length).toBeGreaterThan(0)
        expect(ray.intersectObject(find('fitted caster forks and axles')).length).toBeGreaterThan(0)
        expect(ray.intersectObject(find('vertical rubber tires')).length).toBeGreaterThan(0)
      }
    }
    model.dispose()
  }
})
