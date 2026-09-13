// 1.20 x 0.50 x 1.10 m; bottom-centre, Y-up, front +Z.
import { Group, Mesh, PlaneGeometry, SphereGeometry, DoubleSide, type BufferGeometry, type Material, type MeshStandardMaterial } from 'three/webgpu'
import { bevelBox, createKkPreview, socket, type KkMaterials } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'

const ID = 'kk-003-wagashi-display-cabinet'
type Slot = 'cedar' | 'cedarDark' | 'trayCharcoal' | 'glass' | 'washi' | 'ceramic' | 'moss' | 'vermilion'
export interface KkCabinetConfig { doors: boolean; trays: boolean }
export interface KkCabinetOptions extends Partial<KkCabinetConfig> { materials?: Partial<Record<Slot, MeshStandardMaterial>> }
export interface KkCabinetInstance {
  readonly root: Group
  readonly parts: { carcass: Group; doors: Group; trays: Group; dressing: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkCabinetConfig>
  configure(patch: Partial<KkCabinetConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

export function createModel(options: KkCabinetOptions = {}): KkCabinetInstance {
  const config = { doors: options.doors ?? true, trays: options.trays ?? true }
  const bundle = acquireSurfaceMaterials({ cedar: 'cedar', cedarDark: 'cedar', washi: 'paper', glaze: 'glaze', glazeMoss: 'glaze' }, Object.fromEntries(Object.entries({
    cedar: options.materials?.cedar, cedarDark: options.materials?.cedarDark, washi: options.materials?.washi,
    glaze: options.materials?.ceramic, glazeMoss: options.materials?.moss,
  }).filter(([, material]) => material !== undefined)))
  // The helper acquires the complete kit bundle; only the selected surfaces receive detail.
  const kit = bundle.materials as Record<keyof KkMaterials, Material>
  const materials: Record<Slot, Material> = {
    cedar: kit.cedar, cedarDark: kit.cedarDark, washi: kit.washi, ceramic: kit.glaze, moss: kit.glazeMoss,
    trayCharcoal: options.materials?.trayCharcoal ?? kit.ink, glass: options.materials?.glass ?? kit.glass,
    vermilion: options.materials?.vermilion ?? kit.vermilion,
  }
  if (!options.materials?.glass) { const glass = materials.glass as MeshStandardMaterial; glass.opacity = 0.12; glass.side = DoubleSide }
  if (!options.materials?.ceramic) (materials.ceramic as MeshStandardMaterial).roughness = 0.82
  if (!options.materials?.moss) (materials.moss as MeshStandardMaterial).roughness = 0.85
  const root = new Group(); root.name = ID
  const parts = { carcass: new Group(), doors: new Group(), trays: new Group(), dressing: new Group() }
  const content = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) {
    anchor.name = `${ID} / ${name}`; root.add(anchor)
    const group = new Group(); anchor.add(group); content.set(anchor, group)
  }
  root.add(socket('anchor-cabinet', [0, 0, 0]))
  const geometries: BufferGeometry[] = []
  let disposed = false
  const emit = (group: Group, geometry: BufferGeometry, slot: Slot, pos: [number, number, number], name: string): Mesh => {
    geometries.push(geometry)
    const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.position.set(...pos)
    mesh.castShadow = slot !== 'glass'; mesh.receiveShadow = slot !== 'glass'
    mesh.userData.materialSlot = slot
    if (slot === 'glass') mesh.renderOrder = 2
    content.get(group)!.add(mesh); return mesh
  }
  const box = (group: Group, slot: Slot, size: [number, number, number], pos: [number, number, number], name: string): void => {
    const geometry = bevelBox(...size, Math.min(0.0035, Math.min(...size) * 0.15)); boardUVs(geometry, size)
    emit(group, geometry, slot, pos, name)
  }
  const rebuild = (): void => {
    content.forEach((g) => g.clear()); geometries.splice(0).forEach((g) => g.dispose())
    box(parts.carcass, 'cedar', [1.20, 0.045, 0.50], [0, 1.0775, 0], 'continuous crown')
    box(parts.carcass, 'cedar', [1.15, 0.055, 0.46], [0, 0.1075, 0], 'bottom plinth')
    for (const x of [-0.55, 0.55]) for (const z of [-0.205, 0.205]) {
      box(parts.carcass, 'cedar', [0.065, 0.08, 0.065], [x, 0.04, z], 'short foot')
      box(parts.carcass, 'cedar', [0.055, 0.92, 0.055], [x, 0.595, z], 'continuous corner post')
    }
    box(parts.carcass, 'cedarDark', [1.045, 0.92, 0.020], [0, 0.595, -0.222], 'closed cedar back')
    for (const x of [-0.55, 0.55]) {
      box(parts.carcass, 'cedar', [0.055, 0.15, 0.36], [x, 0.21, 0], 'lower side panel')
      box(parts.carcass, 'cedar', [0.052, 0.035, 0.36], [x, 1.035, 0], 'side glazing rail')
      const pane = emit(parts.carcass, new PlaneGeometry(0.355, 0.73), 'glass', [x, 0.65, 0], 'single side glass pane')
      pane.rotation.y = Math.PI / 2
    }
    for (const y of [0.32, 0.56, 0.80]) box(parts.carcass, 'cedar', [1.045, 0.026, 0.385], [0, y - 0.013, -0.01], 'seated display shelf')
    // Three full-width shelf tiers carry three trays each; everything is seated from shelf top.
    if (config.trays) for (const [tier, y] of [0.32, 0.56, 0.80].entries()) for (const [col, x] of [-0.352, 0, 0.352].entries()) {
      box(parts.trays, 'trayCharcoal', [0.323, 0.012, 0.325], [x, y + 0.006, 0], 'tray floor')
      for (const z of [-0.157, 0.157]) box(parts.trays, 'trayCharcoal', [0.323, 0.018, 0.012], [x, y + 0.021, z], 'tray lip')
      for (const side of [-1, 1]) box(parts.trays, 'trayCharcoal', [0.012, 0.018, 0.301], [x + side * 0.1555, y + 0.021, 0], 'tray side')
      for (const dx of [-0.073, 0.073]) for (const z of [-0.073, 0.073]) {
        const kind = (tier + col) % 3
        const slot: Slot = kind === 0 ? 'moss' : kind === 1 ? 'ceramic' : 'vermilion'
        if (tier === 1 && col === 1) {
          box(parts.dressing, 'vermilion', [0.076, 0.061, 0.073], [x + dx, y + 0.0425, z], 'cut yokan sweet')
        } else {
          const sweet = new SphereGeometry(1, 16, 10); const p = sweet.getAttribute('position')
          for (let i = 0; i < p.count; i++) {
            const px = p.getX(i); const py = p.getY(i); const pz = p.getZ(i)
            const angle = Math.atan2(pz, px)
            const lobes = kind === 2 ? 1 + 0.23 * Math.cos(angle * 5) * (1 - py * py) : 1
            const crease = kind === 2 && py > 0 ? 0.007 * Math.sin(angle * 2.5) ** 2 * (1 - py * py) : 0
            p.setXYZ(i, px * 0.052 * lobes, py * 0.040 - crease, pz * 0.052 * lobes)
          }
          sweet.computeVertexNormals(); boardUVs(sweet, [0.104, 0.08, 0.104])
          emit(parts.dressing, sweet, slot, [x + dx, y + 0.052, z], 'rounded wagashi')
        }
        const accent = new SphereGeometry(1, 8, 4); accent.scale(0.010, 0.005, 0.010)
        emit(parts.dressing, accent, kind === 1 ? 'vermilion' : 'ceramic', [x + dx, y + (tier === 1 && col === 1 ? 0.077 : 0.093), z], 'sweet flower centre')
      }
    }
    if (config.doors) for (const [i, x] of [-0.262, 0.262].entries()) {
      const z = i === 0 ? 0.216 : 0.236
      for (const sx of [-1, 1]) box(parts.doors, 'cedar', [0.028, 0.886, 0.022], [x + sx * 0.247, 0.595, z], 'door stile')
      for (const y of [0.153, 0.294, 1.037]) box(parts.doors, 'cedar', [0.468, 0.028, 0.022], [x, y, z], 'door rail')
      box(parts.doors, 'washi', [0.465, 0.113, 0.009], [x, 0.2235, z - 0.006], 'lower washi inset')
      emit(parts.doors, new PlaneGeometry(0.465, 0.714), 'glass', [x, 0.665, z - 0.006], 'single door glass pane')
      box(parts.doors, 'trayCharcoal', [0.011, 0.065, 0.004], [x + (i === 0 ? -0.247 : 0.247), 0.52, z + 0.011], 'slim door pull')
    }
  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }),
    configure(patch) { if (disposed) return; if (patch.doors !== undefined) config.doors = Boolean(patch.doors); if (patch.trays !== undefined) config.trays = Boolean(patch.trays); rebuild() },
    setMaterial(slot, material) { if (disposed) return; materials[slot] = material; root.traverse((o) => { if (o instanceof Mesh && o.userData.materialSlot === slot) o.material = material }) },
    update() {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((g) => g.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
