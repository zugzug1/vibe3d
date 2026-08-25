// hot-wheels-banked-turned — a Hot Wheels-typology 180 degree banked U-turn, rebuilt at 1:1
// car-plausible scale for exhibition use rather than at toy scale, and finished as fabricated metal.
//
// Scale contract. `trackWidth` is the clear lane between the inside faces of the two side walls and
// defaults to 4 m, which is a single car lane plus working clearance. `radius` is the CENTRE-LINE
// radius of the 180 degree turn and defaults to 8 m — an exhibition-plausible hairpin rather than the
// 0.2 m of the moulded toy, and chosen so the band-to-hole ratio matches the reference part.
// `straightLength` is the length of each run-in measured from its seam.
// Every other dimension (wall thickness, floor thickness, chamfer, skirt thickness, line width) is a
// world-unit size, per modeling rule 7, and is not re-scaled as a percentage of the host.
//
// Angle contract. `bankAngle` is in DEGREES. It is the PEAK bank reached across the middle of the curve;
// the bank ramps from flat at each seam through a smoothstep and holds flat-topped across the apex, so
// the straights and the banked curve always meet coplanar.
//
// Construction. One U-channel cross-section is lofted along a straight-arc-straight centre line. At each
// station the section is rotated about its INNER bottom corner by the local bank, which keeps the inside
// edge of the turn pinned to the ground and lifts the outer rail — the way the part sits on a floor. The
// banked curve additionally carries a swept outer skirt dropped from the raised outer edge down to the
// ground, which is what gives the piece its solid quarter-pipe silhouette.
//
// The section is lofted as SEPARATE batches, not one, so the running surface, the barriers and the
// optional edge lines can carry different values: an inner wall prism, the lane slab between the walls,
// an outer wall prism, and two thin films sitting on the lane. The wall and deck faces they share are
// coincident, so the union is the same solid the single-piece channel described.
//
// ---------------------------------------------------------------------------------------------------
// Colour and material
// ---------------------------------------------------------------------------------------------------
// The defaults are BRUSHED EXHIBITION STEEL — a cool metallic grey deck over darker graphite barriers,
// with slightly darker steel joint hardware. Colour is procedural through five knobs, each a plain hex:
//
//   curveColor      running surface of the BANKED CURVE      default 0x8f979d  (brushed steel)
//   straightColor   running surface of the STRAIGHT run-ins  default 0x969ea3  (brushed steel, lighter)
//   wallColor       both barrier walls and the outer skirt   default 0x454d53  (dark graphite)
//   connectorColor  seam splice plates, bolts, post caps     default 0x7a8288  (darker steel hardware)
//   markingColor    optional edge lines, off by default      default 0xbcc3c6  (muted, see `markings`)
//
// On a metal these hexes tint the REFLECTION, not a diffuse albedo, so they behave differently from a
// painted part: pushing one darker mostly deepens its highlights rather than greying the whole face.
// Cool hexes stay cool; a warm hex reads as bronze or brass almost immediately.
//
// The practical consequence, and the reason `wallColor` sits as far below the deck hexes as it does:
// metal slots lift toward their specular whatever hex you give them, so two slots a step apart on
// paper render as one flat mass. Separating the deck from the barriers needs a much wider spread here
// than the same part would need in paint. Keep that spread if you retint.
//
// Set them at construction:
//
//   createModel({ curveColor: 0x7a8287, wallColor: 0x333a3f })   // darker graphite throughout
//
// Change them later — `configure` recolours in place and never rebuilds geometry for a colour-only
// patch, so it is cheap enough to drive from a UI:
//
//   const turn = createModel()
//   turn.configure({ curveColor: 0xa8b0b6, straightColor: 0xa8b0b6 })   // one uniform steel tone
//   turn.configure({ wallColor: 0x2f3438, connectorColor: 0xc2c9cd })   // near-black rail, bright bolts
//   turn.configure({ curveColor: 0xb9a27e, straightColor: 0xb9a27e })   // warm hex reads as bronze
//   turn.configure({ markings: true, markingColor: 0xd6dbdd })          // add muted edge lines
//
// Finish is NOT driven by the colour knobs. It lives in the `finish` record below, one entry per slot,
// so the whole part stays in family. The deck runs metalness 0.72 at roughness 0.5, the barriers a touch
// softer, and the hardware is the most reflective thing on the piece. Two constraints shaped those
// numbers and are worth knowing before you change them:
//
//   1. The kit capture rig carries NO environment map. A metal's diffuse response falls to zero as
//      metalness approaches 1, so at 0.9+ this part renders as a black hole cut out of the background
//      with a few specular streaks across it. 0.72 keeps enough diffuse for the bank to hold its form
//      while still reading unmistakably as metal. If you light this under an IBL, push it higher.
//   2. A literal brush grain cannot resolve at the kit's capture distance — a realistic 8 mm mill line
//      lands well under one pixel and averages back to flat grey. The finish is therefore carried by a
//      ROUGHNESS map, not a colour map, at the coarser scale that does resolve: broad mill patches with
//      a directional bias along the sweep. Because it is a roughness map it never touches albedo, which
//      is what keeps the five colour knobs above exact.
//
// For anything a hex and that finish cannot express — a photographic texture, an anisotropy map, a TSL
// node material — hand over a whole material instead. `setMaterial` and the `materials` option both mark
// the slot as consumer-owned, after which this model never recolours or disposes it (modeling rule 16),
// so `wallColor` and friends are silently ignored for that slot from then on:
//
//   turn.setMaterial('curve', myBrushedSteelMaterial)
//   createModel({ materials: { wall: myPaintedMaterial } })   // e.g. to break out of metal entirely
//
// Slot names are `curve`, `straight`, `wall`, `marking`, `connector`. `turn.materials` is the live map.
//
// `markings` builds two thin painted edge lines on the lane and defaults to FALSE: bare fabricated metal
// is the intended read, and the lines are kept only as an opt-in for consumers who want a surfaced lane.

