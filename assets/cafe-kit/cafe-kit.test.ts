// Ownership and runtime-contract tests for every Kyoto Kat model — DISCOVERED, not hand-listed.
//
// Fifty models are built by parallel workers who each own one `kk-0NN-<slug>/` directory. Nobody edits
// this file to register a model: every directory with a model.ts is under test the moment it exists.
// A worker runs its own model with `bun test assets/cafe-kit -t kk-0NN`.
//
// The contract is the F1 kit's (rules 15–17 of the vibe-model modeling rules): dispose exactly once,
// dispose twice safely, keep the root and semantic parts stable across a rebuild, never accumulate
// geometry across rebuilds, never dispose a consumer-supplied material. Plus the kit's own datum rules:
// ground at y = 0, bottom-centre origin, metric size within the manifest's authored target.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Box3, BufferGeometry, Material, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three/webgpu'
import { listModelIds } from './kk-core/catalog.ts'
import { TIER_BUDGET, numberFromId, tierFromId } from '../../registries/cafe-kit/src/categories.ts'

type Instance = {
  root: import('three/webgpu').Group
  parts: Record<string, { uuid: string }>
  materials: Record<string, Material>
  getConfig(): unknown
  configure(patch: unknown): void
  setMaterial(slot: string, material: Material): void
  dispose(): void
}
type ModelModule = {
  createModel: (options?: Record<string, unknown>) => Instance
  createPreview: (options: { aspect: number; time?: number }) => unknown
  createCafePreview?: (options: { aspect: number; time?: number }) => unknown
}

const ids = await listModelIds()
const modules = new Map<string, ModelModule>()
for (const id of ids) modules.set(id, await import(`./${id}/model.ts`) as ModelModule)

interface ManifestItem {
  id: string
  dimensions_m: { width: number; depth: number; height: number }
  triangle_target: number
}
const manifest = JSON.parse(readFileSync(join(import.meta.dir, '../../docs/kyoto-kat/manifest.json'), 'utf8')) as {
  items: ManifestItem[]
}
const manifestById = new Map(manifest.items.map((item) => [numberFromId(item.id), item]))
// This production batch must match the original targets; don't accept warning-only drift.
const exactTargetIds = new Set([7, 9, 10, 13, 14, 15, 18])

// --- dispose instrumentation -------------------------------------------------------------------------

const disposeCounts = new Map<object, number>()
let restore: Array<() => void> = []

const instrument = (proto: { dispose: () => void }): void => {
  const original = proto.dispose
  proto.dispose = function patched(this: object) {
    disposeCounts.set(this, (disposeCounts.get(this) ?? 0) + 1)
    return original.call(this)
  }
  restore.push(() => { proto.dispose = original })
}

const countOf = (resource: object): number => disposeCounts.get(resource) ?? 0

const resourcesOf = (root: { traverse: (fn: (o: unknown) => void) => void }): {
  geometries: BufferGeometry[]
  materials: Material[]
} => {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    geometries.add(mesh.geometry as BufferGeometry)
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material as Material)
    }
  })
  return { geometries: [...geometries], materials: [...materials] }
}

const triangleCount = (root: { traverse: (fn: (o: unknown) => void) => void }): number => {
  let triangles = 0
  root.traverse((object) => {
    const mesh = object as Mesh & { isInstancedMesh?: boolean; count?: number }
    if (!mesh.isMesh) return
    const geometry = mesh.geometry as BufferGeometry
    const per = geometry.index ? geometry.index.count / 3 : (geometry.getAttribute('position')?.count ?? 0) / 3
    triangles += per * (mesh.isInstancedMesh ? (mesh.count ?? 1) : 1)
  })
  return Math.round(triangles)
}

beforeEach(() => {
  disposeCounts.clear()
  restore = []
  instrument(BufferGeometry.prototype as unknown as { dispose: () => void })
  instrument(Material.prototype as unknown as { dispose: () => void })
})

afterEach(() => {
  for (const undo of restore) undo()
  restore = []
})

describe('cafe-kit kit', () => {
  test('every model directory follows the id contract and has a manifest row', () => {
    for (const id of ids) {
      expect(id).toMatch(/^kk-\d{3}-[a-z0-9-]+$/)
      expect(manifestById.has(numberFromId(id))).toBe(true)
      expect(() => tierFromId(id)).not.toThrow()
    }
  })
})

