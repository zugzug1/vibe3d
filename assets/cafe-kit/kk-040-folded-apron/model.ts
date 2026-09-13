// kk-040-folded-apron — a faded indigo café apron folded into a bundle, neck loop still standing.
//
// Datum: manifest kk-040 authored target 0.35 × 0.30 × 0.05 m. Built 0.329 × 0.272 × 0.079 m.
// Width and depth are the manifest target within the kit test's ±20 %; the HEIGHT is a reasoned
// override and the kit test warns on it. The reference's defining silhouette is the neck loop arching
// clear of the bundle — at 0.05 m total the loop would be a 2 cm stub and the prop would read as a
// folded towel. The loop is already sagged and leaned off plumb against the illustration (unsupported
// cloth does not hold a taut arch), and the folded bundle itself is only 30 mm of the 79 mm; that is
// what keeps the override to 0.079 rather than the ~0.11 m the reference draws.
//
// Axes: Y-up, metres, ground y = 0 under the bundle, bottom-centre origin, front = +Z — the pocket
// side, with the neck loop standing at the back (−Z) and the waist ties trailing off to +X, as drawn.
//
// Parts:
//   fold    — the bundle: two soft cloth layers, each with a bowed spine, its own corner-radius
//             grading and a small twist off the world axes, the lower proud at −X/+Z so the folded
//             edges layer the way the reference shows them.
//   bib     — the upper apron panel folded down on top, back corners cut away.
//   pockets — the two patch pockets, sunk 2.5 mm into the bib so their open backs are never rasterised.
//   strap   — the neck loop, swept as a flat band in a vertical plane; carries the brass slider.
//   ties    — the two waist ties, swept FLAT (the `'flat'` frame), lying on the ground.
// No movable parts: everything here is folded cloth at rest. `fold`, `bib` and the cloth of `strap`
// and `ties` are one merged batch — cloth is one draw call, hardware is the other.
//
// Collider: none (decorative). If one is ever wanted, a box 0.33 × 0.032 × 0.27 over the bundle alone
// is right — the loop and the ties should not be solid.
//
// What the single reference could not show: the underside of the bundle, the back of the bib, and how
// the ties are folded where they pass behind the bundle. All three are plausible reconstruction.
//
// Art-direction corrections: the illustration's tan topstitching runs as a drawn line with no
// geometry under it; at 2 000 triangles a stitch line would cost more than the pockets it outlines,
// so the pockets carry their own 6 mm vertical step instead and the stitching is dropped. The
// reference's taut neck arch is sagged (see the height note above), and the divider between the two
// pockets is the 8 mm GAP between them rather than a drawn seam. Recorded in review/REVIEW.md.

import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
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

const ID = 'kk-040-folded-apron'

type Slot = 'cloth' | 'hardware'

export interface KkFoldedApronConfig {
  /** The two waist ties trailing off the bundle. Off gives a tighter prop for a crowded shelf. */
  ties: boolean
  /** The brass slider on the right leg of the neck loop. */
  slider: boolean
}

export interface KkFoldedApronOptions extends Partial<KkFoldedApronConfig> {
  materials?: Partial<Record<Slot, MeshStandardMaterial>>
}

