// hot-wheels-loop — an exhibition-scale vertical loop, built as fabricated steel rather than a toy.
//
// Typology comes from the Hot Wheels reference (one ribbon ring, two parallel straights, collar
// clamps, a structure at the base); the material story does not. This is a machined metal
// demonstration loop of the kind erected in a show plaza: a 15 m centreline radius carrying a 3.4 m
// lane between 1.15 m kerb walls, laid on a plate-steel deck and sprung off two graphite haunches.
//
// GROUND CONTINUITY IS THE CONTRACT. `standHeight` is the height of the lane surface at the bottom
// of the ring, and it defaults to one deck thickness — the deck simply rests on grade. A car
// arrives along the approach straight at y ≈ 0, threads the ring, and rolls out along the exit
// straight at y ≈ 0. Nothing here lifts the driveable surface onto a plinth: the haunches spring
// from the deck up the *outside* of the ring, so they brace it without ever rising into the lane.
// Raise `standHeight` only if a scene genuinely wants a climb, and the approach and exit straights
// will pitch to meet the ground again.
//
// The sweep is a helix, not a circle: the section drifts `offset` along the loop's lateral axis
// over one full turn, so entry and exit clear each other at the bottom and the two straights run
// parallel.
//
// ── Changing the colours ─────────────────────────────────────────────────────────────────────────
//
// Every surface is a named slot backed by a `MeshPhysicalMaterial`, and the defaults are metallic
// greys. On a metal, the slot colour is the *specular* tint rather than a paint colour, and the
// per-slot finish — metalness, roughness, clearcoat — is what separates brushed steel from
// graphite from painted line. Both routes below survive a `configure()` rebuild.
//
// 1. Colour numbers, for a quick retint of the model's own materials:
//
//    ```ts
//    const loop = createModel({
//      loopColor: 0x808b92,     // ring lane — brushed steel
//      straightColor: 0x5d6770, // approach / exit lane — brushed steel, one step down
//      kerbColor: 0x384450,     // kerb walls — dark graphite; the value break against the lane
//      apronColor: 0x101a23,    // the ground deck the circuit is laid on — plate steel
//      markingColor: 0xc4cfd1,  // painted edge lines and centre dashes — the only non-metal slot
//      clipColor: 0xcbd7da,     // ring flanges, collar clamps, haunch bands — bright machined steel
//      standColor: 0x424d58,    // base haunches and saddles — structural graphite
//      trimColor: 0x111b24,     // deck joints and recessed tie-down anchors
//    })
//    loop.configure({ loopColor: 0xb8c2c6 })  // retint later; geometry is not rebuilt
//    ```
//
//    Those eight are the defaults. Two things to know before repainting. Value carries the read,
//    not hue: rendered, the order is deck < kerb < haunch < lane < clamp < paint, and losing that
//    ordering is what makes a metal read as flat plastic. And the kit's capture rig is analytic
//    lights with no environment map, so a surface with nowhere to reflect loses most of its value —
//    the metalness figures in `FINISH` are deliberately short of 1 for that reason.
//
//    Want the original toy plastic back? Retint *and* flatten the finish, or the hues will still
//    read as anodised metal:
//
//    ```ts
//    for (const [slot, color] of [['loop', 0xf9752b], ['straight', 0x4fa3e3], ['kerb', 0xf9752b],
//                                 ['clip', 0xf03b2e], ['stand', 0xf7862c], ['apron', 0xf7862c]] as const) {
//      loop.setMaterial(slot, new MeshStandardMaterial({ color, roughness: 0.42, metalness: 0 }))
//    }
//    ```
//
// 2. Whole materials, when a scene owns its own steel:
//
//    ```ts
//    loop.setMaterial('loop', sceneBrushedSteel)
//    loop.setMaterial('stand', sceneStructural)
//    ```
//
//    A material handed in through `setMaterial` or `options.materials` belongs to the caller and is
//    never disposed here, and colour numbers no longer touch that slot.

import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type Material,
} from 'three/webgpu'
import { LoftGeometry } from 'three/examples/jsm/geometries/LoftGeometry.js'

