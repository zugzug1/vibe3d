/**
 * Shared 1:1 circuit datums. FIA-published numbers stay FIA; Grade 1 buildings
 * (Tilke Donington pits, Silverstone Wing area) fill the gaps. Props must import
 * these instead of inventing a second height or thickness.
 *
 * `fits` is the host a gate or end-terminal mates to. Glyph `kind` values are the FIA
 * plate payloads for `f1-circuit-sign` — one prop, not seven boards.
 */

export const WALL_FITS = ['armco', 'concrete', 'jersey'] as const
export type WallFit = (typeof WALL_FITS)[number]

export interface WallEnd {
  /** Outer face height, metres. */
  readonly height: number
  /** Thickness along Z (track-to-runoff), metres. */
  readonly depth: number
  /** Repeat pitch along X, metres. */
  readonly pitch: number
}

/**
 * Nominal end dimensions for a run of each wall family.
 * Concrete: FIA 3501 envelope 1.0–1.2 m; 0.35 m section (was a thin 0.25 m slab).
 * Jersey: NJ profile scaled so the crown sits at 1.0 m (FIA Grade 1), not US 32 in highway.
 * Armco: existing W-beam stack from wave 2.
 */
export const WALL_END: Readonly<Record<WallFit, WallEnd>> = {
  armco: { height: 1.24, depth: 0.14, pitch: 2.0 },
  concrete: { height: 1.0, depth: 0.35, pitch: 2.5 },
  jersey: { height: 1.0, depth: 0.75, pitch: 3.0 },
}

/** FIA Type 4 combination kerb (sausage): 80 cm wide, 12 cm crown, behind the 800 mm rumble. */
export const SAUSAGE_KERB = { width: 0.80, crown: 0.12, pitch: 0.80 } as const

/** FIA artificial-grass verge. Min install 1.80 m; 2.0 m is the common Grade 1 lay. */
export const ASTROTURF = { width: 2.0, pitch: 1.0, thick: 0.028 } as const

/** FIA grid box from Melbourne 2023 (2.7 m). Length fits a ~5.6 m car plus the nose line. */
export const GRID_BOX = { width: 2.7, length: 8.0 } as const

/** MYLAPS FIA 3504 Grade 1 homologated cabinet (970 × 970 × 180 mm). */
export const FIA_LIGHT_PANEL = { width: 0.97, height: 0.97, depth: 0.18 } as const

/**
 * One F1 garage bay, Yas Marina class — the locked 1:1 standard for this kit.
 *
 * `pitch` is the façade module a run tiles on, and a bay fills all of it, so `door` is what sizes the
 * piers rather than the other way round: a 3.3 m Yas aperture in a 7.0 m module leaves a 1.85 m
 * half-pier each side, i.e. one 3.7 m column shared by neighbours.
 *
 * `head` is the clear aperture height at the curtain head, and it is what forces `fascia` down from
 * the old 1.2 m: under a 4.5 m roof deck, 3.0 m of door plus the 0.56 m shutter barrel above it leave
 * only ~0.9 m for the signage band.
 */
export const GARAGE = {
  pitch: 7.0,
  /** Interior clear width between the party walls (`pitch − 2 × wall`). */
  width: 6.68,
  /** Apron face to back wall. Yas main pits measure 20.5 m; rounded for kit math. */
  depth: 20.0,
  /** Roof deck. Only the coping and the roof plant sit above it. */
  height: 4.5,
  /** Clear shutter aperture width. */
  door: 3.3,
  /** Clear shutter aperture height, at the curtain head. */
  head: 3.0,
  fascia: 0.9,
  wall: 0.16,
} as const

/** FIA signalling envelope (WEC A7.6 grammar): ≤ 2.20 m high, 1.00 m deep. */
export const PIT_WALL = {
  depth: 1.0,
  height: 2.2,
  shelf: 1.1,
  glass: 1.0,
} as const

/** Deck must clear this kit's 5 m catch fence. */
export const SPECTATOR_BRIDGE = { deckHeight: 5.5, width: 2.4 } as const

