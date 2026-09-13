// kk-033-kyusu-teapot — a low handmade kyusu with a domed lid, short left spout, and side handle.
//
// Datum: 0.19 W × 0.14 D × 0.12 H m, bottom-centre origin, Y-up, front = +Z. The cylindrical handle
// projects on +X and the short pouring spout rises toward +Z, perpendicular in plan as in the reference.

import { BufferAttribute, BufferGeometry, Group, LatheGeometry, Mesh, Quaternion, Vector2, Vector3, type Material } from 'three/webgpu'

import {
  acquireKkMaterials,
  createKkPreview,
  finishModel,
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
const Y_AXIS = new Vector3(0, 1, 0)

/** Ordered ceramic section; preserve returning walls and remove zero-area pole faces. */
function section(points: readonly (readonly [number, number])[], segments: number): BufferGeometry {
  const geometry = new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), segments)
  const p = geometry.getAttribute('position')
  const source = geometry.getIndex()!
  const indices: number[] = []
  for (let i = 0; i < source.count; i += 3) {
    const ids = [source.getX(i), source.getX(i + 1), source.getX(i + 2)]
    const [a, b, c] = ids.map(id => new Vector3().fromBufferAttribute(p, id))
    if (b!.sub(a!).cross(c!.sub(a!)).lengthSq() > 1e-20) indices.push(...ids)
  }
  geometry.setIndex(indices)
  return geometry
}

/** Sparse curved sweep, with explicit rings for the turned-back mouth wall. */
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
    mesh.name = `${ID} / ${name}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
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

    const vessel = section([
      [0, 0.006], [0.033, 0.006], [0.042, 0.014], [0.051, 0.027],
      [0.057, 0.044], [0.058, 0.058], [0.055, 0.072], [0.049, 0.083],
      [0.041, 0.090], [0.038, 0.091], [0.035, 0.089],
      [0.040, 0.079], [0.048, 0.062], [0.043, 0.026], [0, 0.015],
    ], 20)
    emit('ceramic', vessel, body, 'rounded-vessel')

    const base = section([[0.031, 0.008], [0.031, 0], [0.034, 0], [0.035, 0.003], [0.035, 0.010]], 16)
    emit('metal', base, body, 'foot-ring')

    if (config.lid) {
      const dome = section([
        [0, 0.0905], [0.037, 0.0905], [0.039, 0.092], [0.036, 0.097],
        [0.029, 0.1015], [0.018, 0.105], [0, 0.106],
      ], 20)
      emit('ceramic', dome, lid, 'domed-lid')
      const rim = section([[0.039, 0.089], [0.041, 0.0895], [0.041, 0.091], [0.039, 0.092]], 20)
      emit('metal', rim, lid, 'lid-rim')
      // Local ordered profile closes both axis ends; `revolve()` sorts normalized stations and cannot
      // express this returning inner edge without reopening the crown.
      const knob = section([
        [0.010, 0.104], [0.009, 0.107], [0.008, 0.110], [0.0105, 0.114],
        [0.012, 0.118], [0.010, 0.121], [0.006, 0.1225], [0, 0.123],
      ], 16)
      const knobSeat = section([[0.007, 0.104], [0.012, 0.1045], [0.011, 0.106], [0.008, 0.107]], 12)
      emit('moss', knobSeat, lid, 'knob-seat')
      emit('moss', knob, lid, 'lid-knob')
    }

    const side = config.handleSide
    const handleRoot = new Vector3(side * 0.049, 0.059, -0.002)
    const handleDirection = new Vector3(side, 0.30, 0.02).normalize()
    const handleProfile: readonly (readonly [number, number])[] = [
      [0.017, -0.004], [0.013, 0.008], [0.013, 0.018], [0.016, 0.036],
      [0.020, 0.052], [0.0195, 0.055], [0.017, 0.055], [0.015, 0.034], [0, 0.025],
    ]
    emit('moss', orientAtY(section(handleProfile, 16), handleRoot, handleDirection), handle, 'side-cylinder-handle')
    emit('metal', orientAtY(section([[0.0198, 0.052], [0.0202, 0.054], [0.019, 0.056], [0.017, 0.055]], 16), handleRoot, handleDirection), handle, 'handle-lip')

    const spoutRings = [
      new Vector3(-0.010, 0.048, 0.039),
      new Vector3(-0.011, 0.054, 0.056),
      new Vector3(-0.012, 0.065, 0.066),
      new Vector3(-0.013, 0.078, 0.075),
      new Vector3(-0.014, 0.090, 0.086),
    ]
    emit('ceramic', axialSpout(spoutRings, [0.020, 0.017, 0.013, 0.0095, 0.0085], 14), spout, 'short-spout')
    const baseDirection = spoutRings[1]!.clone().sub(spoutRings[0]!).normalize()
    emit('moss', orientAtY(section([[0.017, -0.002], [0.0205, 0], [0.019, 0.004]], 14), spoutRings[0]!, baseDirection), spout, 'spout-junction')
    const direction = spoutRings[4]!.clone().sub(spoutRings[3]!).normalize()
    emit('metal', orientAtY(section([[0.0085, -0.001], [0.009, 0.001], [0.007, 0.002], [0.0065, 0]], 14), spoutRings[4]!, direction), spout, 'spout-rim')
    emit('opening', orientAtY(section([[0.0065, 0], [0.006, -0.008], [0, -0.011]], 14), spoutRings[4]!, direction), spout, 'spout-opening')
  }

  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated })
  let disposed = false
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
    dispose: () => { if (!disposed) { disposed = true; finished.dispose() } },
  }
}

export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) {
  return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch })
}

export function createCafePreview({ aspect }: { aspect: number; time?: number }) {
  return createKkPreview(createModel(), { aspect, framing: 'cafe' })
}
