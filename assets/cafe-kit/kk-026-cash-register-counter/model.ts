// 0.60 W × 0.50 D × 1.05 H m; bottom-centre, Y-up, customer/front +Z.
// The counter is open storage, not a solid plinth. Loose books and the reference's ceramic cat are separate roster props.
import { Group, Mesh, Shape, ExtrudeGeometry, CylinderGeometry, Vector3, type BufferGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, member, socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID = 'kk-026-cash-register-counter'
type Slot = 'cedar' | 'cedarDark' | 'glazeMoss' | 'glaze' | 'ink' | 'brass' | 'vermilion'
export interface KkRegisterConfig { counterHeight: number; drawerOpen: number }
export interface KkRegisterOptions extends Partial<KkRegisterConfig> { materials?: Partial<Record<Slot, Material>> }
export const structureControls = {
  counterHeight: { min: 0.60, max: 0.78, default: 0.68, step: 0.01, label: 'Counter height (m)' },
  drawerOpen: { min: 0, max: 1, default: 0, step: 0.05, label: 'Cash drawer extension' },
} as const
function configuration(patch: Partial<KkRegisterConfig>, base: KkRegisterConfig = { counterHeight: 0.68, drawerOpen: 0 }): KkRegisterConfig {
  const next = { ...base }
  for (const key of ['counterHeight', 'drawerOpen'] as const) {
    const value = patch[key] === undefined ? base[key] : patch[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${key} must be finite`)
    next[key] = Math.max(structureControls[key].min, Math.min(structureControls[key].max, value))
  }
  return next
}
/** Extruded enamel housing with a true sloped keyboard deck and raised rear shoulder. */
function housing(): BufferGeometry {
  const shape = new Shape(); shape.moveTo(-0.165, 0.053); shape.lineTo(0.175, 0.053)
  shape.lineTo(0.175, 0.075); shape.lineTo(0.160, 0.085); shape.lineTo(-0.100, 0.255)
  shape.quadraticCurveTo(-0.130, 0.280, -0.156, 0.270); shape.lineTo(-0.165, 0.25); shape.closePath()
  const geo = new ExtrudeGeometry(shape, { depth: 0.388, steps: 1, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1, curveSegments: 6 })
  geo.translate(0, 0, -0.194); geo.rotateY(-Math.PI / 2); boardUVs(geo, [0.394, 0.23, 0.346]); return geo
}
/** Rounded display shoulders are cast casing, not square timber-like corners. */
function displayHood(): BufferGeometry {
  const shape = new Shape(); shape.moveTo(-0.173, -0.053); shape.lineTo(0.173, -0.053)
  shape.lineTo(0.173, 0.028); shape.quadraticCurveTo(0.173, 0.053, 0.148, 0.053)
  shape.lineTo(-0.148, 0.053); shape.quadraticCurveTo(-0.173, 0.053, -0.173, 0.028); shape.closePath()
  const geo = new ExtrudeGeometry(shape, { depth: 0.083, steps: 1, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, curveSegments: 6 })
  geo.translate(0, 0, -0.0415); return geo
}
export function createModel(options: KkRegisterOptions = {}) {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<'cedar' | 'cedarDark' | 'glazeMoss' | 'glaze'>({ cedar: 'cedar', cedarDark: 'cedar', glazeMoss: 'glaze', glaze: 'glaze' }, options.materials)
  const materials = { ...bundle.materials, ...options.materials } as Record<Slot, Material>
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { pedestal: new Group(), register: new Group(), drawer: new Group(), keys: new Group(), crank: new Group() }
  const content = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) { anchor.name = `${ID} / ${name}`; root.add(anchor); const generated = new Group(); generated.name = `${anchor.name} / generated`; anchor.add(generated); content.set(anchor, generated) }
  const counter = socket('counter-top', [0, config.counterHeight, 0]); root.add(counter)
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (part: Group, geo: BufferGeometry, slot: Slot, pos: [number, number, number], name: string): Mesh => {
    geometries.push(geo); const mesh = new Mesh(geo, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.position.set(...pos)
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.materialSlot = slot; content.get(part)!.add(mesh); return mesh
  }
  const box = (part: Group, slot: Slot, size: [number, number, number], pos: [number, number, number], name: string): void => {
    const geo = bevelBox(...size, Math.min(0.003, Math.min(...size) * 0.15)); boardUVs(geo, size); emit(part, geo, slot, pos, name)
  }
  const rebuild = (): void => {
    content.forEach(group => group.clear()); geometries.splice(0).forEach(geo => geo.dispose())
    const h = config.counterHeight; counter.position.y = h; parts.drawer.position.z = config.drawerOpen * 0.12
    box(parts.pedestal, 'cedar', [0.60, 0.035, 0.50], [0, h - 0.0175, 0], 'overhanging counter top')
    for (const x of [-0.239, 0.239]) for (const z of [-0.189, 0.189]) box(parts.pedestal, 'cedar', [0.067, h - 0.024, 0.067], [x, (h - 0.024) / 2, z], 'continuous square leg')
    box(parts.pedestal, 'cedar', [0.43, 0.030, 0.386], [0, 0.16, 0], 'open storage floor')
    for (const x of [-0.24, 0.24]) {
      box(parts.pedestal, 'cedarDark', [0.026, h - 0.20, 0.34], [x, (h - 0.20) / 2 + 0.175, 0], 'inset side panel')
      for (const y of [0.171, h - 0.065]) box(parts.pedestal, 'cedar', [0.038, 0.05, 0.35], [x, y, 0], 'side panel rail')
    }
    box(parts.pedestal, 'cedarDark', [0.43, h - 0.20, 0.023], [0, (h - 0.20) / 2 + 0.175, -0.194], 'closed storage back')
    box(parts.pedestal, 'cedar', [0.43, 0.075, 0.035], [0, h - 0.078, 0.195], 'front apron')
    // The cash drawer has an actual cavity, supported by the base and side runners.
    box(parts.register, 'glazeMoss', [0.436, 0.012, 0.37], [-0.02, h + 0.006, 0], 'register sole plate')
    for (const x of [-0.23, 0.19]) box(parts.register, 'glazeMoss', [0.016, 0.048, 0.365], [x, h + 0.033, 0], 'drawer housing side')
    box(parts.drawer, 'cedarDark', [0.396, 0.009, 0.302], [-0.02, h + 0.018, 0.026], 'cash drawer bottom')
    box(parts.drawer, 'cedar', [0.407, 0.04, 0.018], [-0.02, h + 0.033, 0.184], 'cedar cash drawer face')
    for (const x of [-0.21, 0.17]) box(parts.drawer, 'cedarDark', [0.012, 0.031, 0.30], [x, h + 0.033, 0.028], 'cash drawer wall')
    for (const x of [-0.12, -0.02, 0.08]) box(parts.drawer, 'cedarDark', [0.006, 0.022, 0.284], [x, h + 0.031, 0.026], 'cash compartment divider')
    box(parts.drawer, 'cedarDark', [0.38, 0.031, 0.012], [-0.02, h + 0.033, -0.12], 'cash drawer back')
    const knob = new CylinderGeometry(0.011, 0.009, 0.021, 12); knob.rotateX(Math.PI / 2)
    const escutcheon = new CylinderGeometry(0.015, 0.015, 0.005, 16); escutcheon.rotateX(Math.PI / 2)
    emit(parts.drawer, escutcheon, 'brass', [-0.02, h + 0.033, 0.194], 'seated drawer pull escutcheon')
    emit(parts.drawer, knob, 'brass', [-0.02, h + 0.033, 0.201], 'drawer pull')
    emit(parts.register, housing(), 'glazeMoss', [-0.02, h, 0], 'sloped mechanical register housing')
    emit(parts.register, displayHood(), 'glazeMoss', [-0.02, h + 0.315, -0.113], 'raised display hood')
    box(parts.register, 'ink', [0.295, 0.064, 0.006], [-0.02, h + 0.313, -0.067], 'inset display bezel')
    for (let i = 0; i < 4; i++) box(parts.register, 'glaze', [0.035, 0.037, 0.003], [-0.068 + i * 0.046, h + 0.311, -0.0627], 'blank mechanical readout')
    const angle = Math.atan(0.17 / 0.26); const normal = new Vector3(0, Math.cos(angle), Math.sin(angle))
    for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
      const z = 0.123 - row * 0.043; const y = h + 0.085 + (0.16 - z) * 0.17 / 0.26
      const point = new Vector3(-0.122 + col * 0.065, y, z)
      const stem = new CylinderGeometry(0.005, 0.006, 0.020, 8); stem.rotateX(angle)
      const cap = new CylinderGeometry(0.011, 0.0115, 0.007, 12); cap.rotateX(angle)
      const a = point.clone().addScaledVector(normal, 0.006); const b = point.clone().addScaledVector(normal, 0.019)
      emit(parts.keys, stem, 'ink', [a.x, a.y, a.z], 'seated mechanical key stem')
      emit(parts.keys, cap, col === 3 ? 'vermilion' : 'glaze', [b.x, b.y, b.z], 'round key cap')
    }
    const boss = new CylinderGeometry(0.052, 0.052, 0.014, 24); boss.rotateZ(Math.PI / 2)
    emit(parts.crank, boss, 'glazeMoss', [0.181, h + 0.132, -0.055], 'cast crank mounting boss')
    const bearing = new CylinderGeometry(0.026, 0.026, 0.012, 16); bearing.rotateZ(Math.PI / 2)
    emit(parts.crank, bearing, 'brass', [0.191, h + 0.132, -0.055], 'crank bearing flange')
    const axle = new CylinderGeometry(0.018, 0.018, 0.06, 12); axle.rotateZ(Math.PI / 2)
    emit(parts.crank, axle, 'brass', [0.197, h + 0.132, -0.055], 'seated crank axle')
    emit(parts.crank, member(new Vector3(0.222, h + 0.132, -0.055), new Vector3(0.222, h + 0.21, -0.088), 0.009, 10), 'brass', [0, 0, 0], 'crank arm')
    const grip = new CylinderGeometry(0.014, 0.013, 0.066, 12); grip.rotateZ(Math.PI / 2)
    emit(parts.crank, grip, 'cedar', [0.25, h + 0.21, -0.088], 'timber crank grip')
  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }),
    configure(patch: Partial<KkRegisterConfig>) { if (disposed) return; Object.assign(config, configuration(patch, config)); rebuild() },
    setMaterial(slot: Slot, material: Material) { if (disposed) return; materials[slot] = material; root.traverse(o => { if (o instanceof Mesh && o.userData.materialSlot === slot) o.material = material }) },
    update(_deltaSeconds: number) {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach(geo => geo.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
