// f1-camera-tower — temporary broadcast infrastructure: a splay-footed lattice mast standing on
// ballasted outriggers, a caged access ladder with a mid-height rest landing, and a camera deck that
// oversails the mast on cantilever brackets under a scrimmed sunshade.
//
// The preview frames the whole tower rather than the head. On this prop the silhouette is the subject:
// framed on the cameras alone it is indistinguishable from `f1-camera-platform`, and what separates
// the two is the mast under the deck.

import {
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  acquireF1Materials,
  arcBand,
  bevelBox,
  bevelDisc,
  bevelRing,
  createF1Preview,
  disposeF1Materials,
  groundPad,
  loftRoundedBox,
  member,
  mergeParts,
  taperedTube,
  tubeSection,
  type Vec3,
} from '../f1-kit-core/index.ts'

type Slot = 'tower' | 'deck'

export interface F1CameraTowerConfig {
  height: number
}

export interface F1CameraTowerOptions extends Partial<F1CameraTowerConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1CameraTowerInstance {
  readonly root: Group
  readonly parts: { tower: Group; deck: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1CameraTowerConfig>
  configure(patch: Partial<F1CameraTowerConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1CameraTowerConfig = { height: 8 }

// Physical dimensions in metres (rule 7). The mast runs parallel above the splay; below it the legs
// rake out to the wider footprint a free-standing tower needs.
const MAST_HALF = 0.6
const FOOT_HALF = 0.95
/** Ballast anchor radius on each corner diagonal, and the height its stack tops out at. */
const ANCHOR = 1.74
const ANCHOR_TOP = 0.35
/**
 * The outrigger is a leg, not a stay: two tubes of mast section splayed in plan, laced together, and
 * landed on one shoe plate on the ballast. `OUT_SPREAD` is the half-spread at the shoe, which is what
 * gives the pair enough width to be braced against instead of hinging.
 */
const OUT_SHOE_Y = ANCHOR_TOP + 0.065
const OUT_SPREAD = 0.3
/**
 * The ladder clears the widest part of the tower so it can run dead straight, on standoff brackets.
 * It sits on +Z with the landing on +X: those are the faces the kit's key light reaches, and the
 * lighting rig is a kit-wide decision, so the prop turns to meet it rather than the other way round.
 */
const LADDER_Z = FOOT_HALF + 0.32
const LADDER_HALF = 0.25
const CAGE_R = 0.35
const DECK_HALF_X = 1.3
const DECK_HALF_Z = 1.06
const RAIL_MID = 0.55
const RAIL_TOP = 1.02
/** Half-width of the ladder arrival gap in the deck's +Z rail run. */
const GATE_HALF = 0.27
/** Rail heights and post height on the mid landing, kept off the deck rail so the two can diverge. */
const LANDING_RAILS = [0.44, 0.76, 1.08] as const
const LANDING_POST_TOP = 1.13
// The sunshade stands on two posts along the deck's back edge and cantilevers forward on raking
// struts, with a scrim closing the back. Posting all four corners instead turns the head into a
// watchtower cabin; lifting it clear of the camera turns it into a detached blade.
const CANOPY_BACK_X = -(DECK_HALF_X - 0.2)
const CANOPY_FRONT_X = 0.62
const CANOPY_BACK_Y = 1.68
const CANOPY_FRONT_Y = 1.5
const CANOPY_HALF_Z = 0.88

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const
const FACES = [[0, 1], [1, 2], [2, 3], [3, 0]] as const

interface Frame {
  readonly h: number
  readonly bays: number
  /** Node heights from grade to deck. Every ledger, brace, coupler and landing lands on one. */
  readonly nodes: readonly number[]
  readonly splayTop: number
  halfAt(y: number): number
}

function frameFor(h: number): Frame {
  const bays = Math.max(5, Math.round(h / 1.05))
  const nodes: number[] = []
  for (let i = 0; i <= bays; i++) nodes.push((i / bays) * h)
  const splayTop = nodes[Math.min(bays - 2, Math.max(2, Math.round(bays * 0.3)))]!
  return {
    h,
    bays,
    nodes,
    splayTop,
    halfAt: (y) =>
      y >= splayTop ? MAST_HALF : MAST_HALF + (FOOT_HALF - MAST_HALF) * (1 - y / splayTop),
  }
}

const corner = (f: Frame, sx: number, sz: number, y: number): Vector3 =>
  new Vector3(sx * f.halfAt(y), y, sz * f.halfAt(y))

function legParts(f: Frame): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  for (const [sx, sz] of CORNERS) {
    for (let i = 0; i < f.bays; i++) {
      parts.push(member(corner(f, sx, sz, f.nodes[i]!), corner(f, sx, sz, f.nodes[i + 1]!), 0.055, 10))
    }
    const hw = f.halfAt(0)
    // Base jack and sole plate: the bottom 0.2 m of a temporary tower leg is a screw jack, not a leg.
    const jack = new CylinderGeometry(0.075, 0.075, 0.2, 10)
    jack.translate(sx * hw, 0.13, sz * hw)
    parts.push(jack)
    parts.push(groundPad([0.36, 0.36], [sx * hw, 0, sz * hw], 0.035))
  }
  return parts
}

function bracingParts(f: Frame): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  for (let fi = 0; fi < FACES.length; fi++) {
    const [a, b] = FACES[fi]!
    const ca = CORNERS[a]!
    const cb = CORNERS[b]!
    for (const y of f.nodes) {
      parts.push(member(corner(f, ca[0], ca[1], y), corner(f, cb[0], cb[1], y), 0.032, 8))
    }
    // One diagonal per bay, flipped every bay and every face, so the braces chase each other round
    // the tower instead of stacking into four identical zig-zags.
    for (let i = 0; i < f.bays; i++) {
      const rising = (i + fi) % 2 === 0
      const low = rising ? ca : cb
      const high = rising ? cb : ca
      parts.push(member(
        corner(f, low[0], low[1], f.nodes[i]!),
        corner(f, high[0], high[1], f.nodes[i + 1]!),
        0.024,
        7,
      ))
    }
  }
  return parts
}

function outriggerParts(f: Frame): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const kneeY = f.nodes.find((y) => y > f.splayTop + 1e-6) ?? f.splayTop
  const laces = [0.36, 0.58, 0.8] as const
  for (const [sx, sz] of CORNERS) {
    const apex = corner(f, sx, sz, f.splayTop)
    const shoe = new Vector3(sx * ANCHOR, OUT_SHOE_Y, sz * ANCHOR)
    // Unit vector across the corner diagonal: the direction the pair of tubes opens out along.
    const px = -sz * Math.SQRT1_2
    const pz = sx * Math.SQRT1_2
    const at = (t: number, side: number): Vector3 => new Vector3(
      apex.x + (shoe.x - apex.x) * t + side * t * OUT_SPREAD * px,
      apex.y + (shoe.y - apex.y) * t,
      apex.z + (shoe.z - apex.z) * t + side * t * OUT_SPREAD * pz,
    )
    for (const side of [-1, 1] as const) {
      parts.push(member(apex, at(1, side), 0.058, 10))
    }
    // Lacing across the splay, then the zig-zag that makes the two tubes act as one leg.
    for (const t of laces) parts.push(member(at(t, -1), at(t, 1), 0.026, 7))
    for (let i = 0; i < laces.length - 1; i++) {
      const flip = i % 2 === 0 ? 1 : -1
      parts.push(member(at(laces[i]!, -flip), at(laces[i + 1]!, flip), 0.02, 6))
    }
    // Knee brace off the mast a bay above the splay. This is the member that walks deck load out of
    // the mast and down the raker, and it replaces the hair-thin tension stay it used to be.
    parts.push(member(corner(f, sx, sz, kneeY), at(0.58, 0), 0.032, 8))
    // Ground spreader from the base of the mast to the same shoe, closing the triangle at grade.
    const spreadY = ANCHOR_TOP + 0.04
    parts.push(member(
      new Vector3(sx * f.halfAt(spreadY), spreadY, sz * f.halfAt(spreadY)),
      new Vector3(sx * (ANCHOR - 0.05), spreadY, sz * (ANCHOR - 0.05)),
      0.042,
      8,
    ))
    // Shoe plate: the rakers bear on spread steel, not straight onto a concrete block.
    const plate = bevelBox(0.72, 0.06, 0.4, 0.012)
    plate.rotateY(Math.atan2(sx, sz))
    plate.translate(sx * ANCHOR, ANCHOR_TOP + 0.035, sz * ANCHOR)
    parts.push(plate)
  }
  return parts
}

