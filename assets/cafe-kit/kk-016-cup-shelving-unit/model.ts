import { Group, LatheGeometry, Mesh, TorusGeometry, Vector2, type BufferGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'

const ID = 'kk-016-cup-shelving-unit'
type Slot = 'cedar' | 'cedarDark' | 'glaze' | 'glazeMoss' | 'glazeDeep'
export interface KkCupShelfConfig { tiers: number }
export interface KkCupShelfOptions extends Partial<KkCupShelfConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkCupShelfInstance {
  readonly root: Group
  readonly parts: { frame: Group; shelves: Group; dividers: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkCupShelfConfig>
  configure(patch: Partial<KkCupShelfConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}
const tiers = (n: number): number => Number.isFinite(n) ? Math.max(2, Math.min(4, Math.round(n))) : 4

/** Ordered section returns down the INSIDE to a closed floor; revolve() would sort this away. */
export function vesselGeometry(radius: number, height: number, bowl = false): BufferGeometry {
  const wall = 0.006
  const foot = radius * (bowl ? 0.47 : 0.69)
  const profile: [number, number][] = [
    [0, 0], [foot, 0], [foot + 0.004, 0.007],
    [radius * (bowl ? 0.68 : 0.86), height * 0.22],
    [radius * 0.98, height - 0.007], [radius, height - 0.003],
    [radius - wall / 2, height], [radius - wall, height - 0.003],
    [radius - wall - 0.002, height - 0.01],
    [foot - 0.003, 0.016], [0, 0.016],
  ]
  const geometry = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), 16)
  // Three's lathe emits zero-area triangles at axis poles; omit them for a clean closed mesh.
  const p = geometry.getAttribute('position'); const index = geometry.index!
  const indices: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i); const b = index.getX(i + 1); const c = index.getX(i + 2)
    const same = (u: number, v: number): boolean => p.getX(u) === p.getX(v) && p.getY(u) === p.getY(v) && p.getZ(u) === p.getZ(v)
    if (!same(a, b) && !same(b, c) && !same(c, a)) indices.push(a, b, c)
  }
  geometry.setIndex(indices)
  return geometry
}