import {
  BufferGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  Quaternion,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
  Vector3,
  type Material,
} from 'three/webgpu'
import { LoftGeometry } from 'three/examples/jsm/geometries/LoftGeometry.js'

import { bevelBox, createF1Preview, creased, mergeParts } from '../f1-kit-core/index.ts'

type Slot = 'curve' | 'straight' | 'wall' | 'marking' | 'connector'

export interface HotWheelsBankedTurnedConfig {
  /** Centre-line radius of the 180 degree turn, in metres. */
  radius: number
  /** Clear lane width between the inside faces of the side walls, in metres. */
  trackWidth: number
  /** PEAK bank of the curve at its apex, in DEGREES. 0 is flat; the seams are always flat. */
  bankAngle: number
  /** Length of each straight run-in measured from its seam, in metres. */
  straightLength: number
  /** Height of the side walls above the ground plane, in metres. */
  wallHeight: number
  /** Build the optional painted edge lines. `false` — the default — leaves bare metal. */
  markings: boolean
  /** Running surface of the banked curve, hex. Brushed steel by default. */
  curveColor: number
  /** Running surface of the straight run-ins, hex. Brushed steel by default. */
  straightColor: number
  /** Barrier walls and outer skirt, hex. Graphite by default. */
  wallColor: number
  /** Optional painted edge lines, hex. Muted off-white by default. */
  markingColor: number
  /** Seam splice plates, bolts and post caps, hex. Darker steel by default. */
  connectorColor: number
}

export interface HotWheelsBankedTurnedOptions extends Partial<HotWheelsBankedTurnedConfig> {
  /** Consumer-supplied materials. A supplied material is never disposed or recoloured here. */
  materials?: Partial<Record<Slot, Material>>
}