function couplerParts(f: Frame): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  for (const [sx, sz] of CORNERS) {
    for (const y of f.nodes) {
      const hw = f.halfAt(y)
      // A right-angle coupler is two clamps back to back: one takes the ledger, one the brace. At the
      // deck node the second clamp hangs below, clear of the planks.
      const ledgerClamp = new CylinderGeometry(0.084, 0.084, 0.062, 10)
      ledgerClamp.translate(sx * hw, y, sz * hw)
      parts.push(ledgerClamp)
      const braceClamp = new CylinderGeometry(0.072, 0.072, 0.05, 10)
      braceClamp.translate(sx * hw, y + (y >= f.h - 1e-6 ? -0.088 : 0.088), sz * hw)
      parts.push(braceClamp)
    }
  }
  return parts
}

function ballastParts(): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  for (const [sx, sz] of CORNERS) {
    const yaw = Math.atan2(sx, sz)
    // Two blocks per anchor, each dropped by hand and so never quite square to the one under it. They
    // are sized off the outrigger shoe: the shoe has to land inside the block, not overhang it.
    for (let i = 0; i < 2; i++) {
      const block = bevelBox(0.86, 0.17, 0.54, 0.016)
      block.rotateY(yaw + (i === 0 ? -0.045 * sz : 0.062 * sx))
      block.translate(sx * ANCHOR, 0.089 + i * 0.176, sz * ANCHOR)
      parts.push(block)
    }
  }
  return parts
}

