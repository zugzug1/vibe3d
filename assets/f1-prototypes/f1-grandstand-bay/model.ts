// f1-grandstand-bay — one Silverstone-style seating bay: a raked bowl on an elevated deck, tip-up seat
// shells on standards, a hoarding-and-debris-fence frontage, and a tensioned membrane roof carried on
// slender front columns. configure({ rows, width, tiers }).
//
// Datums read off the Silverstone reference: 0.44 m rise on a 0.80 m tread, a 1.10 m promenade sitting
// 0.95 m above ground, row 1 stepped a further 0.75 m up so it clears the hoarding, columns and rafters
// on a ~2.6 m bay pitch, and a roof that falls only 0.45 m across the span before its cantilever curls
// back up, so the canopy opens toward the track instead of shutting down onto it. `width` is the tiling
// module and nothing overhangs it, so a run of bays reads as one continuous stand. The red leading-edge
// fascia and the amber nosings are the catalogue tells — not a grey shed.
//
// `tiers` (1-4) stacks whole bowls, like Madring's S/F stand: tier k's promenade sits at tier k-1's
// bowlTop + ROOF_CLEAR (headroom for the concourse under it), and tier k's front CANTILEVERS
// OVERLAP_ROWS rows' worth of tread past tier k-1's rear edge — the balcony front overhangs the tier
// below rather than sitting flush on top of it (the Madring S/F photo's datum). Each tier's own closed
// bowl mass is already a full-depth slab underneath it (its loft profile's lowest point is local y=0
// across the WHOLE depth, front to rear — see {@link buildBowl}), so that overhang is automatically the
// soffit over the covered rows below — no separate soffit geometry needed. Each tier below the top still
// gets its own frontage (fascia/hoarding/guard-rail), landing right at the overhang's leading edge like a
// real balcony front, and a rear wall stretched to close the gap under the tier above (no see-through
// void). ONE roof — the existing membrane/rafter/column system — rides the TOP tier only by default;
// lower tiers are uncovered except where the tier above overhangs them. `tiers: 1` is untouched: same
// single bowl, same geometry as before.
//
// `tierSpec` (indexed by tier, 0 = bottom) makes every one of those per-tier decisions configurable, so a
// stack is never left floating with no visible means of support:
//   - `rows` — this tier's own row count (default `config.rows`).
//   - `plinth` (tier 0 only) — deck height above ground (default `DECK`, 0.95 m). A taller plinth raises
//     the front wall and the whole stack above it rigidly; it does not change any tier-to-tier clearance
//     (those are all rise-relative, not ground-relative — see the `rebuild` origin derivation).
//   - `lift` (tiers ≥1) — EXTRA clear height added above the default step, e.g. `tierSpec[1].lift` to
//     raise just the middle tier.
//   - `overlapRows` (tiers ≥1) — how many rows of tread this tier's front cantilevers past the tier
//     below's rear edge (default `OVERLAP_ROWS`).
//   - `support` — what carries THIS tier at its front (cantilever-tip) edge: `'columns'` (default) plants
//     a column line, on the roof's own bay pitch, from the tier below's `surfaceY` up to this tier's flat
//     underside (local y = 0), plus a raking stringer down each side to the rear support so the soffit
//     visibly rests on something rather than just closing as a slab; `'wall'` is a solid panel instead of
//     columns; `'none'` leaves it open. For tier 0 — which already stands on a closed loft face reaching
//     the ground (the plinth) — `'columns'`/`'wall'`/`'none'` are all a no-op: there is nothing to add or
//     remove, tier 0 was never floating.
//   - `rearSupport` — the back of the stand: a column line (with X cross-bracing per bay) or wall running
//     from TRUE GROUND up to this tier's own rear-wall height, at the rear face. Every tier above ground
//     gets its own rear tower rather than one member spanning past intermediate tiers, because each tier
//     steps further back as it stacks (see `tierStep.z` below), so the towers never collide.
//   - `stairs` (default `true` for tiers ≥1) — one straight flight (or, past the point it fits inside
//     `width`, a folded switchback) from the tier below's promenade to this tier's promenade, tucked
//     against the +X end of the bay. See {@link buildStairs}.
//   - `roof` (default: top tier only) — lets a non-top tier carry its own membrane roof too, gated by a
//     thrown clearance check against the tier stacked above it.
// Any field left out of a given tier's (partial) entry falls back to the default above, so `tiers: 3`
// alone still builds a complete, fully-supported stack. `tiers` may also be given directly as the
// `tierSpec` array (`tiers: [{...}, {...}, {...}]`), in which case `tiers = tiers.length`.

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

/** What carries a tier at the edge in question: real columns, a solid panel, or nothing at all. */
export type TierSupport = 'columns' | 'wall' | 'none'