export interface KkFoldedApronInstance {
  readonly root: Group
  readonly parts: { fold: Group; bib: Group; pockets: Group; strap: Group; ties: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkFoldedApronConfig>
  configure(patch: Partial<KkFoldedApronConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const DEFAULTS: KkFoldedApronConfig = { ties: true, slider: true }

// --- colour -------------------------------------------------------------------------------------

/**
 * The three values the cloth is built from. The `indigoFaded` slot is the SUN-WORN end of an apron,
 * not its average — used at face value across every surface it renders as pale grey-blue denim with
 * none of the reference's depth, so the tone scale is anchored so that only the crowns of folds ever
 * reach it and the body of the cloth sits a clear step below on the indigo token itself.
 */
const CLOTH_LIT = mixToken(TOKEN.INDIGO, TOKEN.CHARCOAL, 0.26)
const CLOTH_BODY = mixToken(TOKEN.INDIGO, TOKEN.CHARCOAL, 0.5)
/** Inside a fold, where the dye never faded and no light reaches. */
const CLOTH_DEEP = mixToken(TOKEN.INDIGO, TOKEN.CHARCOAL, 0.74)

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

const LIT = ratioTo(CLOTH_LIT, DERIVED.INDIGO_FADED)
const BODY = ratioTo(CLOTH_BODY, DERIVED.INDIGO_FADED)
const DEEP = ratioTo(CLOTH_DEEP, DERIVED.INDIGO_FADED)
const WHITE: [number, number, number] = [1, 1, 1]

function mix3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  const k = clamp01(t)
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

/**
 * Worn indigo does not fade evenly — it goes at the folds and the high spots and holds in the hollows,
 * which is the broad blotching the reference draws across the whole apron. Closed-form in x/z (the
 * kit's no-PRNG rule), so the same apron comes back the same every boot.
 */
function wear(x: number, z: number): number {
  return 0.5
    + 0.26 * Math.cos(34 * x + 22 * z + 0.6)
    + 0.16 * Math.cos(58 * x - 46 * z + 2.3)
    + 0.08 * Math.cos(97 * x + 79 * z - 1.1)
}

/** `tone` 0 = deep in a fold, 0.5 = the body of the cloth, 1 = a faded, lit fold. */
function clothColour(x: number, z: number, tone: number): [number, number, number] {
  const faded = tone < 0.5 ? mix3(DEEP, BODY, tone * 2) : mix3(BODY, LIT, (tone - 0.5) * 2)
  const value = 0.88 + 0.2 * wear(x, z)
  return [faded[0] * value, faded[1] * value, faded[2] * value]
}

// --- a mesh under construction ------------------------------------------------------------------

/**
 * Everything here is generated vertex by vertex, so the kit's `mergeParts` is the wrong tool twice
 * over: it would strip the colour attribute the whole cloth read depends on, and it would merge
 * geometry that was never separate. Parts are accumulated straight into one buffer per material.
 */
class Mesher {
  private readonly positions: number[] = []
  private readonly uvs: number[] = []
  private readonly colours: number[] = []
  private readonly indices: number[] = []

  vertex(p: Vector3, u: number, v: number, colour: readonly [number, number, number]): number {
    this.positions.push(p.x, p.y, p.z)
    this.uvs.push(u, v)
    this.colours.push(colour[0], colour[1], colour[2])
    return this.positions.length / 3 - 1
  }

  tri(a: number, b: number, c: number): void {
    this.indices.push(a, b, c)
  }

  /** `a b c d` in outward-facing winding order. */
  quad(a: number, b: number, c: number, d: number): void {
    this.indices.push(a, b, c, a, c, d)
  }

  get empty(): boolean {
    return this.indices.length === 0
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colours), 3))
    geometry.setIndex(this.indices)
    geometry.computeVertexNormals()
    return geometry
  }
}

// --- outlines -----------------------------------------------------------------------------------

type Pt = readonly [number, number]

/**
 * Round every corner of a convex outline given as `[x, z]`, counter-clockwise in the (x, z) plane —
 * which is the −Y orientation, so a bottom cap runs in outline order and a top cap runs reversed.
 * One helper covers the bundle, the bib with its cut-away back corners, and the pockets, which is why
 * no part of this prop is a box with rounded edges pretending to be cloth.
 */