function ladderParts(f: Frame): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  for (const sx of [-1, 1] as const) {
    parts.push(member(
      new Vector3(sx * LADDER_HALF, 0.1, LADDER_Z),
      new Vector3(sx * LADDER_HALF, f.h + 0.18, LADDER_Z),
      0.026,
      8,
    ))
  }
  const rungs = Math.floor((f.h - 0.2) / 0.3)
  for (let i = 0; i <= rungs; i++) {
    const y = 0.34 + i * 0.3
    parts.push(member(
      new Vector3(-LADDER_HALF, y, LADDER_Z),
      new Vector3(LADDER_HALF, y, LADDER_Z),
      0.014,
      6,
    ))
  }
  // Standoff brackets tie the straight ladder back to the raking face every second node.
  for (let i = 1; i <= f.bays; i += 2) {
    const y = f.nodes[i]!
    for (const sx of [-1, 1] as const) {
      parts.push(member(
        new Vector3(sx * LADDER_HALF, y, LADDER_Z),
        new Vector3(sx * LADDER_HALF, y, f.halfAt(y)),
        0.02,
        6,
      ))
    }
  }
  return parts
}

function cageParts(f: Frame): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const centreZ = LADDER_Z + 0.06
  const hoops: number[] = []
  for (let i = 2; i <= f.bays; i += 2) hoops.push(f.nodes[i]!)
  for (const y of hoops) {
    // Closed outboard, open toward the tower so the climber can step off at the landing and the deck.
    const hoop = arcBand(CAGE_R, CAGE_R + 0.036, -0.09 * Math.PI, 1.09 * Math.PI, 0.04, 0.008, 20)
    hoop.rotateX(Math.PI / 2)
    hoop.translate(0, y, centreZ)
    parts.push(hoop)
  }
  const first = hoops[0]
  const last = hoops[hoops.length - 1]
  if (first === undefined || last === undefined) return parts
  for (const turn of [0.16, 0.5, 0.84] as const) {
    const angle = turn * Math.PI
    const x = Math.cos(angle) * (CAGE_R + 0.018)
    const z = centreZ + Math.sin(angle) * (CAGE_R + 0.018)
    parts.push(member(new Vector3(x, first - 0.12, z), new Vector3(x, last + 0.12, z), 0.013, 6))
  }
  return parts
}

interface Landing {
  readonly y: number
  readonly nearX: number
  readonly farX: number
  readonly halfZ: number
}

function landingFor(f: Frame): Landing {
  const index = Math.min(f.bays - 2, Math.max(2, Math.round(f.bays * 0.55)))
  return { y: f.nodes[index]!, nearX: MAST_HALF, farX: MAST_HALF + 1.12, halfZ: 0.68 }
}