/** Per-tier overrides. Every field is optional on input — see the header comment for each default. */
export interface TierSpec {
  rows: number
  /** Tier 0 only: deck height above ground. */
  plinth: number
  /** Tiers ≥1 only: extra clear height added above the default step. */
  lift: number
  /** Tiers ≥1 only: cantilever over the tier below, in rows of tread. */
  overlapRows: number
  support: TierSupport
  rearSupport: TierSupport
  stairs: boolean
  roof: boolean
}

export interface F1GrandstandBayConfig {
  rows: number
  width: number
  /** Stacked bowls, 1-4. `tiers: 1` (the default) is the original single bowl, unchanged. */
  tiers: number
  /** Per-tier overrides, indexed by tier (0 = bottom). Missing fields/entries fall back to defaults. */
  tierSpec?: ReadonlyArray<Partial<TierSpec>>
}

/** `tiers` may be a count, or the `tierSpec` array itself (then `tiers = tiers.length`). */
export type F1GrandstandBayTiersInput = number | ReadonlyArray<Partial<TierSpec>>

export type F1GrandstandBayPatch = Partial<Omit<F1GrandstandBayConfig, 'tiers'>> & {
  tiers?: F1GrandstandBayTiersInput
}

export interface F1GrandstandBayOptions extends F1GrandstandBayPatch {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1GrandstandBayInstance {
  readonly root: Group
  readonly parts: { bowl: Group; roof: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1GrandstandBayConfig>
  configure(patch: F1GrandstandBayPatch): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1GrandstandBayConfig = { rows: 8, width: 10, tiers: 1 }
const MIN_TIERS = 1
const MAX_TIERS = 4

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
/**
 * estimate:photo — how many rows of tread a stacked tier's balcony front overhangs the tier below, read
 * off the Madring S/F stand photo (the upper tiers' fronts hang over roughly the last three rows of the
 * tier beneath, not sitting flush on top of it). Only meaningful when `tiers` > 1. Default for a tier's
 * `overlapRows`.
 */
const OVERLAP_ROWS = 3

/** Front/rear tier-support column radius — a lighter gauge than the roof's own 0.095 m columns, since a
 *  support column carries one tier's cantilever rather than the whole canopy. */
const SUPPORT_R = 0.085
/** Ground/tread pad under a support column foot, matching the roof column's own pad convention. */
const SUPPORT_PAD = 0.32
/** Clear of the coincident bowl/wall face by more than the column radius, so neither z-fights the other. */
const SUPPORT_INSET = SUPPORT_R + 0.05
const BRACE_R = 0.03
/** Solid-panel support thickness, front or rear. */
const WALL_SUPPORT_T = 0.18

/** Walkway width of the inter-tier stair flight. */
const STAIR_WIDTH = 1.3
/** How far in front of the tier's own leading edge the stair pocket sits — it "may sit outside the
 *  bowl" (per the design brief), so this is unconstrained by `width` on the Z axis. */
const STAIR_MARGIN = 0.5
/** Clear gap between the two lanes of a folded switchback. */
const STAIR_GAP = 0.3

interface Layout {
  readonly rows: number
  readonly width: number
  readonly halfW: number
  readonly halfD: number
  /** This tier's own promenade height above ITS OWN local ground (0.95 m by default; only tier 0's
   *  `plinth` ever overrides it — see the header comment on why that doesn't perturb any clearance). */
  readonly base: number
  readonly bowlTop: number
  /** Rafter and column stations across the bay, boundaries inclusive. */
  readonly columns: readonly number[]
  readonly zBack: number
  readonly zFront: number
  readonly yBack: number
  readonly yFront: number
}

const layoutOf = (rows: number, width: number, base: number): Layout => {
  const halfD = (WALK + rows * TREAD + REAR) / 2
  const bays = Math.max(2, Math.round(width / BAY))
  const columns: number[] = []
  for (let i = 0; i <= bays; i++) columns.push(-width / 2 + (i / bays) * width)
  const bowlTop = base + NOSE + rows * RISE
  return {
    rows,
    width,
    halfW: width / 2,
    halfD,
    base,
    bowlTop,
    columns,
    zBack: -halfD - ROOF_BACK,
    zFront: halfD + ROOF_FRONT,
    yBack: bowlTop + ROOF_CLEAR,
    yFront: bowlTop + ROOF_CLEAR - ROOF_FALL,
  }
}

/** Walking surface of tier `r`, in this layout's own local frame. */
const treadY = (layout: Layout, r: number): number => layout.base + NOSE + r * RISE

/** Rear edge of tier `r` — where its seat standards bolt down. */
const treadBack = (layout: Layout, r: number): number => layout.halfD - WALK - (r + 1) * TREAD

/** Whatever a spectator stands on at `z`: the promenade, or the tier that covers it. */
const surfaceY = (layout: Layout, z: number): number => {
  if (z > layout.halfD - WALK) return layout.base
  const r = Math.floor((layout.halfD - WALK - z) / TREAD)
  return treadY(layout, Math.min(Math.max(r, 0), layout.rows - 1))
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

const clampTierSupport = (value: TierSupport | undefined): TierSupport =>
  value === 'wall' || value === 'none' ? value : 'columns'

/** Fills in every field of one tier's spec from its (possibly empty) partial input. */
const resolveTierSpec = (
  tier: number, rowsDefault: number, isTop: boolean, partial: Partial<TierSpec> | undefined,
): TierSpec => ({
  rows: Math.max(4, Math.round(partial?.rows ?? rowsDefault)),
  plinth: Math.max(0, partial?.plinth ?? DECK),
  lift: Math.max(0, partial?.lift ?? 0),
  overlapRows: Math.max(0, Math.round(partial?.overlapRows ?? OVERLAP_ROWS)),
  support: clampTierSupport(partial?.support),
  rearSupport: clampTierSupport(partial?.rearSupport),
  stairs: partial?.stairs ?? tier >= 1,
  roof: partial?.roof ?? isTop,
})

const resolveTiers = (config: F1GrandstandBayConfig): TierSpec[] => {
  const specs: TierSpec[] = []
  for (let tier = 0; tier < config.tiers; tier++) {
    specs.push(resolveTierSpec(tier, config.rows, tier === config.tiers - 1, config.tierSpec?.[tier]))
  }
  return specs
}

/** `tiers` given as a count, or as the `tierSpec` array itself — resolves to both a clamped count and
 *  the tierSpec to store, `patch.tierSpec` (if also given) always winning over a tiers-as-array input. */
const resolveTiersInput = (
  tiers: F1GrandstandBayTiersInput, explicitTierSpec: ReadonlyArray<Partial<TierSpec>> | undefined,
): { tiers: number; tierSpec: ReadonlyArray<Partial<TierSpec>> | undefined } => {
  if (typeof tiers === 'number') {
    return {
      tiers: Math.min(MAX_TIERS, Math.max(MIN_TIERS, Math.round(tiers))),
      tierSpec: explicitTierSpec,
    }
  }
  const count = Math.min(MAX_TIERS, Math.max(MIN_TIERS, tiers.length))
  return { tiers: count, tierSpec: (explicitTierSpec ?? tiers).slice(0, count) }
}

export function createModel(options: F1GrandstandBayOptions = {}): F1GrandstandBayInstance {
  const tiersInput = resolveTiersInput(options.tiers ?? defaults.tiers, options.tierSpec)
  const config: F1GrandstandBayConfig = {
    rows: Math.max(4, Math.round(options.rows ?? defaults.rows)),
    width: Math.max(4, options.width ?? defaults.width),
    tiers: tiersInput.tiers,
    tierSpec: tiersInput.tierSpec,
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
    mesh.userData.topologyRole = name === 'seats' ? 'scatter' : name.includes('fascia') || name.includes('board') ? 'detail' : 'hull'
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
    group: Group,
  ): void => {
    generated.push(geometry)
    const mesh = new InstancedMesh(geometry, materialSlots[slot], matrices.length)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]!)
    mesh.instanceMatrix.needsUpdate = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  /**
   * A straight guard rail: one top-rail member from `foot` to `head`, plus baluster posts standing on
   * `floorAt(t)` at each of `postsCount` stations along the run (`t` runs 0 at `foot` to 1 at `head`).
   * Shared by the central gangway and the inter-tier stairs so both read as the same fabricated product.
   */
  const buildRail = (
    foot: Vector3, head: Vector3, postsCount: number, floorAt: (t: number) => number,
  ): BufferGeometry[] => {
    const parts: BufferGeometry[] = [member(foot, head, 0.028, 8)]
    for (let p = 0; p <= postsCount; p++) {
      const t = p / postsCount
      const x = foot.x + (head.x - foot.x) * t
      const y = foot.y + (head.y - foot.y) * t
      const z = foot.z + (head.z - foot.z) * t
      parts.push(member(new Vector3(x, floorAt(t) - 0.04, z), new Vector3(x, y, z), 0.022, 6))
    }
    return parts
  }

  /**
   * The raked mass: front skirt, promenade, tiers, rear return — one closed section swept across. Its
   * profile starts and ends at LOCAL y = 0 (front-bottom and rear-bottom corners), and because the loft
   * is closed the implicit edge joining those two points is a flat plane at y = 0 spanning the WHOLE
   * depth — this tier's own underside, flat front to rear, is what a stacked tier above cantilevers over
   * and what a `support` column's head meets (see `buildFrontSupport`).
   * `wallTop` overrides the rear-wall height (local, this tier's own origin) — used to stretch a
   * non-top tier's rear wall up to the tier stacked above it, so the concourse void underneath is
   * closed rather than see-through. Left undefined (the top/only tier) it is the original parapet.
   */
  const buildBowl = (layout: Layout, group: Group, wallTop?: number): void => {
    const profile: Array<readonly [number, number]> = [
      [layout.halfD, 0],
      [layout.halfD, layout.base - 0.12],
      [layout.halfD - 0.12, layout.base],
      [layout.halfD - WALK, layout.base],
      [layout.halfD - WALK, layout.base + NOSE],
    ]
    for (let r = 0; r < layout.rows; r++) {
      const y = treadY(layout, r)
      const back = treadBack(layout, r)
      profile.push([back, y], [back, y + RISE])
    }
    profile.push([-layout.halfD, layout.bowlTop], [-layout.halfD, 0])
    emit('deck', loftAlongX(profile, layout.width, { closed: true }), group, 'bowl')

    const wallH = wallTop ?? layout.bowlTop + 0.62
    const rear = bevelBox(layout.width, wallH, 0.5, 0.03)
    rear.translate(0, wallH / 2, -layout.halfD - 0.24)
    emit('deck', rear, group, 'rear-wall')
  }

  const buildSeating = (layout: Layout, group: Group): void => {
    const across = Math.max(6, Math.floor(layout.width / SEAT_PITCH))
    const pitch = layout.width / across
    const matrices: Matrix4[] = []
    for (let r = 0; r < layout.rows; r++) {
      const y = treadY(layout, r)
      const z = treadBack(layout, r) + 0.3
      for (let s = 0; s < across; s++) {
        const x = -layout.halfW + (s + 0.5) * pitch
        if (Math.abs(x) < AISLE / 2 + 0.04) continue
        matrices.push(new Matrix4().makeTranslation(x, y, z))
      }
    }
    instance('seat', seatShell(), matrices, 'seats', group)
    instance('structure', seatFrame(), matrices, 'seat-frames', group)
  }

  /** Centre flight: half-tier pads make a 0.44 m tier walkable at 0.22 m a step. */
  const buildAisle = (layout: Layout, group: Group): void => {
    const steps: BufferGeometry[] = []
    for (let r = 0; r < layout.rows; r++) {
      const pad = bevelBox(AISLE, RISE / 2 + 0.02, TREAD / 2, 0.012)
      pad.translate(0, treadY(layout, r) + RISE / 4 - 0.01, treadBack(layout, r) + TREAD / 4)
      steps.push(pad)
    }
    // The step up from the promenade is a full 0.75 m, so it gets its own pair of risers.
    for (let s = 0; s < 2; s++) {
      const h = (NOSE / 2) * (s + 1)
      const kerb = bevelBox(AISLE, h, TREAD / 2, 0.012)
      kerb.translate(0, layout.base + h / 2, layout.halfD - WALK + TREAD / 4 - (s * TREAD) / 2)
      steps.push(kerb)
    }
    const landing = bevelBox(AISLE, 0.06, WALK, 0.012)
    landing.translate(0, layout.base + 0.02, layout.halfD - WALK / 2)
    steps.push(landing)
    emit('deck', mergeParts(steps, 'f1-grandstand-bay: aisle steps'), group, 'aisle-steps')

    const railFoot = new Vector3(0, layout.base + 1.06, layout.halfD - WALK + 0.2)
    const railHead = new Vector3(0, layout.bowlTop + 0.86, treadBack(layout, layout.rows - 1) + 0.25)
    const posts = Math.max(3, Math.ceil(layout.rows / 2))
    const rails: BufferGeometry[] = []
    for (const sx of [-1, 1] as const) {
      const x = (sx * AISLE) / 2
      const foot = new Vector3(x, railFoot.y, railFoot.z)
      const head = new Vector3(x, railHead.y, railHead.z)
      rails.push(...buildRail(foot, head, posts, (t) => surfaceY(layout, foot.z + (head.z - foot.z) * t)))
    }
    emit('structure', mergeParts(rails, 'f1-grandstand-bay: gangway'), group, 'central-gangway')
  }

  /** Amber step marking on every tier edge and every aisle half-step. */
  const buildNosings = (layout: Layout, group: Group): void => {
    const parts: BufferGeometry[] = []
    for (let r = 0; r < layout.rows; r++) {
      const y = treadY(layout, r)
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
    lip.translate(0, layout.base + 0.01, layout.halfD - 0.17)
    parts.push(lip)
    emit('structure', mergeParts(parts, 'f1-grandstand-bay: nosings'), group, 'nosings', kit.amber)
  }

  /**
   * The promenade edge: an advertising band, an open guard-rail void over it, and the debris fence raked
   * back above both. The hoarding used to climb the full 0.95 m from the deck to the fence, which welded
   * it to the plinth below into a single continuous two-metre slab and shut the undercroft down. Held to
   * a band, the void above it puts the walk strip and the row-1 riser on show, so the frontage carries
   * promenade depth instead of a face.
   */
  const buildFrontage = (layout: Layout, group: Group): void => {
    const z = layout.halfD + 0.07
    const base = layout.base + 0.09
    const top = base + HOARD_H
    const railHead = layout.base + RAIL_H
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
    strip.translate(0, layout.base + 0.02, layout.halfD - WALK / 2 - 0.04)
    emit('deck', strip, group, 'promenade-strip', kit.graphite)

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

    emit('structure', mergeParts(frame, 'f1-grandstand-bay: frontage'), group, 'frontage')
    emit('structure', mergeParts(panels, 'f1-grandstand-bay: hoarding'), group, 'hoarding', kit.ink)
  }

  /**
   * Scalloped membrane bays clamped between arched rafters that stand proud of the fabric, each one over
   * its own tension web. One lofted slab is what made this read as a shed.
   */
  const buildRoof = (layout: Layout, group: Group): void => {
    const membrane: BufferGeometry[] = []
    const frame: BufferGeometry[] = []
    for (let b = 0; b < layout.columns.length - 1; b++) {
      const x0 = layout.columns[b]!
      const x1 = layout.columns[b + 1]!
      membrane.push(membranePanel(layout, x0, x1))
      frame.push(...bayWeb(layout, x0, x1, b % 2 === 0))
    }
    frame.push(...roofRafters(layout), ...roofEdges(layout))

    emit('roof', mergeParts(membrane, 'f1-grandstand-bay: membrane'), group, 'roof')
    emit('structure', mergeParts(frame, 'f1-grandstand-bay: roof frames'), group, 'roof-frames')
  }

  /** The slender front columns that carry the cantilever — the reference's strongest vertical rhythm. */
  const buildColumns = (layout: Layout, group: Group): void => {
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
        new Vector3(x, layout.base + 0.92, z),
        new Vector3(x, layout.base + 0.92, layout.halfD),
        0.04,
        6,
      ))
    }
    emit('structure', mergeParts(parts, 'f1-grandstand-bay: columns'), group, 'columns')
  }