function roundedOutline(outline: readonly Pt[], radius: number | readonly number[], seg: number): Pt[] {
  const n = outline.length
  const points: Pt[] = []
  for (let i = 0; i < n; i++) {
    const radiusAt = typeof radius === 'number' ? radius : radius[i % radius.length]!
    const v = outline[i]!
    const p = outline[(i - 1 + n) % n]!
    const q = outline[(i + 1) % n]!
    const toP: Pt = [p[0] - v[0], p[1] - v[1]]
    const toQ: Pt = [q[0] - v[0], q[1] - v[1]]
    const lenP = Math.hypot(toP[0], toP[1]) || 1
    const lenQ = Math.hypot(toQ[0], toQ[1]) || 1
    const uP: Pt = [toP[0] / lenP, toP[1] / lenP]
    const uQ: Pt = [toQ[0] / lenQ, toQ[1] / lenQ]
    const cos = Math.max(-0.999, Math.min(0.999, uP[0] * uQ[0] + uP[1] * uQ[1]))
    const half = Math.acos(cos) / 2
    const r = Math.min(radiusAt, lenP * 0.48 * Math.tan(half), lenQ * 0.48 * Math.tan(half))
    const back = r / Math.tan(half)
    const tP: Pt = [v[0] + uP[0] * back, v[1] + uP[1] * back]
    const tQ: Pt = [v[0] + uQ[0] * back, v[1] + uQ[1] * back]
    let bx = uP[0] + uQ[0]
    let bz = uP[1] + uQ[1]
    const lenB = Math.hypot(bx, bz) || 1
    bx /= lenB
    bz /= lenB
    const centre: Pt = [v[0] + bx * (r / Math.sin(half)), v[1] + bz * (r / Math.sin(half))]
    const a0 = Math.atan2(tP[1] - centre[1], tP[0] - centre[0])
    let a1 = Math.atan2(tQ[1] - centre[1], tQ[0] - centre[0])
    while (a1 - a0 > Math.PI) a1 -= Math.PI * 2
    while (a0 - a1 > Math.PI) a1 += Math.PI * 2
    for (let k = seg; k >= 0; k--) {
      const a = a0 + ((a1 - a0) * (seg - k)) / seg
      points.push([centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a)])
    }
  }
  return points
}

function rect(w: number, d: number, cx = 0, cz = 0): Pt[] {
  // Counter-clockwise in (x, z): +x+z, −x+z, −x−z, +x−z.
  return [
    [cx + w / 2, cz + d / 2],
    [cx - w / 2, cz + d / 2],
    [cx - w / 2, cz - d / 2],
    [cx + w / 2, cz - d / 2],
  ]
}

function spin(outline: readonly Pt[], radians: number): Pt[] {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return outline.map(([x, z]) => [x * c - z * s, x * s + z * c] as Pt)
}

/**
 * A folded layer's plan, which is NOT a rectangle.
 *
 * Two independent critiques read the bundle as a stack of cutting boards, and the cause was neither
 * the edge radius nor the colour: it was that the layers were concentric, parallel, equal-thickness
 * rectangles. Cloth folded by hand never squares up. So each layer gets a bowed spine on its ±Z edges
 * (`bow`), a small `twist` off the world axes, and a DIFFERENT corner radius at every corner — the
 * fold side soft, the cut hem side crisp — which is modeling rule 3 (grade cuts per corner, break
 * perfect mirrors) doing the work the bevel radius on its own could not.
 */
function foldedLayer(
  w: number,
  d: number,
  cx: number,
  cz: number,
  bow: readonly [number, number],
  twist: number,
): Pt[] {
  const box = rect(w, d, cx, cz)
  return spin([
    box[0]!,
    [cx + w * 0.06, cz + d / 2 + bow[0]],
    box[1]!,
    box[2]!,
    [cx - w * 0.09, cz - d / 2 - bow[1]],
    box[3]!,
  ], twist)
}

/** Fold side soft, cut hem crisp; the mid-edge stations take a wide radius so the bow stays a bow. */
const FOLD_RADII: readonly number[] = [0.016, 0.05, 0.005, 0.009, 0.042, 0.006]

// --- soft cloth slabs -----------------------------------------------------------------------------

/**
 * The undulation every folded surface in this prop shares. Cloth that has been folded and set down
 * keeps a low swell across it; a flat top is what makes a cloth prop read as a plastic tray.
 */
function swell(x: number, z: number, amp: number): number {
  return amp * (
    Math.cos(14 * x + 0.7) * Math.cos(17 * z - 0.4)
    + 0.45 * Math.cos(27 * x - 19 * z + 1.8)
  )
}