function landingDeckParts(l: Landing): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const span = l.farX - l.nearX
  const midX = (l.nearX + l.farX) / 2
  const plate = bevelBox(span, 0.07, l.halfZ * 2, 0.012)
  plate.translate(midX, l.y + 0.035, 0)
  parts.push(plate)
  // Fascia on the three exposed edges, the same trick as the crown: a rest platform on a climb has to
  // have depth to read as a stage rather than a shelf clipped to a tube.
  for (const sz of [-1, 1] as const) {
    parts.push(bevelBox(span, 0.2, 0.05, 0.01)
      .translate(midX, l.y - 0.07, sz * (l.halfZ - 0.025)))
  }
  parts.push(bevelBox(0.05, 0.2, l.halfZ * 2 - 0.1, 0.01)
    .translate(l.farX - 0.025, l.y - 0.07, 0))
  for (const sz of [-1, 1] as const) {
    parts.push(bevelBox(span, 0.17, 0.032, 0.006)
      .translate(midX, l.y + 0.145, sz * (l.halfZ - 0.016)))
  }
  parts.push(bevelBox(0.032, 0.17, l.halfZ * 2 - 0.064, 0.006)
    .translate(l.farX - 0.016, l.y + 0.145, 0))
  return parts
}

function landingFrameParts(l: Landing): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const railZ = l.halfZ - 0.06
  const railX = l.farX - 0.06
  const midX = (l.nearX + l.farX) / 2
  const bearerY = l.y - 0.05
  for (const sz of [-1, 1] as const) {
    // Two props per side: a deep raker onto the fascia at the far edge and a shorter strut under
    // mid-span. At this size the landing is a small deck, so it is propped like one.
    parts.push(member(
      new Vector3(MAST_HALF, l.y - 0.92, sz * MAST_HALF),
      new Vector3(railX, l.y - 0.14, sz * (l.halfZ - 0.06)),
      0.04,
      8,
    ))
    parts.push(member(
      new Vector3(MAST_HALF, l.y - 0.42, sz * MAST_HALF),
      new Vector3(midX, l.y - 0.12, sz * (l.halfZ - 0.05)),
      0.03,
      7,
    ))
    parts.push(member(
      new Vector3(l.nearX, bearerY, sz * (l.halfZ - 0.05)),
      new Vector3(l.farX - 0.04, bearerY, sz * (l.halfZ - 0.05)),
      0.032,
      8,
    ))
  }
  parts.push(member(
    new Vector3(l.nearX, bearerY, 0),
    new Vector3(l.farX - 0.04, bearerY, 0),
    0.028,
    7,
  ))
  parts.push(member(
    new Vector3(l.farX - 0.05, bearerY, -(l.halfZ - 0.05)),
    new Vector3(l.farX - 0.05, bearerY, l.halfZ - 0.05),
    0.032,
    8,
  ))
  const posts: Array<readonly [number, number]> = [
    [railX, -railZ], [railX, 0], [railX, railZ], [midX, -railZ], [midX, railZ],
  ]
  for (const [x, z] of posts) {
    parts.push(member(
      new Vector3(x, l.y + 0.03, z),
      new Vector3(x, l.y + LANDING_POST_TOP, z),
      0.03,
      8,
    ))
  }
  for (const ry of LANDING_RAILS) {
    for (const sz of [-1, 1] as const) {
      parts.push(member(
        new Vector3(l.nearX - 0.02, l.y + ry, sz * railZ),
        new Vector3(railX, l.y + ry, sz * railZ),
        0.022,
        7,
      ))
    }
    parts.push(member(
      new Vector3(railX, l.y + ry, -railZ),
      new Vector3(railX, l.y + ry, railZ),
      0.022,
      7,
    ))
  }
  return parts
}

