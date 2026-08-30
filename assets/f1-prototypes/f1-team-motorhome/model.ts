// f1-team-motorhome — assembled Cadillac / Schuler 2026 hospitality house.
// 15 × 17 m, three storeys + slatted rooftop terrace. Floating stair in a
// glazed atrium. Crest + wordmark are drawn stamps, not photo textures.
// Interior is dressed from the official tour stills (see interior.ts).
//
// The envelope is a closed box: every façade band is either panel or glass, and
// the rear is solid service wall. Nothing is left open, so the house never reads
// as a see-through diorama. The atrium is a real void carved out of the slabs.

import {
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  LAYER_CLEARANCE,
  MOTORHOME,
  TOKEN,
  acquireF1Materials,
  bevelBox,
  bevelDisc,
  bevelRing,
  createF1Preview,
  disposeF1Materials,
  member,
  mergeParts,
  shade,
  writeGlyphWord,
} from '../f1-kit-core/index.ts'
import { dressInterior, type InteriorLive, type InteriorMats } from './interior.ts'

type Slot = 'shell' | 'glass' | 'deck'

export interface F1TeamMotorhomeConfig {
  /** Footprint width along local X, metres. */
  width: number
  /** Footprint depth along local Z, metres. */
  depth: number
}

export interface F1TeamMotorhomeOptions extends Partial<F1TeamMotorhomeConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1TeamMotorhomeInstance {
  readonly root: Group
  readonly parts: { shell: Group; glass: Group; deck: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1TeamMotorhomeConfig>
  configure(patch: Partial<F1TeamMotorhomeConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1TeamMotorhomeConfig = { width: MOTORHOME.width, depth: MOTORHOME.depth }
const STOREY = MOTORHOME.storey
const STOREYS = MOTORHOME.storeys
const TERRACE = MOTORHOME.terrace
const WALL = 0.22
const ATRIUM_W = 4.2
/** Half width of the carved atrium void, to the inside face of its flanking wall. */
const ATRIUM_HALF = ATRIUM_W / 2 + 0.2
/** How far the atrium void reaches back from the front wall. */
const ATRIUM_D = 4.6
/** Solid corner pier. Closes the ends of every glazed band and squares the silhouette. */
const PIER = 0.46
/**
 * Mid-elevation piers: how wide each pier is along its own elevation, how far the
 * whole pier line stands proud of the glass, the pier centres on one flank as
 * fractions of the half-depth, and where the single pier lands across a front
 * wing measured from the atrium jamb.
 */
const SIDE_PIER = 0.92
const PIER_PROUD = 0.17
const SIDE_PIERS = [-0.63, -0.23, 0.23, 0.63] as const
const WING_PIER = 0.5
const REVEAL = 0.045
/** Brand ribbon: fascia height, stand-off from the panel plane, and coachline height. */
const RIBBON_H = 0.54
const RIBBON_Z = 0.34
const PINSTRIPE_H = 0.2
/** Terrace parapet: a solid guard wall rather than a hairline upstand. */
const PARAPET_H = 0.82
const PARAPET_T = 0.36
const PERSIST = 7

const GOLD: readonly [number, number, number] = [199, 160, 74]
const INK: readonly [number, number, number] = [11, 13, 17]
const CRIMSON: readonly [number, number, number] = [126, 28, 38]
const COBALT: readonly [number, number, number] = [30, 56, 116]

/** Geometry the whole build shares, resolved once per rebuild. */
interface Envelope {
  w: number
  d: number
  h: number
  /** Inside face of the corner piers along X. */
  xEdge: number
  /** Inside face of the corner piers along Z. */
  zEdge: number
  /** Front face of the atrium void (its back wall). */
  atriumZ0: number
  /** Rear face of the front wall, where the atrium void ends. */
  atriumZ1: number
}

function put(
  data: Uint8Array, n: number, x: number, y: number,
  rgb: readonly [number, number, number], a = 255,
): void {
  if (x < 0 || y < 0 || x >= n) return
  const i = (y * n + x) * 4
  if (i + 3 >= data.length) return
  data[i] = rgb[0]
  data[i + 1] = rgb[1]
  data[i + 2] = rgb[2]
  data[i + 3] = a
}

/**
 * DataTexture row 0 samples at v=0, which a PlaneGeometry puts at the bottom, so
 * anything painted top-down lands upside down. Painting is easier top-down, so
 * the buffer is mirrored once at the end instead.
 */
function flipRows(data: Uint8Array, w: number, h: number): void {
  const stride = w * 4
  const scratch = new Uint8Array(stride)
  for (let y = 0; y < Math.floor(h / 2); y++) {
    const top = y * stride
    const bottom = (h - 1 - y) * stride
    scratch.set(data.subarray(top, top + stride))
    data.copyWithin(top, bottom, bottom + stride)
    data.set(scratch, bottom)
  }
}

function finishTexture(data: Uint8Array, w: number, h: number): DataTexture {
  flipRows(data, w, h)
  const tex = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType)
  tex.colorSpace = SRGBColorSpace
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

/** Half width of the heraldic shield at painted row `dy`, or 0 outside it. */
function shieldHalfWidth(dy: number): number {
  if (dy < -74 || dy > 80) return 0
  if (dy <= 18) return 64
  const t = (dy - 18) / 62
  return 64 * Math.pow(1 - t, 0.62)
}

function paintQuarter(
  data: Uint8Array, n: number, x: number, y: number, dx: number, dy: number,
): void {
  const top = dy < -12
  const left = dx < 0
  if (top === left) {
    put(data, n, x, y, top ? CRIMSON : COBALT)
    return
  }
  put(data, n, x, y, INK)
  // Merlette dots in the two dark quarters — the crest's only fine detail, so
  // they are drawn on a coarse lattice that survives the mip chain.
  const gx = Math.abs(((dx + 200) % 26) - 13)
  const gy = Math.abs(((dy + 200) % 26) - 13)
  if (gx * gx + gy * gy < 20) put(data, n, x, y, GOLD)
}

/**
 * Quartered shield inside a laurel bezel, alpha-cut to a disc so it can sit on a
 * physical gold medallion instead of floating as a black square.
 */
function crestTexture(): DataTexture {
  const n = 256
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x - 128
      const dy = y - 124
      const r = Math.hypot(dx, dy)
      if (r > 122) continue
      const a = Math.atan2(dy, dx)
      if (r > 112) {
        put(data, n, x, y, GOLD)
        continue
      }
      if (r > 92) {
        // Laurel: a scalloped gold wreath riding an ink ground.
        put(data, n, x, y, Math.sin(a * 15) > 0.15 ? GOLD : INK)
        continue
      }
      const half = shieldHalfWidth(dy)
      if (half === 0 || Math.abs(dx) > half) {
        put(data, n, x, y, INK)
        continue
      }
      const edge = Math.abs(dx) > half - 6 || dy < -68 || dy > 74
      const cross = Math.abs(dx) < 6 || Math.abs(dy + 12) < 6
      if (edge || cross) put(data, n, x, y, GOLD)
      else paintQuarter(data, n, x, y, dx, dy)
    }
  }
  return finishTexture(data, n, n)
}

/**
 * Gold wordmark on a gold-bordered ink badge, alpha-cut outside the badge so the
 * plate reads as applied signage rather than a black rectangle on the fascia.
 */
function wordmarkTexture(word: string): DataTexture {
  const w = 1024
  const h = 192
  const cell = 26
  const padX = 24
  const padY = 12
  const data = new Uint8Array(w * h * 4)
  for (let y = padY; y < h - padY; y++) {
    for (let x = padX; x < w - padX; x++) {
      const border = x < padX + 7 || x >= w - padX - 7 || y < padY + 7 || y >= h - padY - 7
      put(data, w, x, y, border ? GOLD : INK)
    }
  }
  const advance = cell * 3 + Math.max(4, Math.round(cell * 0.4))
  const inkWidth = (word.length - 1) * advance + cell * 3
  writeGlyphWord(data, w, Math.round((w - inkWidth) / 2), Math.round((h - cell * 5) / 2), word, GOLD, cell)
  return finishTexture(data, w, h)
}

/** Vertical Schuler panels along X or Z. Widths cycle by index, not a PRNG. */
function paneledWall(
  span: number,
  height: number,
  thick: number,
  count: number,
  along: 'x' | 'z',
): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const scales = [1, 0.92, 1.06] as const
  let cursor = -span / 2
  for (let i = 0; i < count; i++) {
    const remaining = count - i
    const raw = (span - (cursor + span / 2)) / remaining
    const pw = Math.min(raw - REVEAL, raw * scales[i % 3]!)
    const mid = cursor + pw / 2
    if (along === 'x') parts.push(bevelBox(pw, height, thick, 0.012).translate(mid, 0, 0))
    else parts.push(bevelBox(thick, height, pw, 0.012).translate(0, 0, mid))
    cursor += pw + REVEAL
  }
  return parts
}