interface SlabOptions {
  readonly base: number
  readonly height: number
  readonly amp: number
  /** Tone at the top face and at the sides — the sides sit deeper in the fold. */
  readonly topTone: number
  readonly sideTone: number
  /** Skip the underside when the slab sits on another one and it can never be seen. */
  readonly floor?: boolean
}

/**
 * A soft cloth slab: the outline lofted through a lower ring, a full-width waist, an inset top ring
 * and an inner crown ring, with the swell written into every ring above the waist. Five rings rather
 * than a box with a bevel, which is the difference between folded cloth and a mattress.
 */
function softSlab(m: Mesher, outline: readonly Pt[], o: SlabOptions): void {
  const n = outline.length
  const top = o.base + o.height
  const ringAt = (scale: number, y: (x: number, z: number) => number, tone: number): number[] =>
    outline.map(([x, z], i) => {
      const sx = x * scale
      const sz = z * scale
      return m.vertex(
        new Vector3(sx, y(sx, sz), sz),
        i / n,
        0,
        clothColour(sx, sz, tone),
      )
    })

  const flat = (value: number) => () => value
  const crown = (lift: number) => (x: number, z: number) => top + lift + swell(x, z, o.amp)

  // A NEAR-VERTICAL wall with a small rolled edge, not a barrel. An earlier revision ran the lower
  // ring at 0.965 of full size and bulged out to the waist, which is a cushion cross-section: an
  // independent critique read the whole prop as a stack of foam trays rather than folded cloth, and
  // this — not the colour, not the landmarks — was the thing doing it. Folded fabric presents a THIN
  // sheet edge.
  const low = ringAt(0.992, flat(o.base + o.height * 0.1), o.sideTone * 0.7)
  const waist = ringAt(1, flat(o.base + o.height * 0.52), o.sideTone)

  // FOUR concentric rings across the top face, not one. With a single ring and an apex the whole top
  // of a slab is three vertices deep and cannot carry either the swell or the worn blotching — which
  // is exactly how it rendered as a flat tray. The rings cost ~96 triangles a slab and buy the surface
  // back.
  const lifts: ReadonlyArray<readonly [number, number]> = [
    [0.995, -0.04],
    [0.9, 0.06],
    [0.68, 0.1],
    [0.36, 0.12],
  ]
  // The tone ramps smoothly from the wall to the crown. Stepping it ring by ring put a visible
  // hairline round the brim that read as an unclosed seam.
  const tops = lifts.map(([scale, lift], k) =>
    ringAt(scale, crown(o.height * lift), o.sideTone + (o.topTone - o.sideTone) * ((k + 1) / lifts.length) ** 0.6))

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    m.quad(low[i]!, waist[i]!, waist[j]!, low[j]!)
    m.quad(waist[i]!, tops[0]![i]!, tops[0]![j]!, waist[j]!)
    for (let k = 0; k < tops.length - 1; k++) {
      m.quad(tops[k]![i]!, tops[k + 1]![i]!, tops[k + 1]![j]!, tops[k]![j]!)
    }
  }

  const inner = tops[tops.length - 1]!
  const centreY = crown(o.height * 0.14)
  const apex = m.vertex(new Vector3(0, centreY(0, 0), 0), 0.5, 0.5, clothColour(0, 0, o.topTone))
  for (let i = 0; i < n; i++) m.tri(apex, inner[(i + 1) % n]!, inner[i]!)

  if (o.floor !== false) {
    const sole = m.vertex(new Vector3(0, o.base, 0), 0.5, 0.5, clothColour(0, 0, 0))
    const hem = ringAt(0.94, flat(o.base), 0.1)
    for (let i = 0; i < n; i++) m.tri(sole, hem[i]!, hem[(i + 1) % n]!)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      m.quad(hem[i]!, low[i]!, low[j]!, hem[j]!)
    }
  }
}

