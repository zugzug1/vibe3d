// kk-034-repaired-cup — a thrown yunomi teacup with a kintsugi lacquer seam running rim to foot.
//
// Datum: manifest kk-034 authored target 0.10 × 0.10 × 0.10 m. Built 0.088 × 0.088 × 0.104 m. The
// reference silhouette is clearly taller than it is wide (830 px across a 1 030 px body), so the
// diameter came down rather than the cup being inflated into a bowl; the height is the manifest
// target. Both sit inside the ±20 % envelope the kit test warns at.
//
// Axes: Y-up, metres, ground y = 0 at the foot-ring bearing face, bottom-centre origin, front = +Z.
// The repair runs down the front-right at `seamAngle` (default 0.30 rad off +Z), which is where the
// reference's three-quarter view puts it.
//
// Parts:
//   body — one lathe carrying the outer wall, the rim, the whole interior and the trimmed foot ring.
//          The unglazed bisque foot, the iron-flashed rim and the uneven glaze are vertex colour on
//          the single `glaze` slot, so the cup is one draw call rather than three.
//   seam — the raised gold lacquer bead, swept along the cup's own surface normal so it stays on the
//          wall at every station and tapers out at both ends the way urushi does.
// No movable parts — a cup has none.
//
// Collider: none (decorative). If one is ever wanted, a capsule r = 0.044, h = 0.104 is the fallback;
// the kit's `furnishing()` default already compiles an AABB hull inside 9 cm.
//
// What the single reference could not show: the underside. A thrown yunomi is trimmed with a recessed
// base inside the foot ring, so that is what is built — a plausible reconstruction, not evidence.
//
// Art-direction correction: the reference's painted plum-blossom decoration is dressing outside the
// manifest brief ("uneven ivory glaze and a fine visible repair seam"). Carrying it would need either
// a texture or a tessellation this 2 000-triangle storytelling tier cannot pay for, so it is omitted;
// the glaze unevenness it sat on is kept. Recorded in review/REVIEW.md.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  Vector3,
  type Material,
  type MeshStandardMaterial,
} from 'three/webgpu'

import {
  DERIVED,
  TOKEN,
  acquireKkMaterials,
  clamp01,
  createKkPreview,
  finishModel,
  mixToken,
  shade,
} from '../kk-core/index.ts'

const ID = 'kk-034-repaired-cup'

type Slot = 'body' | 'seam'

export interface KkRepairedCupConfig {
  /** With the kintsugi bead (the brief) or the same cup unbroken — the café stocks both. */
  repaired: boolean
  /** Azimuth of the repair, radians off +Z. */
  seamAngle: number
}

export interface KkRepairedCupOptions extends Partial<KkRepairedCupConfig> {
  materials?: Partial<Record<Slot, MeshStandardMaterial>>
}

