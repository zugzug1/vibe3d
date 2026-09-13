// kk-004-cedar-cat-tower — the café's cedar cat tower: a plank base deck, a lattice-sided cubby with a
// round mouth, four sisal-wrapped posts and five asymmetric resting platforms with spindle rails.
//
// DATUM. Manifest kk-004: 1.00 W × 0.80 D × 1.65 H m, "authored modeling target, not measured". The base
// deck IS the footprint — 1.00 × 0.80 — so every platform above it cantilevers inside its own base and
// the tower cannot tip out of its declared envelope; the top rail closes the silhouette at 1.65 m.
//
// AXES / ORIGIN. Y-up, metres, ground y = 0, bottom-centre origin (re-centred on its own bounds after
// every rebuild, so dropping the ramp or the cushions keeps the datum). Front = +Z: the cubby's round
// mouth, the open side of both spindle rails and the foot of the scratch ramp all face +Z.
//
// PARTS. `base` (deck, perimeter rail, four feet), `cubby` (boarded box, round-collared mouth, lattice
// flank, floor mat, lid), `structure` (the cedar spine post, the lattice panel, the four sisal posts and
// their iron ferrules), `platforms` (round mid, lower-right, right-mid, top — with their spindle rails),
// `cushions` (three, indigo and rush) and `ramp` (MOVABLE — the loose scratch ramp, pivot on its foot
// edge where it rests on the deck at (0.26, 0.09, 0.30) m, rotates about X to be leaned steeper or
// flatter; it is a separate object in the reference, not joinery).
//
// COLLIDER. compound(box base 1.00 × 0.09 × 0.80 + box cubby 0.50 × 0.44 × 0.44 + capsule spine
// 0.09 r × 1.41 h). Decorative platforms are cantilevers a player walks under; a single AABB would wall
// off the whole cell.
//
// VALUE RAMP, NOT MORE MATERIALS. Four slots (cedar, washi for the sisal rope, tatami for the woven
// scratch pads and the rush cushion, indigo for the two cloth cushions). Every darker cedar value — the
// cubby interior, the post ferrules, the deck's shadowed rebate — is a per-vertex multiplier onto the
// slot's palette colour, solved in linear space by `tintOf`. No baked light direction.
//
// WHAT THE REFERENCE COULD NOT SHOW / ART-DIRECTION CORRECTIONS. The back and left return are away from
// the camera and are a plausible reconstruction (boarded, matching the visible faces). The hanging toy
// ball on its cord is omitted — loose dressing, and the roster's own kk-046. The reference's top cushion
// is ivory with a red wedge and the mid one blue; both are built indigo so the tower carries one cloth,
// which is the kit's restraint rule rather than the painting's. The cedar upright in the reference has a
// round cut-out; it is modelled solid, since a hole read at 1.5 m costs more than it returns.

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
  arcBand,
  bevelBox,
  bevelDisc,
  bevelRing,
  createKkPreview,
  finishModel,
  loftRoundedBox,
  mergeParts,
  mixToken,
  revolve,
  shade,
  socket,
} from '../kk-core/index.ts'

const ID = 'kk-004-cedar-cat-tower'

type Slot = 'cedar' | 'rope' | 'rush' | 'cloth'

const SLOT_BASE: Record<Slot, number> = {
  cedar: DERIVED.CEDAR,
  rope: DERIVED.WASHI,
  rush: DERIVED.TATAMI,
  cloth: DERIVED.INDIGO_CLOTH,
}

const RAMP_TONE = {
  /** Cubby interior, the underside rebate of the deck. */
  cedarDark: DERIVED.CEDAR_DARK,
  /** Iron ferrules clamping each sisal post. */
  iron: mixToken(DERIVED.CEDAR_DARK, TOKEN.CHARCOAL, 0.7),
  /** The rope's shaded lay, one step off the washi it is wound from. */
  ropeWorn: mixToken(DERIVED.WASHI, DERIVED.CEDAR_DARK, 0.28),
  /** Sun-faded top cushion, so the three cloths are not one flat coat. */
  clothFaded: DERIVED.INDIGO_FADED,
} as const

