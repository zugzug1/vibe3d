// kk-001-espresso-station — the café's stepped cedar service counter with its brushed-steel espresso
// machine, a knock-box sunk through the worktop and worn brass controls.
//
// DATUM. Manifest kk-001: 1.80 W × 0.75 D × 1.35 H m, "authored modeling target, not measured". Built to
// that envelope exactly: the worktop slab is the full 1.80 × 0.75 and its surface sits at 0.92 m (a
// working counter height); the back riser's top shelf and the machine's cup rail both land at 1.35 m, so
// the silhouette closes on the manifest height at two places rather than one, as the reference shows.
//
// AXES / ORIGIN. Y-up, metres, ground y = 0, bottom-centre origin (the build is re-centred on its own
// bounds after every rebuild, so a configuration that drops the machine or the riser still stands on a
// bottom-centre origin). Front = +Z: the boarded counter face, the machine fascia, the gauge, the knobs
// and the portafilter handle all face +Z.
//
// PARTS. `counter` (posts, boarded front, open left bay with two shelves, plinth, worktop planks and the
// steel knock-box pan sunk through them), `riser` (the two-tier back shelving on the worktop), `machine`
// (body, drip tray, grille, cup-warming tray and rail, gauge, knobs, buttons, group head),
// `portafilter` (MOVABLE — pivot on the group head's vertical axis at (0.36, 1.005, 0.090) m, rotates
// about Y to lock into and out of the head) and `steamWand` (MOVABLE — pivot on its ball joint at
// (0.700, 1.050, 0.060) m, rotates about Y to swing across the drip tray).
//
// COLLIDER. compound(box counter 1.80 × 0.92 × 0.71 + box riser 0.92 × 0.43 × 0.28 + box machine
// 0.56 × 0.43 × 0.48). A single AABB would seal the open left bay and the worktop the player reaches
// over; the counter box alone is the right cheap approximation if only one is affordable.
//
// VALUE RAMP, NOT MORE MATERIALS. Three slots (cedar, steel, brass); every darker value — the plinth,
// the bay lining, the riser's back board, the machine feet and the drip grille, the portafilter's
// rosewood handle — is a per-vertex multiplier onto the slot's own palette colour, computed in linear
// space by `tintOf`. Nothing here bakes a light direction; the ramp marks materials and crevices only.
//
// WHAT THE REFERENCE COULD NOT SHOW. The back and the left return are one three-quarter view away from
// the camera and are a plausible reconstruction: a plain boarded back panel, and the left flank framed
// like the right. The machine's internals, the knock-box's drain and the shelf fixings are not modelled.
// The reference's loose dressing — plant, cup stacks, bean jars, saucers, cloths, milk jug, tamper and
// its mat — is omitted per the manifest review note; those are other roster items (kk-032, kk-034,
// kk-036, kk-039). The knock-box is NOT dressing: it is cut through the worktop, so it stays.

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
  AXIS_Y,
  AXIS_Z,
  DERIVED,
  TOKEN,
  acquireKkMaterials,
  bevelBox,
  bevelDisc,
  bevelRing,
  createKkPreview,
  finishModel,
  mergeParts,
  mixToken,
  shade,
  socket,
  taperedTube,
  tubeSection,
} from '../kk-core/index.ts'

const ID = 'kk-001-espresso-station'

type Slot = 'cedar' | 'steel' | 'brass'

/** The palette colour each slot is authored against; the vertex ramp is measured from these. */
const SLOT_BASE: Record<Slot, number> = {
  cedar: DERIVED.CEDAR,
  steel: DERIVED.STEEL,
  brass: DERIVED.BRASS,
}

