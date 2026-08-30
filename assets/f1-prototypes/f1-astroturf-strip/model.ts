// f1-astroturf-strip — 2.0 m Grade 1 artificial-grass verge. Dark soil bed,
// two-tone mown pile as a displaced carpet (not Minecraft card blades).
//
// Three descriptions agree about the same surface, each at the scale it can
// actually carry:
//
//   geometry   tuft clumping, crushed patches, the roll joints and the hem,
//              cut deep enough for the dark under-carpet to read through;
//   vertex     the mow, the wear blotches, the sun bleach and the rubber —
//              everything that must sit at a fixed world position;
//   detail map fibre-scale colour, sheen and relief, tiling at ~1 mm a texel,
//              which is finer than the reference camera resolves.
//
// Splitting it that way is what stops the verge reading as printed wallpaper:
// no mow band has a ruled edge, a constant strength, or a clean surface.

import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  type Material,
} from 'three/webgpu'

import {
  ASTROTURF,
  TOKEN,
  acquireF1Materials,
  bevelBox,
  createF1Preview,
  disposeF1Materials,
  shade,
} from '../f1-kit-core/index.ts'

type Slot = 'mat'

export interface F1AstroturfStripConfig {
  modules: number
  /** Blade spacing in metres. Sheet default 0.05; scene uses ~0.22. */
  pileStep: number
}

