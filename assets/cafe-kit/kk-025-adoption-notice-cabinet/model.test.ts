import { expect, test } from 'bun:test'
import { Box3, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3, type BufferGeometry, type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
import { setCafeWoodFinish } from '../kk-core/index.ts'

const meshes = (root: Group): Mesh[] => { const result: Mesh[] = []; root.traverse((o) => { if (o instanceof Mesh) result.push(o) }); return result }
const named = (root: Group, name: string): Mesh => meshes(root).find((o) => o.name.endsWith(`/ ${name}`))!

test('025 furnishing dimensions and finite non-degenerate geometry stay within 6000 triangles', () => {
  const m = createModel()
  try {
    const bounds = new Box3().setFromObject(m.root); const size = bounds.getSize(new Vector3())
    expect(size.x).toBeCloseTo(0.65, 6); expect(size.y).toBeCloseTo(1, 6); expect(size.z).toBeCloseTo(0.2, 6); expect(bounds.min.y).toBeCloseTo(0, 6)
    expect(m.root.userData.category).toBe('furnishing')
    let triangles = 0; const a = new Vector3(), b = new Vector3(), c = new Vector3()
    for (const mesh of meshes(m.root)) {
      const g = mesh.geometry, p = g.getAttribute('position'), index = g.index; const count = index?.count ?? p.count; triangles += count / 3
      for (let i = 0; i < count; i += 3) {
        a.fromBufferAttribute(p, index ? index.getX(i) : i); b.fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1); c.fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2)
        const area = b.sub(a).cross(c.sub(a)).lengthSq(); expect(Number.isFinite(area)).toBe(true); expect(area).toBeGreaterThan(1e-20)
      }
    }
    expect(triangles).toBeLessThanOrEqual(6000)
  } finally { m.dispose() }
})

test('025 glazing is one sheet; cards and drawer contents have physical backing and support', () => {
  const m = createModel(); m.root.updateMatrixWorld(true)
  try {
    expect(meshes(m.parts.glazing).length).toBe(1)
    const glass = new Box3().setFromObject(m.parts.glazing)
    expect(glass.max.z - glass.min.z).toBe(0)
    const cards = meshes(m.parts.cards).filter((o) => o.name.endsWith('/ blank profile card'))
    expect(cards.length).toBe(8)
    const backing = new Box3().setFromObject(named(m.root, 'moss notice backing'))
    for (const card of cards) {
      const b = new Box3().setFromObject(card); expect(b.min.z).toBeCloseTo(backing.max.z, 6); expect(glass.min.z - b.max.z).toBeGreaterThan(0.08)
    }
    const floor = new Box3().setFromObject(named(m.root, 'drawer floor'))
    for (const folder of meshes(m.parts.documents)) expect(new Box3().setFromObject(folder).min.y).toBeCloseTo(floor.max.y, 6)
    const runner = new Box3().setFromObject(named(m.root, 'drawer support runner'))
    expect(runner.max.y).toBeGreaterThan(floor.min.y); expect(runner.min.y).toBeLessThan(floor.min.y)
    expect(runner.intersectsBox(floor)).toBe(true)
    // Select the open cavity, away from files, dividers, and side walls.
    const ray = new Raycaster(new Vector3(-0.23, 0.28, 0.025), new Vector3(0, -1, 0))
    expect(ray.intersectObject(m.parts.drawer)[0]!.object.name).toEndWith('/ drawer floor')
  } finally { m.dispose() }
})

test('025 configuration retains anchors and overrides and frees only owned resources once', () => {
  const external = new MeshStandardMaterial(); let externalDisposals = 0; external.addEventListener('dispose', () => externalDisposals++)
  const m = createModel({ materials: { cedar: external } }); const root = m.root; const drawer = m.parts.drawer
  const ownedMaterials = new Set(Object.values(m.materials).filter((material) => material !== external)); let materialDisposals = 0
  ownedMaterials.forEach((material) => material.addEventListener('dispose', () => materialDisposals++))
  const attachment = new Group(); drawer.add(attachment)
  const old = new Set(meshes(root).map((o) => o.geometry)); const counts = new Map<BufferGeometry, number>()
  old.forEach((g) => g.addEventListener('dispose', () => counts.set(g, (counts.get(g) ?? 0) + 1)))
  const textures = new Set<Texture>(); let textureDisposals = 0
  Object.values(m.materials).forEach((material) => { const s = material as MeshStandardMaterial; for (const t of [s.map, s.normalMap, s.roughnessMap]) if (t) textures.add(t) })
  textures.forEach((t) => t.addEventListener('dispose', () => textureDisposals++))
  m.configure({ drawerOpen: -2, cards: false, glazing: false })
  expect(m.root).toBe(root); expect(m.parts.drawer).toBe(drawer); expect(attachment.parent).toBe(drawer); expect(m.getConfig().drawerOpen).toBe(0)
  expect(meshes(m.parts.cards).length).toBe(0); expect(meshes(m.parts.glazing).length).toBe(0)
  expect([...counts.values()].every((n) => n === 1)).toBe(true); expect(counts.size).toBe(old.size)
  m.configure({ drawerOpen: Number.NaN, cards: true, glazing: true }); expect(m.getConfig().drawerOpen).toBe(1)
  const copy = m.getConfig() as { cards: boolean }; copy.cards = false; expect(m.getConfig().cards).toBe(true)
  m.setMaterial('washi', external); m.configure({ drawerOpen: 0.5 })
  expect(meshes(root).filter((o) => o.userData.materialSlot === 'washi').every((o) => o.material === external)).toBe(true)
  const original = external.color.getHex(); expect(setCafeWoodFinish(root, { tint: '#9a6744' })).toBeGreaterThan(0); expect(external.color.getHex()).toBe(original)
  const current = new Set(meshes(root).map((o) => o.geometry)); let currentDisposals = 0
  current.forEach((g) => g.addEventListener('dispose', () => currentDisposals++))
  m.dispose(); m.dispose(); m.configure({ cards: false })
  expect(currentDisposals).toBe(current.size); expect(textureDisposals).toBe(textures.size); expect(externalDisposals).toBe(0)
  expect(materialDisposals).toBe(ownedMaterials.size)
  external.dispose()
})