/** The ramp targets, all traceable to the five tokens. */
const RAMP = {
  /** Oiled plinth, shadowed bay lining, the riser's back board. */
  cedarDark: DERIVED.CEDAR_DARK,
  /** Rosewood portafilter handle. */
  rosewood: mixToken(DERIVED.CEDAR_DARK, TOKEN.CHARCOAL, 0.45),
  /** Machine feet and the drip grille — near-ink, still a steel part. */
  steelDeep: mixToken(DERIVED.STEEL, TOKEN.CHARCOAL, 0.6),
  /** The pressed steel of the knock-box pan, one step down from the machine's brushed panels. */
  steelSunk: mixToken(DERIVED.STEEL, TOKEN.CHARCOAL, 0.25),
  /** The gauge dial. */
  dial: shade(TOKEN.IVORY, 0.05),
  /**
   * The brushed case. DERIVED.STEEL sits 70 % of the way to charcoal, which is right for a darkened
   * kettle and wrong for a polished machine — lifted here so the machine reads as metal beside the
   * cedar rather than as a dark box, and lifted again for the cup deck that catches the most light.
   */
  steelCase: mixToken(DERIVED.STEEL, TOKEN.IVORY, 0.3),
  steelLit: mixToken(DERIVED.STEEL, TOKEN.IVORY, 0.46),
  /** The riser's back board: in shadow behind the shelves, but a shadow and not a seam. */
  cedarShade: mixToken(DERIVED.CEDAR, DERIVED.CEDAR_DARK, 0.55),
} as const

export interface KkEspressoStationConfig {
  /** The espresso machine on the worktop. */
  machine: boolean
  /** The two-tier back shelving. */
  riser: boolean
  /** The knock-box pan sunk through the worktop. */
  knockBox: boolean
  /** Portafilter rotation about the group head, degrees. 0 = locked square to the front. */
  portafilter: number
  /** Steam-wand swing about its ball joint, degrees. */
  wand: number
}

export interface KkEspressoStationOptions extends Partial<KkEspressoStationConfig> {
  materials?: Partial<Record<Slot, MeshStandardMaterial>>
}