  /**
   * Sponsor fascia hung off the back of the column head, a third of a metre behind the membrane tip and
   * a metre below it. Set proud of the tip it becomes the silhouette; set back, it is depth trim under a
   * canopy edge that leads.
   */
  const buildFascia = (layout: Layout, group: Group): void => {
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

    emit('structure', mergeParts(frame, 'f1-grandstand-bay: fascia frame'), group, 'fascia-frame')
    emit('fascia', mergeParts(faces, 'f1-grandstand-bay: fascia'), group, 'fascia-board')
  }

  /**
   * What carries THIS tier at its front (cantilever-tip) edge: a column line on the roof's own bay pitch,
   * or a solid panel, standing in the undercroft between the lower tier's own `surfaceY` and this tier's
   * flat underside (local y = 0 — see `buildBowl`). Every foot is COMPUTED off `surfaceY`, never assumed,
   * so it can only land on a real tread or promenade.
   */
  const buildFrontSupport = (
    spec: TierSpec, layout: Layout, oy: number, oz: number, wallH: number,
    lower: { readonly layout: Layout; readonly oy: number; readonly oz: number },
    group: Group,
  ): void => {
    if (spec.support === 'none') return
    const z = oz + layout.halfD - SUPPORT_INSET
    const headY = oy
    const footY = lower.oy + surfaceY(lower.layout, z - lower.oz)
    if (footY >= headY) {
      throw new Error(
        `f1-grandstand-bay: front support foot (${footY.toFixed(3)}m) is not below its head `
        + `(${headY.toFixed(3)}m) — the tier below's surface reaches above this tier's own soffit`,
      )
    }
    const parts: BufferGeometry[] = []
    if (spec.support === 'wall') {
      const wall = bevelBox(layout.width, headY - footY, WALL_SUPPORT_T, 0.03)
      wall.translate(0, (footY + headY) / 2, z)
      parts.push(wall)
    } else {
      for (const x of layout.columns) {
        parts.push(member(new Vector3(x, footY, z), new Vector3(x, headY, z), SUPPORT_R, 10))
        parts.push(groundPad([SUPPORT_PAD, SUPPORT_PAD], [x, footY, z], 0.03))
      }
      // Raking stringer down each side of the bay, front-column head back to the rear support's own
      // head — the primary raker beam a real cantilevered stand carries its soffit on, following the
      // rake (low at the front, high at the back) rather than cutting straight across it.
      const rearZ = oz - layout.halfD - 0.24 - 0.25 - SUPPORT_INSET
      const rearHeadY = oy + wallH
      for (const x of [-layout.halfW, layout.halfW] as const) {
        parts.push(member(new Vector3(x, headY, z), new Vector3(x, rearHeadY, rearZ), BRACE_R + 0.01, 8))
      }
    }
    // Every point above was computed in WORLD space (foot/head both cross tier boundaries via `lower`),
    // but this mesh is emitted into `group`, which already carries this tier's own (oy, oz) translation
    // — convert back to local-to-group space so the group's transform doesn't apply the offset twice.
    emit(
      'structure',
      mergeParts(parts, 'f1-grandstand-bay: front support').translate(0, -oy, -oz),
      group,
      'front-support',
    )
  }

