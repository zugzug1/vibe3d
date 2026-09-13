// kk-002-matcha-station — a compact cedar matcha preparation tray with an inset bowl,
// bamboo whisk cradle, two tea caddies and a shallow front utensil slot.
//
// DATUM. Manifest kk-002: 0.80 W × 0.55 D × 0.90 H m, authored target. Y-up, metres,
// bottom-centre origin, front = +Z. The tall whisk cradle closes the 0.90 m silhouette.
// Loose flowers, writing and painted motifs remain omitted; those belong to other roster assets.

import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  DERIVED,
  TOKEN,
  acquireKkMaterials,
  bevelBox,
  bevelDisc,
  bevelRing,
  createKkPreview,
  finishModel,
  mergeParts,
  revolve,
  socket,
  taperedTube,
  tubeSection,
  AXIS_Y,
  AXIS_Z,
} from '../kk-core/index.ts'

const ID = 'kk-002-matcha-station'
type Slot = 'cedar' | 'ceramic' | 'moss' | 'bamboo'

export interface KkMatchaConfig { cradle: boolean; caddies: boolean }
export interface KkMatchaOptions extends Partial<KkMatchaConfig> {
  materials?: Partial<Record<Slot, MeshStandardMaterial>>
}
export interface KkMatchaInstance {
  readonly root: Group
  readonly parts: { tray: Group; bowl: Group; cradle: Group; caddies: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkMatchaConfig>
  configure(patch: Partial<KkMatchaConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const W = 0.8
const D = 0.55
const MAT_TOP = 0.149
const defaults: KkMatchaConfig = { cradle: true, caddies: true }

function box(w: number, h: number, d: number, x: number, y: number, z: number, bevel = 0.006): BufferGeometry {
  const geometry = bevelBox(w, h, d, bevel)
  geometry.translate(x, y, z)
  return geometry
}

/** Closed thrown bowl profile: underside, outer wall, rolled rim, inner wall and dished bottom. */
function lathe(profile: ReadonlyArray<readonly [number, number]>, segments: number, radius: number, height: number, x: number, y: number, z: number): BufferGeometry {
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

/** Ordered exterior/interior profile; the inner floor is closed instead of relying on backface visibility. */
function bowl(radius: number, height: number, x: number, y: number, z: number): BufferGeometry {
  return lathe([
    [0.02, 0.00], [0.34, 0.00], [0.58, 0.10], [0.84, 0.38], [0.96, 0.78],
    [1.02, 0.93], [1.04, 0.96], [1.02, 0.985], [0.99, 1.00], // 4–5 mm rolled lip
    [0.94, 0.96], [0.84, 0.78], [0.74, 0.52], [0.66, 0.25], [0.62, 0.15], [0.00, 0.15],
  ], 28, radius, height, x, y, z)
}

function straightCaddy(radius: number, height: number, x: number, y: number, z: number): BufferGeometry {
  return lathe([
    [0.02, 0.00], [0.98, 0.00], [1.00, 0.08], [1.00, 0.92], [0.98, 0.98],
    [0.88, 0.98], [0.88, 0.16], [0.02, 0.16],
  ], 20, radius, height, x, y, z)
}

export function createModel(options: KkMatchaOptions = {}): KkMatchaInstance {
  const config: KkMatchaConfig = {
    cradle: options.cradle ?? defaults.cradle,
    caddies: options.caddies ?? defaults.caddies,
  }
  const bundle = acquireKkMaterials({ overrides: options.materials })
  const kit = bundle.materials
  const materials: Record<Slot, Material> = {
    cedar: options.materials?.cedar ?? kit.cedarDark,
    ceramic: options.materials?.ceramic ?? kit.glaze,
    moss: options.materials?.moss ?? kit.glazeMoss,
    bamboo: options.materials?.bamboo ?? kit.brass,
  }
  const root = new Group(); root.name = ID
  const assembly = new Group(); assembly.name = 'assembly'; root.add(assembly)
  const tray = new Group(); tray.name = 'tray'
  const bowlPart = new Group(); bowlPart.name = 'bowl'
  const cradle = new Group(); cradle.name = 'whisk-cradle'
  const caddies = new Group(); caddies.name = 'caddies'
  assembly.add(tray, bowlPart, cradle, caddies)
  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { cedar: [], ceramic: [], moss: [], bamboo: [] }
  const emit = (group: Group, name: string, slot: Slot, parts: BufferGeometry[]): void => {
    if (!parts.length) return
    const geometry = mergeParts(parts, `${ID}: ${name}`)
    generated.push(geometry)
    const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); meshesBySlot[slot].push(mesh)
  }
  const release = (): void => {
    for (const group of [tray, bowlPart, cradle, caddies]) group.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }
  const build = (): void => {
    const wood: BufferGeometry[] = []
    wood.push(box(0.72, 0.06, 0.47, 0, 0.055, 0, 0.008))
    wood.push(box(0.76, 0.09, 0.035, 0, 0.115, 0.235, 0.006))
    wood.push(box(0.76, 0.09, 0.035, 0, 0.115, -0.235, 0.006))
    wood.push(box(0.035, 0.09, 0.43, -0.362, 0.115, 0, 0.006))
    wood.push(box(0.035, 0.09, 0.43, 0.362, 0.115, 0, 0.006))
    for (const x of [-0.31, 0.31]) for (const z of [-0.19, 0.19]) wood.push(box(0.075, 0.07, 0.075, x, 0.035, z, 0.005))
    // Divided tray: the right bay receives the bamboo mat, the front channel stays open for the spoon.
    wood.push(box(0.025, 0.07, 0.32, 0.015, 0.15, 0.02, 0.004))
    wood.push(box(0.68, 0.045, 0.025, 0, 0.145, 0.12, 0.004))
    emit(tray, 'tray-cedar', 'cedar', wood)
    const mat: BufferGeometry[] = []
    for (let i = 0; i < 10; i++) mat.push(box(0.28, 0.008, 0.012, 0.20, 0.145, -0.16 + i * 0.028, 0.002))
    emit(tray, 'bamboo-mat', 'bamboo', mat)
    emit(bowlPart, 'matcha-bowl', 'ceramic', [bowl(0.18, 0.15, 0.20, MAT_TOP, 0.045)])
    const tea = bevelDisc(0.12, 0.006, 0.002, 24)
    tea.rotateX(Math.PI / 2); tea.translate(0.20, MAT_TOP + 0.15 * 0.16 + 0.004, 0.045)
    emit(bowlPart, 'matcha-surface', 'moss', [tea])
    if (config.caddies) {
      const tin: BufferGeometry[] = []
      for (const x of [-0.19, -0.02]) {
        tin.push(straightCaddy(0.075, 0.11, x, MAT_TOP, -0.11))
        const lid = bevelDisc(0.073, 0.008, 0.002, 20)
        lid.rotateX(Math.PI / 2); lid.translate(x, MAT_TOP + 0.11 + 0.004, -0.11)
        tin.push(lid)
      }
      emit(caddies, 'tea-caddies', 'ceramic', tin)
    }
    if (config.cradle) {
      const cradleParts: BufferGeometry[] = [
        box(0.025, 0.12, 0.025, -0.26, 0.25, -0.10, 0.004),
        box(0.025, 0.12, 0.025, -0.08, 0.25, -0.10, 0.004),
        box(0.21, 0.025, 0.025, -0.17, 0.31, -0.10, 0.004),
        tubeSection(0.028, 0.04, [-0.17, 0.33, -0.10], AXIS_Y, 16),
        taperedTube([new Vector3(-0.17, 0.46, -0.10), new Vector3(-0.17, 0.50, -0.10), new Vector3(-0.17, 0.54, -0.10)], 0.009, 8),
      ]
      emit(cradle, 'whisk-cradle', 'bamboo', cradleParts)
      const tines: BufferGeometry[] = []
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2
        const radial = (r: number, y: number): Vector3 => new Vector3(-0.17 + Math.cos(angle) * r, y, -0.10 + Math.sin(angle) * r)
        tines.push(taperedTube([
          radial(0.008, 0.35), radial(0.030, 0.375), radial(0.058, 0.405),
          radial(0.064, 0.445), radial(0.046, 0.475),
        ], 0.0035, 6))
      }
      emit(cradle, 'whisk-bristles', 'bamboo', tines)
    }
    emit(tray, 'front-spoon', 'bamboo', [taperedTube([
      new Vector3(-0.27, 0.18, 0.19), new Vector3(-0.08, 0.17, 0.19), new Vector3(0.16, 0.17, 0.19),
    ], 0.012, 8)])
  }
  const recentre = (): void => {
    assembly.position.set(0, 0, 0); assembly.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(assembly as never)
    if (!bounds.isEmpty()) assembly.position.set(-bounds.getCenter(new Vector3()).x, -bounds.min.y, -bounds.getCenter(new Vector3()).z)
  }
  const rebuild = (): void => { release(); build(); recentre() }
  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated, sockets: [socket('anchor-tray', [0, 0, 0])] })
  return {
    root, parts: { tray, bowl: bowlPart, cradle, caddies }, materials,
    getConfig: () => ({ ...config }),
    configure(patch) { if (patch.cradle !== undefined) config.cradle = Boolean(patch.cradle); if (patch.caddies !== undefined) config.caddies = Boolean(patch.caddies); rebuild() },
    setMaterial(slot, material) { materials[slot] = material; for (const mesh of meshesBySlot[slot]) mesh.material = material },
    update: () => {},
    dispose() { finished.dispose() },
  }
}

export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) {
  return createKkPreview(createModel(), { aspect, yaw, pitch })
}
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) {
  return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' })
}