/**
 * Single-lane service / spectator underpass at a Grade 1 circuit. Not a dual-carriageway highway
 * tunnel — that is a different typology (AASHTO 7.2–9 m curb to curb, 4.9 m vertical) and would be a
 * `lanes` config rather than a wider default.
 *
 * `width` / `height` are the **clear opening**, which is what `f1-tunnel-portal` exposes as config:
 * one 3.5 m service lane plus 0.25 m margins, under the DAUB / EU underpass clearance band of
 * 4.5–4.7 m so a service truck passes. `depth` is the bore run along Z, long enough that the far end
 * falls out of the key light and reads as a throat instead of a recess. `deck` is a live-load bridge
 * slab carrying the crossing road, not a lintel band.
 */
export const TUNNEL_PORTAL = {
  width: 4.0,
  height: 4.5,
  depth: 8.0,
  deck: 0.90,
  wall: 0.55,
} as const

/**
 * Circuit access stairs (FIA / EN 1090 galvanized flight).
 * Rise 180 mm / going 280 mm — 2R+G = 640 mm, inside the 550–700 mm band.
 * Deck height for an overpass defaults to SPECTATOR_BRIDGE.deckHeight so a
 * host can span the catch fence without a second height.
 */
export const STAIR_KINDS = ['flight', 'overpass'] as const
export type StairKind = (typeof STAIR_KINDS)[number]

export function isStairKind(value: string): value is StairKind {
  return (STAIR_KINDS as readonly string[]).includes(value)
}

export const STAIRS = {
  rise: 0.18,
  run: 0.28,
  nosing: 0.028,
  treadT: 0.04,
  stringer: 0.22,
  stringerT: 0.06,
  railH: 1.10,
  midH: 0.55,
  toe: 0.12,
  post: 0.048,
  landing: 1.20,
  grating: 8,
} as const

/**
 * FIA Appendix 5 podium (Sporting Regulations) + the 2026 F1-supplied dais
 * photographed at Albert Park (Wikimedia 028A8788 / 028A8821): camera-facing
 * P2 | P1 | P3, large numerals on the front face, glass retaining rail.
 * Walkway and flag slot are Appendix 5 minima, not invented.
 */
export const PODIUM = {
  p1: { height: 1.00, width: 1.20, depth: 1.00 },
  p2: { height: 0.70, width: 1.10, depth: 1.00 },
  p3: { height: 0.40, width: 1.10, depth: 1.00 },
  gap: 0.08,
  /** Appendix 5: winner's dais edge to retaining barrier ≥ 1.20 m. */
  walkway: 1.20,
  /** Appendix 5: space behind the structure for flat flags ≥ 0.50 m. */
  flagGap: 0.50,
  deck: 0.12,
  barrierH: 1.10,
  backdropH: 3.00,
  backdropT: 0.10,
} as const

/** P1 / P2 / P3 dais heights. Prefer `PODIUM.p1.height` in new code. */
export const PODIUM_HEIGHTS = [PODIUM.p1.height, PODIUM.p2.height, PODIUM.p3.height] as const

/** Timing line is a thin white stripe; ceremonial SF chequer uses 1 m tiles. */
export const START_FINISH = { timing: 0.15, chequer: 1.0 } as const

/** FIA yellow board, ~600–800 mm class. */
export const CIRCUIT_SIGN_PLATE = { width: 0.72, height: 0.56 } as const

/** Grade 1 race-control box (Silverstone RC is 950 m²; this is a compact tower). */
export const RACE_CONTROL = { width: 10, depth: 8, height: 14 } as const

/** One F1 garage / pit-wall bay along X. Hosts instance `count` of these. */
export const GARAGE_BAY_PITCH = GARAGE.pitch

export const CIRCUIT_SIGN_KINDS = [
  'DRS',
  'PIT ENTRY',
  'PIT EXIT',
  '80',
  'T-n',
  'SC',
  'VSC',
] as const
export type CircuitSignKind = (typeof CIRCUIT_SIGN_KINDS)[number]

export function isWallFit(value: string): value is WallFit {
  return (WALL_FITS as readonly string[]).includes(value)
}

export function isCircuitSignKind(value: string): value is CircuitSignKind {
  return (CIRCUIT_SIGN_KINDS as readonly string[]).includes(value)
}