export interface HotWheelsBankedTurnedInstance {
  readonly root: Group
  readonly parts: { curve: Group; straights: Group; connectors: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<HotWheelsBankedTurnedConfig>
  configure(patch: Partial<HotWheelsBankedTurnedConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: HotWheelsBankedTurnedConfig = {
  radius: 8,
  trackWidth: 4,
  bankAngle: 52,
  straightLength: 24,
  wallHeight: 1.05,
  markings: false,
  curveColor: 0x8f979d,
  straightColor: 0x969ea3,
  wallColor: 0x454d53,
  markingColor: 0xbcc3c6,
  connectorColor: 0x7a8288,
}

/** Fabrication sizes in metres — physical dimensions, not fractions of the lane. */
const WALL_THICKNESS = 0.26
const FLOOR_THICKNESS = 0.18
const RAIL_CHAMFER = 0.06
const SKIRT_THICKNESS = 0.26
/** How far the bottom of the outer skirt kicks out past the raised outer rail at full bank. */
const SKIRT_FLARE = 0.45
/** Shortest skirt worth building; below this the ring collapses into degenerate triangles (rule 6). */
const MIN_SKIRT_HEIGHT = 0.05
const ARC_SEGMENTS = 72
/** Fraction of the arc spent ramping into, and out of, the flat-topped peak bank. */
const BANK_RAMP = 0.3
/**
 * Dielectric reflectance tint. This only affects the non-metallic fraction of each surface and the
 * painted lines; the metal's own reflection is tinted by its colour knob instead. Neutral-cool, to match
 * the rig's daylight key.
 */
const SPECULAR_TINT = 0xf2f5f7
/** Height fraction of the outer skirt at which the fabrication step runs, and how far it stands proud. */
const SKIRT_STEP_AT = 0.5
const SKIRT_STEP_DEPTH = 0.14
/** Barrier post caps on the rail tops. */
const PIN_RADIUS = 0.13
const PIN_HEIGHT = 0.09
/** Bolt heads through the seam splice plates — smaller than a post cap, per rule 7 a real fastener size. */
const BOLT_RADIUS = 0.06
const BOLT_HEIGHT = 0.045
/**
 * Optional painted edge line. 0.02 m is the smallest step that still clears the deck reliably at this
 * kit's scale (rule 8) while staying a shadow-free sliver in silhouette. The width is a real marking
 * width, not a fraction of the lane.
 */
const MARKING_THICKNESS = 0.02
const MARKING_WIDTH = 0.15
/** Gap between the barrier face and the near edge of the line. */
const MARKING_INSET = 0.12
/**
 * World size of one mill-finish tile, in metres. Sized to what actually resolves at the kit's capture
 * distance: broad patches of a rolled surface, not individual brush lines, which fall under a pixel.
 */
const FINISH_METRES = 1.2

/**
 * Per-slot finish. Kept beside the defaults so a consumer replacing one material can match the rest of
 * the part; see the header's Finish note for why the metalness values stop where they do.
 */
const finish: Record<
  Slot,
  { roughness: number; metalness: number; specularIntensity: number; mill: boolean }
> = {
  curve: { roughness: 0.5, metalness: 0.72, specularIntensity: 0.5, mill: true },
  straight: { roughness: 0.46, metalness: 0.72, specularIntensity: 0.5, mill: true },
  wall: { roughness: 0.55, metalness: 0.68, specularIntensity: 0.5, mill: true },
  // Paint over metal: mostly dielectric, so the lines stay legible against the steel around them.
  marking: { roughness: 0.5, metalness: 0.15, specularIntensity: 0.4, mill: false },
  // Machined hardware is the most reflective thing on the piece, which is what picks the bolts out.
  connector: { roughness: 0.34, metalness: 0.82, specularIntensity: 0.55, mill: true },
}

interface Station {
  /** Centre-line point on the ground plane. */
  readonly p: Vector3
  /** Unit lateral, pointing OUTWARD from the turn centre. Continuous across both seams. */
  readonly lat: Vector3
  /** Local bank in radians. */
  readonly bank: number
}

const smoothstep = (x: number): number => x * x * (3 - 2 * x)

/** Flat at both seams, flat-topped across the apex, smooth in between. */
function bankProfile(t: number): number {
  if (t < BANK_RAMP) return smoothstep(t / BANK_RAMP)
  if (t > 1 - BANK_RAMP) return smoothstep((1 - t) / BANK_RAMP)
  return 1
}

const fract = (x: number): number => x - Math.floor(x)

const hash2 = (x: number, y: number): number => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453)

/**
 * Value noise on a wrapping integer lattice of `period` cells per tile.
 *
 * The lattice indices are taken modulo `period`, so the field is exactly periodic and the texture tiles
 * without a seam. Products of sines were tried first and rejected: separable sinusoids put an even
 * diamond grid across every surface, which reads as woven fabric rather than as a fabricated finish.
 */
function valueNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period
  const y = v * period
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const sx = smoothstep(x - xi)
  const sy = smoothstep(y - yi)
  const corner = (i: number, j: number): number =>
    hash2((((xi + i) % period) + period) % period + seed, (((yi + j) % period) + period) % period + seed * 7)
  const a = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * sx
  const b = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * sx
  return a + (b - a) * sy
}

/**
 * Seamless mill-finish ROUGHNESS map for the metal slots.
 *
 * This is a roughness map and deliberately not a colour map: on a metal the visible finish is almost
 * entirely a roughness effect, and keeping albedo untouched is what makes the documented colour knobs
 * exact rather than approximate. `material.roughness` is set to the top of each slot's intended range
 * and this map, which only ever multiplies downward, polishes parts of the surface back toward the
 * bottom of it.
 *
 * The mill direction runs ALONG the sweep, so the field varies across the section — `v` in the UVs
 * written by `scaleUV` — and holds much steadier along it. Left as data, with no colour space applied.
 */
function millFinishMap(size = 256): DataTexture {
  const n = Math.max(64, size)
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    const v = y / n
    // Coprime periods, so the two scales never line up into a repeating motif.
    const streak = valueNoise(0.5, v, 23, 5) - 0.5
    const patch = valueNoise(0.5, v, 6, 2) - 0.5
    for (let x = 0; x < n; x++) {
      // A slow wander along the sweep keeps the streaks from looking like perfect rails.
      const drift = valueNoise(x / n, v, 4, 9) - 0.5
      const k = Math.min(1, Math.max(0.62, 0.87 + 0.13 * streak + 0.16 * patch + 0.07 * drift))
      const i = (y * n + x) * 4
      const g = Math.round(255 * k)
      data[i] = g
      data[i + 1] = g
      data[i + 2] = g
      data[i + 3] = 255
    }
  }
  const texture = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType)
  texture.name = 'hot-wheels-banked-turned / mill finish'
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

