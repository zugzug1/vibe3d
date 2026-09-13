// kk-008-shoji-folding-screen — three cedar-framed shoji leaves on iron strap hinges, kumiko lattice in
// the plane of the frame with a single washi sheet lapped onto its back.
//
// DATUM. Manifest kk-008: 1.80 W × 0.45 D × 1.70 H m. Height and leaf are direct: each leaf is
// 0.72 × 1.70 m. Width and depth are NOT independent of each other — they are the same zigzag measured
// two ways, so the fold angle is SOLVED, not chosen: with three 0.72 m leaves, depth 0.45 m needs
// sin θ = 0.45 / 0.72 → θ = 38.7°, which puts the span at 0.72 + 2 × 0.72 cos θ = 1.84 m. That is the
// manifest's 1.80 within 3 %, so the declared W and D are consistent with each other and with a 0.72 m
// leaf; `fold` is exposed as config and every other angle trades one against the other.
//
// AXES / ORIGIN. Y-up, metres, ground y = 0, bottom-centre origin (the assembly is re-centred on its own
// bounds after every rebuild, because changing `fold` moves the bounds in both X and Z). Front = +Z: the
// centre leaf faces +Z and both wings fold forward, so all three lattice faces are seen from the front.
// This is a FLOOR-STANDING object — no attachment pivot.
//
// PARTS. `panelLeft` and `panelRight` are MOVABLE, each on its real hinge axis — the vertical line at
// the centre leaf's own edge, x = ∓0.36 m, z = 0 — and each rotates about Y; `configure({ fold })`
// drives both symmetrically. `panelCentre` is the anchor leaf and carries the knuckles.
//
// COLLIDER. compound(box per leaf, 0.72 × 1.70 × 0.035, each on its leaf's transform) — three thin
// boxes. An AABB over the zigzag would claim the 0.45 × 1.80 m of floor a player walks through.
//
// CONSTRUCTION, AND WHERE IT CORRECTS THE REFERENCE. Kumiko sits IN the plane of the frame with the
// washi lapped onto the frame's back rebate — the way a shoji is actually made. The reference paints the
// lattice proud of the frame face, which would leave the paper unsupported. The reference's hinges are
// surface straps on the front face, which cannot fold flat; they are kept (they are the piece's
// silhouette tell) with the knuckle on the panel's own pivot axis, so the leaves stay correct at every
// fold angle and the strap reads as a strap. The shaped foot under each apron is a plain reveal between
// the stiles rather than the reference's cyma curve.
//
// WHAT THE REFERENCE COULD NOT SHOW. The reference is one three-quarter view on a transparent backdrop;
// the backs of the leaves are a plausible reconstruction — plain washi over the frame's back rebate, no
// second lattice. Paper is the one place a flat colour visibly fails, so `washiFibreTexture(256)` rides
// the washi slot; everything else is flat palette plus the vertex value ramp.

import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  AXIS_Y,
  DERIVED,
  TOKEN,
  acquireKkMaterials,
  bevelBox,
  createKkPreview,
  finishModel,
  mergeParts,
  mixToken,
  socket,
  tubeSection,
  washiFibreTexture,
} from '../kk-core/index.ts'

const ID = 'kk-008-shoji-folding-screen'

type Slot = 'cedar' | 'washi' | 'iron'

const SLOT_BASE: Record<Slot, number> = {
  cedar: DERIVED.CEDAR,
  washi: DERIVED.WASHI,
  iron: DERIVED.INK,
}

const TONE = {
  /** Apron and bottom rail: the part that takes boot scuffs and sits out of the light. */
  cedarDark: DERIVED.CEDAR_DARK,
  /** Kumiko: milled from the same cedar, one step lighter because it is freshly planed. */
  kumiko: mixToken(DERIVED.CEDAR, TOKEN.IVORY, 0.22),
} as const

export interface KkShojiScreenConfig {
  /** Fold of each wing away from the centre leaf, degrees. 0 = flat; 38.7 = the manifest footprint. */
  fold: number
  /** Kumiko light squares across one leaf. */
  cols: number
  /** Kumiko light squares up one leaf. */
  rows: number
}