interface Bay {
  mid: number
  span: number
  /** The bay lands against a corner pier, so the working storeys blank it to panel. */
  corner: boolean
}

/**
 * One clear elevation run cut into bays by its mid piers. Solving the grid once
 * keeps the glazing and the blanked cladding registered to the same pier line.
 */
function bayRun(a: number, b: number, piers: readonly number[], bothEnds: boolean): Bay[] {
  const cuts: number[] = [a]
  for (const p of piers) cuts.push(p - SIDE_PIER / 2, p + SIDE_PIER / 2)
  cuts.push(b)
  const last = cuts.length / 2 - 1
  const bays: Bay[] = []
  for (let i = 0; i <= last; i++) {
    const lo = cuts[i * 2]!
    const hi = cuts[i * 2 + 1]!
    bays.push({ mid: (lo + hi) / 2, span: hi - lo, corner: i === last || (bothEnds && i === 0) })
  }
  return bays
}

/** The five bays of one flank, closed by a corner pier at each end. */
function flankBays(zEdge: number): Bay[] {
  return bayRun(-zEdge, zEdge, SIDE_PIERS.map((f) => f * zEdge), true)
}

/** The two bays of one front wing, running outward from the atrium jamb. */
function wingBays(xEdge: number): Bay[] {
  return bayRun(ATRIUM_HALF, xEdge, [ATRIUM_HALF + WING_PIER * (xEdge - ATRIUM_HALF)], false)
}

function storeyBand(s: number): { vip: boolean; sill: number; gh: number; head: number } {
  const vip = s === 1
  const sill = vip ? 0.48 : 0.95
  const gh = STOREY * (vip ? 0.78 : 0.38)
  return { vip, sill, gh, head: Math.max(0.28, STOREY - sill - gh - 0.04) }
}

/**
 * The corner bay of each run, blanked to cladding on one working storey: a solid
 * backing pane behind a proud panelled face. Glass previously ran the whole
 * length of every band, so the flanks read as one mirror curtain slung between
 * the ribbons instead of pier-framed mass.
 */
function blankCornerBays(env: Envelope, s: number, band: BufferGeometry[]): void {
  const { w, d, xEdge, zEdge } = env
  const { sill, gh } = storeyBand(s)
  const y0 = s * STOREY
  // Set back behind the pier faces. Cladding on the same plane as the piers made
  // the whole corner one grooved slab; at this depth the pier returns show and
  // the bay reads as panel held inside a frame.
  const setBack = WALL / 2 + 0.14
  const blank = (span: number, along: 'x' | 'z', ox: number, oz: number, out: number): void => {
    const solid = along === 'z'
      ? bevelBox(WALL, gh + 0.06, span, 0.012)
      : bevelBox(span, gh + 0.06, WALL, 0.012)
    band.push(solid.translate(ox, y0 + sill + gh / 2, oz))
    // The face runs the whole storey, ribbon to ribbon. Cladding only the glazing
    // band left the bay as a quilt of spandrel and infill courses.
    for (const part of paneledWall(span - 0.12, STOREY - 0.16, 0.14, 3, along)) {
      if (along === 'z') part.translate(ox + out * 0.17, y0 + STOREY / 2, oz)
      else part.translate(ox, y0 + STOREY / 2, oz + out * 0.17)
      band.push(part)
    }
  }
  for (const bay of flankBays(zEdge)) {
    if (!bay.corner) continue
    for (const sx of [-1, 1] as const) blank(bay.span, 'z', sx * (w / 2 - setBack), bay.mid, sx)
  }
  for (const bay of wingBays(xEdge)) {
    if (!bay.corner) continue
    for (const sx of [-1, 1] as const) blank(bay.span, 'x', sx * bay.mid, d / 2 - setBack, 1)
  }
}

