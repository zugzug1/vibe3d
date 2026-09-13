// kk-006-feeding-station — a raised twin-bowl ceramic feeding station in a low cedar frame.
// DATUM. Manifest kk-006: 0.50 W × 0.30 D × 0.18 H m, authored target. Y-up, metres,
// bottom-centre origin, front = +Z. Bowls are the identity; the frame stays quiet and structural.

import { Box3, BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial, Vector3, type Material } from 'three/webgpu'
import { acquireKkMaterials, bevelBox, createKkPreview, finishModel, mergeParts, socket } from '../kk-core/index.ts'

const ID = 'kk-006-feeding-station'
type Slot = 'cedar' | 'ceramic'
export interface KkFeederConfig { bowls: boolean }
export interface KkFeederOptions extends Partial<KkFeederConfig> { materials?: Partial<Record<Slot, MeshStandardMaterial>> }
export interface KkFeederInstance {
  readonly root: Group
  readonly parts: { frame: Group; bowlLeft: Group; bowlRight: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkFeederConfig>
  configure(patch: Partial<KkFeederConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, bevel = 0.004): BufferGeometry {
  const geometry = bevelBox(w, h, d, bevel)
  geometry.translate(x, y, z)
  return geometry
}

function bowl(radius: number, height: number, x: number, y: number, z: number): BufferGeometry {
  const profile: ReadonlyArray<readonly [number, number]> = [
    [0.02, 0.00], [0.34, 0.00], [0.58, 0.10], [0.86, 0.78],
    [0.98, 0.98], [1.04, 1.00], [0.94, 0.96], [0.84, 0.84],
    [0.73, 0.61], [0.57, 0.38], [0.36, 0.18], [0.08, 0.13], [0.00, 0.13],
  ]
  const segments = 24
  const positions = new Float32Array(profile.length * segments * 3)
  const uvs = new Float32Array(profile.length * segments * 2)
  const indices: number[] = []
  for (let i = 0; i < profile.length; i++) {
    const [r, t] = profile[i]!
    for (let j = 0; j < segments; j++) {
      const theta = (j / segments) * Math.PI * 2
      const index = (i * segments + j) * 3
      positions[index] = x + radius * r * Math.sin(theta)
      positions[index + 1] = y + height * t
      positions[index + 2] = z + radius * r * Math.cos(theta)
      uvs[(i * segments + j) * 2] = j / segments
      uvs[(i * segments + j) * 2 + 1] = t
    }
  }
  for (let i = 0; i < profile.length - 1; i++) for (let j = 0; j < segments; j++) {
    const a = i * segments + j
    const b = i * segments + ((j + 1) % segments)
    const c = (i + 1) * segments + ((j + 1) % segments)
    const d = (i + 1) * segments + j
    indices.push(a, b, d, b, c, d)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createModel(options: KkFeederOptions = {}): KkFeederInstance {
  const config: KkFeederConfig = { bowls: options.bowls ?? true }
  const bundle = acquireKkMaterials({ overrides: options.materials })
  const kit = bundle.materials
  const materials: Record<Slot, Material> = { cedar: options.materials?.cedar ?? kit.cedar, ceramic: options.materials?.ceramic ?? kit.glaze }
  const root = new Group(); root.name = ID
  const frame = new Group(); frame.name = 'frame'; const bowlLeft = new Group(); bowlLeft.name = 'bowl-left'; const bowlRight = new Group(); bowlRight.name = 'bowl-right'
  root.add(frame, bowlLeft, bowlRight)
  const generated: BufferGeometry[] = []; const meshesBySlot: Record<Slot, Mesh[]> = { cedar: [], ceramic: [] }
  const emit = (group: Group, slot: Slot, name: string, parts: BufferGeometry[]): void => {
    const geometry = mergeParts(parts, `${ID}: ${name}`); generated.push(geometry)
    const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); meshesBySlot[slot].push(mesh)
  }
  const release = (): void => { frame.clear(); bowlLeft.clear(); bowlRight.clear(); for (const geometry of generated) geometry.dispose(); generated.length = 0; for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0 }
  const rebuild = (): void => {
    release()
    const wood: BufferGeometry[] = [
      box(0.46, 0.035, 0.27, 0, 0.105, 0, 0.006),
      box(0.46, 0.055, 0.035, 0, 0.065, 0.117, 0.004),
      box(0.46, 0.055, 0.035, 0, 0.065, -0.117, 0.004),
      box(0.035, 0.055, 0.20, -0.212, 0.065, 0, 0.004),
      box(0.035, 0.055, 0.20, 0.212, 0.065, 0, 0.004),
    ]
    for (const x of [-0.19, 0.19]) for (const z of [-0.105, 0.105]) wood.push(box(0.055, 0.07, 0.055, x, 0.035, z, 0.004))
    emit(frame, 'cedar', 'cedar-frame', wood)
    if (config.bowls) {
      emit(bowlLeft, 'ceramic', 'bowl-left', [bowl(0.098, 0.078, -0.115, 0.125, 0)])
      emit(bowlRight, 'ceramic', 'bowl-right', [bowl(0.098, 0.078, 0.115, 0.125, 0)])
    }
    frame.updateMatrixWorld(true); const bounds = new Box3().setFromObject(root as never); const centre = bounds.getCenter(new Vector3()); root.position.set(-centre.x, -bounds.min.y, -centre.z)
  }
  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated, sockets: [socket('anchor-feeder', [0, 0.08, 0])] })
  return {
    root, parts: { frame, bowlLeft, bowlRight }, materials,
    getConfig: () => ({ ...config }),
    configure(patch) { if (patch.bowls !== undefined) config.bowls = Boolean(patch.bowls); rebuild() },
    setMaterial(slot, material) { materials[slot] = material; for (const mesh of meshesBySlot[slot]) mesh.material = material },
    update: () => {}, dispose() { finished.dispose() },
  }
}

export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
