// kk-033-kyusu-teapot — a low handmade kyusu with a domed lid, short left spout, and side handle.
//
// Datum: 0.19 W × 0.14 D × 0.12 H m, bottom-centre origin, Y-up, front = +Z. The handle is on +X and
// the short pouring spout points −X, matching the reference's readable side-to-side silhouette.

import { BufferGeometry, Group, Mesh, Quaternion, Vector3, type Material } from 'three/webgpu'

import {
  acquireKkMaterials,
  bevelDisc,
  bevelRing,
  createKkPreview,
  finishModel,
  revolve,
  taperedTube,
} from '../kk-core/index.ts'

const ID = 'kk-033-kyusu-teapot'

type Slot = 'ceramic' | 'moss' | 'metal' | 'opening'

export interface KkKyusuConfig {
  lid: boolean
  handleSide: 1 | -1
}

export interface KkKyusuOptions extends Partial<KkKyusuConfig> {}

export interface KkKyusuInstance {
  readonly root: Group
  readonly parts: { body: Group; lid: Group; spout: Group; handle: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkKyusuConfig>
  configure(patch: Partial<KkKyusuConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const DEFAULTS: KkKyusuConfig = { lid: true, handleSide: 1 }
const Z_AXIS = new Vector3(0, 0, 1)

export function createModel(options: KkKyusuOptions = {}): KkKyusuInstance {
  const config: KkKyusuConfig = {
    lid: options.lid ?? DEFAULTS.lid,
    handleSide: options.handleSide === -1 ? -1 : DEFAULTS.handleSide,
  }
  const bundle = acquireKkMaterials()
  const slots: Record<Slot, Material> = {
    ceramic: bundle.materials.glaze,
    moss: bundle.materials.glazeMoss,
    metal: bundle.materials.brass,
    opening: bundle.materials.glazeDeep,
  }

  const root = new Group(); root.name = ID
  const body = new Group(); body.name = 'body'
  const lid = new Group(); lid.name = 'lid'
  const spout = new Group(); spout.name = 'spout'
  const handle = new Group(); handle.name = 'handle'
  root.add(body, lid, spout, handle)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { ceramic: [], moss: [], metal: [], opening: [] }
  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, slots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const orientAt = (geometry: BufferGeometry, point: Vector3, direction: Vector3): BufferGeometry => {
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(Z_AXIS, direction.clone().normalize()))
    geometry.translate(point.x, point.y, point.z)
    return geometry
  }

  const rebuild = (): void => {
    for (const group of [body, lid, spout, handle]) group.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0

    const vessel = revolve([
      [0, 0.028], [0.08, 0.047], [0.22, 0.055], [0.48, 0.057], [0.7, 0.053], [0.9, 0.039], [1, 0.030],
    ], { yBot: 0.012, yTop: 0.088, segments: 10 })
    emit('ceramic', vessel, body, 'rounded-vessel')

    const base = bevelRing(0.032, 0.048, 0.006, 0.0012, 8)
    base.rotateX(Math.PI / 2)
    base.translate(0, 0.012, 0)
    emit('metal', base, body, 'foot-ring')

    if (config.lid) {
      const dome = revolve([
        [0, 0.043], [0.22, 0.044], [0.5, 0.039], [0.76, 0.026], [1, 0.010],
    ], { yBot: 0.084, yTop: 0.104, segments: 10 })
      emit('ceramic', dome, lid, 'domed-lid')
      const rim = bevelRing(0.035, 0.047, 0.003, 0.0008, 8)
      rim.rotateX(Math.PI / 2)
      rim.translate(0, 0.086, 0)
      emit('metal', rim, lid, 'lid-rim')
      const knob = revolve([[0, 0.009], [0.35, 0.014], [0.7, 0.016], [1, 0.009]], {
      yBot: 0.102, yTop: 0.119, segments: 8,
      })
      const knobSeat = bevelDisc(0.012, 0.004, 0.0008, 8)
      knobSeat.rotateX(Math.PI / 2)
      knobSeat.translate(0, 0.103, 0)
      emit('metal', knobSeat, lid, 'knob-seat')
      emit('moss', knob, lid, 'lid-knob')
    }

    const side = config.handleSide
    const handlePath = [
      new Vector3(side * 0.044, 0.064, -0.002),
      new Vector3(side * 0.074, 0.071, -0.002),
      new Vector3(side * 0.098, 0.078, -0.002),
    ]
    emit('moss', taperedTube(handlePath, 0.015, 6), handle, 'side-cylinder-handle')

    const spoutPath = [
      new Vector3(-side * 0.043, 0.057, 0.004),
      new Vector3(-side * 0.066, 0.067, 0.004),
      new Vector3(-side * 0.093, 0.081, 0.004),
    ]
    emit('ceramic', taperedTube(spoutPath, 0.012, 6), spout, 'short-spout')
    const baseDirection = spoutPath[1]!.clone().sub(spoutPath[0]!).normalize()
    emit('metal', orientAt(bevelRing(0.010, 0.016, 0.004, 0.0006, 8), spoutPath[0]!, baseDirection), spout, 'spout-junction')
    const direction = spoutPath[2]!.clone().sub(spoutPath[1]!).normalize()
    emit('metal', orientAt(bevelRing(0.008, 0.013, 0.003, 0.0006, 8), spoutPath[2]!, direction), spout, 'spout-rim')
    emit('opening', orientAt(bevelDisc(0.0085, 0.001, 0.0003, 8), spoutPath[2]!.clone().addScaledVector(direction, 0.001), direction), spout, 'spout-opening')
  }

  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated })
  return {
    root,
    parts: { body, lid, spout, handle },
    materials: slots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.lid !== undefined) config.lid = Boolean(patch.lid)
      if (patch.handleSide !== undefined) config.handleSide = patch.handleSide === -1 ? -1 : 1
      rebuild()
    },
    setMaterial(slot, material) {
      slots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose: () => finished.dispose(),
  }
}

export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) {
  return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch })
}

export function createCafePreview({ aspect }: { aspect: number; time?: number }) {
  return createKkPreview(createModel(), { aspect, framing: 'cafe' })
}