/**
 * Panelled walls, corner piers and the structural slabs. The slabs are cut into a
 * rear plate and two wing plates so the atrium stays a void through all three
 * storeys rather than a hole in a façade backed by continuous floor.
 */
function buildWalls(env: Envelope): { dark: BufferGeometry[]; light: BufferGeometry[] } {
  const { w, d, h, xEdge, zEdge, atriumZ0, atriumZ1 } = env
  const dark: BufferGeometry[] = []
  const light: BufferGeometry[] = []
  const wing = (w - ATRIUM_W) / 2 - WALL
  const pierW = PIER + PIER_PROUD
  const pierX = w / 2 - PIER / 2 + PIER_PROUD / 2
  const pierZ = d / 2 - PIER / 2 + PIER_PROUD / 2

  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      dark.push(bevelBox(pierW, h, PIER, 0.02).translate(
        sx * pierX, h / 2, sz * (d / 2 - PIER / 2),
      ))
    }
    // A single glazed run spanned each seventeen-metre flank, so the shell read as
    // curtain wall. These piers carry through the full height and stand proud of
    // the glass, which is what turns each run into a separately framed bay.
    for (const f of SIDE_PIERS) {
      dark.push(bevelBox(pierW, h, SIDE_PIER, 0.02).translate(sx * pierX, h / 2, f * zEdge))
    }
    dark.push(bevelBox(SIDE_PIER, h, pierW, 0.02).translate(
      sx * (ATRIUM_HALF + WING_PIER * (xEdge - ATRIUM_HALF)), h / 2, pierZ,
    ))
  }

  for (let s = 0; s < STOREYS; s++) {
    const y0 = s * STOREY
    const band = s === 1 ? light : dark
    const { vip, sill, gh, head } = storeyBand(s)
    const sideN = 7 + (s % 2)
    const frontN = 3 + (s % 2)
    const stack = (span: number, along: 'x' | 'z', count: number, ox: number, oz: number): void => {
      for (const part of paneledWall(span, sill, WALL, count, along)) {
        part.translate(ox, y0 + sill / 2, oz)
        band.push(part)
      }
      for (const part of paneledWall(span, head, WALL, count, along)) {
        part.translate(ox, y0 + sill + gh + head / 2, oz)
        band.push(part)
      }
    }
    stack(d, 'z', sideN, -(w / 2 - WALL / 2), 0)
    stack(d, 'z', sideN, w / 2 - WALL / 2, 0)
    stack(wing, 'x', frontN, -(w / 2 + ATRIUM_W / 2) / 2, d / 2 - WALL / 2)
    stack(wing, 'x', frontN, (w / 2 + ATRIUM_W / 2) / 2, d / 2 - WALL / 2)

    if (!vip) blankCornerBays(env, s, band)
    // The rear is back of house: solid full height, so nothing looks through it.
    for (const part of paneledWall(w - WALL * 2, STOREY - 0.04, WALL, 8, 'x')) {
      part.translate(0, y0 + (STOREY - 0.04) / 2, -(d / 2 - WALL / 2))
      band.push(part)
    }

    if (s === STOREYS - 1) continue
    const rearDepth = atriumZ0 + (d / 2 - WALL)
    dark.push(bevelBox(w - WALL * 2, 0.12, rearDepth, 0.01).translate(
      0, y0 + STOREY, -(d / 2 - WALL) + rearDepth / 2,
    ))
    const wingPlate = w / 2 - WALL - ATRIUM_HALF
    for (const sx of [-1, 1] as const) {
      dark.push(bevelBox(wingPlate, 0.12, ATRIUM_D, 0.01).translate(
        sx * (ATRIUM_HALF + wingPlate / 2), y0 + STOREY, (atriumZ0 + atriumZ1) / 2,
      ))
    }
  }
  return { dark, light }
}

/**
 * Glazing spans are solved to the piers and the atrium jambs so no band is left
 * open. Every pane is backed further in by an opaque partition, which is what
 * turns the glass from a hole into a lit room.
 */
