// kk-011-cafe-table — a two-person café table: a plank-jointed cedar top with generously rounded corners
// carried on a shaped apron and four splayed, tapered legs.
//
// DATUM. Manifest kk-011: 0.80 W × 0.65 D × 0.72 H, "rounded rectangular cedar top and splayed legs".
// The TOP is built to those numbers exactly (0.80 × 0.65, surface at 0.72); the measured envelope is
// 0.811 × 0.657 because the splayed feet finish 5 mm outside the top's corner line, which is where the
// reference puts them — a café table is laid out from its top, and the feet reaching the same line is
// what lets two of them push together without the tops fouling.
//
// AXES / ORIGIN. Y-up, metres, ground y = 0, bottom-centre origin, front = +Z. The model is symmetric
// in X and Z, so "front" is a convention here rather than a feature; it matters only for the kit's
// shared preview yaw.
//
// CONSTRUCTION, and what the single three-quarter reference could not show.
//   · Top — four planks laid along X (the long axis), edge-jointed. The reference shows seam lines, not
//     gaps: each plank carries a 3.5 mm CHAMFER (one facet, not a roundover) on its arris and neighbours
//     lap 0.5 mm per side, so the seam is a 6 mm-wide, 3 mm-deep V and no two faces are ever coincident
//     (rule 9). A roundover was tried first and is the wrong tool: a tangent curve leaves the two planks
//     touching almost at full height, and the seam measured 0.7 mm deep — invisible to three successive
//     critics. A straight chamfer's crossing depth is simply (bevel − lap), so the seam is a number you
//     can set. The outer two planks carry the rounded corners; the rounded rectangle is clipped per band.
//   · Apron — four rails, outer faces set back 38 mm from the top's edge, their top 4 mm INSIDE the
//     slab, 85 mm deep so the top and the apron read as two stacked masses rather than one thick slab.
//     The bracket the reference shows at each leg is not a separate glued block: it is the rail's own
//     lower edge, which dips into a cove at each end. One part, one silhouette, no join to hide.
//   · Legs — square section tapering 48 → 27 mm, sheared outward 40 mm in X and 32 mm in Z over their
//     run. The shear (rather than a rotation) is how a splayed leg is really cut: the end grain stays
//     horizontal, so the foot sits flat on the floor and the head sits flat under the top.
//   · Hidden sides: the underside of the top, the inner faces of the apron and the leg heads are a
//     plausible reconstruction — the reference is a single elevated three-quarter view. They are modelled
//     as the simplest construction that would actually hold: through legs housed against the apron
//     corners, top screwed down from inside the frame (fixings not modelled, invisible in play).
//   · Art-direction corrections: none needed — the reference is buildable as drawn. No dressing to omit.
//     The reference's painted knots and ink contours are NOT modelled: the consumer applies its own
//     cel / ink pass, and this kit's materials bake no directional shading (kk-core/materials.ts).
//
// PARTS. `top` (4 planks merged to one mesh), `apron` (4 shaped rails, merged), `legs` (4, merged).
// No movable parts — a café table has none.
//
// COLLIDER. box. The compiled sidecar builds a real 284-triangle manifold hull off the visual meshes
// (no AABB fallback), but a consumer can use the plain box: a player can neither walk under the top nor
// get a foot between the legs at this scale.

import {
  BufferAttribute,
  ExtrudeGeometry,
  Group,
  Mesh,
  Shape,
  type BufferGeometry,
  type DataTexture,
  type Material,
} from 'three/webgpu'

import {
  acquireKkMaterials,
  bevelPrism,
  cedarGrainTexture,
  createKkPreview,
  creased,
  finishModel,
  mergeParts,
} from '../kk-core/index.ts'

const ID = 'kk-011-cafe-table'

type Slot = 'cedar' | 'cedarDark'

export interface KkCafeTableConfig {
  /** Planks in the top, laid along X. 3–6; the reference reads as four. */
  planks: number
  /** How far each foot travels outward from its head, in metres (0 = straight legs). */
  splay: number
}

