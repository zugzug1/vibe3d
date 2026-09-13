// Metres; Y-up, bottom-centre root. Generated geometry is instance-owned.
import { Group, Mesh, BoxGeometry, LatheGeometry, Vector2, Vector3, BufferGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, member } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID = 'kk-037-manual-coffee-grinder'
type Slot = 'cedar' | 'cedarDark' | 'steel' | 'brass'
export const structureControls = {
  "crankAngle": {
    "min": -180,
    "max": 180,
    "default": 0,
    "step": 5,
    "label": "Crank angle (degrees)"
  },
  "drawerOpen": {
    "min": 0,
    "max": 1,
    "default": 0,
    "step": 0.05,
    "label": "Grounds drawer extension"
  }
} as const
export type Config = { -readonly [K in keyof typeof structureControls]: number }
export type Options = Partial<Config> & { materials?: Partial<Record<Slot, Material>> }
function configuration(patch: Partial<Config>, previous?: Config): Config {
  const next = {} as Config
  for (const key of Object.keys(structureControls) as (keyof Config)[]) {
    const rule = structureControls[key]; const value = patch[key] === undefined ? previous?.[key] ?? rule.default : patch[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${key} must be finite`)
    next[key] = Math.max(rule.min, Math.min(rule.max, value))
  }
  return next
}

export function createModel(options: Options = {}) {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<'cedar' | 'cedarDark'>({"cedar":"cedar","cedarDark":"cedar"}, options.materials)
  const materials = { ...bundle.materials, ...options.materials } as Record<Slot, Material>
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { body: new Group(), drawer: new Group(), hopper: new Group(), crank: new Group() }
  const content = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) {
    anchor.name = `${ID} / ${name}`; root.add(anchor)
    const generated = new Group(); generated.name = `${anchor.name} / generated`; anchor.add(generated); content.set(anchor, generated)
  }
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (part: Group, geo: BufferGeometry, slot: Slot, pos: [number, number, number], name: string): Mesh => {
    geometries.push(geo); const mesh = new Mesh(geo, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.position.set(...pos)
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.materialSlot = slot; content.get(part)!.add(mesh); return mesh
  }
  const box = (part: Group, slot: Slot, size: [number, number, number], pos: [number, number, number], name: string, bevel = true): Mesh => {
    const geo = bevel ? bevelBox(...size, Math.min(0.0008, Math.min(...size) * 0.12)) : new BoxGeometry(...size)
    boardUVs(geo, size); return emit(part, geo, slot, pos, name)
  }
  const rod = (part: Group, slot: Slot, a: [number, number, number], b: [number, number, number], radius: number, name: string, segments = 8): Mesh =>
    emit(part, member(new Vector3(...a), new Vector3(...b), radius, segments), slot, [0, 0, 0], name)
  const rebuild = (): void => {
    content.forEach(group => group.clear()); geometries.splice(0).forEach(geo => geo.dispose())

    parts.crank.rotation.y = config.crankAngle * Math.PI / 180
    parts.drawer.position.z = config.drawerOpen * 0.045
    box(parts.body, 'cedar', [0.14, 0.009, 0.14], [0, 0.0045, 0], 'stepped base')
    box(parts.body, 'cedar', [0.132, 0.008, 0.132], [0, 0.013, 0], 'base shoulder')
    for (const x of [-0.055, 0.055]) box(parts.body, 'cedar', [0.016, 0.093, 0.122], [x, 0.0605, 0], 'dovetailed case side')
    box(parts.body, 'cedarDark', [0.096, 0.093, 0.014], [0, 0.0605, -0.054], 'case back')
    box(parts.body, 'cedar', [0.096, 0.044, 0.014], [0, 0.085, 0.054], 'drawer lintel')
    box(parts.body, 'cedar', [0.14, 0.01, 0.14], [0, 0.112, 0], 'overhanging hopper deck')
    for (const x of [-0.055, 0.055]) for (const y of [0.033, 0.055, 0.077, 0.099])
      box(parts.body, 'cedarDark', [0.013, 0.006, 0.002], [x, y, 0.061], 'exposed box joint endgrain', false)
    box(parts.drawer, 'cedar', [0.09, 0.04, 0.012], [0, 0.04, 0.055], 'grounds drawer face')
    box(parts.drawer, 'cedarDark', [0.084, 0.005, 0.078], [0, 0.0225, 0.013], 'grounds drawer floor', false)
    for (const x of [-0.04, 0.04]) box(parts.drawer, 'cedarDark', [0.006, 0.033, 0.078], [x, 0.041, 0.013], 'grounds drawer side', false)
    box(parts.drawer, 'cedarDark', [0.074, 0.033, 0.006], [0, 0.041, -0.023], 'grounds drawer back', false)
    rod(parts.drawer, 'brass', [0, 0.04, 0.059], [0, 0.04, 0.066], 0.004, 'seated pull neck')
    rod(parts.drawer, 'brass', [0, 0.04, 0.065], [0, 0.04, 0.07], 0.008, 'round drawer pull', 12)
    rod(parts.hopper, 'steel', [0, 0.115, 0], [0, 0.124, 0], 0.028, 'bolted hopper foot', 16)
    // Ordered closed annular section: outer bowl, rolled rim, inner bowl, throat.
    const section = [[0.018,0.122],[0.019,0.137],[0.043,0.166],[0.058,0.18],[0.059,0.184],[0.056,0.186],[0.053,0.182],[0.040,0.169],[0.014,0.139],[0.010,0.13],[0.010,0.122],[0.018,0.122]]
    const hopper = new LatheGeometry(section.map(([r,y]) => new Vector2(r,y)), 24)
    // Three's last meridian normal retains the profile edge length. Normalize at millimetre scale.
    hopper.normalizeNormals()
    const hopperMesh = emit(parts.hopper, hopper, 'steel', [0,0,0], 'open flared hopper')
    // Thin inner/outer walls alias in the contrast shadow map; geometry/winding are verified.
    // Keep receiving crank shadows. Preview consumers must preserve this local casting opt-out.
    hopperMesh.castShadow = false
    hopperMesh.userData.cafeCastShadow = false
    for (const x of [-0.019,0.019]) rod(parts.hopper, 'brass', [x,0.12,0], [x,0.127,0], 0.003, 'hopper fixing')
    rod(parts.hopper, 'steel', [0,0.122,0], [0,0.223,0], 0.004, 'continuous grinder spindle', 12)
    rod(parts.hopper, 'brass', [0,0.199,0], [0,0.207,0], 0.011, 'grind adjustment collar', 12)
    rod(parts.crank, 'steel', [0,0.211,0], [0.019,0.211,0], 0.0035, 'crank hub arm')
    rod(parts.crank, 'steel', [0.018,0.211,0], [0.026,0.22,0], 0.0035, 'crank rise')
    rod(parts.crank, 'steel', [0.026,0.22,0], [0.059,0.22,0], 0.0035, 'crank sweep')
    rod(parts.crank, 'brass', [0.059,0.217,0], [0.059,0.239,0], 0.003, 'handle axle')
    const grip = [[0.003,0.224],[0.007,0.225],[0.01,0.232],[0.01,0.241],[0.007,0.249],[0.003,0.25],[0.003,0.224]]
    const handle = new LatheGeometry(grip.map(([r,y]) => new Vector2(r,y)), 12); handle.normalizeNormals()
    emit(parts.crank, handle, 'cedarDark', [0.059,0,0], 'turned timber crank grip')

  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }),
    configure(patch: Partial<Config>) { if (disposed) return; const next = configuration(patch, config); Object.assign(config, next); rebuild() },
    setMaterial(slot: Slot, material: Material) {
      if (disposed) return
      materials[slot] = material
      content.forEach(group => group.traverse(o => { if (o instanceof Mesh && o.userData.materialSlot === slot) o.material = material }))
    },
    update(_deltaSeconds: number) {},
    dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach(geo => geo.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