function buildGlazing(env: Envelope): {
  panes: BufferGeometry[]
  frames: BufferGeometry[]
  backing: BufferGeometry[]
} {
  const { w, d, h, xEdge, zEdge, atriumZ0 } = env
  const panes: BufferGeometry[] = []
  const frames: BufferGeometry[] = []
  const backing: BufferGeometry[] = []

  for (let s = 0; s < STOREYS; s++) {
    const { vip, sill, gh } = storeyBand(s)
    const yMid = s * STOREY + sill + gh / 2
    // Only the hospitality storey keeps a bay at each corner; below and above it
    // those bays are cladding, so the glazing stops short of the corner piers.
    const faces: { x: number; z: number; sx: number; sz: number; split: number }[] = []
    for (const bay of wingBays(xEdge)) {
      if (bay.corner && !vip) continue
      for (const sx of [-1, 1] as const) {
        faces.push({ x: sx * bay.mid, z: d / 2 + 0.02, sx: bay.span, sz: 0.04, split: 2 })
      }
    }
    for (const bay of flankBays(zEdge)) {
      if (bay.corner && !vip) continue
      for (const sx of [-1, 1] as const) {
        faces.push({ x: sx * (w / 2 - 0.08), z: bay.mid, sx: 0.04, sz: bay.span, split: 2 })
      }
    }
    for (const face of faces) {
      panes.push(bevelBox(face.sx, gh, face.sz, 0.004).translate(face.x, yMid, face.z))
      const horizontal = face.sx >= face.sz
      for (let k = 0; k <= face.split; k++) {
        const t = k / face.split
        if (horizontal) {
          const x = face.x - face.sx / 2 + t * face.sx
          frames.push(bevelBox(0.06, gh + 0.08, 0.07, 0.004).translate(x, yMid, face.z + 0.02))
        } else {
          const z = face.z - face.sz / 2 + t * face.sz
          frames.push(bevelBox(0.07, gh + 0.08, 0.06, 0.004).translate(face.x + 0.02, yMid, z))
        }
      }
      for (const edge of [-1, 1] as const) {
        frames.push(bevelBox(
          horizontal ? face.sx : 0.07,
          0.06,
          horizontal ? 0.07 : face.sz,
          0.004,
        ).translate(face.x, yMid + edge * gh / 2, face.z + (horizontal ? 0.02 : 0)))
      }
    }

    // Back-of-house partitions, set 1.25 m in so the windows still read as deep
    // reveals. The ground floor keeps its hero rear wall clear of them.
    if (s === 0) continue
    for (const sx of [-1, 1] as const) {
      backing.push(bevelBox(0.16, STOREY - 0.24, atriumZ0 + zEdge, 0.01).translate(
        sx * (w / 2 - 1.25), s * STOREY + STOREY / 2, (atriumZ0 - zEdge) / 2,
      ))
    }
  }

  panes.push(bevelBox(ATRIUM_HALF * 2 + 0.1, h - 0.4, 0.05, 0.004).translate(0, h / 2, d / 2 - 0.09))
  for (const sx of [-1, 1] as const) {
    frames.push(bevelBox(0.09, h - 0.3, 0.1, 0.006).translate(
      sx * (ATRIUM_HALF + 0.02), h / 2, d / 2 - 0.02,
    ))
  }
  return { panes, frames, backing }
}

interface AtriumParts {
  cream: BufferGeometry[]
  dark: BufferGeometry[]
  stone: BufferGeometry[]
  glassParts: BufferGeometry[]
  steel: BufferGeometry[]
  lume: BufferGeometry[]
}

/**
 * The atrium: flanking walls, a finned feature wall at the back, a gallery and a
 * bridge crossing the void, a reception desk and a hanging light column. Together
 * they give the look-through something to land on at four different depths.
 */
function buildAtrium(env: Envelope): AtriumParts {
  const { d, h, atriumZ0, atriumZ1 } = env
  const out: AtriumParts = { cream: [], dark: [], stone: [], glassParts: [], steel: [], lume: [] }
  const midZ = (atriumZ0 + atriumZ1) / 2

  for (const sx of [-1, 1] as const) {
    out.cream.push(bevelBox(0.18, h - 0.2, ATRIUM_D, 0.014).translate(
      sx * ATRIUM_HALF, (h - 0.2) / 2 + 0.1, midZ,
    ))
  }

  out.cream.push(bevelBox(ATRIUM_HALF * 2 + 0.36, h - 0.2, 0.22, 0.014).translate(
    0, (h - 0.2) / 2 + 0.1, atriumZ0 - 0.11,
  ))
  const fins = 11
  for (let i = 0; i < fins; i++) {
    const x = -ATRIUM_HALF + 0.36 + i * ((ATRIUM_HALF * 2 - 0.72) / (fins - 1))
    out.dark.push(bevelBox(0.1, h - 1.1, 0.1, 0.008).translate(x, (h - 1.1) / 2 + 0.35, atriumZ0 + 0.04))
  }
  out.lume.push(bevelBox(ATRIUM_HALF * 2 - 0.5, 0.07, 0.05, 0.004).translate(0, 0.34, atriumZ0 + 0.09))

  // Gallery hugging the feature wall, and a bridge crossing the void above it.
  for (const [level, depth, offset] of [[1, 1.15, 0.62], [2, 1.65, 0.9]] as const) {
    const y = level * STOREY
    const z = atriumZ0 + offset
    out.cream.push(bevelBox(ATRIUM_HALF * 2, 0.16, depth, 0.012).translate(0, y - 0.08, z))
    out.glassParts.push(bevelBox(ATRIUM_HALF * 2 - 0.1, 1, 0.026, 0.003).translate(
      0, y + 0.5, z + depth / 2,
    ))
    out.steel.push(member(
      new Vector3(-ATRIUM_HALF + 0.05, y + 1.03, z + depth / 2),
      new Vector3(ATRIUM_HALF - 0.05, y + 1.03, z + depth / 2),
      0.026,
      8,
    ))
  }

  out.dark.push(bevelBox(3.3, 0.92, 0.62, 0.02).translate(-0.75, 0.66, atriumZ0 + 0.62))
  out.stone.push(bevelBox(3.5, 0.07, 0.76, 0.01).translate(-0.75, 1.15, atriumZ0 + 0.62))
  out.lume.push(bevelBox(3.1, 0.05, 0.04, 0.003).translate(-0.75, 0.27, atriumZ0 + 0.95))

  // Hanging light column down the void — the strongest single depth cue through
  // the front glazing, and it never touches the stair flights behind it.
  const columnZ = atriumZ0 + 2.35
  const rings = 10
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1)
    const y = h - 0.55 - t * 5.9
    const r = 0.88 - t * 0.42
    const ring = bevelRing(r - 0.11, r, 0.07, 0.012, 28)
    ring.rotateX(-Math.PI / 2)
    ring.translate(0, y, columnZ)
    out.lume.push(ring)
  }
  out.steel.push(member(
    new Vector3(0, h - 0.3, columnZ),
    new Vector3(0, h - 6.4, columnZ),
    0.024,
    6,
  ))

  const stair: BufferGeometry[] = []
  const treads = 16
  const rise = (h - 1.2) / treads
  for (let i = 0; i < treads; i++) {
    const flight = i < 8 ? 0 : 1
    const local = flight === 0 ? i : i - 8
    const x = flight === 0 ? -1.35 + local * 0.32 : 1.15 - local * 0.32
    const z = d / 2 - 1.45 - flight * 0.62
    stair.push(bevelBox(1.25, 0.09, 0.34, 0.012).translate(x, 0.32 + i * rise, z))
  }
  out.stone.push(...stair)
  for (let f = 0; f < 2; f++) {
    out.glassParts.push(bevelBox(2.7, h * 0.48, 0.02, 0.003).translate(
      0, 0.4 + (f + 0.5) * (h * 0.42), d / 2 - 1.28 - f * 0.62,
    ))
  }
  return out
}