export interface KkRepairedCupInstance {
  readonly root: Group
  readonly parts: { body: Group; seam: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkRepairedCupConfig>
  configure(patch: Partial<KkRepairedCupConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const DEFAULTS: KkRepairedCupConfig = { repaired: true, seamAngle: 0.3 }

// --- section ------------------------------------------------------------------------------------

/**
 * The closed half-section, [radius, height] in metres, walked as one loop: recessed base centre →
 * out across the trimmed base → down the inside of the foot ring → the bearing face → up the outer
 * wall → over the rim → back down the interior → in across the dished floor. Traversed this way the
 * outward direction is the profile tangent rotated −90° at every station, so one winding rule holds
 * for the underside, the wall, the rim crown and the interior alike.
 *
 * The three tight corners (bearing edge, rim crown, recess edge) carry a 0.4–0.6 mm chamfer band
 * instead of a duplicated ring: with shared normals that reads as a crisp edge and costs four
 * triangles per azimuth step instead of a whole degenerate ring (modeling rule 1).
 */
const PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.0000, 0.0034], // 0  recessed base centre
  [0.0186, 0.0032], // 1  trimmed base
  [0.0212, 0.0002], // 2  foot ring, inside
  [0.0252, 0.0000], // 3  bearing face
  [0.0258, 0.0008], // 4  bearing chamfer
  [0.0252, 0.0106], // 5  foot ring, outside — the body overhangs it by 5 mm
  [0.0306, 0.0130], // 6  springing: the wall flares straight off the foot before it climbs
  [0.0380, 0.0208], // 7  two stations through the tuck, where the curvature is highest and one
  [0.0428, 0.0292], // 8  station apart reads as a crease down the flank
  [0.0450, 0.0400], // 9  widest — a thrown belly at 41 %
  [0.0452, 0.0490], // 10 the belly is HELD, not a single apex; this is what stops the wall
  [0.0445, 0.0620], // 11 reading as a cone from rim to foot
  [0.0432, 0.0780], // 12
  [0.0420, 0.0910], // 13
  [0.0415, 0.0958], // 14 lip, 8 % narrower than the belly
  [0.0411, 0.0978], // 15 rim, outer chamfer
  [0.0400, 0.0985], // 16 rim crown
  [0.0388, 0.0979], // 17 rim, inner chamfer
  [0.0384, 0.0956], // 18
  [0.0398, 0.0760], // 19 interior
  [0.0412, 0.0500], // 20
  [0.0392, 0.0360], // 21
  [0.0300, 0.0210], // 22
  [0.0000, 0.0166], // 23 dished floor centre
]

/**
 * 36 steps, and the ring WRAPS — column 0 is column 36. A duplicated seam column would leave every
 * vertex on it averaging half its neighbours, which `computeVertexNormals` turns into a hard shading
 * line down one side of an otherwise round pot. Nothing here is textured, so there is no UV seam to
 * pay for the wrap with.
 */
const SEGMENTS = 36
const RIM_Y = 0.0985

/** Profile stations the repair crosses: up the interior, over the crown, down the outside to the foot. */
const SEAM_PATH: readonly number[] = [19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5]
const SEAM_DENSIFY = 2
/**
 * The brief says a FINE seam. Earlier revisions ran a 1.6 mm half-width bead 1.2 mm proud, which two
 * independent critiques both called a glued-on rope rather than an inlaid repair. This is half that:
 * still a raised urushi bead, because flush is the bug (modeling rule 9), but a bead you have to look
 * at rather than a length of solder. It stops at the top of the foot ring — carried across the
 * trimmed foot it put a visible discontinuity through the one crisp edge on the pot.
 */
const SEAM_HALF_WIDTH = 0.0011
const SEAM_SKIRT = 0.00025
const SEAM_CREST = 0.0007

// --- colour -------------------------------------------------------------------------------------

/**
 * Unglazed, iron-bearing clay where the potter trimmed the foot. Vermilion alone takes ivory straight
 * to salmon, so the moss token pulls it back to something that has been near a kiln before the whole
 * mix is sunk toward charcoal.
 */
const BISQUE = mixToken(
  mixToken(mixToken(TOKEN.IVORY, TOKEN.VERMILION, 0.26), TOKEN.MOSS, 0.2),
  TOKEN.CHARCOAL,
  0.52,
)
/** Iron flashing where the glaze ran thin over the rim. */
const RIM_IRON = mixToken(
  mixToken(mixToken(TOKEN.IVORY, TOKEN.VERMILION, 0.28), TOKEN.MOSS, 0.16),
  TOKEN.CHARCOAL,
  0.54,
)
/** The glaze itself carries the kiln's warmth; the slot colour alone renders a shade too cool. */
const GLAZE_WARM = shade(mixToken(DERIVED.GLAZE_IVORY, TOKEN.VERMILION, 0.035), 0.3)
/** The interior pools cooler and greyer than the outside. */
const INTERIOR = mixToken(DERIVED.GLAZE_IVORY, TOKEN.CHARCOAL, 0.1)
/**
 * Kintsugi gold, carried on the seam's own vertex colour. It has to be a clear step DARKER and more
 * saturated than the glaze it crosses — lifted toward ivory it is the same value as the cup and the
 * repair, which is the whole subject, stops reading at any distance at all.
 */
const GOLD = mixToken(
  mixToken(mixToken(TOKEN.IVORY, TOKEN.VERMILION, 0.45), TOKEN.MOSS, 0.28),
  TOKEN.CHARCOAL,
  0.08,
)

/**
 * Vertex colour multiplies the slot's own colour, so a target has to be expressed as a ratio against
 * the glaze the material already carries — and in linear space, which is where the multiply happens.
 */
const scratchColour = new Color()
const scratchBase = new Color()
function ratioTo(hex: number, baseHex: number): [number, number, number] {
  scratchColour.setHex(hex)
  scratchBase.setHex(baseHex)
  return [
    scratchColour.r / scratchBase.r,
    scratchColour.g / scratchBase.g,
    scratchColour.b / scratchBase.b,
  ]
}

function lerp3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

// --- the hand of the potter ---------------------------------------------------------------------

/**
 * A thrown pot is not a cylinder of revolution: the wall runs out of round by a percent or two and
 * the rim never comes back level. Both are closed-form in θ (no PRNG — the kit's determinism rule),
 * and both ramp to nothing at the foot, which is trimmed on the wheel and genuinely round.
 */
function outOfRound(theta: number, y: number): number {
  const ramp = 0.3 + 0.7 * clamp01((y - 0.011) / 0.05)
  // Two low harmonics only: a third above 5θ starts to alias against the 30 azimuth steps and shows
  // up as facets in the silhouette rather than as a wall that ran out of true.
  const w = 0.007 * Math.cos(3 * theta + 0.4) + 0.004 * Math.cos(5 * theta - 1.1)
  return 1 + w * ramp
}

function rimTilt(theta: number, y: number): number {
  const wave = 0.0022 * Math.cos(2 * theta + 0.9) + 0.0008 * Math.cos(3 * theta - 2.1)
  return wave * clamp01((y - 0.058) / 0.038)
}

/** Glaze thickness varies with the dip; this is the value wobble that reads as "uneven ivory glaze". */
function glazeMottle(theta: number, y: number): number {
  const yN = y / RIM_Y
  return 1
    + 0.13 * Math.cos(3.1 * theta + 1.7 * yN + 0.4)
    + 0.07 * Math.cos(5.7 * theta - 3.3 * yN + 2.1)
    + 0.04 * Math.cos(9.3 * theta + 5.1 * yN)
    + 0.025 * Math.cos(13.7 * theta - 8.4 * yN + 1.3)
}

/**
 * How hard the iron in the clay flashed through the glaze at this azimuth. A rim band of one even
 * value is a machine's rim; on a dipped pot the staining is heavy over an arc and almost absent a
 * quarter turn away, which is the single thing that stops the rim reading as a printed stripe.
 */
function rimStain(theta: number): number {
  const a = 0.5 + 0.5 * Math.cos(2.7 * theta + 1.4)
  const b = 0.5 + 0.5 * Math.cos(5.3 * theta - 0.8)
  return clamp01(0.3 + 0.9 * a * (0.55 + 0.45 * b))
}

// --- geometry -----------------------------------------------------------------------------------

interface Station {
  readonly r: number
  readonly y: number
  /** Outward normal in the (radius, height) half-plane. */
  readonly nr: number
  readonly ny: number
}

/** Per-profile-point outward normals, averaged across the two segments that meet there. */
function sectionStations(): Station[] {
  const segments: Array<[number, number]> = []
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const dr = PROFILE[i + 1]![0] - PROFILE[i]![0]
    const dy = PROFILE[i + 1]![1] - PROFILE[i]![1]
    const length = Math.hypot(dr, dy) || 1
    segments.push([dy / length, -dr / length])
  }
  return PROFILE.map(([r, y], i) => {
    const before = segments[i - 1] ?? segments[0]!
    const after = segments[i] ?? segments[segments.length - 1]!
    const nr = before[0] + after[0]
    const ny = before[1] + after[1]
    const length = Math.hypot(nr, ny) || 1
    return { r, y, nr: nr / length, ny: ny / length }
  })
}