/** A patch pocket: a thin proud slab whose open back is sunk into its host so it is never rasterised. */
function patchPocket(m: Mesher, outline: readonly Pt[], hostTop: (x: number, z: number) => number): void {
  const n = outline.length
  const proud = 0.0038
  const sunk = 0.0025
  const ring = (scale: number, lift: number, tone: number): number[] =>
    outline.map(([x, z], i) => {
      const sx = x * scale
      const sz = z * scale
      return m.vertex(new Vector3(sx, hostTop(sx, sz) + lift, sz), i / n, 0, clothColour(sx, sz, tone))
    })

  // A STEP, not a dome. The lip and the face sit at the same radius so the pocket wall is vertical
  // for its whole 6 mm; an inset face turns an applied pocket into a smooth bulge that blurs into the
  // panel behind it, which is precisely how the last revision read.
  const foot = ring(1, -sunk, 0.16)
  const lip = ring(1, proud, 0.34)
  const face = ring(0.994, proud + 0.0004, 0.68)
  const inner = ring(0.72, proud + 0.0012, 0.8)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    m.quad(foot[i]!, lip[i]!, lip[j]!, foot[j]!)
    m.quad(lip[i]!, face[i]!, face[j]!, lip[j]!)
    m.quad(face[i]!, inner[i]!, inner[j]!, face[j]!)
  }
  const apex = m.vertex(
    new Vector3(0, hostTop(0, 0) + proud + 0.0015, 0),
    0.5,
    0.5,
    clothColour(0, 0, 0.82),
  )
  for (let i = 0; i < n; i++) m.tri(apex, inner[(i + 1) % n]!, inner[i]!)
}

// --- swept bands ----------------------------------------------------------------------------------

/**
 * A flat band swept along a path — the neck loop and the waist ties. The width axis is FIXED rather
 * than derived from a Frenet frame: a strap that stands in an arch has its tangent go vertical at both
 * roots, where a Frenet frame flips and the band takes a half twist nothing in the reference has.
 */
function sweepBand(
  m: Mesher,
  path: readonly Vector3[],
  /**
   * A fixed axis for a band standing in a vertical plane (the neck loop), or `'flat'` for a band lying
   * on a surface — which recomputes the width horizontally and perpendicular to the tangent at every
   * station, so the band's faces look up and down. Swept with a fixed near-vertical axis instead, the
   * waist ties came out standing on edge like fins: invisible at the hero angle, obvious the moment
   * the 8-view sheet looked at them side-on.
   */
  widthAxis: Vector3 | 'flat',
  halfWidth: number,
  halfThick: number,
  stations: number,
  tone: number,
  taper: (s: number) => number = () => 1,
): void {
  const curve = new CatmullRomCurve3(path.map((p) => p.clone()))
  const fixed = widthAxis === 'flat' ? null : widthAxis.clone().normalize()
  const up = new Vector3(0, 1, 0)
  const w = new Vector3()
  const rings: number[][] = []
  const point = new Vector3()
  const tangent = new Vector3()
  const thick = new Vector3()
  const corner = new Vector3()
  for (let k = 0; k <= stations; k++) {
    const s = k / stations
    curve.getPointAt(s, point)
    curve.getTangentAt(s, tangent)
    if (fixed) w.copy(fixed)
    else {
      w.copy(tangent).cross(up)
      if (w.lengthSq() < 1e-8) w.set(1, 0, 0)
      w.normalize()
    }
    thick.copy(w).cross(tangent).normalize()
    const hw = halfWidth * taper(s)
    const ht = halfThick * taper(s)
    const ring: number[] = []
    for (const [lw, lt] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      corner.copy(point).addScaledVector(w, lw * hw).addScaledVector(thick, lt * ht)
      // The face that looks up is the faded one; the under face keeps its dye.
      const faceTone = lt > 0 ? tone : tone * 0.42
      ring.push(m.vertex(corner, s, (lw + 1) / 2, clothColour(corner.x, corner.z, faceTone)))
    }
    rings.push(ring)
  }
  for (let k = 0; k < stations; k++) {
    const a = rings[k]!
    const b = rings[k + 1]!
    for (let j = 0; j < 4; j++) {
      const j2 = (j + 1) % 4
      m.quad(a[j]!, b[j]!, b[j2]!, a[j2]!)
    }
  }
  const first = rings[0]!
  m.tri(first[0]!, first[1]!, first[2]!)
  m.tri(first[0]!, first[2]!, first[3]!)
  const last = rings[stations]!
  m.tri(last[0]!, last[3]!, last[2]!)
  m.tri(last[0]!, last[2]!, last[1]!)
}

