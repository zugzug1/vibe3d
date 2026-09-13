import { Group, Mesh, type BufferGeometry, type Material } from 'three/webgpu'

import {
  acquireKkMaterials,
  bevelBox,
  createKkPreview,
  finishModel,
} from '../kk-core/index.ts'

const ID = 'kk-005-machiya-window-bench'
const W = 1.6
const D = 0.55
const H = 1.42
const SEAT_Y = 0.625

type Slot = 'cedar' | 'cedarDark' | 'indigo' | 'indigoFaded' | 'washi'
export interface KkWindowBenchConfig { cushionCount: number }
export interface KkWindowBenchOptions extends Partial<KkWindowBenchConfig> {
  materials?: Partial<Record<Slot, Material>>
}
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

const defaults: KkWindowBenchConfig = { cushionCount: 3 }
const emitBox = (generated: BufferGeometry[], group: Group, material: Material,
  size: [number, number, number], position: [number, number, number], name: string): void => {
  const geo = bevelBox(size[0], size[1], size[2], Math.min(0.008, size[0] * 0.08, size[1] * 0.08, size[2] * 0.08))
  generated.push(geo)
  const mesh = new Mesh(geo, material)
  mesh.name = name
  mesh.position.set(...position)
  group.add(mesh)
}

export function createModel(options: KkWindowBenchOptions = {}): KkWindowBenchInstance {
  const config = { ...defaults, ...options }
  const bundle = acquireKkMaterials({ overrides: options.materials })
  const m = bundle.materials
  const root = new Group(); root.name = ID
  const parts = { frame: new Group(), shoji: new Group(), seat: new Group(), cubbies: new Group() }
  Object.entries(parts).forEach(([key, group]) => { group.name = `${ID} / ${key}`; root.add(group) })
  const generated: BufferGeometry[] = []
  const rebuild = (): void => {
    for (const group of Object.values(parts)) {
      for (const child of [...group.children]) group.remove(child)
    }
    generated.splice(0).forEach((geo) => geo.dispose())

    // Cedar window-seat carcass: a low usable seat with a tall, slender shoji frame behind it.
    for (const x of [-W / 2 + 0.075, W / 2 - 0.075]) {
      // The header laps over the posts by 10 mm; avoid a shared visible top plane.
      emitBox(generated, parts.frame, m.cedarDark, [0.09, H - 0.08, 0.18], [x, (H - 0.08) / 2, -0.03], 'slender corner post')
    }
    emitBox(generated, parts.frame, m.cedar, [W - 0.1, 0.11, 0.10], [0, H - 0.055, -0.03], 'top header beam')
    // The sill is the rear ledge below the shoji; the usable seat projects in front of it.
    emitBox(generated, parts.frame, m.cedar, [W - 0.12, 0.11, 0.14], [0, 0.56, -0.18], 'window sill')
    emitBox(generated, parts.frame, m.cedarDark, [W - 0.16, 0.055, D - 0.12], [0, 0.57, 0.035], 'seat deck')
    emitBox(generated, parts.frame, m.cedarDark, [W - 0.16, 0.11, D], [0, 0.10, 0], 'base rail')

    // The back reads as a shoji lattice rather than an undifferentiated board.
    const shojiBottom = 0.69
    const shojiHeight = 0.60
    const shojiZ = -D / 2 + 0.025
    emitBox(generated, parts.shoji, m.washi, [W - 0.20, shojiHeight, 0.028], [0, shojiBottom + shojiHeight / 2, shojiZ], 'continuous paper screen')
    for (const x of [-0.54, -0.27, 0, 0.27, 0.54]) emitBox(generated, parts.shoji, m.cedarDark, [0.018, shojiHeight, 0.035], [x, shojiBottom + shojiHeight / 2, shojiZ - 0.015], 'vertical shoji lattice')
    for (const y of [0.80, 0.92, 1.04, 1.16, 1.28]) emitBox(generated, parts.shoji, m.cedarDark, [W - 0.20, 0.018, 0.04], [0, y, shojiZ - 0.015], 'horizontal shoji lattice')
    emitBox(generated, parts.shoji, m.cedar, [0.065, shojiHeight + 0.04, 0.04], [0, shojiBottom + shojiHeight / 2, shojiZ + 0.01], 'center mullion')

    const count = Math.max(2, Math.min(4, Math.round(config.cushionCount)))
    const cushionW = (W - 0.24 - (count - 1) * 0.012) / count
    for (let i = 0; i < count; i++) {
      const x = -W / 2 + 0.12 + cushionW / 2 + i * (cushionW + 0.012)
      const cushion = bevelBox(cushionW, 0.10, D - 0.15, 0.018)
      generated.push(cushion)
      const mesh = new Mesh(cushion, i % 2 ? m.indigoFaded : m.indigo); mesh.name = 'rounded indigo seat cushion'; mesh.position.set(x, SEAT_Y, 0.035); parts.seat.add(mesh)
    }
    for (const [x, z] of [[-0.61, 0.17], [0.61, 0.17]] as const) {
      const pillow = bevelBox(0.22, 0.26, 0.075, 0.008)
      generated.push(pillow)
      const mesh = new Mesh(pillow, m.indigoFaded); mesh.name = 'indigo back cushion'
      mesh.position.set(x, 0.78, -0.14); mesh.rotation.x = -0.14; parts.seat.add(mesh)
    }

    // Three open bays under the seat, with offset dividers so the cubby rhythm is legible.
    emitBox(generated, parts.cubbies, m.cedarDark, [W - 0.18, 0.045, D - 0.04], [0, 0.18, 0.01], 'cubby floor')
    for (const x of [-0.26, 0.26]) emitBox(generated, parts.cubbies, m.cedarDark, [0.055, 0.36, D - 0.04], [x, 0.36, 0.01], 'cubby divider')
    for (const x of [-0.49, 0.49]) emitBox(generated, parts.cubbies, m.cedar, [0.40, 0.26, 0.025], [x, 0.30, D / 2 - 0.02], 'fitted cubby drawer front')
    emitBox(generated, parts.cubbies, m.cedarDark, [0.12, 0.018, 0.018], [-0.56, 0.31, D / 2 + 0.002], 'drawer pull')
    emitBox(generated, parts.cubbies, m.cedarDark, [0.12, 0.018, 0.018], [0.56, 0.31, D / 2 + 0.002], 'drawer pull')
  }
  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated })
  return {
    root, parts, materials: m, getConfig: () => ({ ...config }),
    configure(patch) { Object.assign(config, patch); rebuild() },
    setMaterial(slot, material) { m[slot] = material; rebuild() },
    update(_deltaSeconds) {},
    dispose() { finished.dispose() },
  }
}

export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) {
  return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch })
}
export function createCafePreview(options: { aspect: number; time?: number }) {
  return createKkPreview(createModel(), { aspect: options.aspect, framing: 'cafe' })
}