export interface KkCatTowerConfig {
  /** The loose scratch ramp leaning on the deck. */
  ramp: boolean
  /** The three cushions. */
  cushions: boolean
  /** Ramp lean from vertical, degrees. Larger = flatter. */
  rampLean: number
}

export interface KkCatTowerOptions extends Partial<KkCatTowerConfig> {
  materials?: Partial<Record<Slot, MeshStandardMaterial>>
}

export interface KkCatTowerInstance {
  readonly root: Group
  readonly parts: {
    base: Group
    cubby: Group
    structure: Group
    platforms: Group
    cushions: Group
    ramp: Group
  }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkCatTowerConfig>
  configure(patch: Partial<KkCatTowerConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: KkCatTowerConfig = { ramp: true, cushions: true, rampLean: 33 }

// --- the datum -----------------------------------------------------------------------------------

const W = 1.0
const D = 0.8
const DECK = 0.09

const CUBBY = { x0: -0.48, x1: 0.02, z0: -0.06, z1: 0.36, y1: 0.49, lid: 0.53 }
/** The round mouth, cut as a boarded square opening closed down to a circle by an applied collar. */
const MOUTH = { x: -0.29, y: 0.29, r: 0.12 }

/** The spine dies INSIDE the top platform's board — nothing in the reference rises above the top bed. */
const SPINE = { x: 0.1, z: -0.1, t: 0.08, top: 1.445 }

const P_ROUND = { x: -0.26, z: 0.14, r: 0.22, y: 0.86 }
const P_LOW = { x: 0.3, z: 0.04, w: 0.4, d: 0.3, y: 0.6 }
const P_MID = { x: 0.27, z: -0.1, w: 0.46, d: 0.36, y: 0.98 }
/**
 * The hero rest. Bigger than every other platform and squashed to an oval by `TOP_OVAL` so it reads as
 * a bed rather than a second copy of the round mid perch.
 */
const P_TOP = { x: -0.14, z: 0.04, r: 0.34, y: 1.42 }
const TOP_OVAL = 0.8
const BOARD_T = 0.045

/** The scratch ramp's foot on the deck — the edge it pivots on. */
const RAMP_FOOT: readonly [number, number, number] = [0.31, DECK, 0.31]
const RAMP_LEN = 0.5
const RAMP_W = 0.28

// --- linear-space vertex ramp --------------------------------------------------------------------

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function linearOf(hex: number): [number, number, number] {
  return [
    toLinear(((hex >> 16) & 0xff) / 255),
    toLinear(((hex >> 8) & 0xff) / 255),
    toLinear((hex & 0xff) / 255),
  ]
}

/** The per-vertex multiplier moving a slot's palette colour onto `target`, solved where it is applied. */
function tintOf(slot: Slot, target?: number): [number, number, number] {
  if (target === undefined) return [1, 1, 1]
  const base = linearOf(SLOT_BASE[slot])
  const want = linearOf(target)
  return [
    want[0] / Math.max(1e-4, base[0]),
    want[1] / Math.max(1e-4, base[1]),
    want[2] / Math.max(1e-4, base[2]),
  ]
}

/** Written AFTER `mergeParts`, which strips every attribute but position/normal/uv. */
function paint(geometry: BufferGeometry, rgb: readonly [number, number, number]): BufferGeometry {
  const count = geometry.getAttribute('position').count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = rgb[0]
    colors[i * 3 + 1] = rgb[1]
    colors[i * 3 + 2] = rgb[2]
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

function box(
  width: number, height: number, depth: number, bevel: number, x: number, y: number, z: number,
): BufferGeometry {
  const geometry = bevelBox(width, height, depth, bevel)
  geometry.translate(x, y, z)
  return geometry
}

/** A member dimensioned by its own extents, the way joinery is cut. */
function span(
  x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, bevel = 0.005,
): BufferGeometry {
  return box(x1 - x0, y1 - y0, z1 - z0, bevel, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
}

/** A horizontal round board. */
function disc(radius: number, thickness: number, x: number, y: number, z: number): BufferGeometry {
  const geometry = bevelDisc(radius, thickness, Math.min(0.008, thickness * 0.3), 32)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(x, y + thickness / 2, z)
  return geometry
}

/** A horizontal rounded-rect board, rounded in PLAN as the reference's platforms are. */
function plate(
  width: number, depth: number, thickness: number, radius: number, x: number, y: number, z: number,
): BufferGeometry {
  const geometry = loftRoundedBox(width, depth, thickness, radius)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(x, y + thickness / 2, z)
  return geometry
}

/**
 * A sisal post: a near-cylindrical solid of revolution with restrained radial variation. Rope microtexture
 * is deferred to the shared material path; the silhouette should remain a post, not a zigzag.
 */
function ropePost(radius: number, y0: number, y1: number, x: number, z: number): BufferGeometry {
  const turns = Math.max(4, Math.round((y1 - y0) / 0.026))
  const profile: Array<readonly [number, number]> = [[0, 0.0001]]
  for (let i = 0; i <= turns; i += 1) {
    const t = 0.004 + (i / turns) * 0.992
    profile.push([t, i % 2 === 0 ? 1 : 0.94])
  }
  profile.push([1, 0.0001])
  const geometry = revolve(profile, { yBot: y0, yTop: y1, scaleW: radius, segments: 14 })
  geometry.translate(x, 0, z)
  return geometry
}

/**
 * A spindle rail around part of a round platform: vertical spindles under a curved top rail, both set on
 * the same arc. `a0`/`a1` are angles in the rotated plan frame, where 0 is +X and π/2 is the model's −Z.
 */
function spindleRail(
  centreX: number, centreZ: number, radius: number, y0: number, spindleH: number,
  a0: number, a1: number, count: number,
): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  for (let i = 0; i < count; i += 1) {
    const a = a0 + ((i + 0.5) / count) * (a1 - a0)
    const x = centreX + Math.cos(a) * radius
    const z = centreZ - Math.sin(a) * radius
    const spindle = bevelBox(0.02, spindleH, 0.02, 0.004)
    spindle.rotateY(-a)
    spindle.translate(x, y0 + spindleH / 2, z)
    parts.push(spindle)
  }
  const rail = arcBand(radius - 0.026, radius + 0.014, a0, a1, 0.042, 0.008, 30)
  rail.rotateX(-Math.PI / 2)
  rail.translate(centreX, y0 + spindleH + 0.021, centreZ)
  parts.push(rail)
  return parts
}

/** A flat lattice grid in the XY plane, as thick as `t` along Z — the tower's "lattice supports". */
function lattice(
  x0: number, x1: number, y0: number, y1: number, z0: number, t: number, cols: number, rows: number,
): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const bar = 0.014
  for (let i = 0; i < cols; i += 1) {
    const cx = x0 + ((i + 0.5) / cols) * (x1 - x0)
    parts.push(box(bar, y1 - y0, t, 0.003, cx, (y0 + y1) / 2, z0 + t / 2))
  }
  for (let j = 0; j < rows; j += 1) {
    const cy = y0 + ((j + 0.5) / rows) * (y1 - y0)
    parts.push(box(x1 - x0, bar, t * 0.7, 0.003, (x0 + x1) / 2, cy, z0 + t * 0.72))
  }
  return parts
}

/** A soft round cushion: a puffy lathe closed at both poles so it is a solid, not a tube. */
function cushionRound(radius: number, height: number, x: number, y: number, z: number): BufferGeometry {
  const geometry = revolve(
    [[0, 0.001], [0.03, 0.7], [0.16, 0.94], [0.5, 1], [0.84, 0.94], [0.97, 0.7], [1, 0.001]],
    { yBot: y, yTop: y + height, scaleW: radius, segments: 26 },
  )
  geometry.translate(x, 0, z)
  return geometry
}

export function createModel(options: KkCatTowerOptions = {}): KkCatTowerInstance {
  const config: KkCatTowerConfig = {
    ramp: options.ramp ?? defaults.ramp,
    cushions: options.cushions ?? defaults.cushions,
    rampLean: Number.isFinite(options.rampLean) ? options.rampLean! : defaults.rampLean,
  }

  const bundle = acquireKkMaterials({ overrides: options.materials })
  const kit = bundle.materials
  const materialSlots: Record<Slot, Material> = {
    cedar: options.materials?.cedar ?? kit.cedar,
    rope: options.materials?.rope ?? kit.washi,
    rush: options.materials?.rush ?? kit.tatami,
    cloth: options.materials?.cloth ?? kit.indigo,
  }
  for (const slot of Object.keys(materialSlots) as Slot[]) {
    const material = materialSlots[slot]
    if (bundle.owned.includes(material)) (material as MeshStandardMaterial).vertexColors = true
  }

  const root = new Group(); root.name = ID
  const assembly = new Group(); assembly.name = 'assembly'
  root.add(assembly)
  const base = new Group(); base.name = 'base'
  const cubby = new Group(); cubby.name = 'cubby'
  const structure = new Group(); structure.name = 'structure'
  const platforms = new Group(); platforms.name = 'platforms'
  const cushions = new Group(); cushions.name = 'cushions'
  const ramp = new Group(); ramp.name = 'scratch-ramp'
  ramp.userData.movable = true
  assembly.add(base, cubby, structure, platforms, cushions, ramp)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { cedar: [], rope: [], rush: [], cloth: [] }

  const emit = (
    group: Group, name: string, slot: Slot, parts: BufferGeometry[], target?: number,
  ): void => {
    if (!parts.length) return
    const geometry = paint(mergeParts(parts, `${ID}: ${name}`), tintOf(slot, target))
    generated.push(geometry)
    const mesh = new Mesh(geometry, materialSlots[slot])
    // Plain name for the add, then the kit convention: scripts/coplanar-check.ts records each mesh's
    // box as it is added and skips anything that already carries the kit separator.
    mesh.name = name
    group.add(mesh)
    mesh.name = `${ID} / ${name}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
  }

  const release = (): void => {
    for (const group of [base, cubby, structure, platforms, cushions, ramp]) group.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  // --- the build ---------------------------------------------------------------------------------

  const buildBase = (): void => {
    const cedar: BufferGeometry[] = []
    const dark: BufferGeometry[] = []
    // Plank deck: seven boards with an open seam, so the deck reads as joinery and not a slab.
    const planks = 7
    const gap = 0.006
    // Leave a 10 mm reveal where the deck boards meet the perimeter rail.  The
    // boards used to terminate on the rail's outer ±Z planes, creating real
    // same-facing coplanar end faces rather than a seated plank joint.
    const edgeReveal = 0.01
    const plankW = (D - edgeReveal * 2 - gap * (planks - 1)) / planks
    for (let i = 0; i < planks; i += 1) {
      const z0 = -D / 2 + edgeReveal + i * (plankW + gap)
      cedar.push(span(-W / 2 + 0.055, W / 2 - 0.055, 0.03, DECK, z0, z0 + plankW, 0.006))
    }
    // Perimeter rail carrying the planks, and four corner feet lifting the whole deck.
    for (const sx of [-1, 1] as const) {
      const x0 = sx > 0 ? W / 2 - 0.06 : -W / 2
      cedar.push(span(x0, x0 + 0.06, 0.03, DECK + 0.012, -D / 2, D / 2, 0.008))
    }
    for (const sz of [-1, 1] as const) {
      const z0 = sz > 0 ? D / 2 - 0.05 : -D / 2
      cedar.push(span(-W / 2 + 0.06, W / 2 - 0.06, 0.03, DECK + 0.012, z0, z0 + 0.05, 0.008))
    }
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        dark.push(box(0.1, 0.03, 0.1, 0.006, sx * (W / 2 - 0.05), 0.015, sz * (D / 2 - 0.05)))
      }
    }
    emit(base, 'base-cedar', 'cedar', cedar)
    emit(base, 'base-feet', 'cedar', dark, RAMP_TONE.cedarDark)
  }

  const buildCubby = (): void => {
    const cedar: BufferGeometry[] = []
    const dark: BufferGeometry[] = []
    const { x0, x1, z0, z1, y1, lid } = CUBBY
    const t = 0.028

    // Back and left walls, the lattice-sided right wall's frame, and the floor.
    cedar.push(span(x0, x1, DECK, y1, z0, z0 + t))
    cedar.push(span(x0, x0 + t, DECK, y1, z0, z1))
    cedar.push(span(x1 - t, x1, DECK, y1, z0, z1))
    dark.push(span(x0 + t, x1 - t, DECK, DECK + 0.018, z0 + t, z1 - t))

    // Boarded front closing down to a square opening, then a collar that rounds it.
    const mx0 = MOUTH.x - MOUTH.r
    const mx1 = MOUTH.x + MOUTH.r
    const my0 = MOUTH.y - MOUTH.r
    const my1 = MOUTH.y + MOUTH.r
    cedar.push(span(x0, mx0, DECK, y1, z1 - t, z1))
    cedar.push(span(mx1, x1, DECK, y1, z1 - t, z1))
    cedar.push(span(mx0, mx1, DECK, my0, z1 - t, z1))
    cedar.push(span(mx0, mx1, my1, y1, z1 - t, z1))
    const collar = bevelRing(MOUTH.r, MOUTH.r + 0.065, 0.018, 0.005, 30)
    collar.translate(MOUTH.x, MOUTH.y, z1 - 0.004)
    cedar.push(collar)

    // Lattice flank on the +X side, set into the frame. rotateY(-π/2) maps the panel's own X onto Z
    // WITHOUT mirroring it (+π/2 flips the sign and lands the panel behind the box).
    const flank = lattice(z0 + 0.06, z1 - 0.06, DECK + 0.06, y1 - 0.06, 0, 0.018, 5, 5)
    for (const piece of flank) {
      piece.rotateY(-Math.PI / 2)
      piece.translate(x1 + 0.014, 0, 0)
      cedar.push(piece)
    }

    // Lid: a board oversailing the box on every side, and the platform the long post stands on.
    cedar.push(span(x0 - 0.02, x1 + 0.02, y1, lid, z0 - 0.02, z1 + 0.02, 0.008))

    emit(cubby, 'cubby-cedar', 'cedar', cedar)
    emit(cubby, 'cubby-interior', 'cedar', dark, RAMP_TONE.cedarDark)

    const mat = plate(0.34, 0.3, 0.016, 0.03, MOUTH.x + 0.02, DECK + 0.018, (z0 + z1) / 2)
    emit(cubby, 'cubby-mat', 'rush', [mat])
  }

  const buildStructure = (): void => {
    const cedar: BufferGeometry[] = []
    const iron: BufferGeometry[] = []
    const rope: BufferGeometry[] = []

    // The cedar spine: one upright carrying the top platform and the cantilevered right-mid platform.
    cedar.push(span(
      SPINE.x - SPINE.t / 2, SPINE.x + SPINE.t / 2, DECK, SPINE.top,
      SPINE.z - SPINE.t / 2, SPINE.z + SPINE.t / 2, 0.01,
    ))
    // Lattice panel beside it — the reference's "lattice supports". Framed by its own stiles and rails
    // and tied into the spine: an unframed grid floating between two posts reads as a stray ladder.
    const lx0 = 0.13
    const lx1 = 0.47
    // Seated on the base deck and passing BEHIND the lower-right platform, not sliced through it: a
    // panel whose bottom edge stops in mid-air reads as a stray grille, not a support.
    const ly0 = DECK
    // Stops 0.1 m short of the right-mid platform, so that shelf keeps the open air under it that the
    // reference gives it — a panel run up to the underside collapses the cascade into a wall.
    const ly1 = 0.88
    cedar.push(...lattice(lx0 + 0.035, lx1 - 0.035, ly0 + 0.035, ly1 - 0.035, -0.162, 0.02, 5, 6))
    for (const x of [lx0, lx1 - 0.035]) {
      cedar.push(span(x, x + 0.035, ly0, ly1, -0.172, -0.132, 0.006))
    }
    for (const y of [ly0, ly1 - 0.035]) {
      cedar.push(span(lx0, lx1, y, y + 0.035, -0.172, -0.132, 0.006))
    }

    // Four sisal posts, each clamped top and bottom by an iron ferrule.
    const posts: Array<[number, number, number, number, number]> = [
      [-0.26, 0.14, 0.055, CUBBY.lid, P_ROUND.y],
      [0.32, 0.0, 0.055, DECK, P_LOW.y],
      [0.3, -0.14, 0.055, P_LOW.y + BOARD_T, P_MID.y],
      [-0.02, 0.08, 0.055, CUBBY.lid, P_TOP.y],
    ]
    for (const [x, z, r, y0, y1] of posts) {
      rope.push(ropePost(r, y0 + 0.035, y1 - 0.035, x, z))
      iron.push(ropePost(r * 1.12, y0, y0 + 0.04, x, z))
      iron.push(ropePost(r * 1.12, y1 - 0.04, y1, x, z))
    }

    emit(structure, 'structure-cedar', 'cedar', cedar)
    emit(structure, 'post-ferrules', 'cedar', iron, RAMP_TONE.iron)
    emit(structure, 'sisal-posts', 'rope', rope, RAMP_TONE.ropeWorn)
  }

  const buildPlatforms = (): void => {
    const cedar: BufferGeometry[] = []
    const rush: BufferGeometry[] = []

    // Round mid platform with a spindle rail open to the front-right.
    cedar.push(disc(P_ROUND.r, BOARD_T, P_ROUND.x, P_ROUND.y, P_ROUND.z))
    cedar.push(...spindleRail(
      P_ROUND.x, P_ROUND.z, P_ROUND.r - 0.022, P_ROUND.y + BOARD_T, 0.13, 0.16, Math.PI * 1.02, 9,
    ))

    // Lower-right platform, its top dressed with a woven scratch pad.
    cedar.push(plate(P_LOW.w, P_LOW.d, BOARD_T, 0.09, P_LOW.x, P_LOW.y, P_LOW.z))
    rush.push(plate(P_LOW.w - 0.06, P_LOW.d - 0.06, 0.014, 0.06, P_LOW.x, P_LOW.y + BOARD_T, P_LOW.z))

    // Right-mid platform with a back board along its far edge.
    cedar.push(plate(P_MID.w, P_MID.d, BOARD_T, 0.1, P_MID.x, P_MID.y, P_MID.z))
    // Back board set in from the plate's rounded corners, or it overhangs them and reads as detached.
    cedar.push(span(
      P_MID.x - P_MID.w / 2 + 0.05, P_MID.x + P_MID.w / 2 - 0.05,
      P_MID.y + BOARD_T - 0.01, P_MID.y + BOARD_T + 0.12,
      P_MID.z - P_MID.d / 2 + 0.02, P_MID.z - P_MID.d / 2 + 0.05, 0.008,
    ))

    // Top platform: the hero rest, its taller rail closing the silhouette at the manifest height. Built
    // round about the origin, squashed in Z, then moved — scaling it in place would drag the oval's
    // centre off the posts under it.
    const top: BufferGeometry[] = [
      disc(P_TOP.r, BOARD_T, 0, P_TOP.y, 0),
      ...spindleRail(0, 0, P_TOP.r - 0.026, P_TOP.y + BOARD_T, 0.175, 0.12, Math.PI * 1.04, 13),
    ]
    for (const piece of top) {
      piece.scale(1, 1, TOP_OVAL)
      piece.translate(P_TOP.x, 0, P_TOP.z)
      cedar.push(piece)
    }

    emit(platforms, 'platform-cedar', 'cedar', cedar)
    emit(platforms, 'platform-pads', 'rush', rush)
  }

  const buildCushions = (): void => {
    if (!config.cushions) return
    const cloth: BufferGeometry[] = []
    const faded: BufferGeometry[] = []
    const rush: BufferGeometry[] = []
    // Crowned, not slabbed: a cat cushion the reference paints as a plump round bolster.
    cloth.push(cushionRound(P_ROUND.r - 0.03, 0.098, P_ROUND.x, P_ROUND.y + BOARD_T, P_ROUND.z))
    const topCushion = cushionRound(P_TOP.r - 0.045, 0.125, 0, P_TOP.y + BOARD_T, 0)
    topCushion.scale(1, 1, TOP_OVAL)
    topCushion.translate(P_TOP.x, 0, P_TOP.z)
    faded.push(topCushion)
    rush.push(plate(
      P_MID.w - 0.09, P_MID.d - 0.08, 0.1, 0.045, P_MID.x + 0.01, P_MID.y + BOARD_T, P_MID.z + 0.02,
    ))
    emit(cushions, 'cushion-indigo', 'cloth', cloth)
    emit(cushions, 'cushion-faded', 'cloth', faded, RAMP_TONE.clothFaded)
    emit(cushions, 'cushion-rush', 'rush', rush)
  }

  const buildRamp = (): void => {
    if (!config.ramp) return
    // Authored about its foot edge on the deck, so the pivot a consumer sees is the edge it rests on.
    ramp.position.set(RAMP_FOOT[0], RAMP_FOOT[1], RAMP_FOOT[2])
    ramp.rotation.set((-config.rampLean * Math.PI) / 180, 0, 0)
    const board = bevelBox(RAMP_W, RAMP_LEN, 0.04, 0.008)
    board.translate(0, RAMP_LEN / 2, -0.02)
    const cleat = bevelBox(RAMP_W, 0.05, 0.05, 0.008)
    cleat.translate(0, 0.03, 0.012)
    emit(ramp, 'ramp-board', 'cedar', [board, cleat])
    const pad = bevelBox(RAMP_W - 0.06, RAMP_LEN - 0.08, 0.014, 0.004)
    pad.translate(0, RAMP_LEN / 2, 0.005)
    emit(ramp, 'ramp-pad', 'rush', [pad])
  }

  const recentre = (): void => {
    assembly.position.set(0, 0, 0)
    assembly.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(assembly as never)
    if (!bounds.isEmpty()) {
      const centre = bounds.getCenter(new Vector3())
      assembly.position.set(-centre.x, -bounds.min.y, -centre.z)
    }
  }

  const rebuild = (): void => {
    release()
    buildBase()
    buildCubby()
    buildStructure()
    buildPlatforms()
    buildCushions()
    buildRamp()
    recentre()
  }

  rebuild()

  const finished = finishModel(root, bundle, {
    name: ID,
    geometries: generated,
    sockets: [
      socket('anchor-cubby-mouth', [MOUTH.x, MOUTH.y, CUBBY.z1 + 0.02]),
      socket('anchor-perch-top', [P_TOP.x, P_TOP.y + BOARD_T, P_TOP.z]),
      socket('anchor-perch-mid', [P_MID.x, P_MID.y + BOARD_T, P_MID.z]),
    ],
  })

  return {
    root,
    parts: { base, cubby, structure, platforms, cushions, ramp },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.ramp !== undefined) config.ramp = Boolean(patch.ramp)
      if (patch.cushions !== undefined) config.cushions = Boolean(patch.cushions)
      if (patch.rampLean !== undefined && Number.isFinite(patch.rampLean)) {
        config.rampLean = Math.max(10, Math.min(70, patch.rampLean))
      }
      rebuild()
    },
    setMaterial(slot, material) {
      if (!(slot in materialSlots)) return
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      finished.dispose()
    },
  }
}

/** Orbit overrides are forwarded, not swallowed — scripts/qa-sheet.mjs drives its 8 views through here. */
export interface KkPreviewArgs {
  aspect?: number
  time?: number
  yaw?: number
  pitch?: number
}

export function createPreview({ aspect, yaw, pitch }: KkPreviewArgs = {}) {
  return createKkPreview(createModel(), { aspect, yaw, pitch })
}

export function createCafePreview({ aspect, yaw, pitch }: KkPreviewArgs = {}) {
  return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' })
}