export interface F1AstroturfStripOptions extends Partial<F1AstroturfStripConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1AstroturfStripInstance {
  readonly root: Group
  readonly parts: { mat: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1AstroturfStripConfig>
  configure(patch: Partial<F1AstroturfStripConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1AstroturfStripConfig = { modules: 6, pileStep: 0.05 }
const BAND = ASTROTURF.pitch
const WIDTH = ASTROTURF.width
const THICK = ASTROTURF.thick
const PILE = 0.042
/** Mow band pitch across the 2.0 m lay. */
const MOW = 0.5
const RIM = 0.045
/** Pile height, as a fraction of PILE, at which the dark under-carpet shows. */
const DARK_TOP = 0.52
/** Half-width of a module joint, and how far it wanders off the ruled line. */
const SEAM_HALF = 0.026
const SEAM_WANDER = 0.055
/** How far in from the sheet perimeter the pile tucks down toward the bed. */
const HEM = 0.026
/** How deep the pile's backing is bedded into the soil bed (rule 8: a bite). */
const BED_BITE = 0.003

/**
 * The fibre detail tile. Every feature count below is per tile and integral, so
 * the maps wrap seamlessly instead of printing a half-metre grid on the verge.
 */
const TILE = 0.5
const TILE_TEXELS = 512
/** Stitch rows per tile: TILE / 36 puts the tuft rows at a realistic 14 mm. */
const ROWS = 36
/** Fibre cells per tile — elongated along the roll, as a tufted lay is. */
const FIBRE_U = 60
const FIBRE_V = 150
/** Cells per tile for the tuft clumps and the stitch-row jitter. */
const CLUMP = 11
const JITTER = 10

type Rgb = readonly [number, number, number]

function rgb(hex: number): Rgb {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]
}

function mix3(a: Rgb, b: Rgb, t: number): Rgb {
  const k = t < 0 ? 0 : t > 1 ? 1 : t
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

/**
 * Pushes a colour away from its own luminance. Neither the sage field token nor
 * the lime signal is a pure green alone, and their blend carries more blue and
 * red than a turf fibre does.
 */
function saturate(c: Rgb, amount: number): Rgb {
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  return [l + (c[0] - l) * amount, l + (c[1] - l) * amount, l + (c[2] - l) * amount]
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = (x - edge0) / (edge1 - edge0)
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return c * c * (3 - 2 * c)
}

function fract(x: number): number {
  return x - Math.floor(x)
}

/** Vertex colours are consumed in the renderer's linear working space. */
function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function hash2(x: number, y: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453)
}

/**
 * Value noise. Non-zero cell counts wrap the lattice on that axis, which is what
 * lets the detail maps tile; unequal counts stretch the blobs into fibres.
 */
function latticeNoise(x: number, y: number, cellsX = 0, cellsY = 0): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smoothstep(0, 1, x - xi)
  const yf = smoothstep(0, 1, y - yi)
  const x0 = cellsX > 0 ? ((xi % cellsX) + cellsX) % cellsX : xi
  const x1 = cellsX > 0 ? (((xi + 1) % cellsX) + cellsX) % cellsX : xi + 1
  const y0 = cellsY > 0 ? ((yi % cellsY) + cellsY) % cellsY : yi
  const y1 = cellsY > 0 ? (((yi + 1) % cellsY) + cellsY) % cellsY : yi + 1
  const a = hash2(x0, y0)
  const b = hash2(x1, y0)
  const c = hash2(x0, y1)
  const d = hash2(x1, y1)
  const top = a + (b - a) * xf
  return top + (c + (d - c) * xf - top) * yf
}

function fbm(x: number, y: number): number {
  return (
    latticeNoise(x, y) * 0.57 +
    latticeNoise(x * 2.13 + 5.2, y * 2.13 - 1.7) * 0.29 +
    latticeNoise(x * 4.71 - 3.1, y * 4.71 + 9.4) * 0.14
  )
}

/**
 * 1 on a module joint, 0 clear of it. Joints sit on the module grid, so only
 * the nearest one can matter — a hundred-module verge costs the same as one.
 * The joint wanders laterally because a verge is laid in rolls, not ruled.
 */
function seamMask(x: number, z: number, length: number, modules: number): number {
  const k = Math.round((x + length / 2) / BAND)
  if (k < 1 || k > modules - 1) return 0
  const sx = k * BAND - length / 2 + (fbm(z * 0.85 + k * 4.7, k * 2.9) - 0.5) * SEAM_WANDER
  return 1 - smoothstep(SEAM_HALF * 0.16, SEAM_HALF, Math.abs(x - sx))
}

/** Broad crushed-and-dirtied patches. Shared by the relief and the shading. */
function wearPatch(x: number, z: number): number {
  return fbm(x * 1.35 + 11.3, z * 1.35 - 4.6)
}

/**
 * Pile height from the noise field alone, as a fraction of {@link PILE}: tuft
 * clumping, the crushed patches, and a per-cell stipple fine enough that each
 * vertex breaks from its neighbour instead of smoothing into upholstery. A laid
 * verge is flat, so nothing here has a long wavelength.
 */
function pileField(x: number, z: number, patch: number): number {
  const tuft = fbm(x * 9.5 + 1.7, z * 9.5 - 2.3)
  const stipple = hash2(Math.round(x * 137), Math.round(z * 149)) - 0.5
  const h = 0.9 + (tuft - 0.5) * 0.2 + (patch - 0.5) * 0.08 + stipple * 0.1
  return h - smoothstep(0.5, 0.88, patch) * 0.12
}

/**
 * Two-tone mow value at a point, 0 dim to 1 lit.
 *
 * A band is flat in its middle and feathers into its neighbour, its edge
 * wanders, its strength fades in and out *along* its own length, and the pile
 * leans so each band is brighter on one side. Those four together are what
 * separates a mown lay from a printed stripe.
 */
function mowTone(x: number, z: number, halfW: number): number {
  const wander = (fbm(x * 0.55 + 2.4, 3.1) - 0.5) * 0.11
  const bandF = (z + halfW + wander) / MOW
  const band = Math.floor(bandF)
  const inBand = bandF - band
  const flat = Math.min(smoothstep(0, 0.11, inBand), smoothstep(0, 0.11, 1 - inBand))
  const strength = 0.4 + 0.6 * fbm(x * 0.28 + band * 13.7, band * 5.1 + 2.2)
  const parity = band % 2 === 0 ? 1 : 0
  const lean = (inBand - 0.5) * (parity === 1 ? 0.24 : -0.24)
  return 0.5 + (parity - 0.5) * flat * strength * 1.8 + lean
}

interface Scuff {
  readonly x: number
  readonly z: number
  readonly r: number
  readonly rubber: number
  readonly k: number
}

/** Cell width of the scuff lookup, in metres. */
const SCUFF_CELL = 0.5

/**
 * Rubber pickup and dragged dirt, bucketed along the strip. Marbles arrive from
 * the track, so the distribution is biased hard toward the -Z edge; the buckets
 * keep a hundred-module verge as cheap per vertex as a one-module sheet.
 */
function scuffBuckets(length: number, width: number): Map<number, Scuff[]> {
  const buckets = new Map<number, Scuff[]>()
  const count = Math.max(6, Math.round(length * 3))
  for (let i = 0; i < count; i++) {
    const hr = hash2(i * 1.9 + 4.4, 3.1)
    const scuff: Scuff = {
      x: (hash2(i * 3.7 + 0.5, 1.3) - 0.5) * length,
      z: -width / 2 + Math.pow(hash2(i * 5.1 + 2.7, 8.9), 1.9) * width,
      r: 0.1 + hr * 0.22,
      rubber: hash2(i * 7.3 + 6.6, 5.5),
      k: 0.5 + hr * 0.45,
    }
    const lo = Math.floor((scuff.x - scuff.r) / SCUFF_CELL)
    const hi = Math.floor((scuff.x + scuff.r) / SCUFF_CELL)
    for (let c = lo; c <= hi; c++) {
      const cell = buckets.get(c)
      if (cell) cell.push(scuff)
      else buckets.set(c, [scuff])
    }
  }
  return buckets
}

function makeTexture(data: Uint8Array, n: number, srgb: boolean): DataTexture {
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType)
  if (srgb) tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

interface PileDetail {
  readonly map: DataTexture
  readonly roughnessMap: DataTexture
  readonly normalMap: DataTexture
  /** Mean linear value of the detail albedo, divided back out of the mow. */
  readonly meanLinear: number
}

/**
 * The fibre-scale half of the surface: stitched tuft rows, individual fibres
 * elongated along the roll, occasional brown thatch, and the sheen difference
 * between a fibre tip and the shade between two rows. One height field drives
 * all three maps, so the colour, the gloss and the relief cannot disagree.
 */
function pileDetail(): PileDetail {
  const n = TILE_TEXELS
  const px = TILE / n
  const field = new Float32Array(n * n)
  let lo = Infinity
  let hi = -Infinity

  for (let y = 0; y < n; y++) {
    const sv = (y + 0.5) / n
    const row = Math.floor(sv * ROWS)
    for (let x = 0; x < n; x++) {
      const su = (x + 0.5) / n
      const jitter = hash2(row, Math.floor(su * JITTER)) * 0.6
      const ridge = 1 - Math.abs(fract(sv * ROWS + jitter) - 0.5) * 2
      const fibre = latticeNoise(su * FIBRE_U, sv * FIBRE_V, FIBRE_U, FIBRE_V)
      const clump = latticeNoise(su * CLUMP, sv * CLUMP, CLUMP, CLUMP)
      const h = ridge * 0.0018 + (fibre - 0.5) * 0.0044 + (clump - 0.5) * 0.0035
      field[y * n + x] = h
      if (h < lo) lo = h
      if (h > hi) hi = h
    }
  }

  const albedo = new Uint8Array(n * n * 4)
  const rough = new Uint8Array(n * n * 4)
  const normal = new Uint8Array(n * n * 4)
  const thatch = rgb(shade(TOKEN.DUST_300, -0.34))
  const span = hi - lo || 1
  let sum = 0

  for (let y = 0; y < n; y++) {
    const up = ((y + 1) % n) * n
    const down = ((y - 1 + n) % n) * n
    const row = y * n
    for (let x = 0; x < n; x++) {
      const i = (row + x) * 4
      const t = (field[row + x]! - lo) / span

      // Fibre tips catch the light; the shade between two stitch rows does not.
      const dither = hash2(x * 3.1, y * 5.7) - 0.5
      const value = 0.7 + t * 0.44 + dither * 0.085
      // A minority of fibres in a Grade 1 lay are brown thatch.
      const isThatch = hash2(Math.floor(x / 4), Math.floor(y / 4)) > 0.93 ? 0.5 : 0
      const tint = mix3([255, 255, 255], thatch, isThatch)
      albedo[i] = Math.max(0, Math.min(255, Math.round(tint[0] * value)))
      albedo[i + 1] = Math.max(0, Math.min(255, Math.round(tint[1] * value)))
      albedo[i + 2] = Math.max(0, Math.min(255, Math.round(tint[2] * value)))
      albedo[i + 3] = 255
      sum += srgbToLinear(albedo[i + 1]!)

      // Barely glossy: enough for the tips to catch the key, not enough for the
      // cool fill to grey the green out.
      const gloss = Math.round((0.99 - t * 0.1) * 255)
      rough[i] = gloss
      rough[i + 1] = gloss
      rough[i + 2] = gloss
      rough[i + 3] = 255

      const right = (x + 1) % n
      const left = (x - 1 + n) % n
      const du = (field[row + right]! - field[row + left]!) / (2 * px)
      const dv = (field[up + x]! - field[down + x]!) / (2 * px)
      const len = Math.hypot(du, dv, 1)
      normal[i] = Math.round(((-du / len) * 0.5 + 0.5) * 255)
      normal[i + 1] = Math.round(((-dv / len) * 0.5 + 0.5) * 255)
      normal[i + 2] = Math.round((1 / len) * 0.5 * 255 + 127.5)
      normal[i + 3] = 255
    }
  }

  return {
    map: makeTexture(albedo, n, true),
    roughnessMap: makeTexture(rough, n, false),
    normalMap: makeTexture(normal, n, false),
    meanLinear: sum / (n * n),
  }
}

export function createModel(options: F1AstroturfStripOptions = {}): F1AstroturfStripInstance {
  const config: F1AstroturfStripConfig = {
    modules: Math.max(1, Math.round(options.modules ?? defaults.modules)),
    pileStep: options.pileStep != null && Number.isFinite(options.pileStep) && options.pileStep > 0
      ? options.pileStep
      : defaults.pileStep,
  }

  const bundle = acquireF1Materials()
  const extras: Material[] = []
  const supplied = options.materials?.mat
  // Rule 16: the generated maps are only ever stamped onto a material we own.
  const detail = supplied ? null : pileDetail()
  const ownPileMat = detail
    ? new MeshStandardMaterial({
      name: 'f1-kit / astroturf',
      // White: the mow, the wear and the weathering ride on the vertex colour.
      color: 0xffffff,
      map: detail.map,
      roughnessMap: detail.roughnessMap,
      normalMap: detail.normalMap,
      roughness: 1,
      metalness: 0,
      vertexColors: true,
    })
    : null
  if (ownPileMat) {
    ownPileMat.normalScale.set(1.15, 1.15)
    extras.push(ownPileMat)
  }
  const materialSlots: Record<Slot, Material> = { mat: supplied ?? ownPileMat! }

  const bedMat = new MeshStandardMaterial({
    name: 'f1-kit / astroturf bed',
    color: shade(TOKEN.FIELD_500, -0.84),
    roughness: 1,
    metalness: 0,
  })
  const pileDark = new MeshStandardMaterial({
    name: 'f1-kit / astroturf pile',
    color: shade(TOKEN.FIELD_500, -0.72),
    roughness: 0.97,
    metalness: 0,
  })
  extras.push(bedMat, pileDark)

  // Turf green is warmer and more saturated than the kit's sage field token, so
  // the pile is pulled toward the lime signal and then off its own luminance.
  // The values are low on purpose: this kit's rig stacks key, fill, rim and
  // hemisphere, and a mid-green albedo blows out to pale mint under it.
  const lit = saturate(
    mix3(rgb(shade(TOKEN.FIELD_500, -0.66)), rgb(shade(TOKEN.LIME_400, -0.75)), 0.4),
    1.4,
  )
  const dim = saturate(
    mix3(rgb(shade(TOKEN.FIELD_500, -0.82)), rgb(shade(TOKEN.LIME_400, -0.87)), 0.4),
    1.4,
  )
  const bleached = mix3(
    rgb(shade(TOKEN.FIELD_500, -0.6)),
    rgb(shade(TOKEN.DUST_300, -0.74)),
    0.55,
  )
  const rubber = rgb(shade(TOKEN.INK_900, -0.35))
  const dirt = rgb(shade(TOKEN.DUST_300, -0.86))

  const root = new Group()
  root.name = 'f1-astroturf-strip'
  const mat = new Group(); mat.name = 'mat'
  root.add(mat)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { mat: [] }

  const releaseGenerated = (): void => {
    mat.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    meshesBySlot.mat.length = 0
  }

  const emit = (geometry: BufferGeometry, material: Material, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.castShadow = name === 'bed'
    mesh.receiveShadow = true
    meshesBySlot.mat.push(mesh)
    mat.add(mesh)
  }

  const rebuild = (): void => {
    releaseGenerated()
    const length = config.modules * BAND
    const bed = bevelBox(length, THICK, WIDTH, 0.004)
    bed.translate(0, THICK / 2, 0)
    emit(bed, bedMat, 'bed')

    const innerL = length - RIM * 2
    const innerW = WIDTH - RIM * 2
    const halfL = innerL / 2
    const halfW = innerW / 2

    // The backing is bedded into the soil rather than parked on it, so the
    // under-carpet bites in instead of grazing the bed's top face.
    const underH = PILE * DARK_TOP + BED_BITE
    const under = bevelBox(innerL, underH, innerW, 0.006)
    under.translate(0, THICK - BED_BITE + underH / 2, 0)
    emit(under, pileDark, 'pile-dark')

    const step = Math.min(config.pileStep, 0.08)
    const nx = Math.max(24, Math.round(innerL / step))
    const nz = Math.max(16, Math.round(innerW / step))
    const pile = new PlaneGeometry(innerL, innerW, nx, nz)
    pile.rotateX(-Math.PI / 2)
    const pos = pile.getAttribute('position')
    const scuffs = scuffBuckets(innerL, innerW)
    const shading = detail ? new Float32Array(pos.count * 3) : null

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const patch = wearPatch(x, z)
      // The joints and the hem cut below DARK_TOP, which is what lets the dark
      // under-carpet read through them instead of a painted line.
      const hem = Math.max(
        1 - Math.min(1, (halfW - Math.abs(z)) / HEM),
        1 - Math.min(1, (halfL - Math.abs(x)) / HEM),
      )
      const h = pileField(x, z, patch) -
        seamMask(x, z, length, config.modules) * 0.42 -
        hem * 0.3
      pos.setY(i, THICK + PILE * Math.max(0.3, Math.min(1.14, h)))

      if (!shading || !detail) continue

      const worn = smoothstep(0.5, 0.88, patch)
      let tone = mowTone(x, z, halfW)
      tone += (0.4 - tone) * worn * 0.75
      let colour = mix3(dim, lit, tone)

      // Sun bleach: the exposed long edges fade pale and desaturate.
      const exposure = 1 - Math.min(1, (halfW - Math.abs(z)) / 0.24)
      if (exposure > 0) {
        const bleach = smoothstep(0.05, 1, exposure) *
          (0.45 + 0.55 * fbm(x * 2.1 - 8.4, z * 2.1 + 3.7))
        colour = mix3(colour, bleached, bleach * 0.5)
      }

      let scuff = 0
      let kind = 0
      for (const s of scuffs.get(Math.floor(x / SCUFF_CELL)) ?? []) {
        const dx = (x - s.x) / s.r
        const dz = (z - s.z) / (s.r * 0.72)
        const d2 = dx * dx + dz * dz
        if (d2 >= 1) continue
        const f = Math.pow(1 - d2, 1.3) * s.k * (0.4 + 0.6 * fbm(x * 7.3 + 3.1, z * 7.3 - 5.6))
        if (f > scuff) {
          scuff = f
          kind = s.rubber
        }
      }
      if (scuff > 0) colour = mix3(colour, mix3(dirt, rubber, kind), scuff)

      // The detail albedo is a modulation, so its mean is divided back out and
      // the vertex colour stays the surface's actual albedo.
      for (let c = 0; c < 3; c++) {
        shading[i * 3 + c] = Math.min(1, srgbToLinear(colour[c]!) / detail.meanLinear)
      }
    }

    if (shading) pile.setAttribute('color', new Float32BufferAttribute(shading, 3))
    pile.computeVertexNormals()

    if (detail) {
      const repeatU = innerL / TILE
      const repeatV = innerW / TILE
      detail.map.repeat.set(repeatU, repeatV)
      detail.roughnessMap.repeat.set(repeatU, repeatV)
      detail.normalMap.repeat.set(repeatU, repeatV)
    }
    emit(pile, materialSlots.mat, 'pile')
  }
  rebuild()

  return {
    root,
    parts: { mat },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.modules !== undefined) config.modules = Math.max(1, Math.round(patch.modules))
      if (typeof patch.pileStep === 'number' && Number.isFinite(patch.pileStep) && patch.pileStep > 0) {
        config.pileStep = patch.pileStep
      }
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) {
        if (mesh.name === 'pile') mesh.material = material
      }
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      detail?.map.dispose()
      detail?.roughnessMap.dispose()
      detail?.normalMap.dispose()
      for (const material of extras) material.dispose()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel({ modules: 3 }), {
    aspect,
    target: [0, 0.04, 0],
    distance: 2.85,
    fov: 28,
    yaw: -1.05,
    pitch: 0.3,
  })
}