/**
 * Place a section-space point on a station.
 *
 * `u` is lateral (negative inboard, positive outboard) and `v` is height above the ground plane, both
 * measured BEFORE banking. The section is rotated about `(-halfWidth, 0)`, its inner bottom corner, so
 * that corner stays on the floor at every bank angle.
 */
function place(st: Station, u: number, v: number, halfWidth: number): Vector3 {
  const du = u + halfWidth
  const c = Math.cos(st.bank)
  const s = Math.sin(st.bank)
  const ru = -halfWidth + du * c - v * s
  const rv = du * s + v * c
  return new Vector3(st.p.x + st.lat.x * ru, st.p.y + rv, st.p.z + st.lat.z * ru)
}

/** Banked "up" at a station — the section's own +v axis in world space. */
function bankedUp(st: Station): Vector3 {
  return new Vector3(-st.lat.x, 0, -st.lat.z)
    .multiplyScalar(Math.sin(st.bank))
    .setY(Math.cos(st.bank))
}

type Section = ReadonlyArray<readonly [number, number]>

/**
 * The channel cross-section, split into the material batches described in the header.
 *
 * Each returned section is a closed `[u, v]` polygon traversed up its inboard edge, across its top and
 * back down its outboard edge — the same handedness the single-piece channel used, which is the winding
 * `LoftGeometry` needs for outward normals. Their shared faces are coincident and hidden inside the
 * solid, which costs a few interior triangles and buys an honest value break at the barrier feet.
 */