export interface KkCafeTableOptions extends Partial<KkCafeTableConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface KkCafeTableInstance {
  readonly root: Group
  readonly parts: { top: Group; apron: Group; legs: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkCafeTableConfig>
  configure(patch: Partial<KkCafeTableConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: KkCafeTableConfig = { planks: 4, splay: 0.04 }

// --- the datum, in metres ----------------------------------------------------------------------------

const W = 0.8
const D = 0.65
const H = 0.72

/** Top slab. */
const TOP_T = 0.03
const TOP_UNDER = H - TOP_T
const CORNER_R = 0.165
/** Chamfer on every plank arris; also the width of the seam groove between two planks. */
const PLANK_BEVEL = 0.0035
/** Plank bands overlap by this much per side, so a seam is an interpenetration and never a shared face. */
const PLANK_LAP = 0.0005

/** Apron. Rails are set back from the top's straight edges and buried 4 mm up into the slab. */
const APRON_SETBACK = 0.038
const RAIL_T = 0.02
const RAIL_H = 0.085
const RAIL_TOP = TOP_UNDER + 0.004
/** Rail centre planes, placed so each rail's OUTER face lands exactly on the setback. */
const RAIL_OUT_X = W / 2 - APRON_SETBACK - RAIL_T / 2
const RAIL_OUT_Z = D / 2 - APRON_SETBACK - RAIL_T / 2
/** The cove at each rail end that reads as a corner bracket. */
const BRACKET_DROP = 0.042
const BRACKET_RUN = 0.135

/** Legs. */
const LEG_TOP = 0.048
const LEG_FOOT = 0.027
const LEG_BEVEL = 0.005
/** Leg heads seat against the slab underside instead of rising 20 mm into its visible edge. */
const LEG_HEAD_Y = TOP_UNDER
/** Pull the heads beneath the tabletop's overhang so the stance reads as splayed support, not vertical edge trim. */
const LEG_HEAD_INSET = 0.02
const LEG_X = RAIL_OUT_X - LEG_HEAD_INSET
const LEG_Z = RAIL_OUT_Z - LEG_HEAD_INSET
/** Splay in Z is scaled from the X splay by the aspect, so the leg rakes along the table's diagonal. */
const SPLAY_Z_RATIO = D / W

const ARC_SEGMENTS = 8

// --- outline helpers ---------------------------------------------------------------------------------

type Pt = readonly [number, number]

/** The top's plan: a rounded rectangle in XY (y = the table's Z), centred on the origin. */
function roundedRectOutline(width: number, depth: number, radius: number, seg: number): Pt[] {
  const hw = width / 2
  const hd = depth / 2
  const r = Math.min(radius, hw, hd)
  const centres: Pt[] = [[hw - r, -hd + r], [hw - r, hd - r], [-hw + r, hd - r], [-hw + r, -hd + r]]
  const start = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]
  const out: Pt[] = []
  centres.forEach(([cx, cy], corner) => {
    for (let i = 0; i <= seg; i++) {
      const a = start[corner]! + (i / seg) * (Math.PI / 2)
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
  })
  return out
}

/** Sutherland–Hodgman clip of a convex outline against `y >= lo` and `y <= hi`. */
function clipBand(outline: readonly Pt[], lo: number, hi: number): Pt[] {
  const clip = (poly: readonly Pt[], keep: (p: Pt) => number): Pt[] => {
    const out: Pt[] = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % poly.length]!
      const da = keep(a)
      const db = keep(b)
      if (da >= 0) out.push(a)
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db)
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
      }
    }
    return out
  }
  return clip(clip(outline, (p) => p[1] - lo), (p) => hi - p[1])
}

/**
 * One apron rail in its own plane: `length` along X, `RAIL_H` tall, with a cove at each end that reads
 * as the corner bracket. Counter-clockwise, so ExtrudeGeometry keeps the front cap facing +Z.
 */
function railOutline(length: number): Pt[] {
  const hl = length / 2
  const top = RAIL_H / 2
  const bottom = -RAIL_H / 2
  const heel = bottom - BRACKET_DROP
  const out: Pt[] = []
  // Left cove: from the heel up into the straight lower edge.
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const a = Math.PI - (i / ARC_SEGMENTS) * (Math.PI / 2)
    out.push([-hl + BRACKET_RUN + BRACKET_RUN * Math.cos(a), heel + BRACKET_DROP * Math.sin(a)])
  }
  // Right cove: back down to the heel.
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const a = (Math.PI / 2) * (1 - i / ARC_SEGMENTS)
    out.push([hl - BRACKET_RUN + BRACKET_RUN * Math.cos(a), heel + BRACKET_DROP * Math.sin(a)])
  }
  out.push([hl, top], [-hl, top])
  return out
}

