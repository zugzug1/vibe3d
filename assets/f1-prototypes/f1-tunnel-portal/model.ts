// f1-tunnel-portal — a civil-engineering underpass headwall seen from the road: battered piers and a
// deep deck standing 0.62 m proud of the bore so the mouth shows real concrete reveal before it goes
// dark, a cornice and bayed parapet carrying the crossing road over the top, raking wing walls splayed
// forward to retain the embankment, hazard-striped boards on both piers and over the opening, and a
// kerbed carriageway with a slot drain running out of the throat.
//
// It is built 1:1 off `TUNNEL_PORTAL`: a single-lane service underpass at a Grade 1 circuit, 4.0 m clear
// by 4.5 m clear through an 8 m bore. That is one 3.5 m service lane with margins under the DAUB / EU
// clearance band, not a dual-carriageway highway tunnel, and it is why the opening is now slightly taller
// than it is wide. `width` and `height` stay config, so the same source builds any clear opening — but
// every proportion that has to track the opening (pier batter, wing rake, parapet bay rhythm, rib pitch)
// is derived from it rather than frozen at the default, so a wider or taller portal is still this portal.
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
//
// Three things carry that further, and all three are answers to the same complaint — that the elevation
// read as a pale box. The piers batter by better than a metre across their height, so the front elevation
// is a trapezoid rather than a rectangle and the base flares wider than the deck the way an abutment
// footing actually does. The wings run longer and die lower, trading a tall stub end for a long diagonal.
// And the parapet is a thick panelled curb-wall with real recessed casting joints instead of a thin
// screen with proud pilasters, which is what had it reading as a fence standing on the deck.

import { BufferGeometry, Group, Mesh, MeshStandardMaterial, type Material } from 'three/webgpu'

