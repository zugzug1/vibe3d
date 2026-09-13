// kk-002-matcha-station — reference-led cedar tray, chawan, chasen and tea caddy.
// Y-up metres, bottom-centre origin, front +Z. Width/depth remain 0.80 × 0.55 m.
// Reference-proportion override: height ~0.47 m, not the manifest's 0.90 m target;
// stretching the whisk to that target was the cause of the rejected silhouette.
// Coherent ivory ceramic and moss holder; no face-wise glaze patchwork or baked lighting.

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
  acquireKkMaterials,
  bevelBox,
  bevelPrism,
  createKkPreview,
  finishModel,
  mergeParts,
  socket,
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
const DECK_TOP = 0.091
const MAT_TOP = 0.104
const defaults: KkMatchaConfig = { cradle: true, caddies: true }

function box(w: number, h: number, d: number, x: number, y: number, z: number, bevel = 0.006): BufferGeometry {
  const geometry = bevelBox(w, h, d, bevel)
  geometry.translate(x, y, z)
  return geometry
}

/** Closed thrown bowl profile: underside, outer wall, rolled rim, inner wall and dished bottom. */
function lathe(profile: ReadonlyArray<readonly [number, number]>, segments: number, radius: number, height: number, x: number, y: number, z: number, handmade = false): BufferGeometry {
  const positions = new Float32Array(profile.length * segments * 3)
  const uvs = new Float32Array(profile.length * segments * 2)
  const indices: number[] = []
  for (let i = 0; i < profile.length; i++) {
    const [r, t] = profile[i]!
    for (let j = 0; j < segments; j++) {
      const theta = (j / segments) * Math.PI * 2
      const wobble = handmade ? 1 + 0.012 * Math.sin(3 * theta + 0.3) + 0.007 * Math.cos(5 * theta) : 1
      const index = (i * segments + j) * 3
      positions[index] = x + radius * r * Math.sin(theta) * wobble
      positions[index + 1] = y + height * t + (handmade ? 0.002 * Math.sin(3 * theta) * t * t * r : 0)
      positions[index + 2] = z + radius * r * Math.cos(theta) * wobble
      uvs[(i * segments + j) * 2] = j / segments
      uvs[(i * segments + j) * 2 + 1] = t
    }
  }
  for (let i = 0; i < profile.length - 1; i++) for (let j = 0; j < segments; j++) {
    const a = i * segments + j
    const b = i * segments + ((j + 1) % segments)
    const c = (i + 1) * segments + ((j + 1) % segments)
    const d = (i + 1) * segments + j
    // The ascending outer wall faces outward; the returning wall faces inward.
    // Single triangles at the axis close the floors without zero-area pole faces.
    if (profile[i]![0] > 0) indices.push(a, b, d)
    if (profile[i + 1]![0] > 0) indices.push(b, c, d)
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
    [0, 0.026], [0.51, 0.026], [0.54, 0], [0.62, 0], [0.65, 0.042],
    [0.77, 0.085], [0.90, 0.24], [0.97, 0.50], [1.00, 0.85],
    [1.005, 0.975], [0.991, 1], [0.962, 1.005], [0.934, 0.981],
    [0.932, 0.85], [0.906, 0.51], [0.84, 0.29], [0.71, 0.17], [0.48, 0.13], [0, 0.13],
  ], 40, radius, height, x, y, z, true)
}

function straightCaddy(radius: number, height: number, x: number, y: number, z: number): BufferGeometry {
  return lathe([
    [0, 0], [0.9, 0], [0.98, 0.035], [1, 0.09], [1, 0.92], [0.975, 1],
    [0.88, 1], [0.86, 0.1], [0, 0.1],
  ], 28, radius, height, x, y, z)
}

/** Closed rectangular bamboo strip, varying width, with capped ends. */
function strip(points: Vector3[], widths: number[], thickness: number, across: Vector3): BufferGeometry {
  const positions: number[] = []; const indices: number[] = []
  for (let i = 0; i < points.length; i++) {
    const tangent = points[Math.min(i + 1, points.length - 1)]!.clone().sub(points[Math.max(0, i - 1)]!).normalize()
    const side = across.clone().addScaledVector(tangent, -across.dot(tangent)).normalize()
    const normal = side.clone().cross(tangent).normalize()
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = points[i]!.clone().addScaledVector(side, u! * widths[i]! / 2).addScaledVector(normal, v! * thickness / 2)
      positions.push(p.x, p.y, p.z)
    }
  }
  for (let i = 0; i < points.length - 1; i++) for (let j = 0; j < 4; j++) {
    const a = i * 4 + j; const b = i * 4 + (j + 1) % 4; const c = b + 4; const d = a + 4
    indices.push(a, b, d, b, c, d)
  }
  indices.push(0, 2, 1, 0, 3, 2)
  const end = (points.length - 1) * 4
  indices.push(end, end + 1, end + 2, end, end + 2, end + 3)
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!]
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array(points.length * 8), 2))
  g.setIndex(indices); g.computeVertexNormals()
  return g
}