/** A rectangular solid from a centre and three half-extent vectors forming a right-handed set. */
function boxPrism(m: Mesher, centre: Vector3, u: Vector3, v: Vector3, w: Vector3): void {
  const at = (su: number, sv: number, sw: number): number => {
    const p = centre.clone().addScaledVector(u, su).addScaledVector(v, sv).addScaledVector(w, sw)
    return m.vertex(p, (su + 1) / 2, (sv + 1) / 2, WHITE)
  }
  const c = [
    at(-1, -1, -1), at(1, -1, -1), at(1, 1, -1), at(-1, 1, -1),
    at(-1, -1, 1), at(1, -1, 1), at(1, 1, 1), at(-1, 1, 1),
  ]
  m.quad(c[4]!, c[5]!, c[6]!, c[7]!) // +w
  m.quad(c[1]!, c[0]!, c[3]!, c[2]!) // −w
  m.quad(c[1]!, c[5]!, c[6]!, c[2]!) // +u
  m.quad(c[4]!, c[0]!, c[3]!, c[7]!) // −u
  m.quad(c[3]!, c[2]!, c[6]!, c[7]!) // +v
  m.quad(c[0]!, c[4]!, c[5]!, c[1]!) // −v
}

/** A low domed rivet head. */
function rivet(m: Mesher, centre: Vector3, radius: number, height: number, seg = 8): void {
  const ring: number[] = []
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2
    ring.push(m.vertex(
      new Vector3(centre.x + radius * Math.cos(a), centre.y, centre.z + radius * Math.sin(a)),
      0,
      0,
      WHITE,
    ))
  }
  const crown: number[] = []
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2
    crown.push(m.vertex(
      new Vector3(
        centre.x + radius * 0.62 * Math.cos(a),
        centre.y + height,
        centre.z + radius * 0.62 * Math.sin(a),
      ),
      0,
      0,
      WHITE,
    ))
  }
  const apex = m.vertex(new Vector3(centre.x, centre.y + height * 1.3, centre.z), 0.5, 0.5, WHITE)
  for (let k = 0; k < seg; k++) {
    const j = (k + 1) % seg
    m.quad(ring[k]!, crown[k]!, crown[j]!, ring[j]!)
    m.tri(apex, crown[j]!, crown[k]!)
  }
}

// --- the apron ------------------------------------------------------------------------------------

const BUNDLE_W = 0.292
const BUNDLE_D = 0.252
// Thin. Folded fabric layers peek out at the edge as stair-stepped SHEETS; at 12-14 mm apiece they
// stacked into one deep continuous mass instead.
const LAYER_A_H = 0.0080
const LAYER_B_H = 0.0092
const BIB_W = 0.252
const BIB_D = 0.204
const BIB_H = 0.0074
const BIB_BASE = LAYER_A_H * 0.8 + LAYER_B_H * 0.84
const BIB_TOP = BIB_BASE + BIB_H
const BIB_AMP = 0.0038

function bibTop(x: number, z: number): number {
  return BIB_TOP + swell(x, z, BIB_AMP)
}

/** The neck loop, sagged off plumb: cloth, not wire. */
/**
 * Both roots start BELOW the bib's top face, so the band emerges out of the cloth the way a stitched
 * strap does. Started on the surface, the sweep's end cap stands up as a flat tab.
 */
const STRAP_PATH: readonly Vector3[] = [
  new Vector3(-0.076, BIB_BASE - 0.004, -0.076),
  new Vector3(-0.086, 0.046, -0.094),
  new Vector3(-0.048, 0.068, -0.102),
  new Vector3(0.006, 0.076, -0.100),
  new Vector3(0.058, 0.066, -0.092),
  new Vector3(0.088, 0.044, -0.080),
  new Vector3(0.084, BIB_BASE - 0.004, -0.068),
]
const STRAP_WIDTH_AXIS = new Vector3(-0.09, 0.05, 1)