function deckFrameParts(f: Frame): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const y = f.h - 0.035
  const cx = DECK_HALF_X - 0.04
  const cz = DECK_HALF_Z - 0.04
  for (const sz of [-1, 1] as const) {
    parts.push(member(new Vector3(-cx, y, sz * cz), new Vector3(cx, y, sz * cz), 0.04, 8))
  }
  for (const sx of [-1, 1] as const) {
    parts.push(member(new Vector3(sx * cx, y, -cz), new Vector3(sx * cx, y, cz), 0.04, 8))
  }
  for (const jx of [-0.87, -0.435, 0, 0.435, 0.87] as const) {
    parts.push(member(new Vector3(jx, y, -cz), new Vector3(jx, y, cz), 0.028, 6))
  }
  // The deck oversails the mast by most of a metre on the long axis, so the edge beam is picked up by
  // a full flare of raking brackets off the last node rather than four token struts.
  const root = f.nodes[f.bays - 1]!
  const land = y - 0.235
  for (const [sx, sz] of CORNERS) {
    parts.push(member(
      corner(f, sx, sz, root),
      new Vector3(sx * (cx - 0.02), land, sz * (cz - 0.02)),
      0.046,
      8,
    ))
  }
  for (const sx of [-1, 1] as const) {
    parts.push(member(
      new Vector3(sx * MAST_HALF, root, 0),
      new Vector3(sx * (cx - 0.02), land, 0),
      0.034,
      7,
    ))
  }
  for (const sz of [-1, 1] as const) {
    parts.push(member(
      new Vector3(0, root, sz * MAST_HALF),
      new Vector3(0, land, sz * (cz - 0.02)),
      0.034,
      7,
    ))
  }
  return parts
}

function plankParts(f: Frame): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const count = 9
  const gap = 0.022
  const width = (DECK_HALF_Z * 2 - gap * (count - 1)) / count
  for (let i = 0; i < count; i++) {
    const plank = bevelBox(DECK_HALF_X * 2, 0.05, width, 0.007)
    plank.translate(0, f.h + 0.025, -DECK_HALF_Z + width / 2 + i * (width + gap))
    parts.push(plank)
  }
  return parts
}

function deckEdgeParts(f: Frame): BufferGeometry[] {
  // Deep fascia hung off the ledgers on all four sides, in the plank material so it reads with them
  // as one slab. Without it the crown is a plank raft on sticks instead of a broadcast platform.
  const parts: BufferGeometry[] = []
  const y = f.h - 0.17
  for (const sz of [-1, 1] as const) {
    parts.push(bevelBox(DECK_HALF_X * 2, 0.24, 0.05, 0.01)
      .translate(0, y, sz * (DECK_HALF_Z - 0.025)))
  }
  for (const sx of [-1, 1] as const) {
    parts.push(bevelBox(0.05, 0.24, DECK_HALF_Z * 2 - 0.1, 0.01)
      .translate(sx * (DECK_HALF_X - 0.025), y, 0))
  }
  return parts
}

function toeBoardParts(f: Frame): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const y = f.h + 0.145
  for (const sz of [-1, 1] as const) {
    parts.push(bevelBox(DECK_HALF_X * 2, 0.19, 0.034, 0.006)
      .translate(0, y, sz * (DECK_HALF_Z - 0.017)))
  }
  for (const sx of [-1, 1] as const) {
    parts.push(bevelBox(0.034, 0.19, DECK_HALF_Z * 2 - 0.068, 0.006)
      .translate(sx * (DECK_HALF_X - 0.017), y, 0))
  }
  return parts
}

function railParts(f: Frame): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const px = DECK_HALF_X - 0.06
  const pz = DECK_HALF_Z - 0.06
  const posts: Array<readonly [number, number]> = [
    [-px, -pz], [0, -pz], [px, -pz], [px, 0], [px, pz], [0, pz], [-px, pz], [-px, 0],
  ]
  for (const [x, z] of posts) {
    parts.push(member(
      new Vector3(x, f.h + 0.04, z),
      new Vector3(x, f.h + RAIL_TOP + 0.05, z),
      0.028,
      8,
    ))
  }
  for (const ry of [RAIL_MID, RAIL_TOP] as const) {
    const y = f.h + ry
    parts.push(member(new Vector3(-px, y, -pz), new Vector3(px, y, -pz), 0.022, 7))
    for (const sx of [-1, 1] as const) {
      parts.push(member(new Vector3(sx * px, y, -pz), new Vector3(sx * px, y, pz), 0.022, 7))
      // The ladder arrives through the +Z face, so that run stops short of a gate opening.
      parts.push(member(
        new Vector3(sx * px, y, pz),
        new Vector3(sx * GATE_HALF, y, pz),
        0.022,
        7,
      ))
    }
  }
  return parts
}