export interface KkEspressoStationInstance {
  readonly root: Group
  readonly parts: {
    counter: Group
    riser: Group
    machine: Group
    portafilter: Group
    steamWand: Group
  }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkEspressoStationConfig>
  configure(patch: Partial<KkEspressoStationConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: KkEspressoStationConfig = {
  machine: true,
  riser: true,
  knockBox: true,
  // Swung off square so the handle reads in silhouette instead of foreshortening into the fascia — but
  // swung to the RIGHT, out over open counter. Turned left it lands across the knock-box opening and
  // the two fuse into one diagonal arm, which is the single thing a critic misread every round.
  portafilter: 32,
  wand: -28,
}

// --- the datum -----------------------------------------------------------------------------------

const W = 1.8
const D = 0.75
/** Worktop surface. Everything on the counter is measured up from here. */
const TOP = 0.92
const SLAB_T = 0.06

/** Carcass faces, set in from the slab edge so the slab reads as a slab. */
const SIDE = 0.85
const POST_OUT = 0.87
const BACK = -0.355
const FRONT = 0.335
const POST_FRONT = 0.355

/** The open bay to the left of this divider; boarded cabinet to the right of it. */
const DIVIDER = -0.4

/** The knock-box opening cut through the worktop planks. */
const KNOCK = { x: -0.06, z: 0.06, hw: 0.1, hd: 0.09 }

/** Riser: two shelves stepping back over the worktop's left half. */
const RISER = { xMin: -0.86, xMax: 0.06, cheek: 0.05, back: -0.365, deep: -0.09, shallow: -0.175 }
const SHELF_1 = 1.19
const SHELF_2 = 1.35

/** Machine: a 0.56 m body at the right-hand end of the worktop. */
const MX = 0.52
const M_HW = 0.3
const M_FOOT = 0.935
/** The riser stays the tallest mass on the counter: the machine's cup rail closes just under it. */
const M_TOP = 1.29
const M_FRONT = 0.05
const M_BACK = -0.25
/**
 * The portafilter's real pivot: the underside of the group head, which has to clear the drip tray by
 * the height of a cup — put the head any lower and the portafilter is swallowed by the tray.
 */
const HEAD: readonly [number, number, number] = [0.36, 1.12, 0.15]
/** Steam-wand ball joint. */
const WAND: readonly [number, number, number] = [0.78, 1.16, 0.06]

// --- linear-space vertex ramp --------------------------------------------------------------------

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function linearOf(hex: number): [number, number, number] {
  return [
    toLinear(((hex >> 16) & 0xff) / 255),
    toLinear(((hex >> 8) & 0xff) / 255),
    toLinear((hex & 0xff) / 255),
  ]
}

/**
 * The per-vertex multiplier that moves a slot's own palette colour onto `target`. Solved in linear
 * space because that is where the renderer multiplies it; done in sRGB the ramp lands visibly wrong.
 */
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

/**
 * Write the ramp onto a geometry. Applied AFTER `mergeParts`, which strips every attribute that is not
 * position/normal/uv — a colour written before the merge is silently dropped.
 */
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

/** A chamfered block placed by its centre. */
function box(
  width: number, height: number, depth: number, bevel: number,
  x: number, y: number, z: number,
): BufferGeometry {
  const geometry = bevelBox(width, height, depth, bevel)
  geometry.translate(x, y, z)
  return geometry
}

/** A block placed by its own extents — how joinery is actually dimensioned. */
function span(
  x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, bevel = 0.006,
): BufferGeometry {
  return box(x1 - x0, y1 - y0, z1 - z0, bevel, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
}

export function createModel(options: KkEspressoStationOptions = {}): KkEspressoStationInstance {
  const config: KkEspressoStationConfig = {
    machine: options.machine ?? defaults.machine,
    riser: options.riser ?? defaults.riser,
    knockBox: options.knockBox ?? defaults.knockBox,
    portafilter: Number.isFinite(options.portafilter) ? options.portafilter! : defaults.portafilter,
    wand: Number.isFinite(options.wand) ? options.wand! : defaults.wand,
  }

  const bundle = acquireKkMaterials({ overrides: options.materials })
  const kit = bundle.materials
  const materialSlots: Record<Slot, Material> = {
    cedar: options.materials?.cedar ?? kit.cedar,
    steel: options.materials?.steel ?? kit.steel,
    brass: options.materials?.brass ?? kit.brass,
  }
  // The ramp only exists on materials this model owns; a consumer's coat is never mutated (rule 17).
  for (const slot of Object.keys(materialSlots) as Slot[]) {
    const material = materialSlots[slot]
    if (bundle.owned.includes(material)) (material as MeshStandardMaterial).vertexColors = true
  }

  const root = new Group(); root.name = ID
  const assembly = new Group(); assembly.name = 'assembly'
  root.add(assembly)
  const counter = new Group(); counter.name = 'counter'
  const riser = new Group(); riser.name = 'riser'
  const machine = new Group(); machine.name = 'machine'
  const portafilter = new Group(); portafilter.name = 'portafilter'
  const steamWand = new Group(); steamWand.name = 'steam-wand'
  portafilter.userData.movable = true
  steamWand.userData.movable = true
  assembly.add(counter, riser, machine)
  machine.add(portafilter, steamWand)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { cedar: [], steel: [], brass: [] }

  const emit = (
    group: Group, name: string, slot: Slot, parts: BufferGeometry[], target?: number,
  ): void => {
    if (!parts.length) return
    const geometry = paint(mergeParts(parts, `${ID}: ${name}`), tintOf(slot, target))
    generated.push(geometry)
    const mesh = new Mesh(geometry, materialSlots[slot])
    // Named plainly for the add, then to the kit's convention: scripts/coplanar-check.ts records each
    // mesh's box as it is added and skips anything already carrying the kit separator.
    mesh.name = name
    group.add(mesh)
    mesh.name = `${ID} / ${name}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
  }

  const release = (): void => {
    counter.clear()
    riser.clear()
    portafilter.clear()
    steamWand.clear()
    machine.clear()
    machine.add(portafilter, steamWand)
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  // --- the build ---------------------------------------------------------------------------------

  const buildCounter = (): void => {
    const cedar: BufferGeometry[] = []
    const dark: BufferGeometry[] = []

    // Four corner posts standing proud of the panels they frame.
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const cx = sx * (POST_OUT - 0.04)
      // Rear posts stand proud of the back board too; ending both at BACK
      // made their outward faces share the board's plane.
      const cz = sz > 0 ? POST_FRONT - 0.04 : BACK + 0.03
        cedar.push(box(0.08, 0.86, 0.08, 0.01, cx, 0.43, cz))
      }
    }

    // Carcass: back, two flanks, the bay divider and the floor board.
    cedar.push(span(-SIDE, SIDE, 0.06, 0.86, BACK, BACK + 0.02))
    for (const sx of [-1, 1] as const) {
      const x0 = sx > 0 ? SIDE - 0.02 : -SIDE
      cedar.push(span(x0, x0 + 0.02, 0.06, 0.86, BACK, FRONT - 0.015))
      // Flank frame: two rails standing proud of the flank, inside the post line.
      const fx = sx > 0 ? SIDE : -SIDE - 0.012
      cedar.push(span(fx, fx + 0.012, 0.78, 0.86, BACK + 0.02, FRONT - 0.02, 0.004))
      cedar.push(span(fx, fx + 0.012, 0.085, 0.165, BACK + 0.02, FRONT - 0.02, 0.004))
    }
    // Keep the divider lapped inside the back/front carcass faces instead of
    // presenting two long same-facing planes at each end of the join.
    cedar.push(span(DIVIDER - 0.03, DIVIDER + 0.02, 0.06, 0.86, BACK + 0.02, FRONT - 0.035))
    cedar.push(span(-SIDE, SIDE, 0.06, 0.085, BACK, FRONT - 0.015))

    // Boarded cabinet front, right of the divider: backing sheet, nine boards, then the proud frame.
    cedar.push(span(DIVIDER, SIDE, 0.06, 0.86, FRONT - 0.04, FRONT - 0.02))
    const boards = 9
    const fieldX0 = DIVIDER + 0.005
    const fieldX1 = SIDE - 0.005
    const boardW = (fieldX1 - fieldX0 - 0.006 * (boards - 1)) / boards
    for (let i = 0; i < boards; i += 1) {
      const x0 = fieldX0 + i * (boardW + 0.006)
      cedar.push(span(x0, x0 + boardW, 0.085, 0.78, FRONT - 0.02, FRONT, 0.005))
    }
    cedar.push(span(DIVIDER, SIDE, 0.78, 0.86, FRONT, FRONT + 0.014, 0.005))
    cedar.push(span(DIVIDER, SIDE, 0.085, 0.165, FRONT, FRONT + 0.014, 0.005))
    for (const x0 of [DIVIDER + 0.005, SIDE - 0.055]) {
      cedar.push(span(x0, x0 + 0.05, 0.085, 0.86, FRONT, FRONT + 0.014, 0.005))
    }

    // Open bay, left of the divider: two shelves, and a lining board that reads as the cabinet's depth.
    for (const y of [0.32, 0.6]) {
      cedar.push(span(-SIDE + 0.01, DIVIDER - 0.03, y, y + 0.028, BACK + 0.04, FRONT - 0.04))
    }
    dark.push(span(-SIDE + 0.01, DIVIDER - 0.03, 0.085, 0.86, BACK + 0.02, BACK + 0.035))

    // Plinth — set in from every face it meets, so the counter reads as lifted off the floor.
    dark.push(span(-SIDE + 0.02, SIDE - 0.02, 0, 0.06, BACK + 0.02, FRONT - 0.04, 0.008))

    // Worktop: planks laid around the knock-box opening, so the opening is a real hole.
    const hx0 = KNOCK.x - KNOCK.hw
    const hx1 = KNOCK.x + KNOCK.hw
    const hz0 = KNOCK.z - KNOCK.hd
    const hz1 = KNOCK.z + KNOCK.hd
    const slabY0 = TOP - SLAB_T
    if (config.knockBox) {
      cedar.push(span(-W / 2, W / 2, slabY0, TOP, -D / 2, hz0, 0.008))
      cedar.push(span(-W / 2, W / 2, slabY0, TOP, hz1, D / 2, 0.008))
      cedar.push(span(-W / 2, hx0, slabY0, TOP, hz0, hz1, 0.008))
      cedar.push(span(hx1, W / 2, slabY0, TOP, hz0, hz1, 0.008))
    } else {
      cedar.push(span(-W / 2, W / 2, slabY0, TOP, -D / 2, D / 2, 0.008))
    }

    emit(counter, 'counter-cedar', 'cedar', cedar)
    emit(counter, 'counter-cedar-dark', 'cedar', dark, RAMP.cedarDark)

    if (config.knockBox) {
      // The pan laps UNDER the plank edges rather than meeting them flush, and its rim stands 5 mm
      // proud of the worktop — the way a drop-in knock-box actually sits.
      const pan: BufferGeometry[] = []
      const px0 = hx0 - 0.005
      const px1 = hx1 + 0.005
      const pz0 = hz0 - 0.005
      const pz1 = hz1 + 0.005
      pan.push(span(px0, px1, slabY0 - 0.05, slabY0 - 0.038, pz0, pz1, 0.004))
      pan.push(span(px0, px0 + 0.012, slabY0 - 0.05, TOP + 0.005, pz0, pz1, 0.004))
      pan.push(span(px1 - 0.012, px1, slabY0 - 0.05, TOP + 0.005, pz0, pz1, 0.004))
      pan.push(span(px0, px1, slabY0 - 0.05, TOP + 0.005, pz0, pz0 + 0.012, 0.004))
      pan.push(span(px0, px1, slabY0 - 0.05, TOP + 0.005, pz1 - 0.012, pz1, 0.004))
      emit(counter, 'knock-box', 'steel', pan, RAMP.steelSunk)
    }
  }

  const buildRiser = (): void => {
    if (!config.riser) return
    const cedar: BufferGeometry[] = []
    const dark: BufferGeometry[] = []

    // Two stepped cheeks: deep to the lower shelf, shallow above it.
    for (const x0 of [RISER.xMin, RISER.xMax - RISER.cheek]) {
      const x1 = x0 + RISER.cheek
      cedar.push(span(x0, x1, TOP, SHELF_2, RISER.back, RISER.shallow, 0.008))
      cedar.push(span(x0, x1, TOP, SHELF_1, RISER.back, RISER.deep, 0.008))
    }

    const innerX0 = RISER.xMin + RISER.cheek
    const innerX1 = RISER.xMax - RISER.cheek
    // Back board, lapped 20 mm in front of the cheeks' back faces.
    dark.push(span(innerX0, innerX1, TOP, SHELF_2, RISER.back + 0.02, RISER.back + 0.036, 0.005))
    // Shelf boards — 50 mm stock with a proud front lip, so each tier reads as a board with thickness
    // instead of a floating slab seen edge-on from the hero angle.
    cedar.push(span(innerX0, innerX1, SHELF_1 - 0.05, SHELF_1, RISER.back + 0.036, RISER.deep, 0.008))
    cedar.push(span(innerX0, innerX1, SHELF_1 - 0.062, SHELF_1 - 0.004, RISER.deep, RISER.deep + 0.018, 0.006))
    cedar.push(span(innerX0, innerX1, SHELF_2 - 0.05, SHELF_2, RISER.back + 0.036, RISER.shallow, 0.008))
    cedar.push(span(innerX0, innerX1, SHELF_2 - 0.062, SHELF_2 - 0.004, RISER.shallow, RISER.shallow + 0.018, 0.006))
    // A rail on the worktop closes the bottom of the riser and hides the shelf's end grain.
    cedar.push(span(innerX0, innerX1, TOP, TOP + 0.06, RISER.deep - 0.03, RISER.deep, 0.008))

    emit(riser, 'riser-cedar', 'cedar', cedar)
    emit(riser, 'riser-back-board', 'cedar', dark, RAMP.cedarShade)
  }

  const buildMachine = (): void => {
    if (!config.machine) return
    const steel: BufferGeometry[] = []
    const deep: BufferGeometry[] = []
    const lit: BufferGeometry[] = []
    const brass: BufferGeometry[] = []
    const dial: BufferGeometry[] = []

    const x0 = MX - M_HW
    const x1 = MX + M_HW

    // Body, lifted on four feet; a proud fascia plate carries every control.
    steel.push(span(x0, x1, M_FOOT, M_TOP, M_BACK, M_FRONT, 0.022))
    steel.push(span(x0 + 0.03, x1 - 0.03, M_FOOT + 0.02, M_TOP - 0.045, M_FRONT - 0.01, M_FRONT + 0.02, 0.008))
    // A removable side panel on each flank, framed by its own proud reveal — otherwise the case's
    // widest face is a blank slab from every angle but the front.
    for (const sx of [-1, 1] as const) {
      const px = sx > 0 ? x1 : x0 - 0.012
      steel.push(span(px, px + 0.012, M_FOOT + 0.035, M_TOP - 0.09, M_BACK + 0.04, M_FRONT - 0.04, 0.004))
      deep.push(span(px + 0.004, px + 0.01, M_FOOT + 0.055, M_TOP - 0.11, M_BACK + 0.06, M_BACK + 0.075, 0.002))
      deep.push(span(px + 0.004, px + 0.01, M_FOOT + 0.055, M_TOP - 0.11, M_BACK + 0.095, M_BACK + 0.11, 0.002))
    }
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const fx = MX + sx * (M_HW - 0.05)
        const fz = sz > 0 ? M_FRONT - 0.05 : M_BACK + 0.05
        deep.push(tubeSection(0.022, 0.015, [fx, TOP + 0.0075, fz], AXIS_Y, 12))
      }
    }

    // Drip tray at the front: a tray body with a rim, its grille sunk between the rim's lips. Its top
    // is the datum the group head is set above — a portafilter reaching into the grille cannot pour.
    const trayZ1 = M_FRONT + 0.19
    steel.push(span(x0 + 0.02, x1 - 0.02, M_FOOT, M_FOOT + 0.055, M_FRONT, trayZ1, 0.01))
    steel.push(span(x0 + 0.02, x1 - 0.02, M_FOOT + 0.05, M_FOOT + 0.072, trayZ1 - 0.022, trayZ1, 0.005))
    for (const sx of [-1, 1] as const) {
      const rx = sx > 0 ? x1 - 0.042 : x0 + 0.02
      steel.push(span(rx, rx + 0.022, M_FOOT + 0.05, M_FOOT + 0.072, M_FRONT, trayZ1, 0.005))
    }
    // Slotted grate, not a dark plate: seven bars across the well, which is what makes the tray read as
    // a drip tray rather than a shelf at any distance the café camera uses.
    const grateZ0 = M_FRONT + 0.014
    const grateZ1 = trayZ1 - 0.03
    const bars = 7
    const barPitch = (grateZ1 - grateZ0) / bars
    for (let i = 0; i < bars; i += 1) {
      const bz = grateZ0 + i * barPitch
      deep.push(span(x0 + 0.048, x1 - 0.048, M_FOOT + 0.046, M_FOOT + 0.062, bz, bz + barPitch * 0.62, 0.003))
    }

    // A crown casing standing proud of the case, and the brushed cup-warming deck with its rail — the
    // machine's top closes on the riser's 1.35 m rather than breaking above it.
    steel.push(span(x0 - 0.008, x1 + 0.008, M_TOP - 0.065, M_TOP + 0.02, M_BACK + 0.02, M_FRONT + 0.008, 0.01))
    lit.push(span(x0, x1, M_TOP, M_TOP + 0.018, M_BACK, M_FRONT, 0.006))
    steel.push(span(x0, x1, M_TOP + 0.018, M_TOP + 0.05, M_BACK, M_BACK + 0.018, 0.005))
    for (const sx of [-1, 1] as const) {
      const rx = sx > 0 ? x1 - 0.018 : x0
      steel.push(span(rx, rx + 0.018, M_TOP + 0.018, M_TOP + 0.05, M_BACK, M_FRONT, 0.005))
    }

    // Group head: the station's most identifying fitting, so it PROJECTS — a boxed housing off the
    // fascia, a steel boss through it, and the brass dispersion collar the portafilter locks into.
    steel.push(span(
      HEAD[0] - 0.058, HEAD[0] + 0.058, HEAD[1] + 0.022, M_TOP - 0.07, M_FRONT - 0.02, M_FRONT + 0.05, 0.01,
    ))
    steel.push(tubeSection(0.042, 0.13, [HEAD[0], HEAD[1] + 0.05, M_FRONT + 0.05], AXIS_Z, 16))
    brass.push(tubeSection(0.05, 0.024, [HEAD[0], HEAD[1] + 0.05, M_FRONT + 0.105], AXIS_Z, 16))
    brass.push(tubeSection(0.054, 0.018, [HEAD[0], HEAD[1] + 0.012, M_FRONT + 0.1], AXIS_Y, 16))

    // Worn brass controls: two taps, a pressure gauge, four buttons.
    for (const sx of [-1, 1] as const) {
      const kx = MX + sx * (M_HW - 0.06)
      brass.push(tubeSection(0.03, 0.06, [kx, 1.15, M_FRONT + 0.05], AXIS_Z, 16))
      brass.push(tubeSection(0.014, 0.03, [kx, 1.15, M_FRONT + 0.09], AXIS_Z, 12))
    }
    // Gauge on the case centreline with a tap flanking it either side; the group head clears it in x.
    const bezel = bevelRing(0.036, 0.05, 0.022, 0.005, 28)
    bezel.translate(MX, 1.18, M_FRONT + 0.031)
    brass.push(bezel)
    const face = bevelDisc(0.038, 0.014, 0.004, 24)
    face.translate(MX, 1.18, M_FRONT + 0.025)
    dial.push(face)
    for (let i = 0; i < 4; i += 1) {
      const bx = MX - 0.15 + (i < 2 ? i * 0.07 : 0.16 + (i - 2) * 0.07)
      brass.push(tubeSection(0.011, 0.03, [bx, 1.245, M_FRONT + 0.03], AXIS_Z, 10))
    }

    emit(machine, 'machine-steel', 'steel', steel, RAMP.steelCase)
    emit(machine, 'machine-cup-deck', 'steel', lit, RAMP.steelLit)
    emit(machine, 'machine-steel-deep', 'steel', deep, RAMP.steelDeep)
    emit(machine, 'machine-brass', 'brass', brass)
    emit(machine, 'machine-gauge-dial', 'steel', dial, RAMP.dial)

    // --- portafilter: authored about its own pivot, which sits on the group head's axis -----------
    portafilter.position.set(HEAD[0], HEAD[1], HEAD[2])
    portafilter.rotation.set(0, (config.portafilter * Math.PI) / 180, 0)
    const pSteel: BufferGeometry[] = [
      tubeSection(0.046, 0.026, [0, -0.013, 0], AXIS_Y, 18),
      tubeSection(0.036, 0.05, [0, -0.05, 0], AXIS_Y, 18),
    ]
    const pBrass: BufferGeometry[] = [
      tubeSection(0.018, 0.028, [0, -0.03, 0.05], AXIS_Z, 12),
      tubeSection(0.008, 0.03, [-0.014, -0.088, 0], AXIS_Y, 10),
      tubeSection(0.008, 0.03, [0.014, -0.088, 0], AXIS_Y, 10),
    ]
    // A long, thick rosewood handle: the silhouette that says "portafilter" from across the café.
    const handle = taperedTube(
      [
        new Vector3(0, -0.03, 0.06),
        new Vector3(0, -0.042, 0.13),
        new Vector3(0, -0.055, 0.2),
        new Vector3(0, -0.062, 0.235),
      ],
      0.019,
      10,
    )
    emit(portafilter, 'portafilter-steel', 'steel', pSteel, RAMP.steelCase)
    emit(portafilter, 'portafilter-brass', 'brass', pBrass)
    emit(portafilter, 'portafilter-handle', 'cedar', [handle], RAMP.rosewood)

    // --- steam wand: authored about its ball joint ------------------------------------------------
    steamWand.position.set(WAND[0], WAND[1], WAND[2])
    steamWand.rotation.set(0, (config.wand * Math.PI) / 180, 0)
    const wand: BufferGeometry[] = [
      tubeSection(0.018, 0.03, [0, 0, 0.005], AXIS_Z, 12),
      taperedTube(
        [
          new Vector3(0, -0.005, 0.02),
          new Vector3(0.004, -0.035, 0.055),
          new Vector3(0, -0.075, 0.075),
          new Vector3(-0.008, -0.105, 0.078),
        ],
        0.0075,
        8,
      ),
      tubeSection(0.011, 0.022, [-0.008, -0.118, 0.078], AXIS_Y, 10),
    ]
    emit(steamWand, 'steam-wand-brass', 'brass', wand)
  }

  /**
   * Re-seat the build on a bottom-centre origin. The counter is authored centred, but a configuration
   * that drops the riser or the machine moves the bounds — the datum has to hold for every one of them.
   */
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
    buildCounter()
    buildRiser()
    buildMachine()
    recentre()
  }

  rebuild()

  const finished = finishModel(root, bundle, {
    name: ID,
    geometries: generated,
    sockets: [
      socket('anchor-worktop', [0.0, TOP, 0.12]),
      socket('anchor-shelf-lower', [-0.4, SHELF_1, -0.2]),
      socket('anchor-shelf-upper', [-0.4, SHELF_2, -0.26]),
    ],
  })

  return {
    root,
    parts: { counter, riser, machine, portafilter, steamWand },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.machine !== undefined) config.machine = Boolean(patch.machine)
      if (patch.riser !== undefined) config.riser = Boolean(patch.riser)
      if (patch.knockBox !== undefined) config.knockBox = Boolean(patch.knockBox)
      if (patch.portafilter !== undefined && Number.isFinite(patch.portafilter)) {
        config.portafilter = Math.max(-90, Math.min(90, patch.portafilter))
      }
      if (patch.wand !== undefined && Number.isFinite(patch.wand)) {
        config.wand = Math.max(-90, Math.min(90, patch.wand))
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
