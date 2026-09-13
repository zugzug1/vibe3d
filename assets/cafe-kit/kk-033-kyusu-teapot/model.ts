// kk-033-kyusu-teapot — a low handmade kyusu with a domed lid, short left spout, and side handle.
//
// Datum: 0.19 W × 0.14 D × 0.12 H m, bottom-centre origin, Y-up, front = +Z. The cylindrical handle
// projects on +X and the short pouring spout rises toward +Z, perpendicular in plan as in the reference.

import { BufferAttribute, BufferGeometry, Group, LatheGeometry, Mesh, Quaternion, Vector2, Vector3, type Material } from 'three/webgpu'

import {
  acquireKkMaterials,
  bevelDisc,
  bevelRing,
  createKkPreview,
  finishModel,
  revolve,
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
const Y_AXIS = new Vector3(0, 1, 0)

/** Four axial rings replace the long default TubeGeometry path for this tiny spout. */
function axialSpout(path: readonly Vector3[], radii: readonly number[], radial = 10): BufferGeometry {
  const positions = new Float32Array(path.length * radial * 3)
  const indices: number[] = []
  for (let i = 0; i < path.length; i++) {
    const previous = path[Math.max(0, i - 1)]!
    const next = path[Math.min(path.length - 1, i + 1)]!
    const tangent = next.clone().sub(previous).normalize()
    const u = new Vector3(1, 0, 0).projectOnPlane(tangent).normalize()
    const v = tangent.clone().cross(u).normalize()
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const point = path[i]!.clone()
        .addScaledVector(u, radii[i]! * Math.cos(a))
        .addScaledVector(v, radii[i]! * Math.sin(a))
      const offset = (i * radial + j) * 3
      positions[offset] = point.x
      positions[offset + 1] = point.y
      positions[offset + 2] = point.z
    }
  }
  for (let i = 0; i < path.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j
      const b = i * radial + (j + 1) % radial
      const c = (i + 1) * radial + j
      const d = (i + 1) * radial + (j + 1) % radial
      indices.push(a, b, c, b, d, c)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

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

  const orientAtY = (geometry: BufferGeometry, point: Vector3, direction: Vector3): BufferGeometry => {
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(Y_AXIS, direction.clone().normalize()))
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
    ], { yBot: 0.012, yTop: 0.088, segments: 16 })
    emit('ceramic', vessel, body, 'rounded-vessel')

    const base = bevelRing(0.032, 0.048, 0.006, 0.0012, 8)
    base.rotateX(Math.PI / 2)
    base.translate(0, 0.012, 0)
    emit('metal', base, body, 'foot-ring')

    if (config.lid) {
      const dome = revolve([
        [0, 0.043], [0.22, 0.044], [0.5, 0.039], [0.76, 0.026], [1, 0.010],
    ], { yBot: 0.084, yTop: 0.104, segments: 16 })
      emit('ceramic', dome, lid, 'domed-lid')
      const rim = bevelRing(0.035, 0.047, 0.003, 0.0008, 8)
      rim.rotateX(Math.PI / 2)
      rim.translate(0, 0.086, 0)
      emit('metal', rim, lid, 'lid-rim')
      // Local ordered profile closes both axis ends; `revolve()` sorts normalized stations and cannot
      // express this returning inner edge without reopening the crown.
      const knob = new LatheGeometry([
        new Vector2(0, 0.102), new Vector2(0.008, 0.102), new Vector2(0.013, 0.106),
        new Vector2(0.015, 0.112), new Vector2(0.010, 0.118), new Vector2(0, 0.119),
      ], 8)
      const knobSeat = bevelDisc(0.012, 0.004, 0.0008, 8)
      knobSeat.rotateX(Math.PI / 2)
      knobSeat.translate(0, 0.103, 0)
      emit('metal', knobSeat, lid, 'knob-seat')
      emit('moss', knob, lid, 'lid-knob')
    }

    const side = config.handleSide
    const handleRoot = new Vector3(side * 0.050, 0.064, -0.002)
    const handleDirection = new Vector3(side, 0.18, 0.02).normalize()
    const handleProfile = [
      new Vector2(0, 0), new Vector2(0.012, 0), new Vector2(0.014, 0.014),
      new Vector2(0.018, 0.050), new Vector2(0.015, 0.052), new Vector2(0.015, 0.032),
      new Vector2(0, 0.032), new Vector2(0, 0),
    ]
    emit('moss', orientAtY(new LatheGeometry(handleProfile, 10), handleRoot, handleDirection), handle, 'side-cylinder-handle')

    const spoutRings = [
      new Vector3(-0.010, 0.057, 0.036),
      new Vector3(-0.011, 0.064, 0.053),
      new Vector3(-0.012, 0.073, 0.073),
      new Vector3(-0.014, 0.082, 0.092),
    ]
    emit('ceramic', axialSpout(spoutRings, [0.016, 0.014, 0.011, 0.009], 10), spout, 'short-spout')
    const baseDirection = spoutRings[1]!.clone().sub(spoutRings[0]!).normalize()
    emit('metal', orientAt(bevelRing(0.010, 0.016, 0.004, 0.0006, 8), spoutRings[0]!, baseDirection), spout, 'spout-junction')
    const direction = spoutRings[3]!.clone().sub(spoutRings[2]!).normalize()
    emit('metal', orientAt(bevelRing(0.008, 0.010, 0.003, 0.0006, 8), spoutRings[3]!, direction), spout, 'spout-rim')
    emit('opening', orientAt(bevelDisc(0.0065, 0.001, 0.0003, 8), spoutRings[3]!.clone().addScaledVector(direction, -0.001), direction), spout, 'spout-opening')
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