function canopyFrameParts(f: Frame): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const midX = (CANOPY_BACK_X + CANOPY_FRONT_X) / 2
  const midY = (CANOPY_BACK_Y + CANOPY_FRONT_Y) / 2
  for (const sz of [-1, 1] as const) {
    const z = sz * CANOPY_HALF_Z
    parts.push(member(
      new Vector3(CANOPY_BACK_X, f.h + 0.05, z),
      new Vector3(CANOPY_BACK_X, f.h + CANOPY_BACK_Y, z),
      0.038,
      10,
    ))
    parts.push(member(
      new Vector3(CANOPY_BACK_X, f.h + CANOPY_BACK_Y, z),
      new Vector3(CANOPY_FRONT_X, f.h + CANOPY_FRONT_Y, z),
      0.026,
      8,
    ))
    // The raking strut is what lets the shade reach forward without a second pair of legs.
    parts.push(member(
      new Vector3(CANOPY_BACK_X, f.h + CANOPY_BACK_Y - 0.62, z),
      new Vector3(CANOPY_FRONT_X - 0.06, f.h + CANOPY_FRONT_Y - 0.04, z),
      0.026,
      8,
    ))
  }
  // Centre rafter and a mid purlin: a roof with this much plan area cannot hang off two edge rails.
  parts.push(member(
    new Vector3(CANOPY_BACK_X, f.h + CANOPY_BACK_Y, 0),
    new Vector3(CANOPY_FRONT_X, f.h + CANOPY_FRONT_Y, 0),
    0.022,
    7,
  ))
  const purlins: Array<readonly [number, number]> = [
    [CANOPY_BACK_X, CANOPY_BACK_Y],
    [midX, midY],
    [CANOPY_FRONT_X, CANOPY_FRONT_Y],
  ]
  for (const [x, y] of purlins) {
    parts.push(member(
      new Vector3(x, f.h + y, -CANOPY_HALF_Z),
      new Vector3(x, f.h + y, CANOPY_HALF_Z),
      0.022,
      7,
    ))
  }
  return parts
}

function canopySheetParts(f: Frame): BufferGeometry[] {
  const span = CANOPY_FRONT_X - CANOPY_BACK_X
  const rise = CANOPY_FRONT_Y - CANOPY_BACK_Y
  const depth = CANOPY_HALF_Z * 2 + 0.1
  const sheet = bevelBox(Math.hypot(span, rise) + 0.2, 0.048, depth, 0.01)
  sheet.rotateZ(Math.atan2(rise, span))
  sheet.translate(
    (CANOPY_BACK_X + CANOPY_FRONT_X) / 2,
    f.h + (CANOPY_BACK_Y + CANOPY_FRONT_Y) / 2 + 0.062,
    0,
  )
  const fascia = bevelBox(0.06, 0.16, depth, 0.01)
  fascia.translate(CANOPY_FRONT_X + 0.08, f.h + CANOPY_FRONT_Y - 0.04, 0)
  // Scrim across the back of the position: it keeps the low sun off the viewfinder, and it is what
  // ties the shade to the deck instead of leaving it reading as a floating blade.
  const scrim = bevelBox(0.036, 0.5, CANOPY_HALF_Z * 2, 0.008)
  scrim.translate(CANOPY_BACK_X - 0.035, f.h + CANOPY_BACK_Y - 0.24, 0)
  return [sheet, fascia, scrim]
}

/**
 * Position a part authored around its own origin facing +Z onto a yawed assembly. Camera hardware is
 * easier to measure in the camera's own frame than in deck coordinates.
 */
function place(geometry: BufferGeometry, yaw: number, base: Vec3, local: Vec3): BufferGeometry {
  geometry.rotateY(yaw)
  const s = Math.sin(yaw)
  const c = Math.cos(yaw)
  geometry.translate(
    base[0] + local[0] * c + local[2] * s,
    base[1] + local[1],
    base[2] - local[0] * s + local[2] * c,
  )
  return geometry
}

interface CameraBatch {
  readonly shell: BufferGeometry[]
  readonly optics: BufferGeometry[]
  readonly glass: BufferGeometry[]
  readonly tally: BufferGeometry[]
}