export interface KkShojiScreenOptions extends Partial<KkShojiScreenConfig> {
  materials?: Partial<Record<Slot, MeshStandardMaterial>>
}

export interface KkShojiScreenInstance {
  readonly root: Group
  readonly parts: { panelLeft: Group; panelCentre: Group; panelRight: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkShojiScreenConfig>
  configure(patch: Partial<KkShojiScreenConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: KkShojiScreenConfig = { fold: 38.7, cols: 3, rows: 6 }

// --- the datum -----------------------------------------------------------------------------------

const LEAF_W = 0.72
const LEAF_H = 1.7
const LEAF_T = 0.035
/** Stile and rail stock. */
const STILE = 0.055
const TOP_RAIL = 0.075
/** The solid apron at the foot, and the reveal beneath it that makes the two feet. */
const APRON_TOP = 0.28
const APRON_BOTTOM = 0.055
const MID_RAIL = 0.05
/**
 * Kumiko stock. Set almost flush with the frame's front face and standing 24 mm clear of the paper
 * behind it: the shadow line the grid throws onto the washi is the piece's whole visual signature, and
 * a lattice sunk into the frame's thickness loses it at every angle but dead-on.
 */
const KUMIKO_W = 0.022
const KUMIKO_T = 0.024
const KUMIKO_Z1 = LEAF_T / 2 - 0.003
/** Washi lapped into the frame's back rebate — one layer, never two. */
const PAPER_Z0 = -LEAF_T / 2 + 0.002
const PAPER_T = 0.003

/** The light opening, in leaf-local coordinates. */
const OPEN_X0 = STILE
const OPEN_X1 = LEAF_W - STILE
const OPEN_Y0 = APRON_TOP + MID_RAIL
const OPEN_Y1 = LEAF_H - TOP_RAIL

const HINGE_Y = [0.42, 1.4] as const

/**
 * The left wing stands this much further round than the right. A screen is set by hand, never by
 * protractor, and two leaves at one identical angle is the mirror modelling rule 3 asks to be broken —
 * it also stops the two wings presenting one shared bounding plane to the coincidence check.
 */
const FOLD_SKEW_DEG = 3.2

// --- linear-space vertex ramp --------------------------------------------------------------------

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function linearOf(hex: number): [number, number, number] {
  return [
    toLinear(((hex >> 16) & 0xff) / 255),
    toLinear(((hex >> 8) & 0xff) / 255),
    toLinear((hex & 0xff) / 255),
  ]
}

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

/** A member dimensioned by its own extents — how joinery is cut. */
function span(
  x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, bevel = 0.004,
): BufferGeometry {
  const geometry = bevelBox(x1 - x0, y1 - y0, z1 - z0, bevel)
  geometry.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return geometry
}

export function createModel(options: KkShojiScreenOptions = {}): KkShojiScreenInstance {
  const config: KkShojiScreenConfig = {
    fold: Number.isFinite(options.fold) ? options.fold! : defaults.fold,
    cols: Math.max(1, Math.round(options.cols ?? defaults.cols)),
    rows: Math.max(1, Math.round(options.rows ?? defaults.rows)),
  }

  const bundle = acquireKkMaterials({ overrides: options.materials })
  const kit = bundle.materials
  const materialSlots: Record<Slot, Material> = {
    cedar: options.materials?.cedar ?? kit.cedar,
    washi: options.materials?.washi ?? kit.washi,
    iron: options.materials?.iron ?? kit.ink,
  }

  // Paper is the one surface in this piece a flat colour cannot carry: the fibre is what separates
  // washi from card. 256 px, tiled — well inside the kit's 1024 ceiling.
  const ownedTextures: DataTexture[] = []
  const washiMaterial = materialSlots.washi
  if (bundle.owned.includes(washiMaterial) && washiMaterial instanceof MeshStandardMaterial) {
    const fibre = washiFibreTexture(256)
    fibre.repeat.set(4, 8)
    washiMaterial.map = fibre
    washiMaterial.needsUpdate = true
    ownedTextures.push(fibre)
  }
  for (const slot of Object.keys(materialSlots) as Slot[]) {
    const material = materialSlots[slot]
    if (bundle.owned.includes(material)) (material as MeshStandardMaterial).vertexColors = true
  }

  const root = new Group(); root.name = ID
  const assembly = new Group(); assembly.name = 'assembly'
  root.add(assembly)
  const panelLeft = new Group(); panelLeft.name = 'panel-left'
  const panelCentre = new Group(); panelCentre.name = 'panel-centre'
  const panelRight = new Group(); panelRight.name = 'panel-right'
  panelLeft.userData.movable = true
  panelRight.userData.movable = true
  // Each leaf group SITS ON its own hinge axis and its built fold is baked into its geometry, so a
  // consumer turning a wing group about Y folds it further about the true hinge line. Baking rather
  // than leaving the fold on the group transform is also what keeps the three leaves distinguishable
  // to scripts/coplanar-check.ts, which measures each mesh before it has a parent.
  assembly.add(panelCentre, panelLeft, panelRight)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { cedar: [], washi: [], iron: [] }

  const emit = (
    group: Group, name: string, slot: Slot, parts: BufferGeometry[], target?: number,
  ): void => {
    if (!parts.length) return
    const geometry = paint(mergeParts(parts, `${ID}: ${name}`), tintOf(slot, target))
    generated.push(geometry)
    const mesh = new Mesh(geometry, materialSlots[slot])
    // Plain name for the add, then the kit convention: scripts/coplanar-check.ts records each mesh's
    // box as it is added and skips anything already carrying the kit separator.
    mesh.name = name
    group.add(mesh)
    mesh.name = `${ID} / ${name}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
  }

  const release = (): void => {
    for (const group of [panelLeft, panelCentre, panelRight]) group.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  /**
   * One leaf, authored in its own frame: x = 0 at the hinge edge, +x across the leaf, y up from the
   * floor, z through the thickness — then turned by `yaw` about that hinge before it is emitted.
   * `tag` disambiguates the merge label.
   */
  const buildLeaf = (group: Group, tag: string, yaw: number, dir: 1 | -1): void => {
    const turn = (parts: BufferGeometry[]): BufferGeometry[] => {
      if (yaw !== 0) for (const part of parts) part.rotateY(yaw)
      return parts
    }
    // `dir` runs the leaf out of its hinge toward −x instead of +x. The screen folds as a C, not a
    // zigzag — all three lattice faces are on the concave side — and no rotation about Y can put a
    // leaf to the left while keeping its front on that side, so the left leaf is authored mirrored.
    const sp = (
      x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, bevel?: number,
    ): BufferGeometry => span(
      Math.min(dir * x0, dir * x1), Math.max(dir * x0, dir * x1), y0, y1, z0, z1, bevel,
    )
    const frame: BufferGeometry[] = []
    const apron: BufferGeometry[] = []
    const kumiko: BufferGeometry[] = []
    const z0 = -LEAF_T / 2
    const z1 = LEAF_T / 2

    // Stiles full height, top rail, mid rail, and the solid apron between the two feet.
    frame.push(sp(0, STILE, 0, LEAF_H, z0, z1, 0.006))
    frame.push(sp(LEAF_W - STILE, LEAF_W, 0, LEAF_H, z0, z1, 0.006))
    frame.push(sp(OPEN_X0, OPEN_X1, LEAF_H - TOP_RAIL, LEAF_H, z0, z1, 0.006))
    frame.push(sp(OPEN_X0, OPEN_X1, APRON_TOP, OPEN_Y0, z0, z1, 0.006))
    apron.push(sp(OPEN_X0, OPEN_X1, APRON_BOTTOM, APRON_TOP, z0 + 0.006, z1 - 0.006, 0.005))

    // Kumiko grid, all but flush with the frame's front face and standing clear of the paper.
    const kz1 = KUMIKO_Z1
    const kz0 = kz1 - KUMIKO_T
    for (let i = 1; i < config.cols; i += 1) {
      const cx = OPEN_X0 + (i / config.cols) * (OPEN_X1 - OPEN_X0)
      kumiko.push(sp(cx - KUMIKO_W / 2, cx + KUMIKO_W / 2, OPEN_Y0, OPEN_Y1, kz0, kz1, 0.003))
    }
    for (let j = 1; j < config.rows; j += 1) {
      const cy = OPEN_Y0 + (j / config.rows) * (OPEN_Y1 - OPEN_Y0)
      kumiko.push(sp(OPEN_X0, OPEN_X1, cy - KUMIKO_W / 2, cy + KUMIKO_W / 2, kz0, kz1, 0.003))
    }

    emit(group, `${tag}-frame`, 'cedar', turn(frame))
    emit(group, `${tag}-apron`, 'cedar', turn(apron), TONE.cedarDark)
    emit(group, `${tag}-kumiko`, 'cedar', turn(kumiko), TONE.kumiko)

    // One washi sheet, lapped 10 mm onto the frame's back rebate. Single layer, by kit contract.
    const paper = sp(
      OPEN_X0 - 0.01, OPEN_X1 + 0.01, OPEN_Y0 - 0.01, OPEN_Y1 + 0.01,
      PAPER_Z0, PAPER_Z0 + PAPER_T, 0.001,
    )
    emit(group, `${tag}-washi`, 'washi', turn([paper]))
  }

  /** A surface strap hinge leaf on the front face at leaf-local `x`, turned with its leaf. */
  const hingeLeaves = (
    group: Group, tag: string, x: number, reach: number, yaw: number,
  ): void => {
    const parts: BufferGeometry[] = []
    for (const y of HINGE_Y) {
      const plate = span(
        Math.min(x, x + reach), Math.max(x, x + reach),
        y - 0.035, y + 0.035, LEAF_T / 2 - 0.004, LEAF_T / 2 + 0.006, 0.002,
      )
      if (yaw !== 0) plate.rotateY(yaw)
      parts.push(plate)
    }
    emit(group, `${tag}-hinge-leaves`, 'iron', parts)
  }

  const build = (): void => {
    const theta = (config.fold * Math.PI) / 180
    const thetaLeft = ((config.fold + FOLD_SKEW_DEG) * Math.PI) / 180

    // Centre leaf: the anchor, spanning its own width about the model's middle.
    panelCentre.position.set(-LEAF_W / 2, 0, 0)
    buildLeaf(panelCentre, 'centre', 0, 1)
    hingeLeaves(panelCentre, 'centre-left', 0.006, 0.075, 0)
    hingeLeaves(panelCentre, 'centre-right', LEAF_W - 0.006, -0.075, 0)
    // Knuckles ride the pivot axes themselves, so each joint stays a joint at any fold angle.
    const knuckles: BufferGeometry[] = []
    for (const x of [0, LEAF_W]) {
      for (const y of HINGE_Y) {
        knuckles.push(tubeSection(0.012, 0.078, [x, y, LEAF_T / 2 + 0.004], AXIS_Y, 10))
      }
    }
    emit(panelCentre, 'centre-hinge-knuckles', 'iron', knuckles)

    // Wings: each group sits ON its hinge axis; both open toward +Z.
    panelLeft.position.set(-LEAF_W / 2, 0, 0)
    panelRight.position.set(LEAF_W / 2, 0, 0)
    buildLeaf(panelLeft, 'left', thetaLeft, -1)
    buildLeaf(panelRight, 'right', -theta, 1)
    hingeLeaves(panelLeft, 'left', -0.006, -0.075, thetaLeft)
    hingeLeaves(panelRight, 'right', 0.006, 0.075, -theta)
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
    build()
    recentre()
  }

  rebuild()

  const finished = finishModel(root, bundle, {
    name: ID,
    geometries: generated,
    sockets: [socket('anchor-hinge-left', [-LEAF_W / 2, 0, 0]), socket('anchor-hinge-right', [LEAF_W / 2, 0, 0])],
  })

  return {
    root,
    parts: { panelLeft, panelCentre, panelRight },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.fold !== undefined && Number.isFinite(patch.fold)) {
        config.fold = Math.max(0, Math.min(85, patch.fold))
      }
      if (patch.cols !== undefined && Number.isFinite(patch.cols)) {
        config.cols = Math.max(1, Math.min(6, Math.round(patch.cols)))
      }
      if (patch.rows !== undefined && Number.isFinite(patch.rows)) {
        config.rows = Math.max(1, Math.min(10, Math.round(patch.rows)))
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
      for (const texture of ownedTextures) texture.dispose()
      ownedTextures.length = 0
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