interface EntryParts {
  cream: BufferGeometry[]
  ivory: BufferGeometry[]
  gold: BufferGeometry[]
  dark: BufferGeometry[]
  stone: BufferGeometry[]
  glassParts: BufferGeometry[]
  steel: BufferGeometry[]
  lume: BufferGeometry[]
}

/** Forecourt, steps, cheek walls, entrance screen and the deep entry canopy. */
function buildEntry(env: Envelope): EntryParts {
  const { d } = env
  const out: EntryParts = {
    cream: [], ivory: [], gold: [], dark: [],
    stone: [], glassParts: [], steel: [], lume: [],
  }
  const front = d / 2
  const porchW = ATRIUM_W + 3.2

  out.stone.push(bevelBox(porchW, 0.18, 2.9, 0.016).translate(0, 0.09, front + 1.45))
  out.stone.push(bevelBox(porchW - 0.5, 0.12, 0.4, 0.014).translate(0, 0.06, front + 3.1))
  out.stone.push(bevelBox(porchW - 1.1, 0.06, 0.4, 0.012).translate(0, 0.03, front + 3.5))
  for (const sx of [-1, 1] as const) {
    out.cream.push(bevelBox(0.34, 0.66, 3.4, 0.02).translate(
      sx * (porchW / 2 - 0.17), 0.33, front + 1.7,
    ))
    out.dark.push(bevelBox(0.72, 0.78, 0.72, 0.02).translate(
      sx * (porchW / 2 + 0.62), 0.39, front + 2.6,
    ))
  }

  for (let i = 0; i < 4; i++) {
    const x = -1.65 + i * 1.1
    out.glassParts.push(bevelBox(1.02, 2.5, 0.05, 0.004).translate(x, 1.32, front + 0.03))
    out.steel.push(bevelBox(0.07, 2.56, 0.08, 0.005).translate(x - 0.53, 1.32, front + 0.06))
  }
  out.steel.push(bevelBox(0.07, 2.56, 0.08, 0.005).translate(1.83, 1.32, front + 0.06))
  out.steel.push(bevelBox(4.5, 0.09, 0.1, 0.006).translate(0, 2.62, front + 0.07))
  for (const sx of [-1, 1] as const) {
    out.steel.push(bevelBox(0.06, 0.34, 0.06, 0.004).translate(sx * 0.12, 1.15, front + 0.11))
  }

  // A 0.2 m plate on tension rods left the threshold thinner than any ribbon on
  // the shell above it, so the entry never matched the mass language. The canopy
  // is now a full section: a deep beam wrapped in an ivory fascia with its own
  // gold coachline, over a soffit set well up inside that fascia.
  const canopyZ = front + 1.45
  const canopyW = ATRIUM_W + 3.8
  const canopyD = 3.3
  const canopyY = 3.1
  const fasciaH = RIBBON_H + 0.16
  const fasciaT = 0.3
  const fasciaBot = canopyY - fasciaH / 2
  const fasciaZ = canopyZ + canopyD / 2 - fasciaT / 2
  const coachY = fasciaBot + 0.1
  out.dark.push(bevelBox(canopyW - 0.5, 0.5, canopyD - 0.5, 0.02).translate(
    0, canopyY + 0.12, canopyZ,
  ))
  out.dark.push(bevelBox(canopyW - 1.2, 0.1, canopyD - 1.2, 0.014).translate(
    0, fasciaBot + 0.17, canopyZ,
  ))
  out.ivory.push(bevelBox(canopyW, fasciaH, fasciaT, 0.016).translate(0, canopyY, fasciaZ))
  out.gold.push(bevelBox(canopyW + 0.06, 0.13, fasciaT + 0.06, 0.012).translate(
    0, coachY, fasciaZ + 0.02,
  ))
  for (const sx of [-1, 1] as const) {
    out.ivory.push(bevelBox(fasciaT, fasciaH, canopyD, 0.016).translate(
      sx * (canopyW / 2 - fasciaT / 2), canopyY, canopyZ,
    ))
    out.gold.push(bevelBox(fasciaT + 0.06, 0.13, canopyD + 0.06, 0.012).translate(
      sx * (canopyW / 2 - fasciaT / 2 + 0.02), coachY, canopyZ,
    ))
    out.steel.push(member(
      new Vector3(sx * 3.1, canopyY + fasciaH / 2 + 0.02, canopyZ + canopyD / 2 - 0.4),
      new Vector3(sx * 2.5, 5.05, front + 0.12),
      0.045,
      8,
    ))
  }
  for (let i = 0; i < 6; i++) {
    const disc = bevelDisc(0.12, 0.035, 0.006, 16)
    disc.rotateX(Math.PI / 2)
    disc.translate(-2.75 + i * 1.1, fasciaBot + 0.07, canopyZ + 0.1)
    out.lume.push(disc)
  }
  return out
}

/**
 * Proud floor-line ribbons wrapping all four façades: an ivory fascia standing off
 * the panel plane over a bold gold coachline, with a hairline repeat under the
 * fascia's top edge. A one-line hairline pinstripe disappeared at beauty
 * distance, which left the shell reading as generic white banding.
 */
