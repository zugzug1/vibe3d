// kk-003-wagashi-display-cabinet — low glazed cedar case with tiered trays and sliding doors.
// DATUM: 1.20 × 0.50 × 1.10 m authored envelope, Y-up, front = +Z.

import { Box3, BufferGeometry, Group, Mesh, MeshStandardMaterial, Vector3, type Material } from 'three/webgpu'
import { acquireKkMaterials, bevelBox, bevelDisc, createKkPreview, finishModel, mergeParts, socket } from '../kk-core/index.ts'

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

function box(w: number, h: number, d: number, x: number, y: number, z: number, bevel = 0.006): BufferGeometry {
  const geometry = bevelBox(w, h, d, bevel); geometry.translate(x, y, z); return geometry
}

export function createModel(options: KkCabinetOptions = {}): KkCabinetInstance {
  const config: KkCabinetConfig = { doors: options.doors ?? true, trays: options.trays ?? true }
  const bundle = acquireKkMaterials({ overrides: options.materials }); const kit = bundle.materials
  const materials: Record<Slot, Material> = {
    cedar: options.materials?.cedar ?? kit.cedar,
    cedarDark: options.materials?.cedarDark ?? kit.cedarDark,
    trayCharcoal: kit.ink,
    glass: options.materials?.glass ?? kit.glass,
    washi: options.materials?.washi ?? kit.washi,
    ceramic: kit.glaze,
    moss: kit.glazeMoss,
    vermilion: kit.vermilion,
  }
  const root = new Group(); root.name = ID
  const carcass = new Group(); carcass.name = 'carcass'
  const doors = new Group(); doors.name = 'doors'
  const trays = new Group(); trays.name = 'trays'
  const dressing = new Group(); dressing.name = 'dressing'
  root.add(carcass, doors, trays, dressing)
  const generated: BufferGeometry[] = []; const meshesBySlot: Record<Slot, Mesh[]> = { cedar: [], cedarDark: [], trayCharcoal: [], glass: [], washi: [], ceramic: [], moss: [], vermilion: [] }
  const emit = (group: Group, name: string, slot: Slot, parts: BufferGeometry[]): void => {
    if (!parts.length) return
    const geometry = mergeParts(parts, `${ID}: ${name}`); generated.push(geometry)
    const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.castShadow = true; mesh.receiveShadow = true
    if (slot === 'glass') mesh.renderOrder = 2
    group.add(mesh); meshesBySlot[slot].push(mesh)
  }
  const release = (): void => {
    for (const group of [carcass, doors, trays, dressing]) group.clear()
    for (const geometry of generated) geometry.dispose(); generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }
  const rebuild = (): void => {
    release()
    const wood: BufferGeometry[] = [
      box(1.14, 0.08, 0.46, 0, 1.08, 0, 0.008), box(1.14, 0.10, 0.46, 0, 0.08, 0, 0.008),
      box(1.08, 0.10, 0.05, 0, 1.025, 0.20, 0.005),
      box(1.08, 0.06, 0.04, 0, 0.13, -0.20, 0.004),
      // Front posts lap the side panels by 10 mm instead of sharing their outer x face.
      box(0.06, 1.02, 0.06, -0.575, 0.57, 0.22, 0.004), box(0.06, 1.02, 0.06, 0.575, 0.57, 0.22, 0.004),
    ]
    for (const x of [-0.565, 0.565]) {
      wood.push(box(0.05, 0.05, 0.36, x, 1.01, 0.02, 0.004), box(0.05, 0.05, 0.36, x, 0.17, 0.02, 0.004), box(0.05, 0.82, 0.05, x, 0.59, -0.18, 0.004))
    }
    for (const y of [0.33, 0.58, 0.83]) wood.push(box(1.04, 0.045, 0.38, 0, y, -0.005, 0.004))
    for (const x of [-0.52, 0.52]) for (const z of [-0.18, 0.18]) wood.push(box(0.09, 0.07, 0.08, x, 0.035, z, 0.004))
    emit(carcass, 'cedar-case', 'cedar', wood)
    emit(carcass, 'glazed-side-panels', 'glass', [-0.565, 0.565].map((x) => box(0.004, 0.78, 0.32, x, 0.59, 0.02, 0)))
    if (config.doors) {
      const doorFrames: BufferGeometry[] = []
      for (const x of [-0.285, 0.285]) {
        doorFrames.push(box(0.53, 0.035, 0.018, x, 0.18, 0.235, 0.003), box(0.53, 0.035, 0.018, x, 0.98, 0.235, 0.003))
        doorFrames.push(box(0.035, 0.78, 0.018, x - 0.247, 0.58, 0.235, 0.003), box(0.035, 0.78, 0.018, x + 0.247, 0.58, 0.235, 0.003))
      }
      emit(doors, 'sliding-door-frames', 'cedarDark', doorFrames)
      // A single transparent layer per door; the shelves remain readable behind it.
      emit(doors, 'glazed-doors', 'glass', [-0.285, 0.285].map((x) => box(0.47, 0.70, 0.004, x, 0.58, 0.228, 0)))
    }
    if (config.trays) {
      const trayParts: BufferGeometry[] = []
      for (const y of [0.35, 0.60, 0.85]) {
        for (const x of [-0.29, 0.29]) {
          trayParts.push(box(0.43, 0.018, 0.30, x, y, 0.02, 0.002))
          trayParts.push(box(0.43, 0.035, 0.018, x, y + 0.025, 0.16, 0.002), box(0.43, 0.035, 0.018, x, y + 0.025, -0.12, 0.002))
          trayParts.push(box(0.018, 0.035, 0.26, x - 0.205, y + 0.025, 0.02, 0.002), box(0.018, 0.035, 0.26, x + 0.205, y + 0.025, 0.02, 0.002))
        }
      }
      emit(trays, 'tiered-serving-trays', 'trayCharcoal', trayParts)
    }
    // Lower opaque panel band echoes the reference without inventing pastry geometry.
    emit(dressing, 'lower-washi-panels', 'washi', [box(0.48, 0.20, 0.006, -0.285, 0.27, 0.226, 0.001), box(0.48, 0.20, 0.006, 0.285, 0.27, 0.226, 0.001)])
    const sweets: Record<'ceramic' | 'moss' | 'vermilion', BufferGeometry[]> = { ceramic: [], moss: [], vermilion: [] }
    for (const y of [0.35, 0.60, 0.85] as const) {
      const positions = [[-0.36, 0.01], [-0.24, 0.04], [-0.12, -0.01], [0.12, 0.03], [0.24, -0.02], [0.36, 0.04]]
      positions.forEach(([x, z], index) => {
        const sweet = index % 2 === 0 ? bevelDisc(0.032 + (index % 3) * 0.006, 0.028, 0.003, 16) : box(0.052 - (index % 3) * 0.006, 0.035, 0.046, x, y + 0.035, z, 0.003)
        if (index % 2 === 0) sweet.rotateX(Math.PI / 2)
        if (index % 2 === 0) sweet.translate(x, y + 0.035, z)
        sweets[index % 3 === 1 ? 'vermilion' : index % 3 === 2 ? 'moss' : 'ceramic'].push(sweet)
      })
    }
    emit(dressing, 'wagashi-display', 'ceramic', sweets.ceramic)
    emit(dressing, 'wagashi-moss', 'moss', sweets.moss)
    emit(dressing, 'wagashi-accent', 'vermilion', sweets.vermilion)
    const bounds = new Box3().setFromObject(root as never); const center = bounds.getCenter(new Vector3()); root.position.set(-center.x, -bounds.min.y, -center.z)
  }
  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated, sockets: [socket('anchor-cabinet', [0, 0, 0])] })
  return {
    root, parts: { carcass, doors, trays, dressing }, materials,
    getConfig: () => ({ ...config }),
    configure(patch) { if (patch.doors !== undefined) config.doors = Boolean(patch.doors); if (patch.trays !== undefined) config.trays = Boolean(patch.trays); rebuild() },
    setMaterial(slot, material) { materials[slot] = material; for (const mesh of meshesBySlot[slot]) mesh.material = material },
    update: () => {}, dispose() { finished.dispose() },
  }
}

export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