function channelSections(
  halfWidth: number,
  wallHeight: number,
): { innerWall: Section; deck: Section; outerWall: Section; markings: readonly Section[] } {
  const hw = halfWidth
  const wt = WALL_THICKNESS
  const ch = Math.min(RAIL_CHAMFER, wt * 0.45)
  const top = wallHeight
  const lane = FLOOR_THICKNESS
  const paint = lane + MARKING_THICKNESS
  const laneInner = -hw + wt
  const laneOuter = hw - wt
  // Clamp so a narrow `trackWidth` cannot push the two lines through each other.
  const width = Math.min(MARKING_WIDTH, Math.max(0.02, (laneOuter - laneInner) / 2 - MARKING_INSET))
  const line = (from: number): Section => [
    [from, lane],
    [from, paint],
    [from + width, paint],
    [from + width, lane],
  ]
  return {
    innerWall: [
      [-hw, 0],
      [-hw, top - ch],
      [-hw + ch, top],
      [-hw + wt - ch, top],
      [-hw + wt, top - ch],
      [-hw + wt, 0],
    ],
    deck: [
      [laneInner, 0],
      [laneInner, lane],
      [laneOuter, lane],
      [laneOuter, 0],
    ],
    outerWall: [
      [hw - wt, 0],
      [hw - wt, top - ch],
      [hw - wt + ch, top],
      [hw - ch, top],
      [hw, top - ch],
      [hw, 0],
    ],
    markings: [line(laneInner + MARKING_INSET), line(laneOuter - MARKING_INSET - width)],
  }
}

/**
 * Rescale `LoftGeometry`'s UVs from normalised arc length into metres over `FINISH_METRES`.
 *
 * `LoftGeometry` emits `u` as fraction of path length and `v` as fraction of section perimeter, so both
 * axes stretch with the part. Multiplying by the real lengths gives one isotropic, world-scaled tiling
 * for every batch, which is what stops the finish reading coarse on the short seam plates and smeared
 * along the twenty-four metre straights. Rule 7 again: the mill scale is a physical dimension.
 */
function scaleUV(geometry: BufferGeometry, alongMetres: number, aroundMetres: number): void {
  const uv = geometry.getAttribute('uv')
  const su = alongMetres / FINISH_METRES
  const sv = aroundMetres / FINISH_METRES
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  uv.needsUpdate = true
}

function sectionPerimeter(section: Section): number {
  let total = 0
  for (let i = 0; i < section.length; i++) {
    const a = section[i]!
    const b = section[(i + 1) % section.length]!
    total += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return total
}

function ringPerimeter(ring: readonly Vector3[]): number {
  let total = 0
  for (let i = 0; i < ring.length; i++) total += ring[i]!.distanceTo(ring[(i + 1) % ring.length]!)
  return total
}

function pathLength(stations: readonly Station[]): number {
  let total = 0
  for (let i = 1; i < stations.length; i++) total += stations[i]!.p.distanceTo(stations[i - 1]!.p)
  return total
}

function channelLoft(
  stations: readonly Station[],
  section: Section,
  halfWidth: number,
): BufferGeometry {
  const rings = stations.map((st) => section.map(([u, v]) => place(st, u, v, halfWidth)))
  const geometry = new LoftGeometry(rings, { closed: true, capStart: true, capEnd: true })
  scaleUV(geometry, pathLength(stations), sectionPerimeter(section))
  return creased(geometry, 35)
}

/**
 * The outer skirt: a swept wall dropped from the raised outer bottom edge to the floor, kicked out at
 * its base so it reads as a formed flare rather than a card standing on edge. The kick is scaled by
 * skirt height so the near-flat seam ends do not grow a horizontal shelf.
 *
 * The outer face carries a fabrication step half way down, which is the one landmark the reference skirt
 * has that a plain swept wall does not: it breaks the largest surface on the part with a shadow line
 * and gives the bank a sense of scale. Its depth is scaled by skirt height alongside the base kick, so
 * it fades out rather than pinching where the piece flattens into each seam.
 *
 * Ring order runs down the outer face (top, step top, step bottom, bottom) and back up the inner face,
 * which is the counterclockwise winding this section needs viewed back down the loft.
 */
function skirtLoft(stations: readonly Station[], halfWidth: number): BufferGeometry | null {
  if (stations.length < 2) return null
  const rings: Vector3[][] = []
  for (const st of stations) {
    const outerTop = place(st, halfWidth, 0, halfWidth)
    outerTop.y = Math.max(MIN_SKIRT_HEIGHT, outerTop.y)
    const kick = SKIRT_FLARE * Math.min(1, outerTop.y)
    const inward = new Vector3(-st.lat.x, 0, -st.lat.z).multiplyScalar(SKIRT_THICKNESS)
    const outerBottom = new Vector3(outerTop.x + st.lat.x * kick, 0, outerTop.z + st.lat.z * kick)
    const step = SKIRT_STEP_DEPTH * Math.min(1, outerTop.y)
    const onFace = (f: number, proud: number): Vector3 =>
      outerTop
        .clone()
        .lerp(outerBottom, f)
        .add(new Vector3(st.lat.x * proud, 0, st.lat.z * proud))
    rings.push([
      outerTop,
      onFace(SKIRT_STEP_AT, 0),
      onFace(SKIRT_STEP_AT, step),
      outerBottom.clone().add(new Vector3(st.lat.x * step, 0, st.lat.z * step)),
      outerBottom.clone().add(new Vector3(st.lat.x * step, 0, st.lat.z * step)).add(inward),
      outerTop.clone().add(inward),
    ])
  }
  const geometry = new LoftGeometry(rings, { closed: true, capStart: true, capEnd: true })
  // The apex ring is the tallest, so its perimeter is the honest scale for the swept face.
  scaleUV(geometry, pathLength(stations), ringPerimeter(rings[Math.floor(rings.length / 2)]!))
  return creased(geometry, 35)
}

function stud(at: Vector3, up: Vector3, radius: number, height: number): BufferGeometry {
  const geo = new CylinderGeometry(radius, radius * 0.94, height, 14)
  geo.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), up.clone().normalize()))
  geo.translate(at.x, at.y, at.z)
  return geo
}

