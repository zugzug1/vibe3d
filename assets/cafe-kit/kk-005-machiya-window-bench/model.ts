import { Group, Mesh, SphereGeometry, TubeGeometry, CatmullRomCurve3, Vector3, type BufferGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'

const ID = 'kk-005-machiya-window-bench'
type Slot = 'cedar' | 'cedarDark' | 'indigo' | 'indigoFaded' | 'washi'
export interface KkWindowBenchConfig { cushionCount: number }
export interface KkWindowBenchOptions extends Partial<KkWindowBenchConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkWindowBenchInstance {
  readonly root: Group
  readonly parts: { frame: Group; shoji: Group; seat: Group; cubbies: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkWindowBenchConfig>
  configure(patch: Partial<KkWindowBenchConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}
const cushionCount = (n: number): number => Number.isFinite(n) ? Math.max(2, Math.min(4, Math.round(n))) : 3
const signedPower = (n: number, exponent: number): number => Math.abs(n) < 1e-7 ? 0 : Math.sign(n) * Math.pow(Math.abs(n), exponent)

/** Closed stuffed-cloth shell: broad soft faces, pinched corners, no hard bevel-box edge. */
function cloth(width: number, height: number, depth: number): BufferGeometry {
  const geo = new SphereGeometry(1, 24, 16)
  const p = geo.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = signedPower(p.getX(i), 0.28); const z = signedPower(p.getZ(i), 0.28)
    const y = signedPower(p.getY(i), 0.65)
    const wrinkle = 1 - 0.022 * Math.sin(x * 17 + z * 5) ** 2 * Math.abs(x * z)
    p.setXYZ(i, x * width / 2, y * height / 2 * wrinkle, z * depth / 2)
  }
  geo.computeVertexNormals()
  // Face-local cloth coordinates avoid the sphere's visible polar weave convergence.
  boardUVs(geo, [width, height, depth])
  return geo
}

export function createModel(options: KkWindowBenchOptions = {}): KkWindowBenchInstance {
  const config = { cushionCount: cushionCount(options.cushionCount ?? 3) }
  const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar', indigo: 'fabric', indigoFaded: 'fabric', washi: 'paper' }, options.materials)
  const m = bundle.materials
  const root = new Group(); root.name = ID
  const parts = { frame: new Group(), shoji: new Group(), seat: new Group(), cubbies: new Group() }
  const content = new Map<Group, Group>()
  Object.entries(parts).forEach(([key, anchor]) => {
    anchor.name = `${ID} / ${key}`; root.add(anchor)
    const generated = new Group(); anchor.add(generated); content.set(anchor, generated)
  })
  const geometries: BufferGeometry[] = []
  let disposed = false
  const emit = (group: Group, geometry: BufferGeometry, material: Material, position: [number, number, number], name: string): Mesh => {
    geometries.push(geometry)
    const mesh = new Mesh(geometry, material); mesh.name = `${ID} / ${name}`
    mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true
    content.get(group)!.add(mesh); return mesh
  }
  const box = (group: Group, material: Material, size: [number, number, number], position: [number, number, number], name: string): Mesh => {
    const geometry = bevelBox(...size, Math.min(0.004, Math.min(...size) * 0.16))
    boardUVs(geometry, size)
    return emit(group, geometry, material, position, name)
  }
  const rebuild = (): void => {
    for (const group of content.values()) group.clear()
    geometries.splice(0).forEach((geometry) => geometry.dispose())
    // Original 1.60 x 0.55 x 0.85 m target. Keep upholstery thickness and
    // 0.479 m seat top; shorten the storage and shoji instead of scaling the model.
    for (const x of [-0.755, 0.755]) {
      box(parts.frame, m.cedarDark, [0.09, 0.77, 0.09], [x, 0.385, -0.23], 'rear structural post')
      box(parts.frame, m.cedar, [0.09, 0.77, 0.09], [x, 0.385, 0.23], 'front structural post')
      box(parts.frame, m.cedar, [0.09, 0.10, 0.55], [x, 0.80, 0], 'side crown rail')
      box(parts.frame, m.cedarDark, [0.065, 0.285, 0.39], [x, 0.2075, 0], 'closed lower side panel')
      box(parts.frame, m.cedar, [0.075, 0.045, 0.43], [x, 0.485, 0], 'side sill')
    }
    box(parts.frame, m.cedar, [1.42, 0.10, 0.10], [0, 0.80, -0.225], 'rear crown beam')
    box(parts.frame, m.cedar, [1.42, 0.045, 0.075], [0, 0.485, -0.235], 'shoji sill')
    box(parts.frame, m.cedarDark, [1.43, 0.07, 0.09], [0, 0.421, -0.23], 'continuous back apron')
    box(parts.frame, m.cedar, [1.42, 0.048, 0.47], [0, 0.36, 0.005], 'seat deck')
    box(parts.frame, m.cedarDark, [1.42, 0.05, 0.045], [0, 0.313, 0.235], 'front seat apron')
    box(parts.frame, m.cedar, [1.42, 0.05, 0.47], [0, 0.09, 0], 'continuous cabinet floor')
    box(parts.frame, m.cedarDark, [1.42, 0.23, 0.024], [0, 0.225, -0.235], 'cabinet back')
    box(parts.shoji, m.washi, [1.40, 0.2425, 0.012], [0, 0.62875, -0.243], 'rear paper')
    box(parts.shoji, m.cedar, [0.05, 0.2525, 0.042], [0, 0.62875, -0.209], 'center mullion')
    // Visible lattice is forward (+Z) of opaque paper. Crossbars have separate depth layers.
    for (const x of [-0.60, -0.49, -0.38, -0.27, -0.16, 0.16, 0.27, 0.38, 0.49, 0.60]) box(parts.shoji, m.cedarDark, [0.011, 0.2425, 0.016], [x, 0.62875, -0.222], 'front vertical lattice')
    for (const y of [0.59, 0.67]) box(parts.shoji, m.cedarDark, [1.40, 0.013, 0.015], [0, y, -0.208], 'front cross lattice')
    for (const side of [-1, 1]) {
      box(parts.shoji, m.washi, [0.012, 0.2425, 0.37], [side * 0.767, 0.62875, 0], 'side paper')
      for (const z of [-0.135, -0.045, 0.045, 0.135]) box(parts.shoji, m.cedarDark, [0.018, 0.2425, 0.011], [side * 0.75, 0.62875, z], 'inside side lattice')
      for (const y of [0.59, 0.67]) box(parts.shoji, m.cedarDark, [0.014, 0.013, 0.37], [side * 0.735, y, 0], 'inside side crossbar')
      // Both sides of the return are visible; the outside needs its own lattice over the paper.
      for (const z of [-0.135, -0.045, 0.045, 0.135]) box(parts.shoji, m.cedarDark, [0.012, 0.2425, 0.011], [side * 0.782, 0.62875, z], 'outside side lattice')
      for (const y of [0.59, 0.67]) box(parts.shoji, m.cedarDark, [0.010, 0.013, 0.37], [side * 0.795, y, 0], 'outside side crossbar')
    }
    for (const x of [-0.285, 0, 0.285]) box(parts.cubbies, m.cedarDark, [0.04, 0.225, 0.43], [x, 0.225, -0.005], 'fitted bay divider')
    for (const x of [-0.5025, 0.5025]) {
      box(parts.cubbies, m.cedarDark, [0.38, 0.185, 0.35], [x, 0.218, -0.025], 'drawer body')
      box(parts.cubbies, m.cedar, [0.387, 0.208, 0.030], [x, 0.224, 0.213], 'fitted drawer face')
      box(parts.cubbies, m.cedarDark, [0.105, 0.023, 0.025], [x, 0.255, 0.237], 'drawer handle')
    }
    const width = (1.40 - (config.cushionCount - 1) * 0.012) / config.cushionCount
    const cushion = (w: number, h: number, d: number, position: [number, number, number], material: Material, name: string, tilt = 0): void => {
      const mesh = emit(parts.seat, cloth(w, h, d), material, position, name); mesh.rotation.x = tilt
      const points = Array.from({ length: 40 }, (_, i) => {
        const a = i / 40 * Math.PI * 2
        return new Vector3(signedPower(Math.cos(a), 0.28) * w / 2, 0, signedPower(Math.sin(a), 0.28) * d / 2)
      })
      const seam = emit(parts.seat, new TubeGeometry(new CatmullRomCurve3(points, true), 40, 0.0017, 4, true), material, position, `${name} sewn edge`)
      seam.rotation.x = tilt
    }
    for (let i = 0; i < config.cushionCount; i++) cushion(width, 0.095, 0.43, [-0.70 + width / 2 + i * (width + 0.012), 0.4315, 0.015], m.indigo, 'stuffed seat cushion')
    for (const side of [-1, 1]) cushion(0.27, 0.10, 0.29, [side * 0.545, 0.606, -0.115], m.indigoFaded, 'soft back pillow', 1.34)
  }
  rebuild()
  return {
    root, parts, materials: m, getConfig: () => ({ ...config }),
    configure(patch) { if (disposed) return; if (patch.cushionCount !== undefined) config.cushionCount = cushionCount(patch.cushionCount); rebuild() },
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
