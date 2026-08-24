// f1-tunnel-portal — a civil-engineering underpass headwall seen from the road: battered piers and a
// deep deck standing 0.62 m proud of the bore so the mouth shows real concrete reveal before it goes
// dark, a cornice and bayed parapet carrying the crossing road over the top, raking wing walls splayed
// forward to retain the embankment, hazard-striped boards on both piers and over the opening, and a
// kerbed carriageway with a slot drain running out of the throat.
//
// What this replaces was a thin four-sided U: 0.5 m walls with no proud headwall, no wings and no ground
// furniture, which from any angle read as an open-fronted box rather than as a structure holding earth
// back. The mass here is front-loaded — the reveal at the mouth, the splay in plan and the parapet line
// are the three things that carry the read at track scale, and everything else defers to them.
//
// The concrete is poured in four values, not one. A single grey across piers, deck, wings and soffit left
// every plane the same brightness whatever direction it faced, and under this kit's 2.3-intensity key
// that is what collapsed a modelled structure into one extruded block: the lit planes all clipped to the
// same near-white. So the return lifts, the wings drop, the soffit drops furthest, and the spread has to
// be wide because the light compresses whatever spread it is given.

import { BufferGeometry, Group, Mesh, MeshStandardMaterial, type Material } from 'three/webgpu'

import {
  FACE_CLEARANCE,
  TOKEN,
  WALL_END,
  acquireF1Materials,
  bevelBox,
  bevelPrism,
  createF1Preview,
  disposeF1Materials,
  mergeParts,
  shade,
} from '../f1-kit-core/index.ts'

type Slot = 'shell' | 'arch'

export interface F1TunnelPortalConfig {
  width: number
  height: number
}