// --- geometry helpers --------------------------------------------------------------------------------

/**
 * A prism with a real BULLNOSE rather than a single chamfer facet: `segments` bevel rings, so the top
 * arris of a plank rolls over instead of cutting. `bevelPrism` in the core is a one-facet chamfer and
 * pre-insets its outline to preserve extents; a bullnose wants the opposite — the outline IS the widest
 * section, and the flat top face sits `bevel` inside it, which is how a table edge is actually worked.
 */
function bullnosePrism(
  outline: readonly Pt[], depth: number, bevel: number, segments: number,
): BufferGeometry {
  const shape = new Shape()
  outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
  shape.closePath()
  const geo = new ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, depth - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: segments,
    steps: 1,
    curveSegments: 1,
  })
  geo.translate(0, 0, -(depth / 2 - bevel))
  return creased(geo, 50)
}

/** Rewrite a geometry's UVs from its own positions. Used where the extruder's defaults run cross-grain. */
function setUv(geometry: BufferGeometry, u: (x: number, y: number, z: number) => number,
  v: (x: number, y: number, z: number) => number): BufferGeometry {
  const pos = geometry.getAttribute('position')
  const uvs = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    uvs[i * 2] = u(x, y, z)
    uvs[i * 2 + 1] = v(x, y, z)
  }
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  return geometry
}

/**
 * One splayed leg. The prism is extruded along +Z, laid down onto +Y, then tapered and SHEARED outward
 * as it descends — which keeps both end cuts horizontal, so the foot sits flat and the head beds flat
 * under the top. `sx`/`sz` are the corner signs.
 */
function legGeometry(sx: number, sz: number, splay: number): BufferGeometry {
  const half = LEG_TOP / 2
  const geo = bevelPrism([[-half, -half], [half, -half], [half, half], [-half, half]],
    LEG_HEAD_Y, LEG_BEVEL)
  geo.rotateX(Math.PI / 2)
  const pos = geo.getAttribute('position')
  const shrink = LEG_FOOT / LEG_TOP
  const splayZ = splay * SPLAY_Z_RATIO
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + LEG_HEAD_Y / 2
    const t = Math.min(1, Math.max(0, 1 - y / LEG_HEAD_Y))
    const k = 1 + (shrink - 1) * t ** 0.72
    pos.setXYZ(
      i,
      pos.getX(i) * k + sx * (LEG_X + splay * t),
      y,
      pos.getZ(i) * k + sz * (LEG_Z + splayZ * t),
    )
  }
  pos.needsUpdate = true
  // Grain runs down the leg: V (the texture's band axis) has to vary ACROSS it, not along it.
  return setUv(geo, (_x, y) => y, (x, _y, z) => (x * sx + z * sz) * 2)
}

// --- model -----------------------------------------------------------------------------------------