function buildRibbons(env: Envelope): { cream: BufferGeometry[]; gold: BufferGeometry[] } {
  const { w, d, h } = env
  const cream: BufferGeometry[] = []
  const gold: BufferGeometry[] = []
  const drop = RIBBON_H / 2 - PINSTRIPE_H / 2
  const lift = RIBBON_H / 2 - 0.1
  for (const y of [STOREY, STOREY * 2, h - 0.16]) {
    // The roofline ribbon merges into the crown fascia and the roof slab sits
    // directly over it, so up there the second line would never be seen.
    const doubled = y < h - 1
    for (const sz of [-1, 1] as const) {
      cream.push(bevelBox(w + 0.5, RIBBON_H, RIBBON_Z, 0.016).translate(0, y, sz * (d / 2 + 0.08)))
      gold.push(bevelBox(w + 0.56, PINSTRIPE_H, RIBBON_Z + 0.08, 0.012).translate(
        0, y - drop, sz * (d / 2 + 0.12),
      ))
      if (doubled) {
        gold.push(bevelBox(w + 0.56, 0.06, RIBBON_Z + 0.05, 0.01).translate(
          0, y + lift, sz * (d / 2 + 0.1),
        ))
      }
    }
    for (const sx of [-1, 1] as const) {
      cream.push(bevelBox(RIBBON_Z, RIBBON_H, d + 0.5, 0.016).translate(sx * (w / 2 + 0.08), y, 0))
      gold.push(bevelBox(RIBBON_Z + 0.08, PINSTRIPE_H, d + 0.56, 0.012).translate(
        sx * (w / 2 + 0.12), y - drop, 0,
      ))
      if (doubled) {
        gold.push(bevelBox(RIBBON_Z + 0.05, 0.06, d + 0.56, 0.01).translate(
          sx * (w / 2 + 0.1), y + lift, 0,
        ))
      }
    }
  }
  return { cream, gold }
}

/** Roof slab, parapet, pergola and terrace rail. */
function buildTerrace(env: Envelope): {
  cream: BufferGeometry[]
  dark: BufferGeometry[]
  gold: BufferGeometry[]
  steel: BufferGeometry[]
} {
  const { w, d, h } = env
  const cream: BufferGeometry[] = []
  const dark: BufferGeometry[] = []
  const gold: BufferGeometry[] = []
  const steel: BufferGeometry[] = []

  cream.push(bevelBox(w + 0.35, 0.14, d + 0.35, 0.012).translate(0, h + 0.07, 0))
  // The crown of the house. A thin upstand let the terrace read as an open tray,
  // so the parapet is now a full guard wall with its own gold coping.
  const parapetY = h + 0.14 + PARAPET_H / 2
  const copingY = h + 0.14 + PARAPET_H
  for (const sz of [-1, 1] as const) {
    cream.push(bevelBox(w + 0.44, PARAPET_H, PARAPET_T, 0.016).translate(
      0, parapetY, sz * (d / 2 + 0.1),
    ))
    gold.push(bevelBox(w + 0.5, 0.07, PARAPET_T + 0.06, 0.012).translate(
      0, copingY, sz * (d / 2 + 0.1),
    ))
  }
  for (const sx of [-1, 1] as const) {
    cream.push(bevelBox(PARAPET_T, PARAPET_H, d + 0.44, 0.016).translate(
      sx * (w / 2 + 0.1), parapetY, 0,
    ))
    gold.push(bevelBox(PARAPET_T + 0.06, 0.07, d + 0.5, 0.012).translate(
      sx * (w / 2 + 0.1), copingY, 0,
    ))
  }

  const slatN = 20
  for (let i = 0; i < slatN; i++) {
    const z = -d / 2 + 0.45 + (i + 0.5) * ((d - 0.9) / slatN)
    dark.push(bevelBox(w - 0.7, 0.16, 0.22, 0.008).translate(0, h + TERRACE + 0.95, z))
  }
  for (const sx of [-1, 1] as const) {
    dark.push(bevelBox(0.22, TERRACE + 1.15, d - 0.5, 0.012).translate(
      sx * (w / 2 - 0.42), h + (TERRACE + 1.15) / 2, 0,
    ))
  }
  for (const sz of [-1, 1] as const) {
    dark.push(bevelBox(w - 0.7, 0.2, 0.24, 0.01).translate(0, h + TERRACE + 1.22, sz * (d / 2 - 0.4)))
  }
  dark.push(bevelBox(w - 0.55, 0.12, d - 0.55, 0.01).translate(0, h + TERRACE + 0.78, 0))

  const railH = copingY + 0.2
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      steel.push(member(
        new Vector3(sx * w / 2, h + 0.12, sz * d / 2),
        new Vector3(sx * w / 2, railH, sz * d / 2),
        0.03,
        6,
      ))
    }
    steel.push(member(
      new Vector3(sx * w / 2, railH, -d / 2),
      new Vector3(sx * w / 2, railH, d / 2),
      0.024,
      6,
    ))
  }
  for (const sz of [-1, 1] as const) {
    steel.push(member(
      new Vector3(-w / 2, railH, sz * d / 2),
      new Vector3(w / 2, railH, sz * d / 2),
      0.024,
      6,
    ))
  }
  return { cream, dark, gold, steel }
}