function mainCameraParts(base: Vec3, out: CameraBatch): void {
  const yaw = 0.34
  // Tripod down to three shoes, braced back to a spreader hub, then a pedestal to the pan head. The
  // column is at working camera height so the lens shoots over the top rail rather than through it.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - 0.2
    const foot = new Vector3(base[0] + Math.cos(a) * 0.36, base[1], base[2] + Math.sin(a) * 0.36)
    out.shell.push(member(new Vector3(base[0], base[1] + 0.42, base[2]), foot, 0.02, 7))
    out.shell.push(member(new Vector3(base[0], base[1] + 0.12, base[2]), foot, 0.012, 5))
    out.shell.push(bevelBox(0.09, 0.022, 0.07, 0.004)
      .rotateY(-a)
      .translate(foot.x, base[1] + 0.011, foot.z))
  }
  const column = new CylinderGeometry(0.05, 0.06, 0.7, 12)
  column.translate(base[0], base[1] + 0.51, base[2])
  out.shell.push(column)
  out.shell.push(place(bevelBox(0.24, 0.1, 0.26, 0.01), yaw, base, [0, 0.88, 0]))
  out.shell.push(place(loftRoundedBox(0.34, 0.3, 0.5, 0.03), yaw, base, [0, 1.08, 0.02]))
  out.shell.push(place(bevelBox(0.38, 0.035, 0.36, 0.008), yaw, base, [0, 1.27, 0]))
  out.shell.push(place(loftRoundedBox(0.18, 0.15, 0.17, 0.02), yaw, base, [-0.14, 1.18, -0.08]))
  out.shell.push(place(bevelBox(0.14, 0.12, 0.02, 0.004), yaw, base, [-0.14, 1.18, -0.18]))
  for (const sx of [-1, 1] as const) {
    out.shell.push(place(
      member(new Vector3(sx * 0.08, 0.84, -0.14), new Vector3(sx * 0.15, 0.71, -0.5), 0.012, 6),
      yaw,
      base,
      [0, 0, 0],
    ))
  }
  out.optics.push(place(tubeSection(0.115, 0.48, [0, 0, 0], [0, 0, 1], 16), yaw, base, [0, 1.07, 0.5]))
  out.optics.push(place(bevelRing(0.115, 0.158, 0.1, 0.014, 26), yaw, base, [0, 1.07, 0.78]))
  out.glass.push(place(bevelDisc(0.11, 0.014, 0.004, 22), yaw, base, [0, 1.07, 0.76]))
  out.tally.push(place(bevelDisc(0.024, 0.014, 0.004, 10), yaw, base, [0, 1.3, 0.15]))
}

function remoteCameraParts(base: Vec3, out: CameraBatch): void {
  const yaw = -0.62
  out.shell.push(bevelBox(0.22, 0.032, 0.22, 0.006).translate(base[0], base[1] + 0.016, base[2]))
  const post = new CylinderGeometry(0.042, 0.054, 0.8, 12)
  post.translate(base[0], base[1] + 0.43, base[2])
  out.shell.push(post)
  for (const sx of [-1, 1] as const) {
    out.shell.push(place(bevelBox(0.036, 0.18, 0.15, 0.006), yaw, base, [sx * 0.13, 0.94, 0]))
  }
  out.shell.push(place(loftRoundedBox(0.22, 0.2, 0.34, 0.028), yaw, base, [0, 1, 0.01]))
  out.shell.push(place(bevelBox(0.26, 0.032, 0.3, 0.006), yaw, base, [0, 1.13, 0.02]))
  out.optics.push(place(tubeSection(0.068, 0.2, [0, 0, 0], [0, 0, 1], 14), yaw, base, [0, 0.99, 0.25]))
  out.glass.push(place(bevelDisc(0.062, 0.012, 0.003, 16), yaw, base, [0, 0.99, 0.35]))
  out.tally.push(place(bevelDisc(0.018, 0.012, 0.003, 8), yaw, base, [0, 1.16, 0.11]))
}

function loomParts(f: Frame): BufferGeometry[] {
  // Camera and comms cable, lashed down the near leg to a coil at the foot. On a temporary position
  // the cable run is as characteristic as the tower.
  const midY = f.splayTop * 0.5
  const lowY = 0.4
  const loom = taperedTube([
    new Vector3(0.4, f.h - 0.08, 0.66),
    new Vector3(MAST_HALF + 0.08, f.h - 0.95, MAST_HALF + 0.06),
    new Vector3(MAST_HALF + 0.09, f.splayTop + 0.5, MAST_HALF + 0.08),
    new Vector3(f.halfAt(midY) + 0.1, midY, f.halfAt(midY) + 0.1),
    new Vector3(f.halfAt(lowY) + 0.18, 0.28, f.halfAt(lowY) + 0.2),
    new Vector3(1.06, 0.06, 1.38),
  ], 0.042, 8)
  const coil = bevelRing(0.15, 0.27, 0.075, 0.014, 28)
  coil.rotateX(-Math.PI / 2)
  coil.translate(1.2, 0.042, 1.5)
  return [loom, coil]
}