export function createModel(options: KkCafeTableOptions = {}): KkCafeTableInstance {
  const config: KkCafeTableConfig = {
    planks: Math.min(6, Math.max(3, Math.round(options.planks ?? defaults.planks))),
    splay: Math.min(0.09, Math.max(0, options.splay ?? defaults.splay)),
  }

  const bundle = acquireKkMaterials()
  const kit = bundle.materials
  const materialSlots: Record<Slot, Material> = {
    cedar: options.materials?.cedar ?? kit.cedar,
    cedarDark: options.materials?.cedarDark ?? kit.cedarDark,
  }

  // Softened cedar is a broad, near-flat surface here — 0.8 m of tabletop is the model's hero face, and
  // a flat colour reads as plastic at café range. One shared 256 px grain map, never applied over a
  // material the consumer handed in (rule 17).
  let grain: DataTexture | undefined
  const ownsGrain = options.materials?.cedar === undefined || options.materials?.cedarDark === undefined
  if (ownsGrain) {
    grain = cedarGrainTexture(256)
    grain.repeat.set(1.6, 1.6)
    if (options.materials?.cedar === undefined) kit.cedar.map = grain
    if (options.materials?.cedarDark === undefined) kit.cedarDark.map = grain
  }

  const root = new Group(); root.name = ID
  const top = new Group(); top.name = 'top'
  const apron = new Group(); apron.name = 'apron'
  const legs = new Group(); legs.name = 'legs'
  root.add(top, apron, legs)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { cedar: [], cedarDark: [] }

  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, materialSlots[slot])
    mesh.name = `${ID} / ${name}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const release = (): void => {
    top.clear(); apron.clear(); legs.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    meshesBySlot.cedar.length = 0
    meshesBySlot.cedarDark.length = 0
  }

  const rebuild = (): void => {
    release()

    // Top — the rounded rectangle clipped into plank bands, each band centred before it is chamfered so
    // the extruder's inset stays symmetric about the plank rather than about the table.
    const plan = roundedRectOutline(W, D, CORNER_R, ARC_SEGMENTS)
    const band = D / config.planks
    const planks: BufferGeometry[] = []
    for (let i = 0; i < config.planks; i++) {
      const lo = -D / 2 + i * band
      const hi = lo + band
      const centre = (lo + hi) / 2
      const outline = clipBand(plan, lo - (i > 0 ? PLANK_LAP : 0),
        hi + (i < config.planks - 1 ? PLANK_LAP : 0))
      if (outline.length < 3) continue
      const geo = bullnosePrism(outline.map(([x, y]) => [x, y - centre] as Pt), TOP_T, PLANK_BEVEL, 1)
      geo.rotateX(Math.PI / 2)
      geo.translate(0, TOP_UNDER + TOP_T / 2, centre)
      planks.push(geo)
    }
    // World-plan UVs, so each plank samples a different run of the grain instead of four identical ones.
    const slab = setUv(mergeParts(planks, `${ID}: top`), (x) => x, (_x, _y, z) => z)
    emit('cedar', slab, top, 'top-planks')

    // Apron — two rails along X, two along Z, overlapping at the corners where the legs bury them.
    const rails: BufferGeometry[] = []
    for (const sz of [-1, 1] as const) {
      const geo = bevelPrism(railOutline(RAIL_OUT_X * 2), RAIL_T, 0.004)
      geo.translate(0, RAIL_TOP - RAIL_H / 2, sz * RAIL_OUT_Z)
      rails.push(geo)
    }
    for (const sx of [-1, 1] as const) {
      const geo = bevelPrism(railOutline(RAIL_OUT_Z * 2), RAIL_T, 0.004)
      geo.rotateY(Math.PI / 2)
      geo.translate(sx * RAIL_OUT_X, RAIL_TOP - RAIL_H / 2, 0)
      rails.push(geo)
    }
    emit('cedarDark', mergeParts(rails, `${ID}: apron`), apron, 'apron-rails')

    const posts: BufferGeometry[] = []
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) posts.push(legGeometry(sx, sz, config.splay))
    }
    emit('cedar', mergeParts(posts, `${ID}: legs`), legs, 'legs')
  }

  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated })

  return {
    root,
    parts: { top, apron, legs },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.planks !== undefined) {
        config.planks = Math.min(6, Math.max(3, Math.round(patch.planks)))
      }
      if (patch.splay !== undefined) config.splay = Math.min(0.09, Math.max(0, patch.splay))
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      finished.dispose()
      grain?.dispose()
      grain = undefined
    },
  }
}

/**
 * Close-up preview. `yaw`/`pitch` are FORWARDED, which the contract's one-liner does not do — and that
 * omission is what makes an 8-view QA sheet worthless: `scripts/qa-sheet.mjs` orbits by generating a
 * module that calls `createPreview({ yaw, pitch })`, so a `createPreview({ aspect })` that destructures
 * only `aspect` silently renders all eight panels from the default angle.
 */
export function createPreview(
  options: { aspect: number; time?: number; yaw?: number; pitch?: number },
) {
  return createKkPreview(createModel(), {
    aspect: options.aspect, yaw: options.yaw, pitch: options.pitch,
  })
}

export function createCafePreview({ aspect }: { aspect: number; time?: number }) {
  return createKkPreview(createModel(), { aspect, framing: 'cafe' })
}