  /**
   * The back of the stand: a column line (with X cross-bracing per bay) or a wall, from TRUE GROUND up
   * to this tier's own rear-wall height (`wallH` — the same value `buildBowl` used, so the support meets
   * the wall it is bracing). Every tier gets its own tower rather than one member spanning past
   * intermediate tiers, because each tier steps further back as it stacks — the towers never collide.
   */
  const buildRearSupport = (
    spec: TierSpec, layout: Layout, oy: number, oz: number, wallH: number, group: Group,
  ): void => {
    if (spec.rearSupport === 'none') return
    // The rear-wall box (`buildBowl`) is centred at halfD+0.24 with 0.5 m depth — its far face is
    // 0.25 m further back again. Clear that face by more than the support's own radius.
    const wallBackZ = oz - layout.halfD - 0.24 - 0.25
    const z = wallBackZ - SUPPORT_INSET
    const headY = oy + wallH
    const footY = 0
    if (headY <= footY) {
      throw new Error(`f1-grandstand-bay: rear support head (${headY.toFixed(3)}m) is not above ground`)
    }
    const parts: BufferGeometry[] = []
    if (spec.rearSupport === 'wall') {
      const wall = bevelBox(layout.width, headY - footY, WALL_SUPPORT_T, 0.03)
      wall.translate(0, (footY + headY) / 2, z)
      parts.push(wall)
    } else {
      const feet: Vector3[] = []
      const heads: Vector3[] = []
      for (const x of layout.columns) {
        const foot = new Vector3(x, footY, z)
        const head = new Vector3(x, headY, z)
        feet.push(foot)
        heads.push(head)
        parts.push(member(foot, head, SUPPORT_R, 10))
        parts.push(groundPad([SUPPORT_PAD, SUPPORT_PAD], [x, footY, z], 0.03))
      }
      // X cross-bracing, two diagonals per bay, so the back reads as a braced frame rather than a row
      // of unconnected posts.
      for (let b = 0; b < feet.length - 1; b++) {
        parts.push(member(feet[b]!, heads[b + 1]!, BRACE_R, 6))
        parts.push(member(heads[b]!, feet[b + 1]!, BRACE_R, 6))
      }
    }
    // Same local/world conversion as `buildFrontSupport` — the foot is TRUE ground (world y=0).
    emit(
      'structure',
      mergeParts(parts, 'f1-grandstand-bay: rear support').translate(0, -oy, -oz),
      group,
      'rear-support',
    )
  }