function surfacePoint(station: Station, theta: number, lift: number, out: Vector3): Vector3 {
  const radius = station.r * outOfRound(theta, station.y) + station.nr * lift
  const height = station.y + rimTilt(theta, station.y) + station.ny * lift
  return out.set(radius * Math.sin(theta), height, radius * Math.cos(theta))
}

/**
 * The cup itself. One lathe: positions, UVs and the glaze/bisque/iron vertex colour are written in the
 * same pass, so the colour zones stay locked to the profile stations that define them.
 */
function buildBody(stations: readonly Station[]): BufferGeometry {
  const rings = stations.length
  const count = rings * SEGMENTS
  const positions = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  const colours = new Float32Array(count * 3)

  const bisque = ratioTo(BISQUE, DERIVED.GLAZE_IVORY)
  const glaze = ratioTo(GLAZE_WARM, DERIVED.GLAZE_IVORY)
  const iron = ratioTo(RIM_IRON, DERIVED.GLAZE_IVORY)
  const interior = ratioTo(INTERIOR, DERIVED.GLAZE_IVORY)

  // Profile stations, not heights, own the zone boundaries: the glaze line is the top of the trimmed
  // foot (7/8) and the iron flashing is the rim band (15–20), wherever those stations end up sitting.
  const zoneOf = (i: number): [number, number, number] => {
    if (i <= 5) return bisque
    if (i === 6) return lerp3(bisque, glaze, 0.5)
    if (i <= 12) return glaze
    if (i === 13) return lerp3(glaze, iron, 0.18)
    if (i === 14) return lerp3(glaze, iron, 0.5)
    if (i <= 18) return iron
    if (i === 19) return lerp3(interior, iron, 0.45)
    return interior
  }

  const point = new Vector3()
  let v = 0
  for (let i = 0; i < rings; i++) {
    const station = stations[i]!
    const zone = zoneOf(i)
    // How much of this ring is inside the flashing band at all; the azimuth decides the rest.
    const stainable = i >= 13 && i <= 19 ? (i === 13 || i === 19 ? 0.4 : 1) : 0
    // The glaze mottles; the trimmed clay is drier and varies less. The crevice where the wall meets
    // the foot holds glaze and reads darker, which is the one place a lens would otherwise see a seam.
    const mottleDepth = i <= 5 ? 0.4 : 1
    const crevice = i === 5 || i === 6 ? 0.86 : 1
    for (let j = 0; j < SEGMENTS; j++) {
      const theta = (j / SEGMENTS) * Math.PI * 2
      surfacePoint(station, theta, 0, point)
      positions[v * 3] = point.x
      positions[v * 3 + 1] = point.y
      positions[v * 3 + 2] = point.z
      uvs[v * 2] = j / SEGMENTS
      uvs[v * 2 + 1] = i / (rings - 1)
      const mottle = 1 + (glazeMottle(theta, station.y) - 1) * mottleDepth
      const value = mottle * crevice
      const tone = stainable > 0 ? lerp3(zone, iron, stainable * rimStain(theta)) : zone
      colours[v * 3] = tone[0] * value
      colours[v * 3 + 1] = tone[1] * value
      colours[v * 3 + 2] = tone[2] * value
      v++
    }
  }

  const indices: number[] = []
  const at = (i: number, j: number): number => i * SEGMENTS + (j % SEGMENTS)
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = at(i, j)
      const b = at(i + 1, j)
      const c = at(i + 1, j + 1)
      const d = at(i, j + 1)
      indices.push(a, d, b, d, c, b)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new BufferAttribute(colours, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Where the crack wandered: nearly plumb off the rim, then swinging round onto the foot. */
function seamAzimuth(base: number, s: number): number {
  return base - 0.05 + 0.24 * s * s + 0.03 * s - 0.055 * Math.sin(6.1 * s + 1.1)
}

/**
 * The gold bead. Three points across — skirt, crest, skirt — swept along the cup's own surface, so
 * the repair follows the wall out of round instead of floating off it, and offset along the surface
 * normal rather than laid flush (modeling rule 9: flush is the bug). Both ends taper out.
 */
function buildSeam(stations: readonly Station[], base: number): BufferGeometry {
  const path: Station[] = []
  for (let k = 0; k < SEAM_PATH.length - 1; k++) {
    const from = stations[SEAM_PATH[k]!]!
    const to = stations[SEAM_PATH[k + 1]!]!
    for (let d = 0; d < SEAM_DENSIFY; d++) {
      const t = d / SEAM_DENSIFY
      const nr = from.nr + (to.nr - from.nr) * t
      const ny = from.ny + (to.ny - from.ny) * t
      const length = Math.hypot(nr, ny) || 1
      path.push({
        r: from.r + (to.r - from.r) * t,
        y: from.y + (to.y - from.y) * t,
        nr: nr / length,
        ny: ny / length,
      })
    }
  }
  path.push(stations[SEAM_PATH[SEAM_PATH.length - 1]!]!)

  const n = path.length
  const centres: Vector3[] = []
  const normals: Vector3[] = []
  const scratch = new Vector3()
  for (let k = 0; k < n; k++) {
    const s = k / (n - 1)
    const theta = seamAzimuth(base, s)
    const station = path[k]!
    centres.push(surfacePoint(station, theta, 0, new Vector3()))
    normals.push(
      new Vector3(station.nr * Math.sin(theta), station.ny, station.nr * Math.cos(theta)).normalize(),
    )
  }

  // The stations are interpolated between profile points, so the centreline inherits a corner wherever
  // two profile segments meet at an angle — a crack with a visible elbow in it. Two [¼ ½ ¼] passes over
  // the centres and the normals round those out; the ends are pinned so the bead still starts and
  // finishes on the wall.
  for (let pass = 0; pass < 2; pass++) {
    const smoothed = centres.map((p) => p.clone())
    const smoothedN = normals.map((p) => p.clone())
    for (let k = 1; k < n - 1; k++) {
      smoothed[k]!.copy(centres[k]!).multiplyScalar(0.5)
        .addScaledVector(centres[k - 1]!, 0.25)
        .addScaledVector(centres[k + 1]!, 0.25)
      smoothedN[k]!.copy(normals[k]!).multiplyScalar(0.5)
        .addScaledVector(normals[k - 1]!, 0.25)
        .addScaledVector(normals[k + 1]!, 0.25)
        .normalize()
    }
    for (let k = 0; k < n; k++) {
      centres[k]!.copy(smoothed[k]!)
      normals[k]!.copy(smoothedN[k]!)
    }
  }

  const positions = new Float32Array(n * 3 * 3)
  const uvs = new Float32Array(n * 3 * 2)
  const colours = new Float32Array(n * 3 * 3)
  const gold = ratioTo(GOLD, DERIVED.BRASS)
  const tangent = new Vector3()
  const across = new Vector3()
  for (let k = 0; k < n; k++) {
    const s = k / (n - 1)
    const previous = centres[Math.max(0, k - 1)]!
    const next = centres[Math.min(n - 1, k + 1)]!
    tangent.copy(next).sub(previous).normalize()
    across.copy(normals[k]!).cross(tangent).normalize()
    // Urushi is laid on thick in the middle of a run and feathered at both ends.
    const taper = 0.3 + 0.7 * Math.sin(Math.PI * clamp01(s)) ** 0.35
    // A break does not part evenly: the lacquer pools where the shards were furthest apart and runs
    // thin where they still met. Closed-form, so the same cup comes back the same every boot.
    const pooling = 1 + 0.34 * Math.sin(4.2 * s + 0.7) + 0.16 * Math.sin(9.1 * s + 2.4)
    const half = (SEAM_HALF_WIDTH - 0.0004 * s) * taper * pooling
    const skirt = SEAM_SKIRT * taper
    const crest = SEAM_CREST * taper * (0.8 + 0.3 * pooling)
    const centre = centres[k]!
    const normal = normals[k]!
    const write = (slot: number, lateral: number, lift: number): void => {
      const index = (k * 3 + slot) * 3
      positions[index] = centre.x + across.x * lateral + normal.x * lift
      positions[index + 1] = centre.y + across.y * lateral + normal.y * lift
      positions[index + 2] = centre.z + across.z * lateral + normal.z * lift
      uvs[(k * 3 + slot) * 2] = slot / 2
      uvs[(k * 3 + slot) * 2 + 1] = s
      // The crest catches the light, the skirts sit in the lacquer's own shadow.
      const value = slot === 1 ? 1.05 : 0.72
      colours[index] = gold[0] * value
      colours[index + 1] = gold[1] * value
      colours[index + 2] = gold[2] * value
    }
    write(0, -half, skirt)
    write(1, 0, crest)
    write(2, half, skirt)
  }

  const indices: number[] = []
  for (let k = 0; k < n - 1; k++) {
    for (let slot = 0; slot < 2; slot++) {
      const a = k * 3 + slot
      const b = (k + 1) * 3 + slot
      const c = k * 3 + slot + 1
      const d = (k + 1) * 3 + slot + 1
      indices.push(a, b, c, c, b, d)
    }
  }
  indices.push(0, 1, 2)
  indices.push((n - 1) * 3 + 2, (n - 1) * 3 + 1, (n - 1) * 3)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new BufferAttribute(colours, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

// --- model --------------------------------------------------------------------------------------

export function createModel(options: KkRepairedCupOptions = {}): KkRepairedCupInstance {
  const config: KkRepairedCupConfig = {
    repaired: options.repaired ?? DEFAULTS.repaired,
    seamAngle: options.seamAngle ?? DEFAULTS.seamAngle,
  }

  const bundle = acquireKkMaterials({ overrides: options.materials })
  const slots: Record<Slot, Material> = {
    body: bundle.materials.glaze,
    seam: bundle.materials.brass,
  }
  // The glaze, bisque and iron flashing all ride one material as vertex colour. A consumer-supplied
  // coat is left exactly as handed in — mutating it would be the same trespass as disposing it.
  if (!options.materials?.glaze) bundle.materials.glaze.vertexColors = true
  if (!options.materials?.brass) bundle.materials.brass.vertexColors = true

  const root = new Group()
  root.name = ID
  const body = new Group()
  body.name = 'body'
  const seam = new Group()
  seam.name = 'seam'
  root.add(body, seam)

  const stations = sectionStations()
  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { body: [], seam: [] }

  // Meshes go in under their bare semantic name and are prefixed afterwards, exactly as `finishModel`
  // does on the first build: `scripts/coplanar-check.ts` captures parts at `Group.add` time and skips
  // anything already carrying the kit's ` / ` separator, so naming here would hide the model from it.
  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, slots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const namePass = (): void => {
    for (const slot of ['body', 'seam'] as const) {
      for (const mesh of meshesBySlot[slot]) {
        if (!mesh.name.startsWith(ID)) mesh.name = `${ID} / ${mesh.name}`
      }
    }
  }

  const rebuild = (): void => {
    body.clear()
    seam.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    meshesBySlot.body.length = 0
    meshesBySlot.seam.length = 0

    emit('body', buildBody(stations), body, 'cup')
    if (config.repaired) emit('seam', buildSeam(stations, config.seamAngle), seam, 'kintsugi')
    namePass()
  }
  rebuild()

  const finished = finishModel(root, bundle, { name: ID, geometries: generated })

  return {
    root,
    parts: { body, seam },
    materials: slots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.repaired !== undefined) config.repaired = Boolean(patch.repaired)
      if (patch.seamAngle !== undefined && Number.isFinite(patch.seamAngle)) {
        config.seamAngle = patch.seamAngle
      }
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

/**
 * `yaw` and `pitch` are forwarded, not swallowed: `scripts/qa-sheet.mjs` orbits the prop by calling
 * this factory with them, and a `createPreview` that drops them renders the same hero tile eight
 * times — an 8-view sheet that cannot show the defect it exists to find.
 */
export function createPreview(options: PreviewArgs = {}) {
  return createKkPreview(createModel(), framing(options))
}

export function createCafePreview(options: PreviewArgs = {}) {
  return createKkPreview(createModel(), { ...framing(options), framing: 'cafe' })
}

interface PreviewArgs {
  aspect?: number
  time?: number
  yaw?: number
  pitch?: number
}

function framing(options: PreviewArgs) {
  return { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch }
}
