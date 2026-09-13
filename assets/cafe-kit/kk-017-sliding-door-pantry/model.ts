// 0.85 x 0.45 x 1.80 m; bottom-centre, Y-up, front +Z.
import { Group, Mesh, Shape, Path, ExtrudeGeometry, LatheGeometry, Vector2, type BufferGeometry, type Material, type MeshStandardMaterial } from 'three/webgpu'
import { bevelBox, createKkPreview, socket, type KkMaterials } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'

const ID = 'kk-017-sliding-door-pantry'
type Slot = 'cedar' | 'cedarDark' | 'ink' | 'ceramic'
export interface KkPantryConfig { doors: boolean; shelves: boolean }
export interface KkPantryOptions extends Partial<KkPantryConfig> { materials?: Partial<Record<Slot, MeshStandardMaterial>> }
export interface KkPantryInstance {
  readonly root: Group
  readonly parts: { carcass: Group; doors: Group; shelves: Group; hardware: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkPantryConfig>
  configure(patch: Partial<KkPantryConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

/** Solid stile with a real oval finger pocket opening. The recessed bottom is separate. */
function pullStile(): BufferGeometry {
  const shape = new Shape(); shape.moveTo(-0.020, -0.78); shape.lineTo(0.020, -0.78)
  shape.lineTo(0.020, 0.78); shape.lineTo(-0.020, 0.78); shape.closePath()
  const hole = new Path(); hole.absellipse(0, -0.12, 0.009, 0.052, 0, Math.PI * 2, true, 0); shape.holes.push(hole)
  const geometry = new ExtrudeGeometry(shape, { depth: 0.024, bevelEnabled: false, steps: 1, curveSegments: 8 })
  geometry.translate(0, 0, -0.012); boardUVs(geometry, [0.040, 1.56, 0.024]); return geometry
}

/** Closed elliptical annulus: a dark rim and pocket wall, with an actual open centre. */
function pullLiner(outerX: number, outerY: number, depth: number): BufferGeometry {
  const shape = new Shape(); shape.absellipse(0, 0, outerX, outerY, 0, Math.PI * 2, false, 0)
  const hole = new Path(); hole.absellipse(0, 0, 0.0065, 0.048, 0, Math.PI * 2, true, 0); shape.holes.push(hole)
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 8 })
}

function cupGeometry(radius: number, height: number): BufferGeometry {
  const profile = [[0, 0], [radius * 0.68, 0], [radius * 0.76, 0.009], [radius, height - 0.006],
    [radius - 0.003, height], [radius - 0.006, height - 0.006], [radius * 0.63, 0.016], [0, 0.016]]
  const geometry = new LatheGeometry(profile.map(([r, y]) => new Vector2(r!, y!)), 12)
  const p = geometry.getAttribute('position'); const index = geometry.index!; const indices: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
    const same = (a: number, b: number): boolean => p.getX(a) === p.getX(b) && p.getY(a) === p.getY(b) && p.getZ(a) === p.getZ(b)
    if (!same(ids[0]!, ids[1]!) && !same(ids[1]!, ids[2]!) && !same(ids[2]!, ids[0]!)) indices.push(...ids)
  }
  geometry.setIndex(indices); return geometry
}