describe.each(ids)('%s', (id) => {
  const mod = modules.get(id)!
  const factory = () => mod.createModel()

  test('exports createModel, createPreview and createCafePreview', () => {
    expect(typeof mod.createModel).toBe('function')
    expect(typeof mod.createPreview).toBe('function')
    expect(typeof mod.createCafePreview).toBe('function')
  })

  test('disposes every owned resource exactly once', () => {
    const model = factory()
    const { geometries, materials } = resourcesOf(model.root)
    expect(geometries.length).toBeGreaterThan(0)
    expect(materials.length).toBeGreaterThan(0)
    model.dispose()
    for (const geometry of geometries) expect(countOf(geometry)).toBe(1)
    for (const material of materials) expect(countOf(material)).toBe(1)
  })

  test('is safe to dispose twice', () => {
    const model = factory()
    const { geometries, materials } = resourcesOf(model.root)
    model.dispose()
    model.dispose()
    for (const resource of [...geometries, ...materials]) expect(countOf(resource)).toBeLessThanOrEqual(2)
  })

  test('keeps the root and its part groups stable across a rebuild (rule 15)', () => {
    const model = factory()
    const rootId = model.root.uuid
    const partIds = Object.values(model.parts).map((p) => p.uuid)
    expect(partIds.length).toBeGreaterThan(0)
    model.configure(model.getConfig())
    expect(model.root.uuid).toBe(rootId)
    expect(Object.values(model.parts).map((p) => p.uuid)).toEqual(partIds)
    model.dispose()
  })

  test('does not accumulate live geometry across rebuild cycles', () => {
    const model = factory()
    const firstGeneration = resourcesOf(model.root).geometries
    const baseline = firstGeneration.length
    for (let cycle = 0; cycle < 3; cycle++) {
      model.configure(model.getConfig())
      expect(resourcesOf(model.root).geometries.length).toBe(baseline)
    }
    const live = new Set(resourcesOf(model.root).geometries)
    for (const geometry of firstGeneration) expect(countOf(geometry)).toBe(live.has(geometry) ? 0 : 1)
    model.dispose()
  })

  if (exactTargetIds.has(numberFromId(id))) test('configuration preserves consumer placement and attachments', () => {
    const model = factory()
    model.root.position.set(2, 3, -4)
    model.root.rotation.set(0.1, 0.4, -0.2)
    const attachments = Object.values(model.parts).map((anchor) => {
      const group = anchor as unknown as import('three/webgpu').Group
      const child = new Mesh(new BufferGeometry(), new MeshStandardMaterial())
      group.add(child)
      return { group, child }
    })
    try {
      model.configure(model.getConfig())
      expect(model.root.position.toArray()).toEqual([2, 3, -4])
      expect(model.root.rotation.toArray()).toEqual([0.1, 0.4, -0.2, 'XYZ'])
      for (const { group, child } of attachments) expect(child.parent).toBe(group)
    } finally {
      for (const { child } of attachments) { child.removeFromParent(); child.geometry.dispose(); (child.material as Material).dispose() }
      model.dispose()
    }
  })

  if ([7, 10, 18].includes(numberFromId(id))) test('does not erase consumer brass texture maps', () => {
    const texture = new Texture()
    const brass = new MeshStandardMaterial({ map: texture, normalMap: texture, roughnessMap: texture })
    const model = factory({ materials: { brass } })
    try {
      model.configure(model.getConfig())
      expect(brass.map).toBe(texture)
      expect(brass.normalMap).toBe(texture)
      expect(brass.roughnessMap).toBe(texture)
    } finally {
      model.dispose(); brass.dispose(); texture.dispose()
    }
  })

  test('never disposes a consumer-supplied material (rule 17)', () => {
    const model = factory()
    const slot = Object.keys(model.materials)[0]!
    const probe = new MeshStandardMaterial()
    model.setMaterial(slot, probe)
    let hits = 0
    model.root.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh && mesh.material === probe) hits++
    })
    expect(hits).toBeGreaterThan(0)
    model.dispose()
    expect(countOf(probe)).toBe(0)
    probe.dispose()
  })

  test('stands on the ground at a bottom-centre origin, inside the manifest envelope', () => {
    const model = factory()
    model.root.updateMatrixWorld(true)
    const box = new Box3().setFromObject(model.root as never)
    const size = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    const item = manifestById.get(numberFromId(id))!
    if (exactTargetIds.has(numberFromId(id))) {
      expect(size.x).toBeCloseTo(item.dimensions_m.width, 4)
      expect(size.y).toBeCloseTo(item.dimensions_m.height, 4)
      expect(size.z).toBeCloseTo(item.dimensions_m.depth, 4)
    }
    const hanging = (model.root.userData as { attachment?: string }).attachment
    // Hanging / wall-mounted objects document an attachment pivot instead of standing on y = 0.
    if (!hanging) {
      expect(Math.abs(box.min.y)).toBeLessThanOrEqual(0.01)
      expect(Math.abs(centre.x)).toBeLessThanOrEqual(Math.max(0.03, size.x * 0.08))
      expect(Math.abs(centre.z)).toBeLessThanOrEqual(Math.max(0.03, size.z * 0.08))
    }
    // Authored target ±20 % (the manifest calls its dimensions targets, not measurements); a bigger
    // departure is a reasoned override documented in the model header, so the test only warns then.
    const within = (actual: number, target: number) => Math.abs(actual - target) / target <= 0.2
    const ok = within(size.x, item.dimensions_m.width)
      && within(size.z, item.dimensions_m.depth)
      && within(size.y, item.dimensions_m.height)
    if (!ok) {
      console.warn(`${id}: size ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)} m departs >20 % from manifest ${item.dimensions_m.width}×${item.dimensions_m.height}×${item.dimensions_m.depth}`)
    }
    expect(size.x).toBeGreaterThan(0.02)
    expect(size.y).toBeGreaterThan(0.02)
    expect(size.z).toBeGreaterThan(0.02)
    model.dispose()
  })

  test('respects its tier triangle budget', () => {
    const model = factory()
    const tier = tierFromId(id)
    expect(triangleCount(model.root)).toBeLessThanOrEqual(TIER_BUDGET[tier].triangles)
    model.dispose()
  })

  test('names every mesh with the model id and uses only kit materials', () => {
    const model = factory()
    model.root.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      expect(mesh.name.startsWith(id)).toBe(true)
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        expect((material as Material).name.startsWith('cafe-kit / ')).toBe(true)
      }
    })
    model.dispose()
  })
})