export function createModel(options: F1CameraTowerOptions = {}): F1CameraTowerInstance {
  const config: F1CameraTowerConfig = {
    height: Math.min(12, Math.max(6, options.height ?? defaults.height)),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const materialSlots: Record<Slot, Material> = {
    tower: options.materials?.tower ?? kit.steel,
    deck: options.materials?.deck ?? kit.graphite,
  }

  const root = new Group(); root.name = 'f1-camera-tower'
  const tower = new Group(); tower.name = 'tower'
  const deck = new Group(); deck.name = 'deck'
  root.add(tower, deck)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { tower: [], deck: [] }

  const releaseGenerated = (): void => {
    tower.clear(); deck.clear()
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
    // Only slot-driven meshes follow setMaterial. A part that asked for a specific kit material —
    // lens glass, a tally lamp — keeps it, or swapping the deck slot flattens the whole head.
    if (material === undefined) meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const rebuild = (): void => {
    releaseGenerated()
    const f = frameFor(config.height)
    const landing = landingFor(f)

    emit('tower', mergeParts(
      [...legParts(f), ...bracingParts(f), ...outriggerParts(f)],
      'f1-camera-tower: lattice',
    ), tower, 'lattice')
    emit('tower', mergeParts(couplerParts(f), 'f1-camera-tower: couplers'), tower, 'couplers', kit.graphite)
    emit('tower', mergeParts(ballastParts(), 'f1-camera-tower: ballast'), tower, 'ballast', kit.slate)
    emit('tower', mergeParts(
      [...ladderParts(f), ...cageParts(f), ...landingFrameParts(landing)],
      'f1-camera-tower: access',
    ), tower, 'access', kit.steel)
    emit('tower', mergeParts(landingDeckParts(landing), 'f1-camera-tower: landing'), tower, 'landing', kit.graphite)
    emit('tower', mergeParts(loomParts(f), 'f1-camera-tower: loom'), tower, 'loom', kit.ink)

    emit('deck', mergeParts(deckFrameParts(f), 'f1-camera-tower: deck frame'), deck, 'frame', kit.steel)
    emit('deck', mergeParts(
      [...plankParts(f), ...deckEdgeParts(f)],
      'f1-camera-tower: platform',
    ), deck, 'platform')
    emit('deck', mergeParts(toeBoardParts(f), 'f1-camera-tower: toe boards'), deck, 'toeboards', kit.ink)
    emit('deck', mergeParts(
      [...railParts(f), ...canopyFrameParts(f)],
      'f1-camera-tower: rails',
    ), deck, 'rails', kit.steel)
    emit('deck', mergeParts(canopySheetParts(f), 'f1-camera-tower: canopy'), deck, 'canopy', kit.shell)

    const batch: CameraBatch = { shell: [], optics: [], glass: [], tally: [] }
    mainCameraParts([-0.48, f.h + 0.05, 0.02], batch)
    remoteCameraParts([0.86, f.h + 0.05, -0.1], batch)
    emit('deck', mergeParts(batch.shell, 'f1-camera-tower: cameras'), deck, 'cameras', kit.ink)
    emit('deck', mergeParts(batch.optics, 'f1-camera-tower: lenses'), deck, 'lenses', kit.slate)
    emit('deck', mergeParts(batch.glass, 'f1-camera-tower: glass'), deck, 'glass', kit.cyan)
    emit('deck', mergeParts(batch.tally, 'f1-camera-tower: tally'), deck, 'tally', kit.red)
  }
  rebuild()

  return {
    root,
    parts: { tower, deck },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.height !== undefined) config.height = Math.min(12, Math.max(6, patch.height))
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel({ height: 7 }), {
    aspect,
    target: [0, 4.2, 0],
    distance: 21.6,
    fov: 28,
    yaw: 0.62,
    pitch: 0.12,
  })
}