export function createModel(options: KkMatchaOptions = {}): KkMatchaInstance {
  const config: KkMatchaConfig = {
    cradle: options.cradle ?? defaults.cradle,
    caddies: options.caddies ?? defaults.caddies,
  }
  const bundle = acquireKkMaterials({ overrides: options.materials })
  const kit = bundle.materials
  // Same approved warm palette value as the old proxy, but dry bamboo is dielectric.
  // kit.brass is owned by this bundle; the consumer's bamboo override is untouched.
  kit.brass.color.setHex(DERIVED.BRASS)
  kit.brass.metalness = 0; kit.brass.roughness = 0.8
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
  const emit = (group: Group, name: string, slot: Slot | null, parts: BufferGeometry[], fixedMaterial?: Material): void => {
    if (!parts.length) return
    const geometry = mergeParts(parts, `${ID}: ${name}`)
    generated.push(geometry)
    const mesh = new Mesh(geometry, slot ? materials[slot] : fixedMaterial!); mesh.name = `${ID} / ${name}`
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh)
    if (slot) meshesBySlot[slot].push(mesh)
  }
  const release = (): void => {
    for (const group of [tray, bowlPart, cradle, caddies]) group.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }
  const build = (): void => {
    const wood: BufferGeometry[] = []
    wood.push(box(0.766, 0.018, 0.516, 0, DECK_TOP - 0.009, 0, 0.002))
    // Thin perimeter boards, joined at the corners; no oversized round rail caps.
    for (const z of [-D / 2 + 0.009, D / 2 - 0.009]) wood.push(box(W, 0.116, 0.018, 0, 0.091, z, 0.002))
    for (const x of [-W / 2 + 0.009, W / 2 - 0.009]) wood.push(box(0.018, 0.116, 0.512, x, 0.091, 0, 0.002))
    for (const x of [-0.353, 0.353]) for (const z of [-0.228, 0.228]) wood.push(box(0.043, 0.082, 0.044, x, 0.041, z, 0.002))
    wood.push(box(0.014, 0.038, 0.398, -0.05, 0.110, -0.056, 0.0018))
    wood.push(box(0.76, 0.041, 0.013, 0, 0.112, 0.151, 0.0018))
    emit(tray, 'tray-cedar', 'cedar', wood)
    const joinery: BufferGeometry[] = []
    for (const x of [-0.382, 0.382]) for (const z of [-0.275, 0.275]) for (const y of [0.057, 0.119]) {
      joinery.push(box(0.033, 0.012, 0.003, x, y, z, 0.0005))
    }
    emit(tray, 'cedar-corner-keys', 'bamboo', joinery)
    // A small sunk enamel cat silhouette is the reference's front-panel landmark.
    const cat = bevelPrism([[-0.018, -0.02], [-0.013, -0.007], [-0.008, 0.003], [-0.009, 0.015], [-0.014, 0.022], [-0.014, 0.035], [-0.006, 0.029], [0.002, 0.03], [0.008, 0.035], [0.011, 0.024], [0.007, 0.012], [0.014, 0], [0.021, -0.016], [0.018, -0.023]], 0.002, 0)
    cat.translate(0.147, 0.087, 0.2753)
    emit(tray, 'cat-inlay', null, [cat], kit.vermilion)
    const mat: BufferGeometry[] = []
    for (let i = 0; i < 27; i++) mat.push(box(0.408, 0.009, 0.0125, 0.164, MAT_TOP - 0.0045, -0.235 + i * 0.0141, 0.0018))
    emit(tray, 'bamboo-mat', 'bamboo', mat)
    const cords: BufferGeometry[] = []
    for (const x of [-0.017, 0.039, 0.29, 0.346]) {
      const points = Array.from({ length: 55 }, (_, i) => new Vector3(x, MAT_TOP + (i % 2 ? 0.0009 : 0.0016), -0.242 + i * 0.00705))
      cords.push(strip(points, points.map(() => 0.0022), 0.0013, new Vector3(1, 0, 0)))
    }
    emit(tray, 'mat-binding', null, cords, kit.washi)
    emit(bowlPart, 'matcha-bowl', 'ceramic', [bowl(0.173, 0.221, 0.159, MAT_TOP, -0.044)])
    // The fill extends inside the bowl wall at y=.177, leaving a continuous meniscus.
    emit(bowlPart, 'matcha-surface', 'moss', [lathe([[0, 0], [1, 0], [1, 0.8], [0.98, 1], [0, 0.96]], 40, 0.151, 0.003, 0.159, 0.176, -0.044)])
    if (config.caddies) {
      const x = -0.156; const z = -0.168
      emit(caddies, 'tea-caddies', 'ceramic', [straightCaddy(0.065, 0.118, x, DECK_TOP, z)])
      emit(caddies, 'caddy-lid', 'ceramic', [lathe([[0, 0], [0.93, 0], [1, 0.10], [1, 0.85], [0.95, 1], [0, 1]], 28, 0.066, 0.029, x, 0.211, z)])
    }
    if (config.cradle) {
      const x = -0.257; const z = 0.004
      const holder = lathe([[0, 0], [0.83, 0], [0.98, 0.035], [1, 0.12], [0.87, 0.47], [0.67, 0.95], [0.64, 1], [0.55, 1], [0.54, 0.94], [0.68, 0.23], [0, 0.18]], 28, 0.066, 0.111, x, DECK_TOP, z)
      emit(cradle, 'whisk-cradle', 'moss', [holder])
      // A real chasen's grip is below the split fibres, seated inside the ceramic cup.
      emit(cradle, 'whisk-grip', 'bamboo', [lathe([[0, 0], [0.93, 0], [1, 0.035], [1, 0.95], [0.94, 1], [0, 1]], 28, 0.0335, 0.062, x, 0.178, z)])
      emit(cradle, 'whisk-binding', null, [lathe([[0.99, 0], [1.06, 0.1], [1.06, 0.8], [1, 1], [0.94, 1], [0.94, 0], [0.99, 0]], 40, 0.034, 0.009, x, 0.23, z)], kit.ink)
      const tines: BufferGeometry[] = []
      for (let i = 0; i < 40; i++) {
        const a = i / 40 * Math.PI * 2
        const radial = (r: number, y: number): Vector3 => new Vector3(x + Math.cos(a) * r, y, z + Math.sin(a) * r)
        const dy = 0.003 * Math.sin(i * 2.4)
        tines.push(strip([
          radial(0.032, 0.235), radial(0.040, 0.267), radial(0.049, 0.302), radial(0.059, 0.337),
          radial(0.067, 0.37), radial(0.072, 0.399), radial(0.074, 0.421 + dy),
          radial(0.073, 0.437 + dy), radial(0.070, 0.444 + dy), radial(0.067, 0.443 + dy), radial(0.066, 0.437 + dy),
        ], [0.0038, 0.0037, 0.0036, 0.0035, 0.0034, 0.0032, 0.003, 0.0028, 0.0025, 0.0021, 0.0015], 0.0016, new Vector3(-Math.sin(a), 0, Math.cos(a))))
      }
      for (let i = 0; i < 20; i++) {
        const a = (i + 0.5) / 20 * Math.PI * 2
        const radial = (r: number, y: number): Vector3 => new Vector3(x + Math.cos(a) * r, y, z + Math.sin(a) * r)
        tines.push(strip([radial(0.029, 0.237), radial(0.023, 0.286), radial(0.017, 0.34), radial(0.012, 0.391), radial(0.018, 0.42), radial(0.017, 0.436), radial(0.01, 0.444), radial(0.004, 0.44)], [0.003, 0.003, 0.0027, 0.0024, 0.0022, 0.002, 0.0017, 0.001], 0.0013, new Vector3(-Math.sin(a), 0, Math.cos(a))))
      }
      emit(cradle, 'whisk-bristles', 'bamboo', tines)
    }
    emit(tray, 'front-spoon', 'bamboo', [strip([
      new Vector3(-0.12, 0.124, 0.207), new Vector3(-0.119, 0.113, 0.207), new Vector3(-0.105, 0.104, 0.207),
      new Vector3(-0.076, 0.098, 0.207), new Vector3(-0.04, 0.095, 0.207), new Vector3(0.07, 0.095, 0.207),
      new Vector3(0.24, 0.095, 0.207), new Vector3(0.333, 0.095, 0.207), new Vector3(0.337, 0.095, 0.207),
    ], [0.014, 0.027, 0.031, 0.029, 0.021, 0.013, 0.012, 0.012, 0.006], 0.005, new Vector3(0, 0, 1))])
    emit(tray, 'folded-cloth', null, [box(0.209, 0.012, 0.078, -0.263, 0.097, 0.205, 0.003), box(0.196, 0.014, 0.073, -0.269, 0.108, 0.207, 0.0035)], kit.indigo)
  }
  const recentre = (): void => {
    assembly.position.set(0, 0, 0); assembly.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(assembly as never)
    if (!bounds.isEmpty()) assembly.position.set(-bounds.getCenter(new Vector3()).x, -bounds.min.y, -bounds.getCenter(new Vector3()).z)
  }
  const rebuild = (): void => { release(); build(); recentre() }
  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated, sockets: [socket('anchor-tray', [0, 0, 0])] })
  let disposed = false
  return {
    root, parts: { tray, bowl: bowlPart, cradle, caddies }, materials,
    getConfig: () => ({ ...config }),
    configure(patch) { if (disposed) return; if (patch.cradle !== undefined) config.cradle = Boolean(patch.cradle); if (patch.caddies !== undefined) config.caddies = Boolean(patch.caddies); rebuild() },
    setMaterial(slot, material) {
      materials[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() { if (disposed) return; disposed = true; finished.dispose() },
  }
}

export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) {
  return createKkPreview(createModel(), { aspect, yaw, pitch })
}
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) {
  return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' })
}