export function createModel(options: KkPantryOptions = {}): KkPantryInstance {
  const config = { doors: options.doors ?? true, shelves: options.shelves ?? true }
  const bundle = acquireSurfaceMaterials({ cedar: 'cedar', cedarDark: 'cedar', glaze: 'glaze' }, Object.fromEntries(Object.entries({
    cedar: options.materials?.cedar, cedarDark: options.materials?.cedarDark, glaze: options.materials?.ceramic,
  }).filter(([, material]) => material !== undefined)))
  const kit = bundle.materials as Record<keyof KkMaterials, Material>
  const materials: Record<Slot, Material> = { cedar: kit.cedar, cedarDark: kit.cedarDark, ceramic: kit.glaze, ink: options.materials?.ink ?? kit.ink }
  if (!options.materials?.ink) (materials.ink as MeshStandardMaterial).color.multiplyScalar(0.35)
  let ceramicOverridden = Boolean(options.materials?.ceramic)
  const ownedTints: MeshStandardMaterial[] = []
  if (!ceramicOverridden) for (const tint of [kit.glazeMoss, kit.glazeDeep]) {
    const variant = (materials.ceramic as MeshStandardMaterial).clone()
    variant.color.lerp((tint as MeshStandardMaterial).color, 0.30)
    ownedTints.push(variant)
  }
  const root = new Group(); root.name = ID
  const parts = { carcass: new Group(), doors: new Group(), shelves: new Group(), hardware: new Group() }
  const content = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) {
    anchor.name = `${ID} / ${name}`; root.add(anchor); const generated = new Group(); anchor.add(generated); content.set(anchor, generated)
  }
  root.add(socket('anchor-pantry', [0, 0, 0]))
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (group: Group, geometry: BufferGeometry, slot: Slot, pos: [number, number, number], name: string): Mesh => {
    geometries.push(geometry); const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.position.set(...pos)
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.materialSlot = slot; content.get(group)!.add(mesh)
    return mesh
  }
  const box = (group: Group, slot: Slot, size: [number, number, number], pos: [number, number, number], name: string): void => {
    const geometry = bevelBox(...size, Math.min(0.0035, Math.min(...size) * 0.15)); boardUVs(geometry, size); emit(group, geometry, slot, pos, name)
  }
  const rebuild = (): void => {
    content.forEach((g) => g.clear()); geometries.splice(0).forEach((g) => g.dispose())
    box(parts.carcass, 'cedar', [0.85, 0.045, 0.45], [0, 1.7775, 0], 'continuous crown')
    box(parts.carcass, 'cedar', [0.83, 0.055, 0.43], [0, 0.1075, 0], 'continuous base')
    for (const x of [-0.375, 0.375]) for (const z of [-0.172, 0.172]) box(parts.carcass, 'cedar', [0.065, 0.08, 0.065], [x, 0.04, z], 'short foot')
    for (const x of [-0.39, 0.39]) {
      box(parts.carcass, 'cedar', [0.045, 1.62, 0.42], [x, 0.945, 0], 'closed cabinet side')
      box(parts.carcass, 'cedarDark', [0.008, 0.045, 0.33], [x * 1.06, 0.93, 0], 'side mid rail')
    }
    box(parts.carcass, 'ink', [0.735, 1.62, 0.02], [0, 0.945, -0.197], 'recessed dark back')
    for (const y of [0.153, 1.727]) box(parts.carcass, 'cedarDark', [0.735, 0.030, 0.065], [0, y, 0.174], 'sliding door track bed')
    for (const y of [0.162, 1.714]) for (const z of [0.172, 0.203]) box(parts.hardware, 'ink', [0.73, 0.008, 0.005], [0, y, z], 'narrow sliding track')
    if (config.shelves) {
      for (const y of [0.42, 0.96, 1.34]) {
        box(parts.shelves, 'cedarDark', [0.735, 0.026, 0.32], [0, y - 0.013, -0.013], 'fitted interior shelf')
        for (const [i, x] of [-0.26, -0.085, 0.085, 0.26].entries()) {
          const cup = emit(parts.shelves, cupGeometry(i % 2 ? 0.057 : 0.065, i % 2 ? 0.15 : 0.105), 'ceramic', [x, y, 0.025], 'stocked hollow cup')
          if (!ceramicOverridden && i % 3) cup.material = ownedTints[i % 3 - 1]!
          if (i % 2 === 0 && y > 0.9) emit(parts.shelves, cupGeometry(0.064, 0.085), 'ceramic', [x, y + 0.074, 0.025], 'nested bowl')
        }
      }
    }
    if (config.doors) for (const [i, x] of [-0.184, 0.184].entries()) {
      const z = i === 0 ? 0.180 : 0.211
      const outer = x + (i === 0 ? -0.162 : 0.162)
      emit(parts.doors, pullStile(), 'cedar', [outer, 0.942, z], 'pocket-cut outer stile')
      box(parts.hardware, 'ink', [0.025, 0.118, 0.003], [outer, 0.822, z + 0.0005], 'recessed pull bottom')
      emit(parts.hardware, pullLiner(0.009, 0.052, 0.010), 'ink', [outer, 0.822, z + 0.002], 'charcoal pocket wall')
      emit(parts.hardware, pullLiner(0.014, 0.058, 0.002), 'ink', [outer, 0.822, z + 0.011], 'charcoal pocket rim')
      box(parts.doors, 'cedar', [0.025, 1.56, 0.024], [x + (i === 0 ? 0.162 : -0.162), 0.942, z], 'meeting stile')
      box(parts.doors, 'cedar', [0.294, 0.77, 0.012], [x, 0.565, z - 0.006], 'inset solid lower panel')
      for (const [y, h] of [[0.181, 0.038], [0.970, 0.044], [1.69, 0.065]]) box(parts.doors, 'cedar', [0.296, h!, 0.024], [x, y!, z], 'door cross rail')
      // No backing slab or glazing: 27 mm gaps behind 10 mm slats expose the stocked interior.
      for (let slat = 0; slat < 8; slat++) box(parts.doors, 'cedar', [0.010, 0.663, 0.012], [x - 0.1295 + slat * 0.037, 1.3245, z], 'open upper slat')
    }
  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }),
    configure(patch) { if (disposed) return; if (patch.doors !== undefined) config.doors = Boolean(patch.doors); if (patch.shelves !== undefined) config.shelves = Boolean(patch.shelves); rebuild() },
    setMaterial(slot, material) { if (disposed) return; materials[slot] = material; if (slot === 'ceramic') ceramicOverridden = true; root.traverse((o) => { if (o instanceof Mesh && o.userData.materialSlot === slot) o.material = material }) },
    update() {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((g) => g.dispose()); ownedTints.forEach((m) => m.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
