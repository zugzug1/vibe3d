import { expect, test } from 'bun:test'
import { Box3, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3, type Texture } from 'three/webgpu'
import { createModel } from './model.ts'

const meshes = (root: Group): Mesh[] => { const result: Mesh[] = []; root.traverse((o) => { if (o instanceof Mesh) result.push(o) }); return result }

test('027 exact furnishing dimensions, finite triangles, and 6000 triangle budget', () => {
  const m = createModel()
  try {
    const bounds = new Box3().setFromObject(m.root); const size = bounds.getSize(new Vector3())
    expect(size.x).toBeCloseTo(0.7, 6); expect(size.y).toBeCloseTo(0.75, 6); expect(size.z).toBeCloseTo(0.4, 6); expect(bounds.min.y).toBeCloseTo(0, 6)
    expect(m.root.userData.category).toBe('furnishing')
    let triangles = 0; const a = new Vector3(), b = new Vector3(), c = new Vector3()
    for (const mesh of meshes(m.root)) {
      const g = mesh.geometry, p = g.getAttribute('position'), index = g.index, count = index?.count ?? p.count; triangles += count / 3
      for (let i = 0; i < count; i += 3) {
        a.fromBufferAttribute(p, index ? index.getX(i) : i); b.fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1); c.fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2)
        const area = b.sub(a).cross(c.sub(a)).lengthSq(); expect(Number.isFinite(area)).toBe(true); expect(area).toBeGreaterThan(1e-20)
      }
    }
    expect(triangles).toBeLessThanOrEqual(6000)
  } finally { m.dispose() }
})

test('027 both bin mouths and handle cuts expose an actual recessed interior; floors face upward', () => {
  const m = createModel(); m.root.updateMatrixWorld(true)
  try {
    for (const bin of [m.parts.leftBin, m.parts.rightBin]) {
      const x = bin.position.x; const z = bin.position.z
      const floorHit = new Raycaster(new Vector3(x, 0.59, z), new Vector3(0, -1, 0)).intersectObject(bin)[0]!
      expect(floorHit.object.name).toEndWith('/ hollow tapered bin shell'); expect(floorHit.point.y).toBeCloseTo(0.113, 6)
      const handleHit = new Raycaster(new Vector3(x, 0.505, 0.3), new Vector3(0, 0, -1)).intersectObject(bin)[0]!
      expect(handleHit.point.z).toBeLessThan(-0.1)
      const frontHit = new Raycaster(new Vector3(x + 0.07, 0.505, 0.3), new Vector3(0, 0, -1)).intersectObject(bin)[0]!
      expect(frontHit.object.name).toEndWith('/ perforated bin front'); expect(frontHit.point.z).toBeGreaterThan(0.14)
      const outside = new Raycaster(new Vector3(x + 0.2, 0.3, z), new Vector3(-1, 0, 0)).intersectObject(bin)[0]!
      expect(outside.point.x).toBeGreaterThan(x + 0.10)
    }
    const cat = new Raycaster(new Vector3(0, 0.708, 0.3), new Vector3(0, 0, -1)).intersectObject(m.parts.crest)
    expect(cat.length).toBe(0)
    const solid = new Raycaster(new Vector3(0.08, 0.708, 0.3), new Vector3(0, 0, -1)).intersectObject(m.parts.crest)
    expect(solid.length).toBeGreaterThan(0)
  } finally { m.dispose() }
})

test('027 bins sit on the shelf with clear divider/counter margins', () => {
  const m = createModel(); m.root.updateMatrixWorld(true)
  try {
    const shelf = meshes(m.parts.carcass).find((o) => o.name.endsWith('/ bin support shelf'))!
    const support = new Box3().setFromObject(shelf)
    for (const bin of [m.parts.leftBin, m.parts.rightBin]) {
      const b = new Box3().setFromObject(bin); expect(b.min.y).toBeCloseTo(support.max.y, 6)
      expect(b.max.y).toBeLessThan(0.605); expect(b.min.z).toBeGreaterThan(-0.1685); expect(b.max.z).toBeLessThan(0.185)
      expect(Math.min(Math.abs(b.min.x), Math.abs(b.max.x))).toBeGreaterThan(0.011)
    }
  } finally { m.dispose() }
})

test('027 independent removal preserves sockets, attachments, material overrides and ownership', () => {
  const external = new MeshStandardMaterial(); let externalDisposals = 0; external.addEventListener('dispose', () => externalDisposals++)
  const m = createModel({ materials: { glazeMoss: external } }); const root = m.root; const bin = m.parts.leftBin
  const ownedMaterials = new Set(Object.values(m.materials).filter((material) => material !== external)); let materialDisposals = 0
  ownedMaterials.forEach((material) => material.addEventListener('dispose', () => materialDisposals++))
  const attachment = new Group(); bin.add(attachment)
  const old = new Set(meshes(root).map((o) => o.geometry)); let oldDisposals = 0
  old.forEach((g) => g.addEventListener('dispose', () => oldDisposals++))
  const textures = new Set<Texture>(); let textureDisposals = 0
  Object.values(m.materials).forEach((material) => { const s = material as MeshStandardMaterial; for (const t of [s.map, s.normalMap, s.roughnessMap]) if (t) textures.add(t) })
  textures.forEach((t) => t.addEventListener('dispose', () => textureDisposals++))
  m.configure({ leftBin: false }); expect(m.root).toBe(root); expect(m.parts.leftBin).toBe(bin); expect(attachment.parent).toBe(bin)
  expect(meshes(bin).length).toBe(0); expect(meshes(m.parts.rightBin).length).toBe(3); expect(oldDisposals).toBe(old.size)
  m.setMaterial('indigo', external); m.configure({ leftBin: true, rightBin: true })
  expect(meshes(bin).every((o) => o.material === external)).toBe(true); expect(meshes(m.parts.rightBin).every((o) => o.material === external)).toBe(true)
  const copy = m.getConfig() as { leftBin: boolean }; copy.leftBin = false; expect(m.getConfig().leftBin).toBe(true)
  const current = new Set(meshes(root).map((o) => o.geometry)); let currentDisposals = 0
  current.forEach((g) => g.addEventListener('dispose', () => currentDisposals++))
  m.dispose(); m.dispose(); m.configure({ rightBin: false })
  expect(currentDisposals).toBe(current.size); expect(textureDisposals).toBe(textures.size); expect(externalDisposals).toBe(0); external.dispose()
  expect(materialDisposals).toBe(ownedMaterials.size)
})