import {
  FACE_CLEARANCE,
  TOKEN,
  TUNNEL_PORTAL,
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

/**
 * `width` and `height` are the *clear* opening — headroom and carriageway, not the outside envelope —
 * and they come straight off the kit datum so the portal cannot drift from the rest of the circuit.
 */
const defaults: F1TunnelPortalConfig = { width: TUNNEL_PORTAL.width, height: TUNNEL_PORTAL.height }

/**
 * Bore length along Z. Long enough that the far end falls away from the key light: at the 4.4 m this
 * came from, the closing wall still caught enough of it that the opening read as a recess rather than
 * as a bore, and 8 m of throat is also what a road wide enough to need a parapet actually spans.
 */
const DEPTH = TUNNEL_PORTAL.depth
/** Structural side-wall thickness flanking the bore. */
const WALL = TUNNEL_PORTAL.wall
/**
 * Slab over the opening. A road runs on top of this, so it is a deck carrying live load rather than a
 * lintel band — and its depth is the largest single reason the portal reads as engineered concrete.
 */
const DECK = TUNNEL_PORTAL.deck
/**
 * How far the headwall stands proud of the bore mouth. This is the reveal: the band of concrete the
 * jambs show before the bore goes dark, and the difference between a portal and a hole.
 *
 * The soffit across that same reveal goes the other way, down to the darkest concrete in the model. A
 * downward face never catches the key, so carrying the soffit at jamb value was a large part of what
 * flattened the front into one wash.
 */
const HEADWALL = 0.62
/**
 * Batter on a pier's outer face, as a slope rather than as a pair of offsets: total face rake per unit
 * of pier height, then how much of that rake is spent flaring the base versus drawing the top in.
 *
 * It has to be a slope because the clear height is config. At the fixed 0.48 / 0.42 offsets this came
 * from, the rake was tuned against one 3.4 m pier and went shallow the moment the opening grew — and
 * what the eye measures is not the angle but how far the silhouette moves against the height it moves
 * across. 1:4.1 holds that constant: steep for a wall, ordinary for an abutment, and enough that the
 * front elevation closes to a trapezoid at any opening the config asks for.
 *
 * Earlier passes at 1:12 and then 1:9 both still read plumb, because half a metre of draw across a
 * seven-metre elevation is inside the width of the coping above it.
 *
 * Because the pier is extruded from an outline in XY, the batter is carried by its front face too, so the
 * taper shows in straight elevation rather than only in the raking side.
 *
 * The kick is deliberately allowed past the deck edge. Holding the base inside the slab was the wrong
 * constraint: an abutment footing is normally wider than the deck it carries, and clamping the flare to
 * the slab meant the widest line in the silhouette was the lid — which is most of what made the thing
 * read as a box.
 */
const PIER_BATTER = 1 / 4.1
const PIER_KICK_SHARE = 0.55
/**
 * What is left of the headwall pier's step over the bore wall once the battered top has drawn in.
 *
 * The step itself is derived, not authored: the pier's outer face has to draw in over its height without
 * crossing inboard of the bore wall it fronts, so the step at deck level is the budget the taper is cut
 * from and it must be the draw plus a margin. Authoring the step instead capped the taper at whatever
 * angle happened to fit, which is how the piers ended up reading plumb.
 */
const PIER_STEP_MARGIN = 0.14

/** FIA 3501 concrete-wall envelope, reused for the deck parapet rather than inventing a second height. */
const PARAPET_H = WALL_END.concrete.height
/**
 * Parapet thickness. Deliberately thicker than the FIA trackside wall the height comes from: that wall is
 * a free-standing barrier, this one is cast monolithic with a deck and has to look like it could take a
 * vehicle impact without the deck edge letting go.
 *
 * At the wall's own 0.35 m the parapet read as a screen rather than as mass — and paired with the proud
 * pilasters that used to divide it, the whole thing read as panel fencing standing on the slab. Thickness
 * is what fixes that, because a parapet is legible as concrete from its cap depth and its returns, both
 * of which scale with how thick it is.
 */
const PARAPET_T = WALL_END.concrete.depth + 0.17
/**
 * The parapet is not one slab. It is a continuous web with cast panels standing forward of it, separated
 * by real recessed joints — a parapet is poured in bays against stop-ends, and those joints are the only
 * concrete character that survives at track scale without inventing surface noise.
 *
 * This replaces pilasters that stood *proud* of the face. A proud vertical strip repeated along a thin
 * wall is a fence post, and five of them turned the parapet into fence bays whatever value it was given.
 * The same rhythm cut *into* the face reads as casting, because the joint is in shadow rather than in the
 * light: the recess does the work the strip was failing to do.
 *
 * The web carries most of the thickness so the panels are a shallow layer over it. A joint 5 cm wide and
 * 42 cm deep is a slot; the same joint over a thick web is 5 cm by 14 cm, which is a construction joint.
 */
const PARAPET_BACK = 0.38
const PARAPET_JOINT = 0.05
/**
 * Bay length, not bay count. A stop-end is placed at a pour length the site can actually cast, so the
 * number of bays has to follow the deck rather than the deck being divided into a fixed five — otherwise
 * a narrow portal gets slot-width panels and a wide one gets bays no formwork would be built for.
 *
 * The count derived from it is forced odd, which is what keeps it from locking to the even run of hazard
 * plates over the opening below (rule 3): two odd rhythms will not read as one grid, two matching ones
 * will. At the default opening this lands on the five bays the elevation was tuned with.
 */
const PARAPET_BAY_PITCH = 1.45
/** Cap over the parapet. Depth follows the wall it caps, so a thicker parapet gets a heavier coping. */
const COPING_H = 0.19
/** Coping oversail, across the wall only. A coping flush with its wall reads as a paint line, not a cap. */
const COPING_OUT = 0.085
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
const SOFFIT_H = 0.2
const SOFFIT_SET = 0.075

/** Dark liner panels inside the bore. They start at the mouth plane so the headwall reveal stays concrete. */
const LINER = 0.08
/**
 * Lit ribs standing proud of the liner, and how they are spaced down the bore. Parallax is what sells the
 * length, so they run at a pitch rather than at two authored stations — but the pitch is coarse.
 *
 * A rib is two bright verticals, one per jamb, and a raking view of an 8 m throat throws the far ones
 * well inboard of the near ones. At a 2 m pitch that is eight verticals fanned across one opening, and
 * the mouth stops reading as a bore and starts reading as a portcullis. Three metres apart the same ribs
 * stay legible as stations passing away from the camera, which is the read that was wanted.
 */
const RIB = 0.09
const RIB_W = 0.24
const RIB_PITCH = 3.0
/** How far inside the mouth the first rib sits, and how much clear bore is left before the closing wall. */
const RIB_LEAD = 1.4
const RIB_TAIL = 0.5
const KERB_H = 0.16
const KERB_W = 0.28
/** Carriageway surface, held proud of the ground plane so the apron reads as a laid slab. */
const ROAD = 0.02
/** Carriageway run in front of the mouth. Long enough that the road still passes the wing wall ends. */
const APRON = 2.0
const DRAIN_W = 0.22

/**
 * Wing walls: splay in plan, thickness, and the slope the rake runs at. They fall from just under the
 * soffit line to a low stub, so the near end springs off a datum the rest of the model already uses.
 *
 * The rake is authored as a slope and the run derived from it, for the same reason the pier batter is:
 * a fixed 3.2 m run tuned against a 3.2 m opening turns into a near-vertical sail the moment the clear
 * height goes to 4.5 m, and a wing that steep has stopped being a diagonal at all.
 *
 * They rake continuously rather than stepping: discrete lifts with a coping each turned the pair into a
 * bar chart flanking the portal, because the tall vertical face at every step reads as its own pylon.
 * They are also held well below the parapet. Springing them from the coping made two sails as tall as
 * the whole structure, and they then hid the piers and both hazard boards — a wing that matches the thing
 * it flanks has stopped being subordinate to it, and the portal has to stay the tallest element for the
 * parapet line to mean anything.
 *
 * The run is long and the far end is low, which is the pair that makes the rake read. A short wing dying
 * at trackside-wall height ended in a metre-tall vertical face under a bright coping, and that end face
 * is a hard stop: it closed the diagonal off before it had gone anywhere and left two stubby buttresses
 * squaring up the silhouette. Taken out further and down to a low stub, the same wall becomes the longest
 * diagonal in the model, which is what the flanking mass is for. The splay works with it — more plan
 * flare throws the far end towards the camera, so the run reads as depth as well as slope.
 */
const SPLAY = 0.52
const WING_T = 0.5
const WING_RAKE = 0.88
/** Height the rake dies at, well under the trackside-wall datum the near end springs from. */
const WING_FAR_H = 0.48
/**
 * The wing's own coping, thinner than the parapet's and held at wall value rather than trim value.
 *
 * Sharing the parapet coping's depth and its bright trim material was a mistake that undid the whole
 * point of darkening the wings. The camera looks slightly down, so a coping's *top* face is presented
 * nearly square to it — on a wall raking away across four metres that top face is the largest single
 * surface either wing shows, and at trim value it turned each wing into a bright ramp with a sliver of
 * dark wall behind it. Darkening the body cannot help while the brightest thing in the frame is bolted
 * along its full length.
 *
 * So it stays a line rather than becoming a surface: thin enough to describe the slope, and only a step
 * off the wall it caps instead of three. The parapet keeps the bright oversailing cap, which is the point
 * — there is one line of trim across the top of the structure, and the wings are subordinate to it.
 */
const WING_COPE_H = 0.1
const WING_COPE_OUT = 0.022
/**
 * Margin on how far the near end is buried inside the pier, over the pier's own draw.
 *
 * The burial is sized against the batter, not against the wing, so it is derived: the pier face draws in
 * over its height, and the corner most at risk of breaking back out through it is the near end's *top*.
 * Covering the full draw plus this margin is safe at any clear height the config asks for.
 */
const WING_BURY_MARGIN = 0.14

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
/**
 * Stacked run of plates up a pier, kept low enough that the top plate stays on the drawn-in face.
 *
 * It does not grow with the opening. Hazard boards are read from a vehicle, so they belong at vehicle
 * height in world units whatever the portal above them is doing (rule 7).
 */
const PIER_PLATE_RUN = 1.9
/**
 * Four across the opening, against the parapet's odd bay count above: two odd rhythms will not lock into
 * one grid the way two matching ones do (rule 3).
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
    color: shade(TOKEN.SHELL_200, -0.5),
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
  //
  // The ladder is also anchored at the top rather than in the middle. Trying to separate the fascia from
  // the mass by lifting the fascia cannot work when the fascia is already clipping: there is no headroom
  // left above it. So the trim takes the top of the range, the fascia sits just under it, and everything
  // below drops — which is the only direction the range still has room in.
  //
  // The whole family then sits lower than the token it is mixed from. SHELL_200 is a cool near-white, and
  // a structure built entirely out of the top of it reads as white panelling with grey shading on it
  // rather than as grey concrete catching a bright key — the ladder was legible but the material was not.
  // Dropping every rung together keeps the separation that was won and spends the headroom on looking
  // like concrete instead.
  const proudMat = new MeshStandardMaterial({
    name: 'f1-kit / portal headwall',
    color: shade(TOKEN.SHELL_200, -0.24),
    roughness: 0.9,
    metalness: 0.0,
  })
  const rakeMat = new MeshStandardMaterial({
    name: 'f1-kit / portal wing',
    color: shade(TOKEN.SHELL_200, -0.72),
    roughness: 0.95,
    metalness: 0.0,
  })
  const soffitMat = new MeshStandardMaterial({
    name: 'f1-kit / portal soffit',
    color: shade(TOKEN.SHELL_200, -0.88),
    roughness: 0.95,
    metalness: 0.0,
  })
  /**
   * Cast trim: copings and painted kerb lines, the brightest concrete in the model.
   *
   * This used to be the kit's `shell` material, which is the wrong family for it. `shell` is a coated
   * panel product — roughness 0.55 and a little metalness — and the copings are the top of almost every
   * mass here, so they take the key square on and returned a sheen off it. Cast concrete does not do
   * that, and a whole structure trimmed in something that does reads as moulded white plastic no matter
   * how well the values underneath it are graded. Same job, same brightness, matte.
   */
  const trimMat = new MeshStandardMaterial({
    name: 'f1-kit / portal trim',
    color: shade(TOKEN.SHELL_200, -0.08),
    roughness: 0.88,
    metalness: 0.0,
  })
  /** Model-owned for their whole life; freed once, in `dispose`. */
  const persistent: Material[] = [concreteMat, proudMat, rakeMat, soffitMat, trimMat]
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
    /** Soffit line: where the piers stop and the proud return takes over. */
    const soffitTop = height + SOFFIT_H
    /**
     * The pier batter, resolved against this opening. The rake is a slope, so the taller the clear
     * opening the further the face travels — and the step over the bore wall is whatever the top's draw
     * needs plus a margin, never less, or the wall behind breaks back out through the pier face.
     */
    const pierRake = soffitTop * PIER_BATTER
    const pierKick = pierRake * PIER_KICK_SHARE
    const pierDraw = pierRake - pierKick
    const pierStep = pierDraw + PIER_STEP_MARGIN
    /** Outer face of a headwall pier at deck level. */
    const pierOut = halfW + WALL + pierStep
    /** Top of the deck slab: where the crossing road runs. */
    const deckTop = height + DECK
    /**
     * Deck half-width. Pulled in tight over the piers: the slab and the parapet on top of it occupy the
     * whole upper half of the elevation, so every centimetre of oversail here is spent widening the one
     * rectangle that was making the structure read as a box. Tight enough that the battered pier bases
     * now flare clearly outboard of it, which is the silhouette this wants — widest at the ground.
     */
    const deckHalf = pierOut + 0.18
    /** The headwall plane. The parapet is flush with it and every applied board measures from it. */
    const face = DEPTH / 2 + HEADWALL

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
      const outer: Pt = [pierOut + pierKick - cx, -cy]
      const outerTop: Pt = [pierOut - pierDraw - cx, cy]
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

    // --- parapets over the deck: a thick curb-wall, panelled with real recessed joints --------------
    // Each parapet is described by its outward face plane and which way the mass runs from it, so the
    // front one can sit flush with the headwall and the back one flush with the rear of the deck.
    const parapetY = deckTop + PARAPET_H / 2
    const panelD = PARAPET_T - PARAPET_BACK
    // Odd, so it cannot fall into step with the even run of hazard plates on the elevation below.
    const parapetBays = Math.max(3, 2 * Math.round(((deckHalf * 2) / PARAPET_BAY_PITCH - 1) / 2) + 1)
    const bayW = (deckHalf * 2 - PARAPET_JOINT * (parapetBays - 1)) / parapetBays
    for (const [plane, into] of [[face, -1], [-DEPTH / 2, 1]] as const) {
      // Continuous web behind the panels, taken to soffit value. It is what the joints open onto, so a
      // joint reads as a shadowed recess rather than as a slot cut through to the sky — and it is the
      // face the crossing road sees, which is turned away from the key and belongs dark anyway.
      soffit.push(bevelBox(deckHalf * 2, PARAPET_H, PARAPET_BACK, 0.014)
        .translate(0, parapetY, plane + into * (PARAPET_T - PARAPET_BACK / 2)))
      for (let i = 0; i < parapetBays; i++) {
        const px = -deckHalf + bayW / 2 + i * (bayW + PARAPET_JOINT)
        concrete.push(bevelBox(bayW, PARAPET_H, panelD, 0.018)
          .translate(px, parapetY, plane + into * (panelD / 2)))
      }
      // Oversails across the wall, not past its ends: a coping that runs on into space past the last
      // support reads as a loose plank rather than as a cast cap. It runs unbroken over the joints,
      // which is what keeps the bays reading as one wall rather than as a row of separate blocks.
      bright.push(bevelBox(deckHalf * 2, COPING_H, PARAPET_T + COPING_OUT * 2, 0.016)
        .translate(0, deckTop + PARAPET_H + COPING_H / 2, plane + into * (PARAPET_T / 2)))
    }
    // The crossing road itself. Without it the deck is an anonymous slab and the parapets have nothing
    // to guard, which is what left the whole mass reading as a box lid.
    const overZ0 = -DEPTH / 2 + PARAPET_T
    const overZ1 = face - PARAPET_T
    surface.push(bevelBox(deckHalf * 2 - 0.1, 0.06, overZ1 - overZ0, 0.008)
      .translate(0, deckTop + 0.03, (overZ0 + overZ1) / 2))

    // --- wing walls: one raking lift per side, soffit line down to a low stub -----------------------
    const wingNear = height - 0.1
    const wingFar = WING_FAR_H
    const wingRun = (wingNear - wingFar) / WING_RAKE
    // The burial covers the pier's full draw, measured along the wing rather than along X: the wing is
    // splayed, so a burial of `b` only reaches `b * cos(SPLAY)` inboard of the pier face.
    const wingBury = pierDraw / Math.cos(SPLAY) + WING_BURY_MARGIN
    for (const sx of [-1, 1] as const) {
      // Both spins are proper rotations. Building one wing and mirroring it would invert its winding,
      // so the -X wing is rotated past half a turn instead.
      const spin = sx > 0 ? -SPLAY : Math.PI + SPLAY
      const x0 = -wingBury
      const cx = (x0 + wingRun) / 2
      const cy = wingNear / 2
      const place = (geo: BufferGeometry): BufferGeometry =>
        geo.translate(cx, cy, 0).rotateY(spin).translate(sx * (pierOut - 0.04), 0, face - 0.24)
      rake.push(place(bevelPrism([
        [x0 - cx, -cy], [wingRun - cx, -cy],
        [wingRun - cx, wingFar - WING_COPE_H - cy], [x0 - cx, wingNear - WING_COPE_H - cy],
      ], WING_T, 0.02)))
      // The coping is a band following the rake, not a horizontal cap: a level coping on a raking wall
      // is the tell that the wall was extruded rather than built. It is the only line that describes the
      // slope, so it is held one step off the wing rather than at trim value — see WING_COPE_H.
      concrete.push(place(bevelPrism([
        [x0 - cx, wingNear - WING_COPE_H - cy], [wingRun - cx, wingFar - WING_COPE_H - cy],
        [wingRun - cx, wingFar - cy], [x0 - cx, wingNear - cy],
      ], WING_T + WING_COPE_OUT * 2, 0.014)))
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

    // Ribs inside the bore, catching the key light against the dark lining. Run at a pitch from just
    // inside the mouth so the count follows the bore length rather than being authored per depth.
    const ribBack = -DEPTH / 2 + RIB_TAIL
    for (let zRib = DEPTH / 2 - RIB_LEAD; zRib >= ribBack; zRib -= RIB_PITCH) {
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
        board(sx * (halfW + (WALL + pierStep) / 2), 0.3 + i * (pierPlate + PLATE_GAP) + pierPlate / 2,
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
    emit('shell', mergeParts(bright, 'f1-tunnel-portal: trim'), shell, 'trim', trimMat)
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
  // Shot at the locked default so the beauty frame is the 1:1 asset, not a trimmed variant. The camera
  // pulls back and the target lifts from the old 3.2 m opening: the structure now stands 6.59 m to the
  // top of the coping over an 8 m bore, and the framing has to hold the parapet line, the throat and
  // both wing stubs at once.
  return createF1Preview(createModel(), {
    aspect,
    target: [0, 2.6, 0.4],
    distance: 27,
    fov: 33,
    yaw: 0.44,
    pitch: 0.17,
    ground: true,
  })
}