import {
  FACE_CLEARANCE,
  LAYER_CLEARANCE,
  TOKEN,
  bevelBox,
  createF1Preview,
  creased,
  mergeParts,
  shade,
} from '../f1-kit-core/index.ts'

type Slot = 'loop' | 'straight' | 'kerb' | 'apron' | 'marking' | 'clip' | 'stand' | 'trim'

/** Deck, wall and clamp thicknesses are physical dimensions, not fractions of the span (rule 7). */
const WALL_THICKNESS = 0.22
const FLOOR_THICKNESS = 0.26
const CLIP_THICKNESS = 0.085
/** Painted lines stand one layer clearance proud of the lane so they never fight it (rule 8). */
const PAINT_THICKNESS = 0.02

export interface HotWheelsLoopConfig {
  /** Loop centreline radius in metres. Lane diameter is twice this. */
  radius: number
  /** Lateral spiral pitch over one turn — how far the exit sits beside the entry. */
  offset: number
  /** Clear lane width between the kerb walls, in metres. */
  trackWidth: number
  /** Kerb wall height above the lane surface, in metres. */
  wallHeight: number
  /** Length of each approach / exit straight, in metres. */
  straightLength: number
  /** Incline of the entry ramp in radians. Zero — the default — keeps the approach on grade. */
  approachTilt: number
  /**
   * Lane surface height at the bottom of the ring, in metres. Defaults to one deck thickness, which
   * puts the underside of the deck on grade and the lane a kerb's height above it. Raising this
   * lifts the whole circuit and pitches the straights to reach the ground again.
   */
  standHeight: number
  /** Number of collar clamps distributed around the ring. */
  clipCount: number
  /** Lay a concrete ground pad under the circuit. */
  groundPad: boolean
  loopColor: number
  straightColor: number
  kerbColor: number
  apronColor: number
  markingColor: number
  clipColor: number
  standColor: number
  trimColor: number
}

