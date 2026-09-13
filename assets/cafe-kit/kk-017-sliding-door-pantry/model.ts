// kk-017-sliding-door-pantry — tall cedar pantry with twin sliding doors, lattice upper vents and recessed pulls.
// DATUM: 0.85 × 0.45 × 1.80 m authored envelope, Y-up, front = +Z.

import { Box3, BufferGeometry, Group, Mesh, MeshStandardMaterial, Vector3, type Material } from 'three/webgpu'
import { acquireKkMaterials, bevelBox, bevelDisc, createKkPreview, finishModel, mergeParts, socket } from '../kk-core/index.ts'

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

function box(w: number, h: number, d: number, x: number, y: number, z: number, bevel = 0.005): BufferGeometry {
  const geometry = bevelBox(w, h, d, bevel); geometry.translate(x, y, z); return geometry
}

export function createModel(options: KkPantryOptions = {}): KkPantryInstance {
  const config: KkPantryConfig = { doors: options.doors ?? true, shelves: options.shelves ?? true }
  const bundle = acquireKkMaterials({ overrides: options.materials }); const kit = bundle.materials
  const materials: Record<Slot, Material> = {
    cedar: options.materials?.cedar ?? kit.cedar,
    cedarDark: options.materials?.cedarDark ?? kit.cedarDark,
    ink: options.materials?.ink ?? kit.ink,
    ceramic: kit.glaze,
  }
  const root = new Group(); root.name = ID
  const carcass = new Group(); carcass.name = 'carcass'; const doors = new Group(); doors.name = 'doors'; const shelves = new Group(); shelves.name = 'shelves'; const hardware = new Group(); hardware.name = 'hardware'
  root.add(carcass, doors, shelves, hardware)
  const generated: BufferGeometry[] = []; const meshesBySlot: Record<Slot, Mesh[]> = { cedar: [], cedarDark: [], ink: [], ceramic: [] }
  const emit = (group: Group, name: string, slot: Slot, parts: BufferGeometry[]): void => {
    if (!parts.length) return
    const geometry = mergeParts(parts, `${ID}: ${name}`); generated.push(geometry)
    const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); meshesBySlot[slot].push(mesh)
  }
  const release = (): void => { for (const group of [carcass, doors, shelves, hardware]) group.clear(); for (const geometry of generated) geometry.dispose(); generated.length = 0; for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0 }
  const rebuild = (): void => {
    release()
    const body: BufferGeometry[] = [
      box(0.07, 1.62, 0.39, -0.39, 0.88, 0, 0.006), box(0.07, 1.62, 0.39, 0.39, 0.88, 0, 0.006),
      box(0.78, 0.08, 0.42, 0, 1.72, 0, 0.008), box(0.78, 0.10, 0.42, 0, 0.08, 0, 0.008),
      box(0.76, 0.07, 0.035, 0, 0.16, 0.20, 0.004), box(0.76, 0.07, 0.035, 0, 1.58, 0.20, 0.004),
      box(0.76, 0.10, 0.05, 0, 1.64, 0.20, 0.005),
      box(0.04, 1.66, 0.04, -0.38, 0.88, 0.20, 0.003), box(0.04, 1.66, 0.04, 0.38, 0.88, 0.20, 0.003),
    ]
    for (const x of [-0.35, 0.35]) for (const z of [-0.16, 0.16]) body.push(box(0.09, 0.08, 0.08, x, 0.04, z, 0.004))
    emit(carcass, 'cedar-carcass', 'cedar', body)
    emit(carcass, 'dark-open-interior', 'ink', [box(0.72, 1.52, 0.025, 0, 0.88, -0.19, 0.002)])
    if (config.shelves) {
      const shelfParts: BufferGeometry[] = []
      for (const y of [0.40, 0.82, 1.24]) shelfParts.push(box(0.70, 0.045, 0.34, 0, y, -0.01, 0.004))
      emit(shelves, 'interior-shelves', 'cedarDark', shelfParts)
      const cups: BufferGeometry[] = []
      for (const y of [0.40, 0.82, 1.24]) for (const x of [-0.25, 0, 0.25]) {
        const cup = bevelDisc(0.028 + (x === 0 ? 0.004 : 0), 0.065, 0.003, 14)
        cup.rotateX(Math.PI / 2); cup.translate(x, y + 0.055, 0.015); cups.push(cup)
      }
      emit(shelves, 'cup-silhouettes', 'ceramic', cups)
    }
    if (config.doors) {
      const panels: BufferGeometry[] = []
      const lowerTrim: BufferGeometry[] = []
      for (const x of [-0.18, 0.18]) {
        // The reference is solid below the rail and open/slatted above it; a full slab here hides the landmark.
        panels.push(box(0.37, 0.90, 0.028, x, 0.67, 0.215, 0.004))
        panels.push(box(0.37, 0.045, 0.035, x, 1.54, 0.20, 0.003), box(0.37, 0.045, 0.035, x, 0.22, 0.20, 0.003))
        panels.push(box(0.04, 1.31, 0.035, x - 0.165, 0.88, 0.20, 0.003), box(0.04, 1.31, 0.035, x + 0.165, 0.88, 0.20, 0.003))
        // Upper screened opening: vertical cedar slats are the pantry's landmark, not a flat box.
        for (let i = -3; i <= 3; i++) panels.push(box(0.016, 0.38, 0.045, x + i * 0.045, 1.34, 0.20, 0.002))
        panels.push(box(0.37, 0.035, 0.045, x, 1.14, 0.20, 0.003), box(0.37, 0.035, 0.045, x, 1.54, 0.20, 0.003))
        lowerTrim.push(box(0.29, 0.018, 0.04, x, 0.27, 0.24, 0.002), box(0.29, 0.018, 0.04, x, 1.07, 0.24, 0.002))
      }
      emit(doors, 'sliding-door-panels', 'cedar', panels)
      emit(doors, 'framed-lower-panels', 'cedarDark', lowerTrim)
    }
    const pulls: BufferGeometry[] = [box(0.72, 0.014, 0.022, 0, 0.20, 0.225, 0.002), box(0.72, 0.014, 0.022, 0, 1.57, 0.225, 0.002)]
    for (const x of [-0.365, 0.365]) pulls.push(box(0.028, 0.16, 0.018, x, 0.77, 0.24, 0.004))
    emit(hardware, 'recessed-pulls', 'ink', pulls)
    const bounds = new Box3().setFromObject(root as never); const center = bounds.getCenter(new Vector3()); root.position.set(-center.x, -bounds.min.y, -center.z)
  }
  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated, sockets: [socket('anchor-pantry', [0, 0, 0])] })
  return {
    root, parts: { carcass, doors, shelves, hardware }, materials,
    getConfig: () => ({ ...config }),
    configure(patch) { if (patch.doors !== undefined) config.doors = Boolean(patch.doors); if (patch.shelves !== undefined) config.shelves = Boolean(patch.shelves); rebuild() },
    setMaterial(slot, material) { materials[slot] = material; for (const mesh of meshesBySlot[slot]) mesh.material = material },
    update: () => {}, dispose() { finished.dispose() },
  }
}

export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