export function createModel(options: F1TeamMotorhomeOptions = {}): F1TeamMotorhomeInstance {
  const config: F1TeamMotorhomeConfig = {
    width: Math.max(10, options.width ?? defaults.width),
    depth: Math.max(12, options.depth ?? defaults.depth),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const extras: Material[] = []
  const textures: DataTexture[] = []

  const blackMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome black',
    color: shade(TOKEN.INK_950, 0.06),
    roughness: 0.62,
    metalness: 0.08,
  })
  const creamMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome cream',
    // SHELL-050 carried a cool cast that rendered as site-office white. This is
    // that token pulled toward DUST-300 far enough to survive the key light,
    // which is the warm off-white the real coachwork is finished in.
    color: 0xdfd9c6,
    roughness: 0.7,
    metalness: 0.02,
  })
  const glassMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome glass',
    color: 0x0d161d,
    roughness: 0.07,
    metalness: 0.5,
    transparent: true,
    opacity: 0.62,
  })
  const woodMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome wood',
    color: shade(TOKEN.DUST_300, -0.28),
    roughness: 0.68,
    metalness: 0.04,
  })
  const stoneMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome stone',
    color: shade(TOKEN.DUST_300, -0.08),
    roughness: 0.78,
    metalness: 0.02,
  })
  const greyMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome grey',
    color: shade(TOKEN.SLATE_650, 0.12),
    roughness: 0.82,
    metalness: 0.02,
  })
  const fireMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome fire',
    color: TOKEN.ORANGE_500,
    emissive: TOKEN.AMBER_400,
    emissiveIntensity: 2.4,
    roughness: 0.42,
    metalness: 0,
    toneMapped: false,
  })
  extras.push(blackMat, creamMat, glassMat, woodMat, stoneMat, greyMat, fireMat)

  const materialSlots: Record<Slot, Material> = {
    shell: options.materials?.shell ?? blackMat,
    glass: options.materials?.glass ?? glassMat,
    deck: options.materials?.deck ?? creamMat,
  }

  const root = new Group()
  root.name = 'f1-team-motorhome'
  const shell = new Group(); shell.name = 'shell'
  const glass = new Group(); glass.name = 'glass'
  const deck = new Group(); deck.name = 'deck'
  root.add(shell, glass, deck)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { shell: [], glass: [], deck: [] }
  const groups: Record<Slot, Group> = { shell, glass, deck }
  const kitRoot = new Group()
  kitRoot.name = 'interior-kit'
  root.add(kitRoot)
  const kitLive: InteriorLive[] = []

  const releaseKit = (): void => {
    for (const instance of kitLive) instance.dispose()
    kitLive.length = 0
  }

  const releaseGenerated = (): void => {
    releaseKit()
    shell.clear(); glass.clear(); deck.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
    for (const texture of textures) texture.dispose()
    textures.length = 0
    for (let i = PERSIST; i < extras.length; i++) extras[i]!.dispose()
    extras.length = PERSIST
  }

  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string, material?: Material): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, material ?? materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const interiorMats = (): InteriorMats => ({
    black: blackMat,
    cream: creamMat,
    glass: glassMat,
    wood: woodMat,
    stone: stoneMat,
    grey: greyMat,
    fire: fireMat,
    kit: { graphite: kit.graphite, steel: kit.steel, ink: kit.ink, cobalt: kit.cobalt },
  })

  /** Crest medallion and wordmark plates, mounted proud on an ivory crown band. */
  const buildSignage = (
    env: Envelope,
    gold: BufferGeometry[],
    cream: BufferGeometry[],
    dark: BufferGeometry[],
  ): void => {
    const { w, d, h } = env
    const crownY = h - 0.52

    cream.push(bevelBox(w + 0.56, 0.9, 0.42, 0.016).translate(0, crownY, d / 2 + 0.12))
    for (const sx of [-1, 1] as const) {
      cream.push(bevelBox(0.42, 0.9, d + 0.56, 0.016).translate(sx * (w / 2 + 0.12), crownY, 0))
    }

    const bladeY = STOREY + 1.55
    cream.push(bevelBox(ATRIUM_HALF * 2 + 0.5, 2.44, 0.32, 0.02).translate(0, bladeY, d / 2 + 0.1))
    // A gold-framed ink field for the heraldry to sit on. Mounted straight onto
    // the ivory blade the crest read as a decal on a billboard rather than as the
    // house's badge, and the blade itself carried most of the value.
    gold.push(bevelBox(3.72, 2.36, 0.14, 0.014).translate(0, bladeY, d / 2 + 0.28))
    dark.push(bevelBox(3.56, 2.24, 0.16, 0.018).translate(0, bladeY, d / 2 + 0.3))

    // Cast-badge profile. Two shallow steps still read as a decal ringed in gold,
    // so the flange now laps the plaque out to the gold margin, the collar is a
    // heavy band standing half a metre off it, and the crest sits down inside
    // that collar rather than on top of the stack.
    const bezelZ = d / 2 + 0.42
    const flange = bevelRing(0.98, 1.18, 0.24, 0.022, 56)
    flange.translate(0, bladeY, bezelZ)
    gold.push(flange)
    const collar = bevelRing(0.84, 1.04, 0.48, 0.024, 56)
    collar.translate(0, bladeY, bezelZ + 0.15)
    gold.push(collar)
    const bezel = bevelDisc(0.9, 0.32, 0.02, 48)
    bezel.translate(0, bladeY, bezelZ + 0.1)
    gold.push(bezel)
    // Cast bosses straddling the flange. A turned ring on its own photographs as
    // a printed circle; the notch rhythm is what says the bezel was cast.
    const bosses = 12
    for (let i = 0; i < bosses; i++) {
      const a = (i / bosses) * Math.PI * 2 + Math.PI / bosses
      gold.push(bevelBox(0.17, 0.17, 0.26, 0.018).translate(
        Math.cos(a) * 1.08, bladeY + Math.sin(a) * 1.08, bezelZ + 0.02,
      ))
    }

    const crestTex = crestTexture()
    textures.push(crestTex)
    const crestMat = new MeshStandardMaterial({
      name: 'f1-kit / motorhome crest',
      map: crestTex,
      transparent: true,
      alphaTest: 0.5,
      side: DoubleSide,
      roughness: 0.4,
      metalness: 0.28,
    })
    extras.push(crestMat)
    const crest = new PlaneGeometry(1.7, 1.7)
    crest.translate(0, bladeY, bezelZ + 0.28 + LAYER_CLEARANCE)
    emit('shell', crest, shell, 'crest', crestMat)

    const wordTex = wordmarkTexture('CADILLAC')
    textures.push(wordTex)
    const wordMat = new MeshStandardMaterial({
      name: 'f1-kit / motorhome wordmark',
      map: wordTex,
      transparent: true,
      alphaTest: 0.5,
      side: DoubleSide,
      roughness: 0.44,
      metalness: 0.18,
    })
    extras.push(wordMat)

    const frontWord = new PlaneGeometry(4.3, 0.806)
    frontWord.translate(4.6, crownY, d / 2 + 0.36 + LAYER_CLEARANCE)
    emit('shell', frontWord, shell, 'wordmark-front', wordMat)

    for (const sx of [-1, 1] as const) {
      const sideWord = new PlaneGeometry(4.3, 0.806)
      sideWord.rotateY(sx * Math.PI / 2)
      sideWord.translate(sx * (w / 2 + 0.36 + LAYER_CLEARANCE), crownY, sx * 1.2)
      emit('shell', sideWord, shell, sx < 0 ? 'wordmark-left' : 'wordmark-right', wordMat)
    }
  }

  const rebuild = (): void => {
    releaseGenerated()
    const w = config.width
    const d = config.depth
    const h = STOREYS * STOREY
    const env: Envelope = {
      w,
      d,
      h,
      xEdge: w / 2 - PIER,
      zEdge: d / 2 - PIER,
      atriumZ1: d / 2 - WALL,
      atriumZ0: d / 2 - WALL - ATRIUM_D,
    }

    const goldMat = new MeshStandardMaterial({
      name: 'f1-kit / motorhome gold',
      // Fully metallic gold only shows where it catches a specular, which is why
      // the coachlines sank into the panelling. Part-metal keeps a diffuse lift.
      color: 0xd8b869,
      roughness: 0.34,
      metalness: 0.62,
    })
    const lumeMat = new MeshStandardMaterial({
      name: 'f1-kit / motorhome lume',
      color: 0xf6efdd,
      emissive: 0xffe6b4,
      emissiveIntensity: 1.35,
      roughness: 0.5,
      metalness: 0,
      toneMapped: false,
    })
    // The brand banding is warmer and glossier than the interior cream, so it is
    // its own material rather than sharing the general shell tone.
    const ivoryMat = new MeshStandardMaterial({
      name: 'f1-kit / motorhome ivory',
      color: 0xe8dbb6,
      roughness: 0.6,
      metalness: 0.03,
    })
    extras.push(goldMat, lumeMat, ivoryMat)

    emit('shell', bevelBox(w + 0.6, 0.18, d + 0.6, 0.02).translate(0, 0.09, 0), shell, 'plinth', kit.graphite)

    const walls = buildWalls(env)
    const glazing = buildGlazing(env)
    const atrium = buildAtrium(env)
    const entry = buildEntry(env)
    const ribbons = buildRibbons(env)
    const terrace = buildTerrace(env)

    const dark = [...walls.dark, ...glazing.backing, ...atrium.dark, ...entry.dark, ...terrace.dark]
    const light = [...walls.light, ...atrium.cream, ...entry.cream]
    const ivory = [...ribbons.cream, ...terrace.cream, ...entry.ivory]
    const gold = [...ribbons.gold, ...terrace.gold, ...entry.gold]
    buildSignage(env, gold, ivory, dark)

    emit('shell', mergeParts(dark, 'mass-dark'), shell, 'mass-dark', blackMat)
    emit('shell', mergeParts(light, 'mass-cream'), shell, 'mass-cream', creamMat)
    emit('shell', mergeParts(ivory, 'mass-ivory'), shell, 'mass-ivory', ivoryMat)
    emit('shell', mergeParts(gold, 'trim-gold'), shell, 'trim-gold', goldMat)
    emit('shell', mergeParts(glazing.frames, 'mullions'), shell, 'mullions', kit.graphite)
    emit('glass', mergeParts(
      [...glazing.panes, ...atrium.glassParts, ...entry.glassParts],
      'glazing',
    ), glass, 'glazing', glassMat)
    emit('deck', mergeParts([...atrium.stone, ...entry.stone], 'stonework'), deck, 'stonework', stoneMat)
    emit('deck', mergeParts(
      [...atrium.steel, ...entry.steel, ...terrace.steel],
      'metalwork',
    ), deck, 'metalwork', kit.steel)
    emit('deck', mergeParts([...atrium.lume, ...entry.lume], 'lume'), deck, 'lume', lumeMat)

    const hearth = bevelDisc(0.55, 0.05, 0.01, 16)
    hearth.rotateX(-Math.PI / 2)
    hearth.translate(w / 2 - 1.4, h + 0.2, -d / 2 + 1.2)
    emit('deck', hearth, deck, 'hearth', kit.graphite)

    dressInterior(w, d, (slot, geometry, name, material) => {
      emit(slot, geometry, groups[slot], name, material)
    }, interiorMats(), textures, extras, (instance, x, y, z, yaw = 0) => {
      instance.root.position.set(x, y, z)
      instance.root.rotation.y = yaw
      kitRoot.add(instance.root)
      kitLive.push(instance)
    })
  }
  rebuild()

  return {
    root,
    parts: { shell, glass, deck },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.width !== undefined) config.width = Math.max(10, patch.width)
      if (patch.depth !== undefined) config.depth = Math.max(12, patch.depth)
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      kitRoot.removeFromParent()
      for (const material of extras) material.dispose()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0, 5.2, 2],
    distance: 32,
    fov: 30,
    yaw: 0.72,
    pitch: 0.18,
  })
}

export function createAltPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0, 4.4, 6],
    distance: 22,
    fov: 32,
    yaw: 0.08,
    pitch: 0.12,
  })
}

export function createGroundPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0, 1.4, -5.4],
    distance: 9.2,
    fov: 36,
    yaw: 0.42,
    pitch: 0.08,
    bloom: true,
  })
}

export function createVipPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0.2, STOREY + 1.15, -1.4],
    distance: 9,
    fov: 36,
    yaw: 0.62,
    pitch: 0.1,
    bloom: true,
  })
}

export function createOfficePreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0, STOREY * 2 + 1.15, -3.8],
    distance: 8.2,
    fov: 36,
    yaw: 0.48,
    pitch: 0.1,
    bloom: true,
  })
}