export interface HotWheelsLoopOptions extends Partial<HotWheelsLoopConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface HotWheelsLoopInstance {
  readonly root: Group
  readonly parts: {
    loop: Group
    straights: Group
    clips: Group
    stand: Group
    trim: Group
    anchors: Group
  }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<HotWheelsLoopConfig>
  configure(patch: Partial<HotWheelsLoopConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

/**
 * Defaults are cool exhibition metal, derived from canonical tokens rather than hand-picked greys,
 * so the loop sits inside the kit's palette instead of importing a toy's.
 */
const defaults: HotWheelsLoopConfig = {
  radius: 15,
  offset: 4.6,
  trackWidth: 3.4,
  wallHeight: 1.15,
  straightLength: 18,
  approachTilt: 0,
  standHeight: FLOOR_THICKNESS,
  clipCount: 3,
  groundPad: true,
  loopColor: shade(TOKEN.SLATE_650, 0.3),
  straightColor: shade(TOKEN.GRAPHITE_800, 0.3),
  kerbColor: shade(TOKEN.GRAPHITE_800, 0.14),
  apronColor: shade(TOKEN.GRAPHITE_800, -0.32),
  markingColor: shade(TOKEN.SHELL_200, -0.1),
  clipColor: shade(TOKEN.SHELL_200, -0.06),
  standColor: shade(TOKEN.GRAPHITE_800, 0.18),
  trimColor: shade(TOKEN.GRAPHITE_800, -0.3),
}

/**
 * Finish per slot. The kit's capture rig is analytic lights with no environment map, so a fully
 * metallic surface has nothing to reflect and collapses to black; these figures keep enough diffuse
 * for the greys to hold their value while the speculars still carry the metal.
 */
const FINISH: Record<Slot, { roughness: number; metalness: number; clearcoat: number }> = {
  loop: { roughness: 0.34, metalness: 0.7, clearcoat: 0.12 },
  straight: { roughness: 0.32, metalness: 0.7, clearcoat: 0.12 },
  kerb: { roughness: 0.3, metalness: 0.8, clearcoat: 0.1 },
  apron: { roughness: 0.58, metalness: 0.5, clearcoat: 0 },
  marking: { roughness: 0.5, metalness: 0, clearcoat: 0.2 },
  clip: { roughness: 0.2, metalness: 0.9, clearcoat: 0.25 },
  stand: { roughness: 0.36, metalness: 0.68, clearcoat: 0.08 },
  trim: { roughness: 0.55, metalness: 0.6, clearcoat: 0 },
}

type Profile = ReadonlyArray<readonly [number, number]>

interface Station {
  readonly p: Vector3
  /** Unit vector along the track width. */
  readonly lateral: Vector3
  /** Unit vector from the lane surface towards the side the car rides on. */
  readonly up: Vector3
}

/**
 * Skin a run of sections, fixing winding from the geometry rather than trusting the author.
 *
 * `LoftGeometry` wants each section counterclockwise as seen from the end looking back, which means
 * the section's right-hand normal must point along the sweep. A U-channel run reverses that relation
 * depending on which way the frame turns, so the normal is measured and the sections flipped when it
 * disagrees (rule 5).
 */
function loftRun(sections: Vector3[][], label: string): BufferGeometry {
  const first = sections[0]!
  const advance = new Vector3().subVectors(sections[1]![0]!, first[0]!)
  const normal = new Vector3()
  for (let i = 0; i < first.length; i++) {
    const a = first[i]!
    const b = first[(i + 1) % first.length]!
    normal.x += (a.y - b.y) * (a.z + b.z)
    normal.y += (a.z - b.z) * (a.x + b.x)
    normal.z += (a.x - b.x) * (a.y + b.y)
  }
  const wound = normal.dot(advance) < 0 ? sections.map((section) => [...section].reverse()) : sections
  const geometry = new LoftGeometry(wound, { closed: true, capStart: true, capEnd: true })
  geometry.name = label
  return geometry
}

function sweep(profile: Profile, stations: Station[], label: string): BufferGeometry {
  return loftRun(
    stations.map(({ p, lateral, up }) =>
      profile.map(([u, v]) => p.clone().addScaledVector(lateral, u).addScaledVector(up, v)),
    ),
    label,
  )
}

/** The load-bearing deck: lane surface at v = 0, structural backing below it. */
function deckProfile(width: number): Profile {
  const outer = width / 2 + WALL_THICKNESS
  return [
    [-outer, 0],
    [-outer, -FLOOR_THICKNESS],
    [outer, -FLOOR_THICKNESS],
    [outer, 0],
  ]
}

/**
 * One kerb wall, on the `side` given as -1 or +1. Its own material slot is what lets the walls read
 * darker than the lane; it sinks a face clearance into the deck so no two faces share a plane
 * (rule 8).
 */
function wallProfile(width: number, wallHeight: number, side: number): Profile {
  const inner = side * (width / 2)
  const outer = side * (width / 2 + WALL_THICKNESS)
  return [
    [inner, -FACE_CLEARANCE],
    [outer, -FACE_CLEARANCE],
    [outer, wallHeight],
    [inner, wallHeight],
  ]
}

/** A painted line of `width`, centred at `centre` across the lane and lying just proud of it. */
function stripeProfile(centre: number, width: number): Profile {
  const a = centre - width / 2
  const b = centre + width / 2
  const lo = LAYER_CLEARANCE
  const hi = LAYER_CLEARANCE + PAINT_THICKNESS
  return [
    [a, lo],
    [b, lo],
    [b, hi],
    [a, hi],
  ]
}

/**
 * The concrete haunch springing from the pad up the ring's outer face on one side.
 *
 * It is cut by the ring rather than fitted to it: at every station the top of the section is the
 * lowest point of the outer circle at that x, so the fillet can never rise into the lane. This is
 * the whole of the base structure — it braces the ring where the load turns into the ground and
 * carries nothing, which is what keeps entry and exit on grade.
 */
function haunchRun(
  side: number,
  radius: number,
  centreY: number,
  offset: number,
  halfDepth: number,
  base: number,
  label: string,
): BufferGeometry {
  const outerRadius = radius + FLOOR_THICKNESS
  const sections: Vector3[][] = []
  const steps = 16
  for (let i = 0; i <= steps; i++) {
    const x = side * radius * (0.1 + 0.56 * (i / steps))
    const top = centreY - Math.sqrt(Math.max(0, outerRadius * outerRadius - x * x)) + 0.06
    const arc = Math.asin(Math.min(1, Math.abs(x) / radius))
    const a = side < 0 ? arc : Math.PI * 2 - arc
    const z = offset * (a / (Math.PI * 2)) - offset / 2
    sections.push([
      new Vector3(x, base, z - halfDepth),
      new Vector3(x, base, z + halfDepth),
      new Vector3(x, top, z + halfDepth),
      new Vector3(x, top, z - halfDepth),
    ])
  }
  return loftRun(sections, label)
}

/** A collar that grips the channel from outside. Sunk into the host by a face clearance so no pair
 *  of coplanar faces ends up fighting for the same depth (rule 8). */
function collarProfile(
  width: number, wallHeight: number, thickness: number, reach: number,
): Profile {
  const grip = width / 2 + WALL_THICKNESS - FACE_CLEARANCE
  const outer = grip + thickness
  const top = wallHeight * reach
  return [
    [-outer, top],
    [-outer, -FLOOR_THICKNESS - thickness + FACE_CLEARANCE],
    [outer, -FLOOR_THICKNESS - thickness + FACE_CLEARANCE],
    [outer, top],
    [grip, top],
    [grip, -FLOOR_THICKNESS],
    [-grip, -FLOOR_THICKNESS],
    [-grip, top],
  ]
}

export function createModel(options: HotWheelsLoopOptions = {}): HotWheelsLoopInstance {
  const config = normalise({ ...defaults, ...options })

  const owned: MeshStandardMaterial[] = []
  const surface = (slot: Slot, color: number): Material => {
    const supplied = options.materials?.[slot]
    if (supplied) return supplied
    const material = new MeshPhysicalMaterial({
      name: `hot-wheels-loop / ${slot}`,
      color,
      clearcoatRoughness: 0.28,
      ...FINISH[slot],
    })
    owned.push(material)
    return material
  }

  const materialSlots: Record<Slot, Material> = {
    loop: surface('loop', config.loopColor),
    straight: surface('straight', config.straightColor),
    kerb: surface('kerb', config.kerbColor),
    apron: surface('apron', config.apronColor),
    marking: surface('marking', config.markingColor),
    clip: surface('clip', config.clipColor),
    stand: surface('stand', config.standColor),
    trim: surface('trim', config.trimColor),
  }
  type ColorKey =
    | 'loopColor' | 'straightColor' | 'kerbColor' | 'apronColor'
    | 'markingColor' | 'clipColor' | 'standColor' | 'trimColor'
  const colorKeys: Record<ColorKey, Slot> = {
    loopColor: 'loop',
    straightColor: 'straight',
    kerbColor: 'kerb',
    apronColor: 'apron',
    markingColor: 'marking',
    clipColor: 'clip',
    standColor: 'stand',
    trimColor: 'trim',
  }

  const root = new Group()
  root.name = 'hot-wheels-loop'
  const loop = new Group(); loop.name = 'loop'
  const straights = new Group(); straights.name = 'straights'
  const clips = new Group(); clips.name = 'clips'
  const stand = new Group(); stand.name = 'stand'
  const trim = new Group(); trim.name = 'trim'
  // Anchors live outside the generated groups so a rebuild never invalidates a consumer's
  // attachment (rule 10).
  const anchors = new Group(); anchors.name = 'anchors'
  const entryAnchor = new Object3D(); entryAnchor.name = 'entry'
  const exitAnchor = new Object3D(); exitAnchor.name = 'exit'
  const crownAnchor = new Object3D(); crownAnchor.name = 'crown'
  anchors.add(entryAnchor, exitAnchor, crownAnchor)
  root.add(loop, straights, clips, stand, trim, anchors)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = {
    loop: [], straight: [], kerb: [], apron: [], marking: [], clip: [], stand: [], trim: [],
  }

  const releaseGenerated = (): void => {
    loop.clear(); straights.clear(); clips.clear(); stand.clear(); trim.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    const crisp = creased(geometry, 24)
    generated.push(crisp)
    const mesh = new Mesh(crisp, materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  /** The ring's centre, in model space. The lane's lowest point is `standHeight` directly below it. */
  const ringCentre = (): Vector3 => new Vector3(0, config.standHeight + config.radius, 0)

  /** One station on the helix. `a = 0` is the bottom of the ring, where the lane is level. */
  const ringStation = (a: number): Station => {
    const { radius, standHeight, offset } = config
    return {
      p: new Vector3(
        -radius * Math.sin(a),
        standHeight + radius * (1 - Math.cos(a)),
        offset * (a / (Math.PI * 2)) - offset / 2,
      ),
      lateral: new Vector3(0, 0, 1),
      up: new Vector3(Math.sin(a), Math.cos(a), 0),
    }
  }

  /**
   * The full turn, sampled from exactly 0 to exactly 2π. The endpoints matter: at both of them the
   * lane is horizontal and at `standHeight`, which is what lets the straights leave on grade with
   * no kink at the join.
   */
  const loopStations = (): Station[] => {
    const count = 168
    const stations: Station[] = []
    for (let i = 0; i <= count; i++) stations.push(ringStation((i / count) * Math.PI * 2))
    return stations
  }

  const runStations = (from: Vector3, to: Vector3, up: Vector3, count = 6): Station[] => {
    const lateral = new Vector3(0, 0, 1)
    const stations: Station[] = []
    for (let i = 0; i <= count; i++) {
      stations.push({ p: from.clone().lerp(to, i / count), lateral, up: up.clone() })
    }
    return stations
  }

  /** A puzzle tab: a plate tongue capped by a round lobe, in the run's own frame. */
  const puzzleTab = (at: Vector3, outward: Vector3, up: Vector3): BufferGeometry[] => {
    const reach = config.trackWidth * 0.34
    const lobe = config.trackWidth * 0.24
    const tongue = bevelBox(config.trackWidth * 0.44, FLOOR_THICKNESS, reach, 0.03)
    tongue.translate(0, -FLOOR_THICKNESS / 2, reach / 2)
    const head = new CylinderGeometry(lobe, lobe, FLOOR_THICKNESS, 24)
    head.translate(0, -FLOOR_THICKNESS / 2, reach)
    const lateral = new Vector3().crossVectors(up, outward).normalize()
    const frame = new Matrix4().makeBasis(lateral, up, outward).setPosition(at)
    const parts = [tongue, head]
    for (const part of parts) part.applyMatrix4(frame)
    return parts
  }

  /** Recessed tie-down anchors, standing one layer clearance off the lane (rule 8). */
  const tieDowns = (from: Vector3, to: Vector3, up: Vector3): BufferGeometry[] => {
    const lateral = new Vector3(0, 0, 1)
    const radius = config.trackWidth * 0.075
    const parts: BufferGeometry[] = []
    for (let i = 0; i < 4; i++) {
      const t = 0.16 + i * 0.22
      const side = i % 2 === 0 ? 0.3 : -0.28
      const centre = from
        .clone()
        .lerp(to, t)
        .addScaledVector(lateral, config.trackWidth * side)
        .addScaledVector(up, LAYER_CLEARANCE * 2)
      const disc = new CylinderGeometry(radius, radius, 0.05, 18)
      const frame = new Matrix4()
        .makeBasis(lateral, up, new Vector3().crossVectors(lateral, up).negate())
        .setPosition(centre)
      disc.applyMatrix4(frame)
      parts.push(disc)
    }
    return parts
  }

  /** Broken centre line along a straight — the cheapest cue that this surface is a road. */
  const centreDashes = (from: Vector3, to: Vector3, up: Vector3): BufferGeometry[] => {
    const along = new Vector3().subVectors(to, from)
    const span = along.length()
    along.normalize()
    const lateral = new Vector3(0, 0, 1)
    const dash = Math.max(0.9, config.trackWidth * 0.5)
    const gap = dash * 0.85
    const parts: BufferGeometry[] = []
    for (let s = dash; s + dash < span; s += dash + gap) {
      const at = from
        .clone()
        .addScaledVector(along, s + dash / 2)
        .addScaledVector(up, LAYER_CLEARANCE + PAINT_THICKNESS / 2)
      const bar = new BoxGeometry(config.trackWidth * 0.075, PAINT_THICKNESS, dash)
      bar.applyMatrix4(new Matrix4().makeBasis(lateral, up, along).setPosition(at))
      parts.push(bar)
    }
    return parts
  }

  const ringBand = (centre: number, halfArc: number, profile: Profile, label: string): BufferGeometry => {
    const band: Station[] = []
    for (let k = 0; k <= 8; k++) band.push(ringStation(centre - halfArc + (k / 8) * halfArc * 2))
    return sweep(profile, band, label)
  }

  const rebuild = (): void => {
    releaseGenerated()
    const { radius, trackWidth, wallHeight, standHeight, offset, straightLength, approachTilt } = config
    const deck = deckProfile(trackWidth)
    const leftWall = wallProfile(trackWidth, wallHeight, -1)
    const rightWall = wallProfile(trackWidth, wallHeight, 1)
    const edgeInset = trackWidth / 2 - Math.max(0.16, trackWidth * 0.08)
    const lineWidth = Math.max(0.09, trackWidth * 0.035)
    const outerHalf = trackWidth / 2 + WALL_THICKNESS

    // The ring: deck, two kerb walls, two painted edge lines. Splitting the old single U-channel
    // loft into separate lofts is what buys the darker kerb read without a second colour on one mesh.
    const ring = loopStations()
    emit('loop', sweep(deck, ring, 'loop-deck'), loop, 'loop-deck')
    emit(
      'kerb',
      mergeParts(
        [sweep(leftWall, ring, 'loop-kerb-l'), sweep(rightWall, ring, 'loop-kerb-r')],
        'loop-kerbs',
      ),
      loop,
      'loop-kerbs',
    )
    emit(
      'marking',
      mergeParts(
        [
          sweep(stripeProfile(-edgeInset, lineWidth), ring, 'loop-line-l'),
          sweep(stripeProfile(edgeInset, lineWidth), ring, 'loop-line-r'),
        ],
        'loop-lines',
      ),
      loop,
      'loop-lines',
    )

    // Straights. Both meet the ring where the lane is level, so with the default `approachTilt` of
    // zero the whole circuit — arrive, thread, depart — happens at one height: the ground.
    const entryJoin = ring[0]!.p
    const exitJoin = ring[ring.length - 1]!.p
    const rampDir = new Vector3(-Math.cos(approachTilt), -Math.sin(approachTilt), 0)
    const rampUp = new Vector3(-Math.sin(approachTilt), Math.cos(approachTilt), 0)
    const rampEnd = entryJoin.clone().addScaledVector(rampDir, 0.6)
    const rampStart = rampEnd.clone().addScaledVector(rampDir, -(straightLength + 0.6))
    // The exit falls only as far as the ring was raised. At the default `standHeight` that fall is
    // zero and the run-out is dead level — no jump-off on the far side.
    const fall = Math.max(0, standHeight - FLOOR_THICKNESS)
    const drop = Math.min(approachTilt, Math.asin(Math.min(1, fall / straightLength)))
    const exitDir = new Vector3(-Math.cos(drop), -Math.sin(drop), 0)
    const exitUp = new Vector3(-Math.sin(drop), Math.cos(drop), 0)
    const exitStart = exitJoin.clone().addScaledVector(exitDir, -0.6)
    const exitEnd = exitStart.clone().addScaledVector(exitDir, straightLength + 0.6)

    const approachRun = runStations(rampStart, rampEnd, rampUp)
    const exitRun = runStations(exitStart, exitEnd, exitUp)

    emit(
      'straight',
      mergeParts(
        [
          sweep(deck, approachRun, 'approach-deck'),
          sweep(deck, exitRun, 'exit-deck'),
          ...puzzleTab(rampStart, rampDir.clone().negate(), rampUp),
          ...puzzleTab(exitEnd, exitDir, exitUp),
        ],
        'straights',
      ),
      straights,
      'straight-decks',
    )
    emit(
      'kerb',
      mergeParts(
        [
          sweep(leftWall, approachRun, 'approach-kerb-l'),
          sweep(rightWall, approachRun, 'approach-kerb-r'),
          sweep(leftWall, exitRun, 'exit-kerb-l'),
          sweep(rightWall, exitRun, 'exit-kerb-r'),
        ],
        'straight-kerbs',
      ),
      straights,
      'straight-kerbs',
    )
    emit(
      'marking',
      mergeParts(
        [
          sweep(stripeProfile(-edgeInset, lineWidth), approachRun, 'approach-line-l'),
          sweep(stripeProfile(edgeInset, lineWidth), approachRun, 'approach-line-r'),
          sweep(stripeProfile(-edgeInset, lineWidth), exitRun, 'exit-line-l'),
          sweep(stripeProfile(edgeInset, lineWidth), exitRun, 'exit-line-r'),
          ...centreDashes(rampStart, rampEnd, rampUp),
          ...centreDashes(exitStart, exitEnd, exitUp),
        ],
        'straight-lines',
      ),
      straights,
      'straight-lines',
    )

    emit(
      'trim',
      mergeParts(
        [...tieDowns(rampStart, rampEnd, rampUp), ...tieDowns(exitStart, exitEnd, exitUp)],
        'tie-downs',
      ),
      trim,
      'tie-downs',
    )

    // Ground pad. Its top sits a third of a deck into the underside of the track, so the asphalt
    // reads as laid on the concrete rather than balanced on it, and the pad never lifts the lane.
    const padTop = FLOOR_THICKNESS * 0.35
    const padThickness = 0.7
    const padBase = padTop - 0.04

    if (config.groundPad) {
      const xs = [rampStart.x, rampEnd.x, exitStart.x, exitEnd.x, radius * 0.7, -radius * 0.7]
      const padMaxX = Math.max(...xs) + outerHalf * 1.4
      const padMinX = Math.min(...xs) - outerHalf * 1.4
      const padLength = padMaxX - padMinX
      const padDepth = offset + outerHalf * 2 + radius * 0.3
      const padMidX = (padMaxX + padMinX) / 2
      const plate = bevelBox(padLength, padThickness, padDepth, 0.14)
      plate.translate(padMidX, padTop - padThickness / 2, 0)
      emit('apron', plate, stand, 'ground-pad')

      // Slab joints and a painted perimeter. Without them the pad is an untextured plane and the
      // eye reads it as a plinth; with them it reads as the floor the circuit is standing on.
      const jointPitch = Math.max(4, radius * 0.42)
      const joints: BufferGeometry[] = []
      for (let x = padMinX + jointPitch; x < padMaxX - jointPitch * 0.5; x += jointPitch) {
        const groove = new BoxGeometry(0.1, PAINT_THICKNESS, padDepth - 0.5)
        groove.translate(x, padTop - PAINT_THICKNESS / 2 + LAYER_CLEARANCE, 0)
        joints.push(groove)
      }
      if (joints.length > 0) emit('trim', mergeParts(joints, 'pad-joints'), stand, 'pad-joints')

      const border: BufferGeometry[] = []
      for (const sign of [-1, 1]) {
        const line = new BoxGeometry(padLength - 1.2, PAINT_THICKNESS, 0.16)
        line.translate(padMidX, padTop + LAYER_CLEARANCE, sign * (padDepth / 2 - 0.7))
        border.push(line)
      }
      emit('marking', mergeParts(border, 'pad-border'), stand, 'pad-border')
    }

    const standParts: BufferGeometry[] = []

    const centreY = standHeight + radius
    standParts.push(
      haunchRun(-1, radius, centreY, offset, outerHalf * 0.98, padBase, 'haunch-entry'),
      haunchRun(1, radius, centreY, offset, outerHalf * 0.98, padBase, 'haunch-exit'),
    )

    // Saddles where each ring end enters the pad: without them the ribbon looks balanced on the
    // concrete rather than clamped into it.
    const saddle = collarProfile(trackWidth, wallHeight, CLIP_THICKNESS * 1.8, 0.5)
    const saddleArc = 2.9 / radius
    standParts.push(
      ringBand(saddleArc * 0.9, saddleArc, saddle, 'saddle-entry'),
      ringBand(Math.PI * 2 - saddleArc * 0.9, saddleArc, saddle, 'saddle-exit'),
    )
    emit('stand', mergeParts(standParts, 'stand'), stand, 'stand')

    // Steel bands: one where each haunch dies into the ring, plus `clipCount` spaced round the turn.
    const haunchArc = Math.asin(Math.min(1, 0.66))
    const collar = collarProfile(trackWidth, wallHeight, CLIP_THICKNESS, 0.2)
    const collars: BufferGeometry[] = [haunchArc, Math.PI * 2 - haunchArc].map((a, i) =>
      ringBand(a, 1.5 / radius, collar, `haunch-band-${i}`),
    )
    const clipArc = 2.1 / radius
    for (let i = 0; i < config.clipCount; i++) {
      const turn = ((i + 0.5) / config.clipCount) * Math.PI * 2
      const centre = Math.min(Math.PI * 2 - clipArc, Math.max(clipArc, turn))
      collars.push(ringBand(centre, clipArc, collar, `clip-${i}`))
    }
    // Outer stiffener flanges. A 30 m steel ring is not a smooth extrusion, and without the ribs
    // the outer face is one untouched band with nothing in it to read the loop's scale against.
    const ribCount = Math.max(8, Math.round(radius * 1.6))
    for (let i = 0; i < ribCount; i++) {
      const a = ((i + 0.5) / ribCount) * Math.PI * 2
      const { p, lateral, up } = ringStation(a)
      const rib = bevelBox(outerHalf * 2 - 0.08, 0.26, 0.18, 0.03)
      rib.applyMatrix4(
        new Matrix4()
          .makeBasis(lateral, up, new Vector3().crossVectors(lateral, up))
          .setPosition(p.clone().addScaledVector(up, -(FLOOR_THICKNESS + 0.07))),
      )
      collars.push(rib)
    }
    if (collars.length > 0) emit('clip', mergeParts(collars, 'clips'), clips, 'clips')

    entryAnchor.position.copy(rampStart)
    exitAnchor.position.copy(exitEnd)
    crownAnchor.position.copy(ringCentre().setY(standHeight + radius * 2))
  }
  rebuild()

  return {
    root,
    parts: { loop, straights, clips, stand, trim, anchors },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      let geometryDirty = false
      for (const key of Object.keys(patch) as Array<keyof HotWheelsLoopConfig>) {
        const value = patch[key]
        if (value === undefined) continue
        if (key in colorKeys) {
          const slot = colorKeys[key as ColorKey]
          config[key] = value as never
          const material = materialSlots[slot]
          // Only recolour a material this model made; a consumer's material is theirs (rule 16).
          if (material instanceof MeshStandardMaterial && owned.includes(material)) {
            material.color.setHex(value as number)
          }
          continue
        }
        config[key] = value as never
        geometryDirty = true
      }
      if (geometryDirty) {
        Object.assign(config, normalise(config))
        rebuild()
      }
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      for (const material of owned) material.dispose()
      owned.length = 0
      root.removeFromParent()
    },
  }
}

/** Clamp the configuration to values that still build a threadable loop standing on the ground. */
function normalise(config: HotWheelsLoopConfig): HotWheelsLoopConfig {
  const trackWidth = Math.max(1.6, config.trackWidth)
  const outer = trackWidth + WALL_THICKNESS * 2
  return {
    ...config,
    radius: Math.max(outer * 1.5, config.radius),
    trackWidth,
    // The exit has to clear the entry, so the spiral pitch can never be narrower than the section.
    offset: Math.max(outer + 0.4, config.offset),
    wallHeight: Math.max(0.25, config.wallHeight),
    straightLength: Math.max(trackWidth, config.straightLength),
    approachTilt: Math.min(0.6, Math.max(0, config.approachTilt)),
    // One deck thickness is the floor: the underside of the track rests on grade and the lane is
    // never sunk below it.
    standHeight: Math.max(FLOOR_THICKNESS, config.standHeight),
    clipCount: Math.max(0, Math.round(config.clipCount)),
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0, 12, 0],
    distance: 86,
    fov: 30,
    yaw: -0.66,
    pitch: 0.27,
  })
}
