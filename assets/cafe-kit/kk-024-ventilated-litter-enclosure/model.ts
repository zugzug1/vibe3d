// 0.70 W × 0.50 D × 0.50 H m, bottom-centre origin, front +Z.
// The reference's plant and folded cloth are loose roster dressing and omitted.
// The offset opening, open side/front slats, sliding service leaf and removable open tray are functional geometry.
import { Group, Mesh, Shape, Path, ExtrudeGeometry, type BufferGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'

const ID = 'kk-024-ventilated-litter-enclosure'
type Slot = 'cedar' | 'cedarDark' | 'glazeMoss' | 'tatami' | 'ink'
export interface KkLitterConfig { entranceLeft: boolean; serviceOpen: number; trayExtension: number }
export interface KkLitterOptions extends Partial<KkLitterConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkLitterInstance {
  readonly root: Group
  readonly parts: { carcass: Group; entrance: Group; serviceDoor: Group; tray: Group; hardware: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkLitterConfig>
  configure(patch: Partial<KkLitterConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}
function configuration(patch: Partial<KkLitterConfig>, base: KkLitterConfig = { entranceLeft: false, serviceOpen: 0, trayExtension: 0 }): KkLitterConfig {
  const entranceLeft = patch.entranceLeft === undefined ? base.entranceLeft : patch.entranceLeft
  if (typeof entranceLeft !== 'boolean') throw new TypeError('entranceLeft must be boolean')
  const unit = (value: number, name: string): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite`); return Math.max(0, Math.min(1, value)) }
  const serviceOpen = unit(patch.serviceOpen === undefined ? base.serviceOpen : patch.serviceOpen, 'serviceOpen')
  const trayExtension = unit(patch.trayExtension === undefined ? base.trayExtension : patch.trayExtension, 'trayExtension')
  // The tray exits through the cabinet's open rear maintenance bay; it never passes through the small cat entrance.
  return { entranceLeft, serviceOpen, trayExtension }
}
function perforatedBoard(width: number, height: number, rx: number, ry: number): BufferGeometry {
  const shape = new Shape(); shape.moveTo(-width / 2, -height / 2); shape.lineTo(width / 2, -height / 2)
  shape.lineTo(width / 2, height / 2); shape.lineTo(-width / 2, height / 2); shape.closePath()
  const hole = new Path(); hole.absellipse(0, 0, rx, ry, 0, Math.PI * 2, true, 0); shape.holes.push(hole)
  const geometry = new ExtrudeGeometry(shape, { depth: 0.020, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 1, curveSegments: 16, steps: 1 })
  geometry.translate(0, 0, -0.010); boardUVs(geometry, [width, height, 0.023]); return geometry
}
export function createModel(options: KkLitterOptions = {}): KkLitterInstance {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<'cedar' | 'cedarDark' | 'glazeMoss' | 'tatami'>({ cedar: 'cedar', cedarDark: 'cedar', glazeMoss: 'glaze', tatami: 'paper' }, options.materials)
  const materials = { ...bundle.materials, ink: options.materials?.ink ?? (bundle.materials as unknown as Record<Slot, Material>).ink }
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { carcass: new Group(), entrance: new Group(), serviceDoor: new Group(), tray: new Group(), hardware: new Group() }
  const content = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) {
    anchor.name = `${ID} / ${name}`; root.add(anchor); const generated = new Group(); generated.name = `${anchor.name} / generated`; anchor.add(generated); content.set(anchor, generated)
  }
  root.add(socket('anchor-litter-enclosure', [0, 0, 0]))
  const entry = socket('cat-entry', [0.15, 0.132, 0.24]); root.add(entry)
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (part: Group, geometry: BufferGeometry, slot: Slot, position: [number, number, number], name: string): void => {
    geometries.push(geometry); const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.position.set(...position)
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.materialSlot = slot; content.get(part)!.add(mesh)
  }
  const box = (part: Group, slot: Slot, size: [number, number, number], position: [number, number, number], name: string): void => {
    const geometry = bevelBox(...size, Math.min(0.0025, Math.min(...size) * 0.15)); boardUVs(geometry, size); emit(part, geometry, slot, position, name)
  }
  const rebuild = (): void => {
    content.forEach(group => group.clear()); geometries.splice(0).forEach(geometry => geometry.dispose())
    const side = config.entranceLeft ? -1 : 1
    parts.serviceDoor.position.x = side * config.serviceOpen * 0.296
    parts.tray.position.z = -config.trayExtension * 0.40
    entry.position.x = side * 0.15
    box(parts.carcass, 'cedar', [0.7, 0.03, 0.5], [0, 0.485, 0], 'overhanging solid top')
    box(parts.carcass, 'cedarDark', [0.63, 0.028, 0.42], [0, 0.08, 0], 'cabinet floor')
    for (const x of [-0.315, 0.315]) for (const z of [-0.215, 0.215]) {
      box(parts.carcass, 'cedar', [0.05, 0.075, 0.05], [x, 0.0375, z], 'short square foot')
      box(parts.carcass, 'cedar', [0.045, 0.405, 0.045], [x, 0.2675, z], 'corner stile')
    }
    for (const x of [-0.317, 0.317]) {
      for (const y of [0.118, 0.443]) box(parts.carcass, 'cedar', [0.04, 0.047, 0.397], [x, y, 0], 'side cross rail')
      for (let i = 0; i < 11; i++) box(parts.carcass, 'cedar', [0.025, 0.296, 0.017], [x, 0.28, -0.175 + i * 0.035], 'open side ventilation slat')
    }
    for (const y of [0.115, 0.448]) box(parts.carcass, 'cedar', [0.59, 0.045, 0.029], [0, y, 0.216], 'front cross rail')
    // Rear boards stop above the tray rim, making a continuous withdrawal slot accessible from behind.
    for (let i = 0; i < 5; i++) box(parts.carcass, 'cedarDark', [0.118, 0.282, 0.018], [-0.24 + i * 0.12, 0.323, -0.22], 'rear vertical board')
    box(parts.carcass, 'cedarDark', [0.60, 0.025, 0.023], [0, 0.184, -0.22], 'rear maintenance header')
    emit(parts.entrance, perforatedBoard(0.302, 0.339, 0.118, 0.14), 'cedar', [side * 0.151, 0.2815, 0.230], 'round cat doorway panel')
    const cx = -side * 0.1575
    for (const offset of [-0.137, 0.137]) {
      const x = cx + side * offset
      if (offset > 0) {
        emit(parts.serviceDoor, perforatedBoard(0.023, 0.309, 0.0045, 0.021), 'cedar', [x, 0.282, 0.207], 'pocket-cut sliding stile')
        box(parts.serviceDoor, 'ink', [0.013, 0.049, 0.002], [x, 0.282, 0.207], 'recessed finger pull bottom')
      } else box(parts.serviceDoor, 'cedar', [0.023, 0.309, 0.023], [x, 0.282, 0.207], 'sliding outer stile')
    }
    for (const y of [0.133, 0.432]) box(parts.serviceDoor, 'cedar', [0.255, 0.033, 0.023], [cx, y, 0.207], 'sliding cross rail')
    for (let i = 0; i < 9; i++) box(parts.serviceDoor, 'cedar', [0.013, 0.278, 0.014], [cx - 0.112 + i * 0.028, 0.282, 0.207], 'open front ventilation slat')
    for (const y of [0.111, 0.452]) box(parts.hardware, 'cedarDark', [0.604, 0.009, 0.017], [0, y, 0.203], 'recessed sliding guide')
    // A closed-bottom, open-top removable pan: four rounded walls lap its floor.
    box(parts.tray, 'glazeMoss', [0.554, 0.008, 0.348], [0, 0.098, -0.008], 'tray floor')
    for (const x of [-0.273, 0.273]) box(parts.tray, 'glazeMoss', [0.012, 0.064, 0.348], [x, 0.126, -0.008], 'tray side wall')
    for (const z of [-0.176, 0.16]) box(parts.tray, 'glazeMoss', [0.548, 0.064, 0.012], [0, 0.126, z], 'tray end wall')
    box(parts.tray, 'tatami', [0.531, 0.007, 0.317], [0, 0.105, -0.008], 'contained litter bed')
  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }),
    configure(patch) { if (disposed) return; const next = configuration(patch, config); Object.assign(config, next); rebuild() },
    setMaterial(slot, material) { if (disposed) return; materials[slot] = material; root.traverse(o => { if (o instanceof Mesh && o.userData.materialSlot === slot) o.material = material }) },
    update() {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach(geometry => geometry.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
