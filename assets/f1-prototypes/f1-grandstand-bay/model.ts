// f1-grandstand-bay — one Silverstone-style seating bay: a raked bowl on an elevated deck, tip-up seat
// shells on standards, a hoarding-and-debris-fence frontage, and a tensioned membrane roof carried on
// slender front columns. configure({ rows, width }).
//
// Datums read off the Silverstone reference: 0.44 m rise on a 0.80 m tread, a 1.10 m promenade sitting
// 0.95 m above ground, row 1 stepped a further 0.75 m up so it clears the hoarding, columns and rafters
// on a ~2.6 m bay pitch, and a roof that falls only 0.45 m across the span before its cantilever curls
// back up, so the canopy opens toward the track instead of shutting down onto it. `width` is the tiling
// module and nothing overhangs it, so a run of bays reads as one continuous stand. The red leading-edge
// fascia and the amber nosings are the catalogue tells — not a grey shed.

import {
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three/webgpu'
import { LoftGeometry } from 'three/examples/jsm/geometries/LoftGeometry.js'

import {
  TOKEN,
  acquireF1Materials,
  bevelBox,
  bevelPrism,
  createF1Preview,
  disposeF1Materials,
  groundPad,
  loftAlongX,
  member,
  mergeParts,
  shade,
} from '../f1-kit-core/index.ts'

type Slot = 'structure' | 'deck' | 'seat' | 'roof' | 'fascia'

export interface F1GrandstandBayConfig {
  rows: number
  width: number
}

export interface F1GrandstandBayOptions extends Partial<F1GrandstandBayConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1GrandstandBayInstance {
  readonly root: Group
  readonly parts: { bowl: Group; roof: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1GrandstandBayConfig>
  configure(patch: Partial<F1GrandstandBayConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1GrandstandBayConfig = { rows: 8, width: 10 }

const RISE = 0.44
const TREAD = 0.8
/** Promenade in front of row 1. */
const WALK = 1.1
/**
 * Step from the promenade up to row 1. Sized against the frontage hoarding rather than as a kerb: at a
 * kerb's height the first two rows sit behind the advertising and the seating field loses its depth.
 */
const NOSE = 0.75
/** The bowl stands on a plinth, so its frontage reads as a wall rather than a step. */
const DECK = 0.95
/** Circulation behind the last row, inside the bowl mass. */
const REAR = 0.5
const AISLE = 1.1
const SEAT_PITCH = 0.435
/** Column and rafter pitch. */
const BAY = 2.6
const ROOF_BACK = 0.55
const ROOF_FRONT = 0.95
const ROOF_CLEAR = 2.25
/**
 * Fall from the rear tie to the leading edge. Kept shallow: the rake alone still stops the back rows
 * peeking over their own fascia, and anything steeper shuts the canopy down onto the track instead of
 * opening it out over the bowl.
 */
const ROOF_FALL = 0.45
const ROOF_ARCH = 0.24
/** Upward curl over the outer {@link TIP_U} of the cantilever — the lift that opens the front. */
const ROOF_LIFT = 0.3
/** Where the curl starts, as a fraction of the span from the rear tie. */
const TIP_U = 0.68
/** Mid-bay pull on the fabric at the leading edge: what bays the front edge into scallops. */
const MEMBRANE_SAG = 0.3
/** Drop from the membrane tip to the column head, so the fabric edge leads and the steel follows. */
const EDGE_HEAD = 0.44
const FASCIA_H = 0.46
/**
 * Advertising band at the promenade edge. Held to a band rather than run the full height up to the
 * debris fence: at full height it welds to the plinth under it and the two read as one two-metre slab.
 */
const HOARD_H = 0.62
/** Guard-rail head above the deck. The open void between it and the hoarding is what shows the walk. */
const RAIL_H = 1.12

interface Layout {
  readonly rows: number
  readonly width: number
  readonly halfW: number
  readonly halfD: number
  readonly bowlTop: number
  /** Rafter and column stations across the bay, boundaries inclusive. */
  readonly columns: readonly number[]
  readonly zBack: number
  readonly zFront: number
  readonly yBack: number
  readonly yFront: number
}

const layoutOf = ({ rows, width }: F1GrandstandBayConfig): Layout => {
  const halfD = (WALK + rows * TREAD + REAR) / 2
  const bays = Math.max(2, Math.round(width / BAY))
  const columns: number[] = []
  for (let i = 0; i <= bays; i++) columns.push(-width / 2 + (i / bays) * width)
  const bowlTop = DECK + NOSE + rows * RISE
  return {
    rows,
    width,
    halfW: width / 2,
    halfD,
    bowlTop,
    columns,
    zBack: -halfD - ROOF_BACK,
    zFront: halfD + ROOF_FRONT,
    yBack: bowlTop + ROOF_CLEAR,
    yFront: bowlTop + ROOF_CLEAR - ROOF_FALL,
  }
}

/** Walking surface of tier `r`. */
const treadY = (r: number): number => DECK + NOSE + r * RISE

/** Rear edge of tier `r` — where its seat standards bolt down. */
const treadBack = (layout: Layout, r: number): number => layout.halfD - WALK - (r + 1) * TREAD

/** Whatever a spectator stands on at `z`: the promenade, or the tier that covers it. */
const surfaceY = (layout: Layout, z: number): number => {
  if (z > layout.halfD - WALK) return DECK
  const r = Math.floor((layout.halfD - WALK - z) / TREAD)
  return treadY(Math.min(Math.max(r, 0), layout.rows - 1))
}

/** Rafter top chord at `u`: 0 at the rear tie, 1 at the leading edge. */
const rafterAt = (layout: Layout, u: number): { z: number; y: number } => {
  const curl = Math.max(0, (u - TIP_U) / (1 - TIP_U))
  return {
    z: layout.zBack + (layout.zFront - layout.zBack) * u,
    y: layout.yBack
      + (layout.yFront - layout.yBack) * u
      + Math.sin(u * Math.PI) * ROOF_ARCH
      + curl * curl * ROOF_LIFT,
  }
}

/**
 * How far the fabric hangs below the rafter chord at `u` along the span and `v` across the bay. The
 * pull grows toward the leading edge, so one surface gives both a straight rafter line and a front
 * edge bayed into deep scallops between the rib tips.
 */
const membraneSag = (u: number, v: number): number =>
  -MEMBRANE_SAG * (0.1 + 0.9 * u ** 2.4) * Math.sin(Math.PI * Math.min(Math.max(v, 0), 1))

/** A point `drop` below the membrane soffit, on the bay running from `x0` to `x1`. */
const soffitAt = (
  layout: Layout, x0: number, x1: number, u: number, v: number, drop: number,
): Vector3 => {
  const station = rafterAt(layout, u)
  return new Vector3(x0 + (x1 - x0) * v, station.y + membraneSag(u, v) - drop, station.z)
}

/**
 * One fabric bay: pinned to the rafter either side and pulled down between them, so the leading edge
 * comes out scalloped rather than sawn off square. Swept across the bay rather than along the span,
 * because the scallop is what varies from rib to rib.
 */
const membranePanel = (layout: Layout, x0: number, x1: number): BufferGeometry => {
  const across = 11
  const along = 14
  const inset = 0.06
  const rings: Vector3[][] = []
  for (let i = 0; i < across; i++) {
    const v = (inset + ((x1 - x0 - inset * 2) * i) / (across - 1)) / (x1 - x0)
    const x = x0 + (x1 - x0) * v
    const upper: Vector3[] = []
    const lower: Vector3[] = []
    for (let k = 0; k <= along; k++) {
      const u = k / along
      const station = rafterAt(layout, u)
      const y = station.y + membraneSag(u, v)
      upper.push(new Vector3(x, y + 0.025, station.z))
      lower.push(new Vector3(x, y - 0.045, station.z))
    }
    lower.reverse()
    rings.push([...upper, ...lower])
  }
  return new LoftGeometry(rings, { closed: true, capStart: true, capEnd: true })
}

/** Rib stations for the tension web slung under one fabric bay. */
const WEB_U = [0.07, 0.22, 0.37, 0.52, 0.67, 0.82, 0.97] as const

/**
 * The web under one bay: transverse ribs chorded across the scallop, catenary runners down the span
 * that carry the pull, and a zig-zag brace between the two rafters. Without it the negative space
 * under the fabric reads as an empty box panel instead of a canopy.
 */
const bayWeb = (layout: Layout, x0: number, x1: number, flip: boolean): BufferGeometry[] => {
  const parts: BufferGeometry[] = []
  const at = (u: number, v: number, drop: number): Vector3 => soffitAt(layout, x0, x1, u, v, drop)

  for (const u of WEB_U) {
    for (let j = 0; j < 6; j++) {
      parts.push(member(at(u, j / 6, 0.082), at(u, (j + 1) / 6, 0.082), 0.024, 6))
    }
  }
  for (const [v, radius] of [[0.28, 0.019], [0.5, 0.026], [0.72, 0.019]] as const) {
    for (let k = 0; k < 10; k++) {
      parts.push(member(at(k / 10, v, 0.088), at((k + 1) / 10, v, 0.088), radius, 6))
    }
  }
  // Hem cable round the leading edge: the scallop has to read as pulled taut, not hung slack.
  for (let j = 0; j < 8; j++) {
    parts.push(member(at(1, j / 8, 0.012), at(1, (j + 1) / 8, 0.012), 0.028, 6))
  }
  // Hangers back to the head chord, so the lifted tip is tied down rather than floating.
  const head = rafterAt(layout, 1).y - EDGE_HEAD
  const chordZ = rafterAt(layout, 1).z - 0.07
  for (const v of [0.34, 0.66] as const) {
    const hem = at(1, v, 0.03)
    parts.push(member(hem, new Vector3(hem.x, head, chordZ), 0.019, 6))
  }
  // Flipping the zig-zag per bay breaks the mirror and reads as real bracing (rule 3).
  const braceDrop = (u: number): number => 0.16 + 0.3 * u * u
  for (let j = 0; j < WEB_U.length - 1; j++) {
    const even = (j % 2 === 0) === flip
    const a = WEB_U[j]!
    const c = WEB_U[j + 1]!
    parts.push(member(at(a, even ? 0 : 1, braceDrop(a)), at(c, even ? 1 : 0, braceDrop(c)), 0.021, 6))
    parts.push(member(at(c, 0, braceDrop(c)), at(c, 1, braceDrop(c)), 0.018, 6))
  }
  return parts
}

/** The arched rafters standing proud of the fabric, one per bay boundary. */
const roofRafters = (layout: Layout): BufferGeometry[] => {
  const parts: BufferGeometry[] = []
  const stations = 10
  for (const x of layout.columns) {
    for (let k = 0; k < stations; k++) {
      const a = rafterAt(layout, k / stations)
      const c = rafterAt(layout, (k + 1) / stations)
      parts.push(member(new Vector3(x, a.y, a.z), new Vector3(x, c.y, c.z), 0.072, 8))
    }
  }
  return parts
}

/** Tip beam, column head chord and rear tie — the three lines the whole canopy hangs between. */
const roofEdges = (layout: Layout): BufferGeometry[] => {
  const parts: BufferGeometry[] = []
  const front = rafterAt(layout, 1)
  const rear = rafterAt(layout, 0)
  const chordZ = front.z - 0.07
  const head = front.y - EDGE_HEAD
  parts.push(member(
    new Vector3(-layout.halfW, front.y - 0.1, chordZ),
    new Vector3(layout.halfW, front.y - 0.1, chordZ),
    0.048,
    10,
  ))
  parts.push(member(
    new Vector3(-layout.halfW, head, chordZ),
    new Vector3(layout.halfW, head, chordZ),
    0.058,
    10,
  ))
  parts.push(member(
    new Vector3(-layout.halfW, rear.y - 0.14, rear.z),
    new Vector3(layout.halfW, rear.y - 0.14, rear.z),
    0.055,
    8,
  ))
  for (const x of layout.columns) {
    parts.push(member(
      new Vector3(x, front.y - 0.1, chordZ),
      new Vector3(x, head, chordZ),
      0.036,
      6,
    ))
    parts.push(member(
      new Vector3(x, layout.bowlTop + 0.22, rear.z),
      new Vector3(x, rear.y - 0.16, rear.z),
      0.07,
      8,
    ))
  }
  return parts
}

/** The two seating blocks either side of the centre aisle. */
const blocks = (layout: Layout): ReadonlyArray<readonly [number, number]> => [
  [-layout.halfW, -AISLE / 2],
  [AISLE / 2, layout.halfW],
]

/**
 * One tip-up shell: a reclined back over a tilted pan, authored with its origin on the tread so a row is
 * a pure translation. The back holds its full 0.43 m width for most of its height and only relieves at
 * the very top — narrowing it lower turns a filled row into a rack of separate objects.
 */
const seatShell = (): BufferGeometry => {
  const back = bevelPrism(
    [
      [-0.185, -0.21], [0.185, -0.21],
      [0.215, -0.08], [0.215, 0.16],
      [0.175, 0.225], [-0.175, 0.225],
      [-0.215, 0.16], [-0.215, -0.08],
    ],
    0.055,
    0.013,
  )
  back.rotateX(-0.15)
  back.translate(0, 0.65, -0.12)

  const pan = bevelPrism(
    [
      [-0.205, -0.15], [0.205, -0.15],
      [0.205, 0.09], [0.16, 0.155],
      [-0.16, 0.155], [-0.205, 0.09],
    ],
    0.055,
    0.013,
  )
  pan.rotateX(Math.PI / 2 - 0.09)
  pan.translate(0, 0.44, 0.06)

  return mergeParts([back, pan], 'f1-grandstand-bay: seat shell')
}

/** The standard, pan bracket and back stay carrying one shell. */
const seatFrame = (): BufferGeometry => {
  const standard = bevelBox(0.13, 0.43, 0.1, 0.014)
  standard.translate(0, 0.215, -0.03)
  const bracket = bevelBox(0.3, 0.055, 0.07, 0.012)
  bracket.translate(0, 0.4, 0.03)
  return mergeParts(
    [
      standard,
      bracket,
      member(new Vector3(0, 0.39, -0.03), new Vector3(0, 0.71, -0.16), 0.022, 6),
      groundPad([0.2, 0.16], [0, 0, -0.03], 0.022),
    ],
    'f1-grandstand-bay: seat frame',
  )
}

export function createModel(options: F1GrandstandBayOptions = {}): F1GrandstandBayInstance {
  const config: F1GrandstandBayConfig = {
    rows: Math.max(4, Math.round(options.rows ?? defaults.rows)),
    width: Math.max(4, options.width ?? defaults.width),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const extras: Material[] = []
  const own = (material: Material): Material => {
    extras.push(material)
    return material
  }
  /**
   * Three values the shared bundle does not carry, each derived from its own token and each constructed
   * only when the consumer has not supplied that slot (rule 16). GRAPHITE-800 straight puts the frame a
   * shade off black, which is where the roof steel was disappearing; COBALT-500 straight is a signal
   * blue rather than upholstery, and needs taking well down because a diffuse albedo gains most of a
   * stop under this rig; and SHELL-200 without an emissive term has no soffit at all.
   *
   * The bowl keeps the bundle's `slate`. Its metalness is what holds cast concrete at a mid value here —
   * authored as a pure diffuse it gains the same stop the seats do and washes out to near-white, and the
   * step mass against the airy canopy is the contrast this model is carried by.
   */
  const materialSlots: Record<Slot, Material> = {
    structure: options.materials?.structure ?? own(new MeshStandardMaterial({
      name: 'f1-kit / grandstand steel',
      color: shade(TOKEN.GRAPHITE_800, 0.3),
      roughness: 0.44,
      metalness: 0.55,
    })),
    deck: options.materials?.deck ?? kit.slate,
    seat: options.materials?.seat ?? own(new MeshStandardMaterial({
      name: 'f1-kit / grandstand seat',
      color: shade(TOKEN.COBALT_500, -0.5),
      roughness: 0.7,
      metalness: 0.04,
    })),
    // Tensioned PVC is translucent: in the reference the soffit is lit by the sun coming through the
    // fabric, not by bounce off the bowl. A standard material cannot transmit, so the emissive carries
    // that light instead — without it the underside faces away from every lamp in the rig and the canopy
    // reads as a hole with a web strung across it.
    roof: options.materials?.roof ?? own(new MeshStandardMaterial({
      name: 'f1-kit / grandstand membrane',
      color: TOKEN.SHELL_200,
      roughness: 0.62,
      metalness: 0.04,
      emissive: shade(TOKEN.SHELL_200, -0.24),
      emissiveIntensity: 0.5,
    })),
    fascia: options.materials?.fascia ?? kit.red,
  }

  const root = new Group()
  root.name = 'f1-grandstand-bay'
  const bowl = new Group(); bowl.name = 'bowl'
  const roof = new Group(); roof.name = 'roof'
  root.add(bowl, roof)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = {
    structure: [], deck: [], seat: [], roof: [], fascia: [],
  }

  const releaseGenerated = (): void => {
    for (const group of [bowl, roof]) group.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  const emit = (
    slot: Slot,
    geometry: BufferGeometry,
    group: Group,
    name: string,
    material?: Material,
  ): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, material ?? materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const instance = (
    slot: Slot,
    geometry: BufferGeometry,
    matrices: readonly Matrix4[],
    name: string,
  ): void => {
    generated.push(geometry)
    const mesh = new InstancedMesh(geometry, materialSlots[slot], matrices.length)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]!)
    mesh.instanceMatrix.needsUpdate = true
    meshesBySlot[slot].push(mesh)
    bowl.add(mesh)
  }

  /** The raked mass: front skirt, promenade, tiers, rear return — one closed section swept across. */
  const buildBowl = (layout: Layout): void => {
    const profile: Array<readonly [number, number]> = [
      [layout.halfD, 0],
      [layout.halfD, DECK - 0.12],
      [layout.halfD - 0.12, DECK],
      [layout.halfD - WALK, DECK],
      [layout.halfD - WALK, DECK + NOSE],
    ]
    for (let r = 0; r < layout.rows; r++) {
      const y = treadY(r)
      const back = treadBack(layout, r)
      profile.push([back, y], [back, y + RISE])
    }
    profile.push([-layout.halfD, layout.bowlTop], [-layout.halfD, 0])
    emit('deck', loftAlongX(profile, layout.width, { closed: true }), bowl, 'bowl')

    const wallH = layout.bowlTop + 0.62
    const rear = bevelBox(layout.width, wallH, 0.5, 0.03)
    rear.translate(0, wallH / 2, -layout.halfD - 0.24)
    emit('deck', rear, bowl, 'rear-wall')
  }

  const buildSeating = (layout: Layout): void => {
    const across = Math.max(6, Math.floor(layout.width / SEAT_PITCH))
    const pitch = layout.width / across
    const matrices: Matrix4[] = []
    for (let r = 0; r < layout.rows; r++) {
      const y = treadY(r)
      const z = treadBack(layout, r) + 0.3
      for (let s = 0; s < across; s++) {
        const x = -layout.halfW + (s + 0.5) * pitch
        if (Math.abs(x) < AISLE / 2 + 0.04) continue
        matrices.push(new Matrix4().makeTranslation(x, y, z))
      }
    }
    instance('seat', seatShell(), matrices, 'seats')
    instance('structure', seatFrame(), matrices, 'seat-frames')
  }

  /** Centre flight: half-tier pads make a 0.44 m tier walkable at 0.22 m a step. */
  const buildAisle = (layout: Layout): void => {
    const steps: BufferGeometry[] = []
    for (let r = 0; r < layout.rows; r++) {
      const pad = bevelBox(AISLE, RISE / 2 + 0.02, TREAD / 2, 0.012)
      pad.translate(0, treadY(r) + RISE / 4 - 0.01, treadBack(layout, r) + TREAD / 4)
      steps.push(pad)
    }
    // The step up from the promenade is a full 0.75 m, so it gets its own pair of risers.
    for (let s = 0; s < 2; s++) {
      const h = (NOSE / 2) * (s + 1)
      const kerb = bevelBox(AISLE, h, TREAD / 2, 0.012)
      kerb.translate(0, DECK + h / 2, layout.halfD - WALK + TREAD / 4 - (s * TREAD) / 2)
      steps.push(kerb)
    }
    const landing = bevelBox(AISLE, 0.06, WALK, 0.012)
    landing.translate(0, DECK + 0.02, layout.halfD - WALK / 2)
    steps.push(landing)
    emit('deck', mergeParts(steps, 'f1-grandstand-bay: aisle steps'), bowl, 'aisle-steps')

    const rails: BufferGeometry[] = []
    const foot = new Vector3(0, DECK + 1.06, layout.halfD - WALK + 0.2)
    const head = new Vector3(0, layout.bowlTop + 0.86, treadBack(layout, layout.rows - 1) + 0.25)
    const posts = Math.max(3, Math.ceil(layout.rows / 2))
    for (const sx of [-1, 1] as const) {
      const x = (sx * AISLE) / 2
      rails.push(member(new Vector3(x, foot.y, foot.z), new Vector3(x, head.y, head.z), 0.028, 8))
      for (let p = 0; p <= posts; p++) {
        const t = p / posts
        const y = foot.y + (head.y - foot.y) * t
        const z = foot.z + (head.z - foot.z) * t
        rails.push(member(new Vector3(x, surfaceY(layout, z) - 0.04, z), new Vector3(x, y, z), 0.022, 6))
      }
    }
    emit('structure', mergeParts(rails, 'f1-grandstand-bay: gangway'), bowl, 'central-gangway')
  }

  /** Amber step marking on every tier edge and every aisle half-step. */
  const buildNosings = (layout: Layout): void => {
    const parts: BufferGeometry[] = []
    for (let r = 0; r < layout.rows; r++) {
      const y = treadY(r)
      const edge = treadBack(layout, r) + TREAD
      for (const [x0, x1] of blocks(layout)) {
        const nose = bevelBox(x1 - x0, 0.028, 0.075, 0.007)
        nose.translate((x0 + x1) / 2, y + 0.013, edge - 0.05)
        parts.push(nose)
      }
      const step = bevelBox(AISLE, 0.028, 0.075, 0.007)
      step.translate(0, y + RISE / 2 + 0.013, treadBack(layout, r) + TREAD / 2 - 0.05)
      parts.push(step)
    }
    // Promenade lip. Once the hoarding is only a band the walk behind it is on show, and an unmarked
    // slab edge is the one thing that would still give it away as a slab.
    const lip = bevelBox(layout.width, 0.026, 0.08, 0.007)
    lip.translate(0, DECK + 0.01, layout.halfD - 0.17)
    parts.push(lip)
    emit('structure', mergeParts(parts, 'f1-grandstand-bay: nosings'), bowl, 'nosings', kit.amber)
  }

  /**
   * The promenade edge: an advertising band, an open guard-rail void over it, and the debris fence raked
   * back above both. The hoarding used to climb the full 0.95 m from the deck to the fence, which welded
   * it to the plinth below into a single continuous two-metre slab and shut the undercroft down. Held to
   * a band, the void above it puts the walk strip and the row-1 riser on show, so the frontage carries
   * promenade depth instead of a face.
   */
  const buildFrontage = (layout: Layout): void => {
    const z = layout.halfD + 0.07
    const base = DECK + 0.09
    const top = base + HOARD_H
    const railHead = DECK + RAIL_H
    const frame: BufferGeometry[] = []
    const panels: BufferGeometry[] = []

    for (const y of [base, top] as const) {
      const rail = bevelBox(layout.width, 0.1, 0.2, 0.02)
      rail.translate(0, y, z)
      frame.push(rail)
    }
    // The rail the promenade is actually fenced to, a void's height clear of the hoarding it caps.
    const head = bevelBox(layout.width, 0.085, 0.17, 0.02)
    head.translate(0, railHead, z)
    frame.push(head)
    // Posts run past the hoarding to the head rail, so the void reads as framed rather than as absence.
    for (const x of layout.columns) {
      const post = bevelBox(0.1, railHead - base, 0.18, 0.02)
      post.translate(x, (base + railHead) / 2, z - 0.01)
      frame.push(post)
    }
    for (let b = 0; b < layout.columns.length - 1; b++) {
      const x0 = layout.columns[b]!
      const x1 = layout.columns[b + 1]!
      const panel = bevelBox(x1 - x0 - 0.13, HOARD_H - 0.14, 0.07, 0.014)
      panel.translate((x0 + x1) / 2, base + HOARD_H / 2, z - 0.055)
      panels.push(panel)
    }

    // The walk the void exposes: dark anti-slip decking laid over the cast promenade, biting into it
    // rather than floating a hair over it (rule 8). At the concrete's own value it disappears, and the
    // void reads as a gap in a face instead of a walkway seen behind a rail.
    const strip = bevelBox(layout.width - 0.16, 0.05, WALK - 0.42, 0.012)
    strip.translate(0, DECK + 0.02, layout.halfD - WALK / 2 - 0.04)
    emit('deck', strip, bowl, 'promenade-strip', kit.graphite)

    // Fence posts sit mid-bay so a tiled run never doubles one up on a seam.
    const fenceTop = railHead + 1.55
    const count = Math.max(3, Math.ceil(layout.width / 1.7))
    for (let p = 0; p < count; p++) {
      const x = -layout.halfW + (p + 0.5) * (layout.width / count)
      frame.push(member(new Vector3(x, railHead, z), new Vector3(x, fenceTop, z - 0.18), 0.035, 6))
    }
    for (const t of [0.34, 0.67, 1] as const) {
      const y = railHead + (fenceTop - railHead) * t
      frame.push(member(
        new Vector3(-layout.halfW, y, z - 0.18 * t),
        new Vector3(layout.halfW, y, z - 0.18 * t),
        0.022,
        6,
      ))
    }

    emit('structure', mergeParts(frame, 'f1-grandstand-bay: frontage'), bowl, 'frontage')
    emit('structure', mergeParts(panels, 'f1-grandstand-bay: hoarding'), bowl, 'hoarding', kit.ink)
  }

  /**
   * Scalloped membrane bays clamped between arched rafters that stand proud of the fabric, each one over
   * its own tension web. One lofted slab is what made this read as a shed.
   */
  const buildRoof = (layout: Layout): void => {
    const membrane: BufferGeometry[] = []
    const frame: BufferGeometry[] = []
    for (let b = 0; b < layout.columns.length - 1; b++) {
      const x0 = layout.columns[b]!
      const x1 = layout.columns[b + 1]!
      membrane.push(membranePanel(layout, x0, x1))
      frame.push(...bayWeb(layout, x0, x1, b % 2 === 0))
    }
    frame.push(...roofRafters(layout), ...roofEdges(layout))

    emit('roof', mergeParts(membrane, 'f1-grandstand-bay: membrane'), roof, 'roof')
    emit('structure', mergeParts(frame, 'f1-grandstand-bay: roof frames'), roof, 'roof-frames')
  }

  /** The slender front columns that carry the cantilever — the reference's strongest vertical rhythm. */
  const buildColumns = (layout: Layout): void => {
    const front = rafterAt(layout, 1)
    const knee = rafterAt(layout, 0.76)
    const z = front.z - 0.07
    const parts: BufferGeometry[] = []
    for (const x of layout.columns) {
      const head = front.y - EDGE_HEAD
      parts.push(member(new Vector3(x, 0, z), new Vector3(x, head, z), 0.095, 10))
      parts.push(groundPad([0.36, 0.36], [x, 0, z], 0.035))
      parts.push(member(
        new Vector3(x, head - 1.4, z),
        new Vector3(x, knee.y - 0.22, knee.z),
        0.045,
        6,
      ))
      parts.push(member(
        new Vector3(x, DECK + 0.92, z),
        new Vector3(x, DECK + 0.92, layout.halfD),
        0.04,
        6,
      ))
    }
    emit('structure', mergeParts(parts, 'f1-grandstand-bay: columns'), roof, 'columns')
  }

  /**
   * Sponsor fascia hung off the back of the column head, a third of a metre behind the membrane tip and
   * a metre below it. Set proud of the tip it becomes the silhouette; set back, it is depth trim under a
   * canopy edge that leads.
   */
  const buildFascia = (layout: Layout): void => {
    const front = rafterAt(layout, 1)
    const z = front.z - 0.34
    const top = front.y - EDGE_HEAD - 0.04
    const frame: BufferGeometry[] = []
    const faces: BufferGeometry[] = []

    for (const y of [top, top - FASCIA_H] as const) {
      const rail = bevelBox(layout.width, 0.075, 0.15, 0.018)
      rail.translate(0, y, z)
      frame.push(rail)
    }
    for (const x of layout.columns) {
      const mullion = bevelBox(0.08, FASCIA_H, 0.12, 0.016)
      mullion.translate(x, top - FASCIA_H / 2, z - 0.015)
      frame.push(mullion)
      for (const y of [top, top - FASCIA_H] as const) {
        frame.push(member(
          new Vector3(x, y, z),
          new Vector3(x, y + (y === top ? 0.06 : -0.02), front.z - 0.07),
          0.026,
          6,
        ))
      }
    }
    for (let b = 0; b < layout.columns.length - 1; b++) {
      const x0 = layout.columns[b]!
      const x1 = layout.columns[b + 1]!
      const face = bevelBox(x1 - x0 - 0.11, FASCIA_H - 0.1, 0.05, 0.012)
      face.translate((x0 + x1) / 2, top - FASCIA_H / 2, z - 0.04)
      faces.push(face)
    }

    emit('structure', mergeParts(frame, 'f1-grandstand-bay: fascia frame'), roof, 'fascia-frame')
    emit('fascia', mergeParts(faces, 'f1-grandstand-bay: fascia'), roof, 'fascia-board')
  }

  const rebuild = (): void => {
    releaseGenerated()
    const layout = layoutOf(config)
    buildBowl(layout)
    buildSeating(layout)
    buildAisle(layout)
    buildNosings(layout)
    buildFrontage(layout)
    buildRoof(layout)
    buildColumns(layout)
    buildFascia(layout)
  }
  rebuild()

  return {
    root,
    parts: { bowl, roof },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.rows !== undefined) config.rows = Math.max(4, Math.round(patch.rows))
      if (patch.width !== undefined) config.width = Math.max(4, patch.width)
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      for (const material of extras) material.dispose()
      extras.length = 0
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  // Framed from under the eave rather than over it. Above the leading edge the canopy is only a skin and
  // the tension web slung beneath it never appears; dropped below the membrane tip and swung round toward
  // the open end of the bay, the sight line passes under the near rafter and runs the length of the
  // soffit while the scalloped hem still reads against the sky.
  return createF1Preview(createModel({ rows: 6, width: 7 }), {
    aspect,
    target: [0, 4.05, 0.1],
    distance: 19.5,
    fov: 34,
    yaw: -0.86,
    pitch: 0.082,
  })
}
