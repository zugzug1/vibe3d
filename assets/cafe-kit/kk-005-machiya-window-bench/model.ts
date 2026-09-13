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
    // 1.60 x 0.55 x 1.42 m. Side returns and rear screen seat into the same frame.
    for (const x of [-0.755, 0.755]) {
      box(parts.frame, m.cedarDark, [0.09, 1.34, 0.09], [x, 0.67, -0.23], 'rear structural post')
      box(parts.frame, m.cedar, [0.09, 1.34, 0.09], [x, 0.67, 0.23], 'front structural post')
      box(parts.frame, m.cedar, [0.10, 0.10, 0.55], [x, 1.37, 0], 'side crown rail')
      box(parts.frame, m.cedarDark, [0.065, 0.49, 0.39], [x, 0.335, 0], 'closed lower side panel')
      box(parts.frame, m.cedar, [0.075, 0.065, 0.43], [x, 0.655, 0], 'side sill')
    }
    box(parts.frame, m.cedar, [1.42, 0.12, 0.10], [0, 1.36, -0.23], 'rear crown beam')
    box(parts.frame, m.cedar, [1.42, 0.10, 0.075], [0, 0.71, -0.235], 'shoji sill')
    box(parts.frame, m.cedarDark, [1.43, 0.09, 0.09], [0, 0.625, -0.23], 'continuous back apron')
    box(parts.frame, m.cedar, [1.42, 0.048, 0.47], [0, 0.574, 0.005], 'seat deck')
    box(parts.frame, m.cedarDark, [1.42, 0.07, 0.045], [0, 0.529, 0.235], 'front seat apron')
    box(parts.frame, m.cedar, [1.42, 0.065, 0.47], [0, 0.1125, 0], 'continuous cabinet floor')
    box(parts.frame, m.cedarDark, [1.42, 0.37, 0.024], [0, 0.33, -0.235], 'cabinet back')
    box(parts.shoji, m.washi, [1.40, 0.54, 0.012], [0, 1.03, -0.243], 'rear paper')
    box(parts.shoji, m.cedar, [0.05, 0.555, 0.042], [0, 1.035, -0.209], 'center mullion')
    // Visible lattice is forward (+Z) of opaque paper. Crossbars have separate depth layers.
    for (const x of [-0.60, -0.49, -0.38, -0.27, -0.16, 0.16, 0.27, 0.38, 0.49, 0.60]) box(parts.shoji, m.cedarDark, [0.011, 0.54, 0.016], [x, 1.03, -0.222], 'front vertical lattice')
    for (const y of [0.91, 1.13]) box(parts.shoji, m.cedarDark, [1.40, 0.013, 0.015], [0, y, -0.208], 'front cross lattice')
    for (const side of [-1, 1]) {
      box(parts.shoji, m.washi, [0.012, 0.60, 0.37], [side * 0.773, 0.995, 0], 'side paper')
      for (const z of [-0.135, -0.045, 0.045, 0.135]) box(parts.shoji, m.cedarDark, [0.018, 0.60, 0.011], [side * 0.75, 0.995, z], 'inside side lattice')
      for (const y of [0.88, 1.09]) box(parts.shoji, m.cedarDark, [0.014, 0.013, 0.37], [side * 0.735, y, 0], 'inside side crossbar')
      // Both sides of the return are visible; the outside needs its own lattice over the paper.
      for (const z of [-0.135, -0.045, 0.045, 0.135]) box(parts.shoji, m.cedarDark, [0.012, 0.60, 0.011], [side * 0.790, 0.995, z], 'outside side lattice')
      for (const y of [0.88, 1.09]) box(parts.shoji, m.cedarDark, [0.010, 0.013, 0.37], [side * 0.800, y, 0], 'outside side crossbar')
    }
    for (const x of [-0.285, 0, 0.285]) box(parts.cubbies, m.cedarDark, [0.04, 0.40, 0.43], [x, 0.347, -0.005], 'fitted bay divider')
    for (const x of [-0.5025, 0.5025]) {
      box(parts.cubbies, m.cedarDark, [0.38, 0.32, 0.35], [x, 0.325, -0.025], 'drawer body')
      box(parts.cubbies, m.cedar, [0.387, 0.355, 0.030], [x, 0.3325, 0.213], 'fitted drawer face')
      box(parts.cubbies, m.cedarDark, [0.105, 0.023, 0.025], [x, 0.405, 0.237], 'drawer handle')
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
    for (let i = 0; i < config.cushionCount; i++) cushion(width, 0.095, 0.43, [-0.70 + width / 2 + i * (width + 0.012), 0.6455, 0.015], m.indigo, 'stuffed seat cushion')
    for (const side of [-1, 1]) cushion(0.27, 0.10, 0.29, [side * 0.545, 0.82, -0.115], m.indigoFaded, 'soft back pillow', 1.34)
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