  /**
   * One straight flight — or, past the point its run no longer fits inside `width`, a folded switchback
   * (two half-flights and a landing) — from the lower tier's promenade to this tier's promenade, tucked
   * against the +X end of the bay so it never overhangs the tiling module (it MAY run past the bowl's own
   * depth on Z though — nothing tiles against a neighbour bay in that direction). Steps are solid stacked
   * blocks, like the model's own row risers, so the flight is self-supporting rather than a floating
   * tread run. Riser/tread is this model's own RISE/TREAD (0.44 m / 0.8 m) — this is part of the STAND,
   * not the FIA circuit-stairs catalogue module.
   */
  const buildStairs = (
    layout: Layout, oy: number, oz: number,
    lower: { readonly layout: Layout; readonly oy: number; readonly oz: number },
    width: number, group: Group,
  ): { readonly steps: number; readonly switchback: boolean } => {
    const footY = lower.oy + lower.layout.base
    const headY = oy + layout.base
    if (headY <= footY) {
      throw new Error(
        `f1-grandstand-bay: stairs head (${headY.toFixed(3)}m) is not above their foot `
        + `(${footY.toFixed(3)}m)`,
      )
    }
    const dy = headY - footY
    const halfW = width / 2
    // The guard rail's own top-rail member (radius 0.028) stands proud of whatever x it's centred on, so
    // the flight's outer edge is pulled in by more than that radius — the rail is what would otherwise
    // overhang the tiling module, not the tread blocks (which are already inset by their own margin).
    const edge = halfW - 0.05
    const steps = Math.max(1, Math.ceil(dy / RISE))
    const run = steps * TREAD
    const maxRun = width - STAIR_WIDTH - STAIR_MARGIN
    const switchback = run > maxRun

    const treads: BufferGeometry[] = []
    const rails: BufferGeometry[] = []
    const z0 = oz + layout.halfD + STAIR_MARGIN

    const flight = (x0: number, x1: number, y0: number, y1: number, z: number, count: number): void => {
      const stepRun = (x1 - x0) / count
      for (let i = 0; i < count; i++) {
        const xa = x0 + i * stepRun
        const xb = x0 + (i + 1) * stepRun
        const y = y0 + ((y1 - y0) * (i + 1)) / count
        const block = bevelBox(Math.max(0.05, Math.abs(stepRun) - 0.02), Math.max(0.05, y - y0), STAIR_WIDTH, 0.02)
        block.translate((xa + xb) / 2, y0 + (y - y0) / 2, z)
        treads.push(block)
      }
      rails.push(...buildRail(
        new Vector3(x0, y0 + RAIL_H, z - STAIR_WIDTH / 2 + 0.06),
        new Vector3(x1, y1 + RAIL_H, z - STAIR_WIDTH / 2 + 0.06),
        Math.max(3, count),
        (t) => y0 + (y1 - y0) * t,
      ))
    }

    if (!switchback) {
      const x0 = edge - run
      if (x0 < -halfW) {
        throw new Error(
          `f1-grandstand-bay: stairs run (${run.toFixed(2)}m) does not fit inside width (${width}m)`,
        )
      }
      flight(x0, edge, footY, headY, z0, steps)
    } else {
      const steps1 = Math.ceil(steps / 2)
      const steps2 = steps - steps1
      const landingY = footY + (dy * steps1) / steps
      const run1 = steps1 * TREAD
      const run2 = steps2 * TREAD
      const x0 = edge - Math.max(run1, run2)
      if (x0 < -halfW) {
        throw new Error(
          `f1-grandstand-bay: switchback stair run (${Math.max(run1, run2).toFixed(2)}m) does not fit `
          + `inside width (${width}m) even folded`,
        )
      }
      const z1 = z0
      const z2 = z0 + STAIR_WIDTH + STAIR_GAP
      flight(edge - run1, edge, footY, landingY, z1, steps1)
      flight(edge, edge - run2, landingY, headY, z2, steps2)
      const landing = bevelBox(STAIR_WIDTH, 0.08, STAIR_WIDTH * 2 + STAIR_GAP, 0.02)
      landing.translate(edge - STAIR_WIDTH / 2, landingY + 0.02, z0 + (STAIR_WIDTH + STAIR_GAP) / 2)
      treads.push(landing)
    }

    // Same local/world conversion as `buildFrontSupport` — foot/head were computed in world space
    // because they cross into `lower`'s own (differently-offset) group.
    emit('deck', mergeParts(treads, 'f1-grandstand-bay: stairs').translate(0, -oy, -oz), group, 'stairs')
    emit(
      'structure',
      mergeParts(rails, 'f1-grandstand-bay: stair-rail').translate(0, -oy, -oz),
      group,
      'stair-rail',
    )
    return { steps, switchback }
  }