/** The ties come out of the bundle's right edge and lie DOWN — they hang, they do not cantilever. */
const TIE_A: readonly Vector3[] = [
  new Vector3(0.104, 0.020, -0.062),
  new Vector3(0.142, 0.015, -0.020),
  new Vector3(0.160, 0.008, 0.032),
  new Vector3(0.152, 0.004, 0.090),
  // Clear of the bundle's front edge (z = 0.130), not under it: routed short the band passes through
  // the bundle's side wall and leaves a notch at the exit that reads as torn geometry.
  new Vector3(0.126, 0.003, 0.142),
]
/** The second tie is SHORTER and finishes well clear of the first: run to the same corner the two end
 *  caps tangle into a notch that reads as torn geometry rather than as two ties. */
const TIE_B: readonly Vector3[] = [
  new Vector3(0.112, 0.013, -0.034),
  new Vector3(0.150, 0.008, 0.008),
  new Vector3(0.160, 0.004, 0.052),
]
const TIE_WIDTH_AXIS = new Vector3(0.28, 1, 0.12)

function buildCloth(config: KkFoldedApronConfig): BufferGeometry {
  const m = new Mesher()

  // The bundle. The upper layer is offset toward +X/−Z rather than concentrically inset, so the folded
  // edges show along the near-left and front — one side of a folded bundle, not a tiered cake showing
  // every layer on all four sides, which is what a concentric stack renders as.
  softSlab(m, roundedOutline(
    foldedLayer(BUNDLE_W, BUNDLE_D, -0.006, 0.006, [0.007, 0.003], 0.034),
    FOLD_RADII,
    2,
  ), {
    base: 0,
    height: LAYER_A_H,
    amp: 0.0046,
    topTone: 0.46,
    sideTone: 0.22,
  })
  softSlab(m, roundedOutline(
    foldedLayer(0.262, 0.216, 0.004, -0.004, [0.004, 0.008], -0.022),
    FOLD_RADII,
    2,
  ), {
    base: LAYER_A_H * 0.8,
    height: LAYER_B_H,
    amp: 0.0048,
    topTone: 0.54,
    sideTone: 0.26,
    floor: false,
  })

  // The bib, folded down on top: the two back corners of an apron bib are cut away for the neck strap.
  const bz = 0.008
  const bibOutline: Pt[] = [
    [BIB_W / 2, BIB_D / 2 + bz],
    [-BIB_W / 2, BIB_D / 2 + bz],
    [-BIB_W / 2, -BIB_D / 2 + bz + 0.05],
    [-BIB_W / 2 + 0.056, -BIB_D / 2 + bz],
    [BIB_W / 2 - 0.056, -BIB_D / 2 + bz],
    [BIB_W / 2, -BIB_D / 2 + bz + 0.05],
  ]
  softSlab(m, roundedOutline(spin(bibOutline, 0.019), [0.02, 0.007, 0.012, 0.01, 0.008, 0.016], 2), {
    base: BIB_BASE,
    height: BIB_H,
    amp: BIB_AMP,
    topTone: 0.76,
    sideTone: 0.3,
    floor: false,
  })

  // Two patch pockets low on the bib with a 4 mm gap — the reference's central seam is the gap, not a
  // drawn line, which is how the pair reads as two pockets without paying for a stitch run.
  for (const cx of [-0.058, 0.058]) {
    patchPocket(m, roundedOutline(spin(rect(0.104, 0.080, cx, 0.046), 0.019), 0.008, 1), bibTop)
  }

  sweepBand(m, STRAP_PATH, STRAP_WIDTH_AXIS, 0.0155, 0.0022, 28, 0.55)

  if (config.ties) {
    sweepBand(m, TIE_A, 'flat', 0.013, 0.0019, 14, 0.5, (s) => 1 - 0.22 * s * s)
    sweepBand(m, TIE_B, 'flat', 0.012, 0.0018, 10, 0.44, (s) => 1 - 0.18 * s * s)
  }

  return m.build()
}