export function createModel(
  options: HotWheelsBankedTurnedOptions = {},
): HotWheelsBankedTurnedInstance {
  const config: HotWheelsBankedTurnedConfig = {
    radius: Math.max(4, options.radius ?? defaults.radius),
    trackWidth: Math.max(1.2, options.trackWidth ?? defaults.trackWidth),
    bankAngle: Math.min(75, Math.max(0, options.bankAngle ?? defaults.bankAngle)),
    straightLength: Math.max(2, options.straightLength ?? defaults.straightLength),
    wallHeight: Math.max(FLOOR_THICKNESS + 0.12, options.wallHeight ?? defaults.wallHeight),
    markings: options.markings ?? defaults.markings,
    curveColor: options.curveColor ?? defaults.curveColor,
    straightColor: options.straightColor ?? defaults.straightColor,
    wallColor: options.wallColor ?? defaults.wallColor,
    markingColor: options.markingColor ?? defaults.markingColor,
    connectorColor: options.connectorColor ?? defaults.connectorColor,
  }

  const owned: MeshPhysicalMaterial[] = []
  const ownedTextures: DataTexture[] = []
  // Built lazily: a consumer that supplies every metal material never pays for the map.
  let mill: DataTexture | null = null
  const millMap = (): DataTexture => {
    if (!mill) {
      mill = millFinishMap()
      ownedTextures.push(mill)
    }
    return mill
  }

  const makeSlot = (slot: Slot, color: number): Material => {
    const supplied = options.materials?.[slot]
    if (supplied) return supplied
    const spec = finish[slot]
    const material = new MeshPhysicalMaterial({
      name: `hot-wheels-banked-turned / ${slot}`,
      color,
      roughness: spec.roughness,
      roughnessMap: spec.mill ? millMap() : null,
      metalness: spec.metalness,
      specularIntensity: spec.specularIntensity,
      specularColor: SPECULAR_TINT,
    })
    owned.push(material)
    return material
  }

  const materialSlots: Record<Slot, Material> = {
    curve: makeSlot('curve', config.curveColor),
    straight: makeSlot('straight', config.straightColor),
    wall: makeSlot('wall', config.wallColor),
    marking: makeSlot('marking', config.markingColor),
    connector: makeSlot('connector', config.connectorColor),
  }
  const ownsSlot: Record<Slot, boolean> = {
    curve: !options.materials?.curve,
    straight: !options.materials?.straight,
    wall: !options.materials?.wall,
    marking: !options.materials?.marking,
    connector: !options.materials?.connector,
  }

  const root = new Group()
  root.name = 'hot-wheels-banked-turned'
  const curve = new Group()
  curve.name = 'curve'
  const straights = new Group()
  straights.name = 'straights'
  const connectors = new Group()
  connectors.name = 'connectors'
  root.add(curve, straights, connectors)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = {
    curve: [],
    straight: [],
    wall: [],
    marking: [],
    connector: [],
  }

  const releaseGenerated = (): void => {
    curve.clear()
    straights.clear()
    connectors.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const rebuild = (): void => {
    releaseGenerated()

    const R = config.radius
    const halfWidth = config.trackWidth / 2 + WALL_THICKNESS
    const wallHeight = config.wallHeight
    const peak = (config.bankAngle * Math.PI) / 180
    const L = config.straightLength
    const { innerWall, deck, outerWall, markings } = channelSections(halfWidth, wallHeight)

    // The turn sits on -X: the run-in travels -X along z = +R, the arc sweeps the left half, and the
    // run-out travels +X along z = -R. `lat` is Y x tangent throughout, which is the outward radial on
    // the arc and stays continuous through both seams.
    const arc: Station[] = []
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      const t = i / ARC_SEGMENTS
      const theta = Math.PI / 2 + t * Math.PI
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      arc.push({
        p: new Vector3(R * cos, 0, R * sin),
        lat: new Vector3(cos, 0, sin),
        bank: peak * bankProfile(t),
      })
    }

    const runIn: Station[] = [
      { p: new Vector3(L, 0, R), lat: new Vector3(0, 0, 1), bank: 0 },
      { p: new Vector3(0, 0, R), lat: new Vector3(0, 0, 1), bank: 0 },
    ]
    const runOut: Station[] = [
      { p: new Vector3(0, 0, -R), lat: new Vector3(0, 0, -1), bank: 0 },
      { p: new Vector3(L, 0, -R), lat: new Vector3(0, 0, -1), bank: 0 },
    ]

    // Running surfaces carry the deck slots; both barriers and the skirt batch into the wall slot.
    emit('curve', channelLoft(arc, deck, halfWidth), curve, 'banked-deck')
    emit(
      'straight',
      mergeParts(
        [channelLoft(runIn, deck, halfWidth), channelLoft(runOut, deck, halfWidth)],
        'hot-wheels-banked-turned: straight decks',
      ),
      straights,
      'run-in-decks',
    )

    const curveWalls: BufferGeometry[] = [
      channelLoft(arc, innerWall, halfWidth),
      channelLoft(arc, outerWall, halfWidth),
    ]
    const skirt = skirtLoft(arc, halfWidth)
    if (skirt) curveWalls.push(skirt)
    emit(
      'wall',
      mergeParts(curveWalls, 'hot-wheels-banked-turned: curve walls'),
      curve,
      'banked-barriers',
    )

    emit(
      'wall',
      mergeParts(
        [
          channelLoft(runIn, innerWall, halfWidth),
          channelLoft(runIn, outerWall, halfWidth),
          channelLoft(runOut, innerWall, halfWidth),
          channelLoft(runOut, outerWall, halfWidth),
        ],
        'hot-wheels-banked-turned: straight walls',
      ),
      straights,
      'run-in-barriers',
    )

    if (config.markings) {
      // The lines are lofted through `place` like everything else, so they follow the bank instead of
      // needing to be projected onto it afterwards.
      emit(
        'marking',
        mergeParts(
          markings.map((line) => channelLoft(arc, line, halfWidth)),
          'hot-wheels-banked-turned: curve lines',
        ),
        curve,
        'banked-edge-lines',
      )
      emit(
        'marking',
        mergeParts(
          [
            ...markings.map((line) => channelLoft(runIn, line, halfWidth)),
            ...markings.map((line) => channelLoft(runOut, line, halfWidth)),
          ],
          'hot-wheels-banked-turned: straight lines',
        ),
        straights,
        'run-in-edge-lines',
      )
    }

    // Both seams are flat by construction, so the splice plates are axis-aligned boxes, not lofts.
    const tabParts: BufferGeometry[] = []
    const tabThickness = 0.07
    const tabHalfWidth = config.trackWidth * 0.24
    const plateHalfLength = 0.45
    const railU = halfWidth - WALL_THICKNESS / 2
    for (const z of [R, -R] as const) {
      const plate = bevelBox(plateHalfLength * 2, tabThickness, tabHalfWidth * 2, 0.02)
      plate.translate(0, FLOOR_THICKNESS + tabThickness * 0.34, z)
      tabParts.push(plate)
      // Four bolts through the plate read as a bolted steel splice rather than a snap-fit tab.
      const boltY = FLOOR_THICKNESS + tabThickness * 0.34 + tabThickness / 2
      for (const dx of [-1, 1] as const) {
        for (const dz of [-1, 1] as const) {
          tabParts.push(
            stud(
              new Vector3(dx * (plateHalfLength - 0.14), boltY, z + dz * (tabHalfWidth - 0.2)),
              new Vector3(0, 1, 0),
              BOLT_RADIUS,
              BOLT_HEIGHT,
            ),
          )
        }
      }
      for (const side of [1, -1] as const) {
        tabParts.push(
          stud(
            new Vector3(0, wallHeight + 0.02, z + side * railU),
            new Vector3(0, 1, 0),
            PIN_RADIUS,
            PIN_HEIGHT,
          ),
        )
      }
    }
    // Post caps on the curve's inner rail, where the reference shows fixing pins.
    for (const t of [0.13, 0.87] as const) {
      const st = arc[Math.round(t * ARC_SEGMENTS)]!
      tabParts.push(
        stud(
          place(st, -halfWidth + WALL_THICKNESS / 2, wallHeight + 0.02, halfWidth),
          bankedUp(st),
          PIN_RADIUS,
          PIN_HEIGHT,
        ),
      )
    }
    emit(
      'connector',
      mergeParts(tabParts, 'hot-wheels-banked-turned: connectors'),
      connectors,
      'connector-tabs',
    )
  }

  rebuild()

  return {
    root,
    parts: { curve, straights, connectors },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      let rebuildGeometry = false
      if (patch.radius !== undefined) {
        config.radius = Math.max(4, patch.radius)
        rebuildGeometry = true
      }
      if (patch.trackWidth !== undefined) {
        config.trackWidth = Math.max(1.2, patch.trackWidth)
        rebuildGeometry = true
      }
      if (patch.bankAngle !== undefined) {
        config.bankAngle = Math.min(75, Math.max(0, patch.bankAngle))
        rebuildGeometry = true
      }
      if (patch.straightLength !== undefined) {
        config.straightLength = Math.max(2, patch.straightLength)
        rebuildGeometry = true
      }
      if (patch.wallHeight !== undefined) {
        config.wallHeight = Math.max(FLOOR_THICKNESS + 0.12, patch.wallHeight)
        rebuildGeometry = true
      }
      if (patch.markings !== undefined && patch.markings !== config.markings) {
        config.markings = patch.markings
        rebuildGeometry = true
      }
      if (patch.curveColor !== undefined) config.curveColor = patch.curveColor
      if (patch.straightColor !== undefined) config.straightColor = patch.straightColor
      if (patch.wallColor !== undefined) config.wallColor = patch.wallColor
      if (patch.markingColor !== undefined) config.markingColor = patch.markingColor
      if (patch.connectorColor !== undefined) config.connectorColor = patch.connectorColor
      const recolour: ReadonlyArray<readonly [Slot, number | undefined]> = [
        ['curve', patch.curveColor],
        ['straight', patch.straightColor],
        ['wall', patch.wallColor],
        ['marking', patch.markingColor],
        ['connector', patch.connectorColor],
      ]
      for (const [slot, value] of recolour) {
        // Rule 16: a consumer-supplied material is theirs, so its colour is not ours to change.
        if (value === undefined || !ownsSlot[slot]) continue
        ;(materialSlots[slot] as MeshPhysicalMaterial).color.setHex(value)
      }
      if (rebuildGeometry) rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      ownsSlot[slot] = false
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      for (const material of owned) material.dispose()
      owned.length = 0
      for (const texture of ownedTextures) texture.dispose()
      ownedTextures.length = 0
      mill = null
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [1.5, 0.6, 0.5],
    distance: 41,
    fov: 40,
    yaw: 0.62,
    pitch: 0.5,
  })
}