export function createModel(options: KkCupShelfOptions = {}): KkCupShelfInstance {
  const config = { tiers: tiers(options.tiers ?? 4) }
  const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar', glaze: 'glaze', glazeMoss: 'glaze', glazeDeep: 'glaze' }, options.materials)
  const m = bundle.materials
  const root = new Group(); root.name = ID
  const parts = { frame: new Group(), shelves: new Group(), dividers: new Group() }
  const content = new Map<Group, Group>()
  Object.entries(parts).forEach(([key, anchor]) => {
    anchor.name = `${ID} / ${key}`; root.add(anchor)
    const generated = new Group(); anchor.add(generated); content.set(anchor, generated)
  })
  const geometries: BufferGeometry[] = []
  let disposed = false
  const emit = (group: Group, geometry: BufferGeometry, material: Material, position: [number, number, number], name: string): Mesh => {
    geometries.push(geometry)
    const mesh = new Mesh(geometry, material); mesh.position.set(...position); mesh.name = `${ID} / ${name}`
    mesh.castShadow = true; mesh.receiveShadow = true; content.get(group)!.add(mesh); return mesh
  }
  const box = (group: Group, material: Material, size: [number, number, number], position: [number, number, number], name: string): void => {
    const geometry = bevelBox(...size, Math.min(0.003, Math.min(...size) * 0.12))
    boardUVs(geometry, size); emit(group, geometry, material, position, name)
  }
  const rebuild = (): void => {
    for (const group of content.values()) group.clear()
    geometries.splice(0).forEach((geometry) => geometry.dispose())
    const step = 0.2675; const base = 0.13; const t = 0.025
    const edges = [-0.4775, -0.1592, 0.1592, 0.4775]
    const heights = [config.tiers, config.tiers - 1, Math.max(1, config.tiers - 2)]
    box(parts.frame, m.cedar, [1, 0.045, 0.25], [0, base - 0.0225, 0], 'continuous base board')
    for (const x of [-0.43, 0.43]) for (const z of [-0.083, 0.083]) box(parts.frame, m.cedarDark, [0.055, 0.085, 0.060], [x, 0.0425, z], 'short foot')
    // Single shared side/divider walls: no doubled coplanar box faces at column joins.
    for (let boundary = 0; boundary < 4; boundary++) {
      const rows = boundary === 0 ? heights[0]! : heights[boundary - 1]!
      const h = rows * step
      box(parts.dividers, m.cedar, [t, h - t, 0.235], [edges[boundary]!, base + (h - t) / 2, 0.003], 'continuous joined side wall')
    }
    for (let col = 0; col < 3; col++) {
      const left = edges[col]! + t / 2; const right = edges[col + 1]! - t / 2
      const x = (left + right) / 2; const width = right - left
      const rows = heights[col]!
      box(parts.dividers, m.cedarDark, [width, rows * step - t, 0.017], [x, base + (rows * step - t) / 2, -0.106], `closed column back ${col}`)
      for (let row = 1; row <= rows; row++) {
        // Roof spans side wall end grain; intermediate shelves fit BETWEEN continuous walls.
        const roof = row === rows
        box(parts.shelves, m.cedar, [width + (roof ? t * 2 : 0), t, 0.24], [x, base + row * step - t / 2, 0.002], `${roof ? 'closed crate roof' : 'fitted shelf'} ${col}/${row}`)
      }
      const floor = (row: number): number => base + row * step
      const vessel = (offset: number, row: number, radius: number, height: number, material: Material, name: string, bowl = false, lift = 0): void => {
        if (row >= rows) return
        emit(parts.shelves, vesselGeometry(radius, height, bowl), material, [x + offset, floor(row) + lift, 0.020], name)
      }
      if (col === 0) {
        vessel(0, 0, 0.073, 0.155, m.glazeMoss, 'open moss vessel')
        for (let i = 0; i < 3; i++) vessel(0, 1, 0.086, 0.047, i === 0 ? m.glazeMoss : m.glaze, 'stacked hollow bowl', true, i * 0.031)
        vessel(-0.048, 2, 0.052, 0.13, m.glaze, 'ivory tea cup')
        vessel(0.073, 2, 0.043, 0.10, m.glazeDeep, 'indigo tea cup')
        vessel(0, 3, 0.064, 0.174, m.glazeMoss, 'tall open vessel')
      } else if (col === 1) {
        for (let i = 0; i < 2; i++) vessel(0, 0, 0.09, 0.075, i ? m.glaze : m.glazeDeep, 'nested hollow bowl', true, i * 0.041)
        for (let row = 1; row < rows; row++) {
          vessel(-0.025, row, 0.061, 0.14, m.glaze, 'handled ivory cup')
          // Full torus is closed; rear segment is buried in the cup wall, not left uncapped.
          const handle = new TorusGeometry(0.041, 0.008, 6, 16)
          handle.scale(0.88, 1, 1)
          emit(parts.shelves, handle, m.glaze, [x + 0.041, floor(row) + 0.082, 0.020], 'closed cup handle')
        }
      } else {
        vessel(0, 0, 0.070, 0.10, m.glazeMoss, 'low moss bowl', true)
        vessel(0, 1, 0.061, 0.13, m.glazeDeep, 'deep glaze cup')
      }
    }
  }
  rebuild()
  return {
    root, parts, materials: m, getConfig: () => ({ ...config }),
    configure(patch) { if (disposed) return; if (patch.tiers !== undefined) config.tiers = tiers(patch.tiers); rebuild() },
    setMaterial(slot, material) { if (disposed) return; m[slot] = material; rebuild() },
    update(_deltaSeconds) {},
    dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((geometry) => geometry.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) {
  return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch })
}
export function createCafePreview(options: { aspect: number; time?: number }) {
  return createKkPreview(createModel(), { aspect: options.aspect, framing: 'cafe' })
}