function buildHardware(config: KkFoldedApronConfig): BufferGeometry | null {
  const m = new Mesher()

  // Two rivets at the outer top corner of each pocket, as the reference places them.
  for (const [cx, cz] of [[-0.102, 0.080], [0.102, 0.012]] as const) {
    rivet(m, new Vector3(cx, bibTop(cx, cz) + 0.0035, cz), 0.0042, 0.0022)
  }

  if (config.slider) {
    // The slider rides the right leg of the loop. Its frame is built in that leg's own frame so it
    // sits ON the strap rather than beside it.
    const curve = new CatmullRomCurve3(STRAP_PATH.map((p) => p.clone()))
    const centre = curve.getPointAt(0.84)
    const tangent = curve.getTangentAt(0.84)
    const w = STRAP_WIDTH_AXIS.clone().normalize()
    const thick = w.clone().cross(tangent).normalize()
    const along = tangent.clone().normalize()

    const halfW = 0.0168
    const halfL = 0.0082
    const bar = 0.0017
    const plate = 0.0011
    const put = (offW: number, offL: number, hw: number, hl: number): void => {
      boxPrism(
        m,
        centre.clone().addScaledVector(w, offW).addScaledVector(along, offL),
        w.clone().multiplyScalar(hw),
        thick.clone().multiplyScalar(plate),
        along.clone().multiplyScalar(hl),
      )
    }
    put(0, halfL - bar, halfW, bar) // front bar
    put(0, -(halfL - bar), halfW, bar) // back bar
    put(halfW - bar, 0, bar, halfL) // right cheek
    put(-(halfW - bar), 0, bar, halfL) // left cheek
    put(0, 0, halfW - bar * 2, bar * 0.8) // centre bar
  }

  return m.empty ? null : m.build()
}

// --- model ----------------------------------------------------------------------------------------

export function createModel(options: KkFoldedApronOptions = {}): KkFoldedApronInstance {
  const config: KkFoldedApronConfig = {
    ties: options.ties ?? DEFAULTS.ties,
    slider: options.slider ?? DEFAULTS.slider,
  }

  const bundle = acquireKkMaterials({ overrides: options.materials })
  const slots: Record<Slot, Material> = {
    cloth: bundle.materials.indigoFaded,
    hardware: bundle.materials.brass,
  }
  // Fade, fold shadow and the worn blotching all ride one material as vertex colour. A
  // consumer-supplied coat is left exactly as handed in.
  if (!options.materials?.indigoFaded) bundle.materials.indigoFaded.vertexColors = true

  const root = new Group()
  root.name = ID
  const fold = new Group(); fold.name = 'fold'
  const bib = new Group(); bib.name = 'bib'
  const pockets = new Group(); pockets.name = 'pockets'
  const strap = new Group(); strap.name = 'strap'
  const ties = new Group(); ties.name = 'ties'
  root.add(fold, bib, pockets, strap, ties)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { cloth: [], hardware: [] }

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
    for (const slot of ['cloth', 'hardware'] as const) {
      for (const mesh of meshesBySlot[slot]) {
        if (!mesh.name.startsWith(ID)) mesh.name = `${ID} / ${mesh.name}`
      }
    }
  }

  const rebuild = (): void => {
    for (const group of [fold, bib, pockets, strap, ties]) group.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    meshesBySlot.cloth.length = 0
    meshesBySlot.hardware.length = 0

    // The semantic groups are the prop's anatomy; the cloth is one batch because five draw calls of
    // indigo is five draw calls of indigo. The batch hangs off `fold`, the part that is always there.
    emit('cloth', buildCloth(config), fold, 'cloth')
    const hardware = buildHardware(config)
    if (hardware) emit('hardware', hardware, strap, 'hardware')
    namePass()
  }
  rebuild()

  const finished = finishModel(root, bundle, { name: ID, geometries: generated })

  return {
    root,
    parts: { fold, bib, pockets, strap, ties },
    materials: slots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.ties !== undefined) config.ties = Boolean(patch.ties)
      if (patch.slider !== undefined) config.slider = Boolean(patch.slider)
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