  /**
   * Stacks `config.tiers` bowls. Tier 0 emits straight into the `bowl`/`roof` groups exactly as the
   * single-bowl model always has (identity transform) — that's what keeps `tiers: 1` byte-identical.
   * Tier k>=1 gets its own subgroup, translated by the running (oy, oz) origin. Origins are derived in a
   * PREPASS (before anything is built) so a later tier's position is known while building an earlier one
   * — `buildRoof`'s clearance check and `buildFrontSupport`'s stringer both need to look at the tier
   * ABOVE. Only tier 0's `plinth` ever shifts an origin directly: `tierStepY` (the promenade-to-promenade
   * rise) is invariant to which local base a tier is built from (it cancels: `bowlTop - base` is always
   * `NOSE + rows*RISE` regardless of `base`), so raising the plinth shifts tier 0 and, by carrying through
   * the running `oy`, every tier stacked above it — rigidly, without perturbing any tier-to-tier
   * clearance.
   */
  const rebuild = (): void => {
    releaseGenerated()

    const tierSpecs = resolveTiers(config)
    const layouts = tierSpecs.map((spec, tier) =>
      layoutOf(spec.rows, config.width, tier === 0 ? spec.plinth : DECK),
    )

    const origins: Array<{ oy: number; oz: number }> = [{ oy: 0, oz: 0 }]
    for (let tier = 1; tier < tierSpecs.length; tier++) {
      const spec = tierSpecs[tier]!
      const lower = layouts[tier - 1]!
      const lowerOrigin = origins[tier - 1]!
      const lowerBase = tier === 1 ? tierSpecs[0]!.plinth : DECK
      const tierStepY = NOSE + lower.rows * RISE + ROOF_CLEAR + spec.lift
      const tierStepZ = 2 * lower.halfD - spec.overlapRows * TREAD
      const oy = lowerOrigin.oy + (lowerBase - DECK) + tierStepY
      const oz = lowerOrigin.oz - tierStepZ
      origins.push({ oy, oz })

      // The covered row is the last row of the tier below NOT under this tier's overhang; this tier's
      // own flat underside (its local y=0, see `buildBowl`) must clear that row's tread by ROOF_CLEAR, or
      // the concourse walking under the balcony has no headroom.
      const coveredRow = Math.min(Math.max(lower.rows - spec.overlapRows, 0), lower.rows - 1)
      const rowWorldY = lowerOrigin.oy + lowerBase + NOSE + coveredRow * RISE
      const headroom = oy - rowWorldY
      if (headroom < ROOF_CLEAR) {
        throw new Error(
          `f1-grandstand-bay: tier ${tier} cantilever headroom over row ${coveredRow} is `
          + `${headroom.toFixed(3)}m, short of ROOF_CLEAR (${ROOF_CLEAR}m) — raise lift, reduce `
          + `overlapRows, or reduce rows`,
        )
      }
    }

    for (let tier = 0; tier < tierSpecs.length; tier++) {
      const spec = tierSpecs[tier]!
      const layout = layouts[tier]!
      const origin = origins[tier]!
      const isTop = tier === tierSpecs.length - 1

      const bowlGroup = tier === 0 ? bowl : (() => {
        const g = new Group()
        g.name = `tier-${tier}`
        g.position.set(0, origin.oy, origin.oz)
        bowl.add(g)
        return g
      })()

      const wallH = isTop ? layout.bowlTop + 0.62 : origins[tier + 1]!.oy - origin.oy
      buildBowl(layout, bowlGroup, isTop ? undefined : wallH)
      buildSeating(layout, bowlGroup)
      buildAisle(layout, bowlGroup)
      buildNosings(layout, bowlGroup)
      buildFrontage(layout, bowlGroup)

      if (tier > 0) {
        const lower = { layout: layouts[tier - 1]!, oy: origins[tier - 1]!.oy, oz: origins[tier - 1]!.oz }
        buildFrontSupport(spec, layout, origin.oy, origin.oz, wallH, lower, bowlGroup)
        buildRearSupport(spec, layout, origin.oy, origin.oz, wallH, bowlGroup)
        if (spec.stairs) buildStairs(layout, origin.oy, origin.oz, lower, config.width, bowlGroup)
      }

      if (spec.roof) {
        const roofGroup = tier === 0 ? roof : (() => {
          const g = new Group()
          g.name = `tier-${tier}`
          g.position.set(0, origin.oy, origin.oz)
          roof.add(g)
          return g
        })()

        if (!isTop) {
          let maxRoofY = -Infinity
          for (let i = 0; i <= 24; i++) maxRoofY = Math.max(maxRoofY, rafterAt(layout, i / 24).y)
          const roofTopWorldY = origin.oy + maxRoofY
          const aboveMassBottomWorldY = origins[tier + 1]!.oy
          const clearance = aboveMassBottomWorldY - roofTopWorldY
          if (clearance < ROOF_CLEAR) {
            throw new Error(
              `f1-grandstand-bay: tier ${tier} roof clears the tier above by ${clearance.toFixed(3)}m, `
              + `short of ROOF_CLEAR (${ROOF_CLEAR}m)`,
            )
          }
        }

        buildRoof(layout, roofGroup)
        buildColumns(layout, roofGroup)
        buildFascia(layout, roofGroup)
      }
    }
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
      if (patch.tiers !== undefined) {
        const resolved = resolveTiersInput(patch.tiers, patch.tierSpec)
        config.tiers = resolved.tiers
        config.tierSpec = resolved.tierSpec ?? config.tierSpec
      } else if (patch.tierSpec !== undefined) {
        config.tierSpec = patch.tierSpec
      }
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