export interface F1TunnelPortalOptions extends Partial<F1TunnelPortalConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1TunnelPortalInstance {
  readonly root: Group
  readonly parts: { shell: Group; arch: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1TunnelPortalConfig>
  configure(patch: Partial<F1TunnelPortalConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

/** `width` and `height` are the *clear* opening — headroom and carriageway, not the outside envelope. */
const defaults: F1TunnelPortalConfig = { width: 5, height: 3.2 }

/**
 * Bore length along Z. Long enough that the far end falls away from the key light: at the 3.4 m this
 * started from, the closing wall stayed lit and the opening read as a recess rather than as a bore.
 */
const DEPTH = 4.4
/** Structural side-wall thickness flanking the bore. */
const WALL = 0.55
/**
 * Slab over the opening. A road runs on top of this, so it is a deck carrying live load rather than a
 * lintel band — and its depth is the largest single reason the portal reads as engineered concrete.
 */
const DECK = 0.85
/**
 * How far the headwall stands proud of the bore mouth. This is the reveal: the band of concrete the
 * jambs show before the bore goes dark, and the difference between a portal and a hole.
 *
 * The soffit across that same reveal goes the other way, down to the darkest concrete in the model. A
 * downward face never catches the key, so carrying the soffit at jamb value was a large part of what
 * flattened the front into one wash.
 */
const HEADWALL = 0.62
/** Extra width a headwall pier carries over the bore wall behind it, so the mouth steps rather than butts. */
const PIER_STEP = 0.26
/**
 * Batter on a pier's outer face: proud at the base, drawn in at the top. Together they rake the face by
 * half a metre over the pier's height, around 1:6 — steep for a wall, ordinary for an abutment.
 *
 * At the 0.1 / 0.06 this started from the taper was under three degrees, and three degrees across a
 * four-metre face is invisible: the piers read as plumb boxes and the headwall lost the leaning-back
 * stance that separates a structure retaining earth from a doorway cut in a wall. Because the pier is
 * extruded from an outline in XY, the batter is carried by its front face too, so the taper shows in
 * straight elevation rather than only in the raking side. The kick is held just under the deck's own
 * overhang so the base still lands inside the slab edge — the deck has to oversail the pier, not the
 * pier burst out through the deck.
 */
const PIER_KICK = 0.3
const PIER_DRAW = 0.2

/** FIA 3501 concrete-wall envelope, reused for the deck parapet rather than inventing a second height. */
const PARAPET_H = WALL_END.concrete.height
const PARAPET_T = WALL_END.concrete.depth
const COPING_H = 0.13
/** Coping oversail, across the wall only. A coping flush with its wall reads as a paint line, not a cap. */
const COPING_OUT = 0.055
/** Pilasters dividing the parapet into bays. Seven unbroken metres of it read as a blank lid. */
const PILASTER_W = 0.22
const PILASTER_OUT = 0.07
const PILASTER_BAYS = 5
/**
 * String course capping the headwall, which the parapet then rises off flush. Two metres of blank
 * concrete above the opening needs one horizontal to sit on, and setting the parapet back behind that
 * course instead opened a shadow slot at deck level that left the parapet reading as a rail on legs.
 */
const COURSE_H = 0.2
const COURSE_OUT = 0.09

/**
 * The soffit band: the bottom slice of the proud return, cast as its own recessed member. Height, and
 * how far it is set back from the return's face and sides so the return overhangs it on three sides.
 *
 * The set-back is what turns a change of colour into a change of light. A dark band flush with the
 * headwall is a painted stripe; the same band held back sits in its own shadow, and the return's bottom
 * arris then reads as the drip it would actually be cast as.
 *
 * The height is set by the capture, not by the detail. At 0.07 m this was a correct soffit that resolved
 * to five pixels from the reference camera and therefore did nothing at all; the band has to be deep
 * enough to survive the framing the model is judged in. It also sets the datum the piers stop at and the
 * lintel plates start from, so the whole front elevation reads off one line.
 */
const SOFFIT_H = 0.16
const SOFFIT_SET = 0.045

/** Dark liner panels inside the bore. They start at the mouth plane so the headwall reveal stays concrete. */
const LINER = 0.08
/** Lit ribs standing proud of the liner. Parallax down the bore is what sells its length. */
const RIB = 0.09
const RIB_W = 0.24
const KERB_H = 0.16
const KERB_W = 0.28
/** Carriageway surface, held proud of the ground plane so the apron reads as a laid slab. */
const ROAD = 0.02
/** Carriageway run in front of the mouth. */
const APRON = 1.6
const DRAIN_W = 0.22

/**
 * Wing walls: splay in plan, thickness and run. They rake from the soffit line down to the kit's
 * trackside-wall height, so both ends of the rake land on a datum the rest of the model already uses.
 *
 * They rake continuously rather than stepping: discrete lifts with a coping each turned the pair into a
 * bar chart flanking the portal, because the tall vertical face at every step reads as its own pylon.
 * They are also held well below the parapet. Springing them from the coping made two sails as tall as
 * the whole structure, and they then hid the piers and both hazard boards — a wing that matches the thing
 * it flanks has stopped being subordinate to it, and the portal has to stay the tallest element for the
 * parapet line to mean anything.
 */
const SPLAY = 0.38
const WING_T = 0.5
const WING_RUN = 2.6

/**
 * Hazard signage is cut plates bolted to concrete, so it is authored as a run of discrete plates with a
 * real gap between them and a real border of backboard inside each one.
 *
 * One plate striped end to end across the whole opening gave the diagonals five metres to run in, and
 * with no edge anywhere for the eye to catch on, the result read as a painted barber-pole band rather
 * than as signage. The border is what makes each plate's striping stop short of its own edge; the gap is
 * what makes there be more than one plate; and the pitch is coarse enough that a plate carries three or
 * four bands rather than a dozen, which is the difference between a cut 45-degree board and a texture.
 */
const PLATE_BORDER = 0.08
const PLATE_GAP = 0.14
const PLATE_PITCH = 0.24
const PIER_PLATES = 2
/** Plate width on a pier, held clear of the battered outer face at the height the top plate reaches. */
const PIER_PLATE_W = 0.6
/** Stacked run of plates up a pier, kept low enough that the top plate stays on the drawn-in face. */
const PIER_PLATE_RUN = 1.9
/**
 * Four across the opening, against the parapet's five bays above: two odd rhythms will not lock into one
 * grid the way two matching ones do (rule 3).
 */
const LINTEL_PLATES = 4
/** Breathing room between the lintel plates and the two horizontals that bracket them. */
const LINTEL_CLEAR = 0.045

type Pt = readonly [number, number]

/** Clips a convex outline against the half-plane where `f` is negative, preserving winding. */
function clipHalf(poly: readonly Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const fa = f(a)
    const fb = f(b)
    if (fa <= 0) out.push(a)
    if (fa <= 0 !== fb <= 0) {
      const t = fa / (fa - fb)
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return out
}

function outlineArea(poly: readonly Pt[]): number {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    sum += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(sum) / 2
}

/**
 * Diagonal hazard striping for a `w` x `h` board, authored about the board centre and split into its two
 * alternating colours.
 *
 * Each stripe is the true intersection of a 45-degree band with the board rectangle, so the striping is
 * clipped to the plate rather than overhanging it. That clip is the whole difference between a hazard
 * board and a column of loose diamonds: the stripes have to run off the edges to read as one field.
 */
function hazardStripes(
  w: number, h: number, pitch: number, lean: 1 | -1,
): { warn: Pt[][]; dark: Pt[][] } {
  const rect: Pt[] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
  const nx = Math.SQRT1_2
  const ny = lean * Math.SQRT1_2
  const reach = (Math.SQRT1_2 * (w + h)) / 2
  const warn: Pt[][] = []
  const dark: Pt[][] = []
  const bands = Math.max(2, Math.ceil((reach * 2) / pitch))
  for (let i = 0; i < bands; i++) {
    const u0 = -reach + i * pitch
    let poly = clipHalf(rect, (p) => u0 - (p[0] * nx + p[1] * ny))
    if (poly.length >= 3) poly = clipHalf(poly, (p) => p[0] * nx + p[1] * ny - (u0 + pitch))
    // Corner bands clip to slivers; anything under a square centimetre is not a stripe.
    if (poly.length < 3 || outlineArea(poly) < 1e-4) continue
    ;(i % 2 === 0 ? warn : dark).push(poly)
  }
  return { warn, dark }
}

export function createModel(options: F1TunnelPortalOptions = {}): F1TunnelPortalInstance {
  const config: F1TunnelPortalConfig = {
    width: Math.max(3, options.width ?? defaults.width),
    height: Math.max(2, options.height ?? defaults.height),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  // Structural concrete is a shadowed value of the kit's coated shell, not the shell itself. At full
  // SHELL-200 the portal read as a painted panel product; the copings and kerb lines are what keep that
  // bright value, and they only register as cast trim because the mass behind them sits a step down.
  const concreteMat = new MeshStandardMaterial({
    name: 'f1-kit / portal concrete',
    color: shade(TOKEN.SHELL_200, -0.32),
    roughness: 0.93,
    metalness: 0.0,
  })
  // Three more values off the same token, one per exposure rather than one per part: the return is the
  // plane nearest the camera and square to the key so it lifts, the wings are turned away and hold back
  // wet earth so they drop, and the soffit never sees the key at all so it drops furthest.
  //
  // The spread is deliberately wider than the exposures alone would justify. Under this rig the lit
  // planes sit near the top of the range, so a half-step of albedo between two of them clips to the same
  // white and the break disappears — the separation has to be authored in albedo to survive in the frame.
  const proudMat = new MeshStandardMaterial({
    name: 'f1-kit / portal headwall',
    color: shade(TOKEN.SHELL_200, -0.15),
    roughness: 0.9,
    metalness: 0.0,
  })
  const rakeMat = new MeshStandardMaterial({
    name: 'f1-kit / portal wing',
    color: shade(TOKEN.SHELL_200, -0.58),
    roughness: 0.95,
    metalness: 0.0,
  })
  const soffitMat = new MeshStandardMaterial({
    name: 'f1-kit / portal soffit',
    color: shade(TOKEN.SHELL_200, -0.74),
    roughness: 0.95,
    metalness: 0.0,
  })
  /** Model-owned for their whole life; freed once, in `dispose`. */
  const persistent: Material[] = [concreteMat, proudMat, rakeMat, soffitMat]
  let disposed = false

  const materialSlots: Record<Slot, Material> = {
    shell: options.materials?.shell ?? concreteMat,
    // The bore is the deepest cavity in the model and has to go to the bottom of the value range, or the
    // reveal at the mouth has nothing to read against.
    arch: options.materials?.arch ?? kit.ink,
  }

  const root = new Group(); root.name = 'f1-tunnel-portal'
  const shell = new Group(); shell.name = 'shell'
  const arch = new Group(); arch.name = 'arch'
  root.add(shell, arch)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { shell: [], arch: [] }

  const releaseGenerated = (): void => {
    shell.clear(); arch.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
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

  const rebuild = (): void => {
    releaseGenerated()
    const { width, height } = config
    const halfW = width / 2
    /** Outer face of a headwall pier at deck level. */
    const pierOut = halfW + WALL + PIER_STEP
    /** Top of the deck slab: where the crossing road runs. */
    const deckTop = height + DECK
    const deckHalf = pierOut + 0.32
    /** The headwall plane. The parapet is flush with it and every applied board measures from it. */
    const face = DEPTH / 2 + HEADWALL
    /** Soffit line: where the piers stop and the proud return takes over. */
    const soffitTop = height + SOFFIT_H

    const concrete: BufferGeometry[] = []  // portal mass: walls, deck, parapets, kerbs, ribs
    const proud: BufferGeometry[] = []     // the return standing forward of the mouth: piers and course
    const rake: BufferGeometry[] = []      // wing wall bodies, raked away from the key light
    const soffit: BufferGeometry[] = []    // recessed band under the proud return
    const bright: BufferGeometry[] = []    // cast trim: copings and kerb tops
    const bore: BufferGeometry[] = []      // the throat: liner panels, closing wall, drain invert
    const surface: BufferGeometry[] = []   // carriageway and the road over the deck
    const plates: BufferGeometry[] = []    // sign backboards
    const warnParts: BufferGeometry[] = [] // hazard striping, warning colour
    const darkParts: BufferGeometry[] = [] // hazard striping, dark colour
    const grate: BufferGeometry[] = []

    // --- bore: walls the full length, deck spanning them, return standing proud of the mouth ---------
    for (const sx of [-1, 1] as const) {
      concrete.push(bevelBox(WALL, height, DEPTH, 0.02)
        .translate(sx * (halfW + WALL / 2), height / 2, 0))
    }
    concrete.push(bevelBox(deckHalf * 2, DECK, DEPTH + 0.02, 0.024)
      .translate(0, height + DECK / 2, 0.01))
    // The slab is cast in two pieces along Z instead of one: the span over the bore keeps base value and
    // the block forward of the mouth is the return, which is the plane the camera sees most of. They
    // overlap by a centimetre so the joint cannot open into a hairline seam at a glancing angle.
    const returnH = deckTop - soffitTop
    proud.push(bevelBox(deckHalf * 2, returnH + 0.01, HEADWALL, 0.024)
      .translate(0, deckTop - (returnH + 0.01) / 2, DEPTH / 2 + HEADWALL / 2))
    // The bottom slice of that return, set back on three sides and taken to the darkest concrete value.
    // Over the opening it is the reveal soffit; outboard of the piers it is the underside of the deck
    // overhang, which is the same downward face and belongs at the same value.
    const soffitZ0 = DEPTH / 2 - 0.04
    const soffitZ1 = face - SOFFIT_SET
    soffit.push(bevelBox(deckHalf * 2 - SOFFIT_SET * 2, SOFFIT_H, soffitZ1 - soffitZ0, 0.01)
      .translate(0, height + SOFFIT_H / 2, (soffitZ0 + soffitZ1) / 2))

    // --- headwall piers: battered outer face, vertical jamb -----------------------------------------
    // Authored about their own centre because `bevelPrism` clamps its facet against the smallest
    // coordinate in the outline — an outline sitting on y = 0 would silently lose its bevel (rule 6).
    //
    // They stop at the soffit line rather than running the full deck height. Carrying them to the top
    // put their front faces in the headwall plane over the same span as the return's own front face, and
    // since both belong to one merged mesh the two coplanar sheets z-fought into a band of hatching
    // across the whole sign zone. Stopping the pier is also the truer section: the return oversails it.
    for (const sx of [-1, 1] as const) {
      const cx = (halfW + pierOut) / 2
      const cy = soffitTop / 2
      const inner: Pt = [halfW - cx, -cy]
      const outer: Pt = [pierOut + PIER_KICK - cx, -cy]
      const outerTop: Pt = [pierOut - PIER_DRAW - cx, cy]
      const innerTop: Pt = [halfW - cx, cy]
      // Reversed for the -X pier so the outline stays counter-clockwise: mirroring the point list
      // would invert the winding and flip every face normal (rule 5).
      const outline = sx > 0
        ? [inner, outer, outerTop, innerTop]
        : [inner, innerTop, outerTop, outer].map(([x, y]) => [-x, y] as Pt)
      proud.push(bevelPrism(outline, HEADWALL, 0.025)
        .translate(sx * cx, cy, DEPTH / 2 + HEADWALL / 2))
    }
    proud.push(bevelBox(deckHalf * 2 + COURSE_OUT * 2, COURSE_H, HEADWALL + COURSE_OUT, 0.014)
      .translate(0, deckTop - COURSE_H / 2, DEPTH / 2 + (HEADWALL + COURSE_OUT) / 2))

    // --- parapets, bays and copings over the deck ---------------------------------------------------
    for (const zc of [face - PARAPET_T / 2, -DEPTH / 2 + PARAPET_T / 2]) {
      concrete.push(bevelBox(deckHalf * 2, PARAPET_H, PARAPET_T, 0.018)
        .translate(0, deckTop + PARAPET_H / 2, zc))
      // Oversails across the wall, not past its ends: a coping that runs on into space past the last
      // support reads as a loose plank rather than as a cast cap.
      bright.push(bevelBox(deckHalf * 2, COPING_H, PARAPET_T + COPING_OUT * 2, 0.016)
        .translate(0, deckTop + PARAPET_H + COPING_H / 2, zc))
    }
    for (let i = 0; i < PILASTER_BAYS; i++) {
      const px = -deckHalf + 0.45 + i * ((deckHalf * 2 - 0.9) / (PILASTER_BAYS - 1))
      concrete.push(bevelBox(PILASTER_W, PARAPET_H - 0.04, PILASTER_OUT, 0.008)
        .translate(px, deckTop + (PARAPET_H - 0.04) / 2, face + PILASTER_OUT / 2 - FACE_CLEARANCE))
    }
    // The crossing road itself. Without it the deck is an anonymous slab and the parapets have nothing
    // to guard, which is what left the whole mass reading as a box lid.
    const overZ0 = -DEPTH / 2 + PARAPET_T
    const overZ1 = face - PARAPET_T
    surface.push(bevelBox(deckHalf * 2 - 0.1, 0.06, overZ1 - overZ0, 0.008)
      .translate(0, deckTop + 0.03, (overZ0 + overZ1) / 2))

    // --- wing walls: one raking lift per side, soffit line down to trackside-wall height -------------
    const wingNear = height
    const wingFar = PARAPET_H
    for (const sx of [-1, 1] as const) {
      // Both spins are proper rotations. Building one wing and mirroring it would invert its winding,
      // so the -X wing is rotated past half a turn instead.
      const spin = sx > 0 ? -SPLAY : Math.PI + SPLAY
      // Buried into the pier at the near end so the joint is solid rather than a butted seam, and buried
      // deeper than it used to be: the pier's outer face now draws in by 0.2 m over its height, so a
      // shallow burial let the wing's near end break back out through the face towards the top.
      const x0 = -0.34
      const cx = (x0 + WING_RUN) / 2
      const cy = wingNear / 2
      const place = (geo: BufferGeometry): BufferGeometry =>
        geo.translate(cx, cy, 0).rotateY(spin).translate(sx * (pierOut - 0.04), 0, face - 0.3)
      rake.push(place(bevelPrism([
        [x0 - cx, -cy], [WING_RUN - cx, -cy],
        [WING_RUN - cx, wingFar - COPING_H - cy], [x0 - cx, wingNear - COPING_H - cy],
      ], WING_T, 0.02)))
      // The coping is a band following the rake, not a horizontal cap: a level coping on a raking wall
      // is the tell that the wall was extruded rather than built. Held at trim value, it is now the
      // brightest thing on the wing and the only line that describes the slope of the rake.
      bright.push(place(bevelPrism([
        [x0 - cx, wingNear - COPING_H - cy], [WING_RUN - cx, wingFar - COPING_H - cy],
        [WING_RUN - cx, wingFar - cy], [x0 - cx, wingNear - cy],
      ], WING_T + COPING_OUT * 2, 0.016)))
    }

    // --- bore lining. Starts at the mouth plane, leaving HEADWALL of concrete reveal ahead of it. ---
    for (const sx of [-1, 1] as const) {
      bore.push(bevelBox(LINER, height - LINER, DEPTH - 0.02, 0.008)
        .translate(sx * (halfW - LINER / 2), (height - LINER) / 2, -0.01))
    }
    bore.push(bevelBox(halfW * 2, LINER, DEPTH - 0.02, 0.008)
      .translate(0, height - LINER / 2, -0.01))
    bore.push(bevelBox(halfW * 2 - 0.02, height - 0.02, 0.12, 0.01)
      .translate(0, height / 2, -DEPTH / 2 + 0.06))

    // Ribs inside the bore, catching the key light against the dark lining.
    for (const zRib of [-0.35, -DEPTH / 2 + 1.0]) {
      for (const sx of [-1, 1] as const) {
        concrete.push(bevelBox(RIB, height - LINER, RIB_W, 0.008)
          .translate(sx * (halfW - LINER - RIB / 2), (height - LINER) / 2, zRib))
      }
      concrete.push(bevelBox((halfW - LINER) * 2, RIB, RIB_W, 0.008)
        .translate(0, height - LINER - RIB / 2, zRib))
    }

    // --- carriageway, kerbs and drain --------------------------------------------------------------
    surface.push(bevelBox((halfW - LINER) * 2, 0.14, DEPTH + HEADWALL + APRON, 0.01)
      .translate(0, ROAD - 0.07, (HEADWALL + APRON) / 2))

    const kerbLen = DEPTH + HEADWALL + APRON * 0.85
    const kerbZ = (HEADWALL + APRON * 0.85) / 2
    const kerbStem = KERB_H + ROAD - 0.05
    for (const sx of [-1, 1] as const) {
      const cx = sx * (halfW - LINER - KERB_W / 2)
      concrete.push(bevelBox(KERB_W, kerbStem, kerbLen, 0.01).translate(cx, kerbStem / 2, kerbZ))
      // Painted kerb line. It is the only bright thing inside the opening, so it is what leads the eye
      // into the throat instead of stopping on the mouth.
      bright.push(bevelBox(KERB_W + 0.02, 0.05, kerbLen - 0.04, 0.008)
        .translate(cx, kerbStem + 0.025, kerbZ))
    }

    // One drain, on the -X channel only. A pair either side turns the carriageway symmetrical, and the
    // asymmetry is what makes the road read as falling to a low side (rule 3).
    const drainX = -(halfW - LINER - KERB_W - DRAIN_W / 2)
    const drainLen = DEPTH + HEADWALL + APRON * 0.6
    const drainZ = (HEADWALL + APRON * 0.6) / 2
    bore.push(bevelBox(DRAIN_W, 0.16, drainLen, 0.008).translate(drainX, ROAD - 0.115, drainZ))
    for (const dx of [-1, 1] as const) {
      concrete.push(bevelBox(0.05, 0.09, drainLen, 0.006)
        .translate(drainX + dx * (DRAIN_W / 2 + 0.025), ROAD - 0.045, drainZ))
    }
    const bars = Math.max(2, Math.round(drainLen / 0.4))
    for (let i = 0; i < bars; i++) {
      const z = drainZ - drainLen / 2 + 0.1 + (i + 0.5) * ((drainLen - 0.2) / bars)
      grate.push(bevelBox(DRAIN_W - 0.02, 0.022, 0.05, 0.004).translate(drainX, ROAD - 0.018, z))
    }

    // --- hazard boards on the headwall face --------------------------------------------------------
    const plateFront = face + 0.06 - FACE_CLEARANCE
    const board = (cx: number, cy: number, w: number, h: number, lean: 1 | -1): void => {
      plates.push(bevelBox(w, h, 0.06, 0.008).translate(cx, cy, plateFront - 0.03))
      const { warn, dark } = hazardStripes(
        w - PLATE_BORDER * 2, h - PLATE_BORDER * 2, PLATE_PITCH, lean,
      )
      const stripeZ = plateFront - FACE_CLEARANCE + 0.014
      for (const poly of warn) warnParts.push(bevelPrism(poly, 0.028, 0).translate(cx, cy, stripeZ))
      for (const poly of dark) darkParts.push(bevelPrism(poly, 0.028, 0).translate(cx, cy, stripeZ))
    }
    // Piers carry a stacked pair each, leaning opposite ways left and right so both point down into the
    // carriageway the way the sign is specified, rather than reading as one strip copied across.
    const pierRun = Math.min(PIER_PLATE_RUN, height - 0.7)
    const pierPlate = (pierRun - PLATE_GAP * (PIER_PLATES - 1)) / PIER_PLATES
    for (const sx of [-1, 1] as const) {
      for (let i = 0; i < PIER_PLATES; i++) {
        board(sx * (halfW + (WALL + PIER_STEP) / 2), 0.3 + i * (pierPlate + PLATE_GAP) + pierPlate / 2,
          PIER_PLATE_W, pierPlate, sx > 0 ? 1 : -1)
      }
    }
    // Over the opening the plates fill the panel between the soffit band and the string course, so they
    // are bracketed by two real horizontals instead of floating on a blank field, and are mirrored about
    // the crown so the diagonals fall outward to either side.
    const lintelY1 = deckTop - COURSE_H
    const lintelH = Math.max(0.24, lintelY1 - soffitTop - LINTEL_CLEAR * 2)
    const lintelRun = width + 0.6
    const lintelPlate = (lintelRun - PLATE_GAP * (LINTEL_PLATES - 1)) / LINTEL_PLATES
    for (let i = 0; i < LINTEL_PLATES; i++) {
      board(-lintelRun / 2 + lintelPlate / 2 + i * (lintelPlate + PLATE_GAP), (soffitTop + lintelY1) / 2,
        lintelPlate, lintelH, i * 2 < LINTEL_PLATES ? -1 : 1)
    }

    emit('shell', mergeParts(concrete, 'f1-tunnel-portal: portal'), shell, 'portal')
    emit('shell', mergeParts(proud, 'f1-tunnel-portal: headwall'), shell, 'headwall', proudMat)
    emit('shell', mergeParts(rake, 'f1-tunnel-portal: wings'), shell, 'wings', rakeMat)
    emit('shell', mergeParts(soffit, 'f1-tunnel-portal: soffit'), shell, 'soffit', soffitMat)
    emit('shell', mergeParts(bright, 'f1-tunnel-portal: trim'), shell, 'trim', kit.shell)
    emit('shell', mergeParts(surface, 'f1-tunnel-portal: carriageway'), shell, 'carriageway', kit.tread)
    emit('arch', mergeParts(bore, 'f1-tunnel-portal: throat'), arch, 'throat')
    emit('arch', mergeParts(plates, 'f1-tunnel-portal: boards'), arch, 'boards', kit.graphite)
    emit('arch', mergeParts(warnParts, 'f1-tunnel-portal: chevrons'), arch, 'chevrons', kit.amber)
    emit('arch', mergeParts(darkParts, 'f1-tunnel-portal: chevron ink'), arch, 'chevron-ink', kit.ink)
    emit('arch', mergeParts(grate, 'f1-tunnel-portal: grate'), arch, 'grate', kit.steel)
  }
  rebuild()

  return {
    root,
    parts: { shell, arch },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.width !== undefined) config.width = Math.max(3, patch.width)
      if (patch.height !== undefined) config.height = Math.max(2, patch.height)
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      if (disposed) return
      disposed = true
      releaseGenerated()
      for (const material of persistent) material.dispose()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel({ width: 4.6, height: 3.1 }), {
    aspect,
    target: [0, 1.85, 0.3],
    distance: 22,
    fov: 33,
    yaw: 0.44,
    pitch: 0.17,
    ground: true,
  })
}
