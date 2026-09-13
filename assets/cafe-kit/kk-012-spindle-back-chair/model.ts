// kk-012-spindle-back-chair — a bow-back Windsor side chair: a saddle-plank seat, a steam-bent hoop, five
// turned spindles and four raked turned legs braced by an H-stretcher.
//
// DATUM. Manifest kk-012: 0.45 W × 0.48 D × 0.85 H, "curved timber back and worn seat". Measured
// envelope is 0.450 × 0.480 × 0.850 — exact. The three numbers are taken literally and each is carried
// by a different member: the splayed feet own the width, the raked bow's back face owns the depth
// against the seat's nose, and the crown of the bow owns the height.
// Seat height 0.445 — the one number the manifest does not give and the one the player's eye checks
// against the 0.72 m table (kk-011): 0.275 m of clearance is a chair you can actually sit at.
//
// AXES / ORIGIN. Y-up, metres, ground y = 0, bottom-centre origin, front = +Z (you sit facing +Z;
// the bow is at −Z). No attachment pivot — this stands on the floor.
//
// CONSTRUCTION, and what the single three-quarter reference could not show.
//   · Seat — one plank, its plan a closed Catmull-Rom through measured control points: a narrow back
//     edge (±0.158) that flares through a waist to ±0.214 just forward of centre, then rounds into
//     shoulders at ±0.085 and drops 9 mm back to a cyma nose — the shield plan of a real saddle seat,
//     not a rounded rectangle. Worked with a real 6 mm BULLNOSE (a multi-ring roundover, not a single
//     chamfer facet) because the seat edge is the one arris on this chair a sitter's hand actually
//     finds — the opposite call from kk-011's top, where a chamfer was needed to keep a seam readable.
//   · Bow — a single bent hoop: vertical stiles tangent into a 0.168 m semicircular crown, the whole
//     plane raked back 0.25 : 1 so the crown sits 0.098 m behind its feet. Swept as one tube, so there
//     is no joint to hide where stile becomes crown — which is the point of steam-bending. The feet are
//     placed forward of the seat's back edge, at the station where the seat is wide enough to swallow
//     the whole 28 mm stile: a hoop entering at the back edge pokes out through the seat's side.
//   · Spindles — five, turned with a vase swell in the lower third, rising from the seat's back to land
//     ON THE BOW'S CENTRELINE (radius 0.161 against the hoop's 0.168), so every top is buried inside the
//     hoop rather than butted against its surface. Their tops therefore meet the bow at five DIFFERENT
//     heights, exactly as the reference shows.
//   · Legs — turned, and SHEARED rather than rotated into their rake: a horizontal section stays
//     horizontal, so all four feet sit flat on the floor and all four heads bed flat under the seat.
//     Rotating them instead is what leaves a chair standing on four ellipse edges. Rake is 19°: the feet
//     are pinned to the manifest's 0.45 m width, so the splay is bought by drawing the HEADS in under
//     the seat (±0.112) rather than by pushing the feet out past the datum.
//   · H-stretcher — two side stretchers at y = 0.175, their ends solved against the legs' TRUE sheared
//     axes at that height (not the head positions), crossed by one medial stretcher 7 mm lower so the
//     two interpenetrate instead of sharing a face. The medial's ends land exactly on the side
//     stretchers' axes: run them past, as a first pass did, and a 20 mm stub pokes out through the side
//     rail — the only modelling error a critic caught on this model.
//   · Hidden sides / plausible reconstruction: the underside of the seat, the back face of the bow and
//     every mortise are not in the reference. Modelled as the simplest construction that would hold —
//     through-tenons into the seat for legs, bow and spindles, none of them expressed on the top face.
//   · APPROXIMATIONS, stated: the seat is a flat plank with a rolled edge, NOT an adzed saddle dish —
//     the dish is the reference's strongest seat cue and the one thing an extruded plan cannot give at
//     this budget. Its cyma front (the 9 mm centre dip between the shoulders) IS modelled, in the plan
//     outline. Turned rings on the legs and spindles are profile swells on a lathe, not cut beads.
//   · Art-direction corrections: the reference's contour shows a fifth member on each side below the
//     side stretcher; a chair has no such member and a Windsor H-stretcher is the construction the rest
//     of the drawing implies, so it is read as the far-side stretcher seen through the frame, not built.
//
// PARTS. `seat`, `back` (bow + spindles), `legs` (legs + stretchers). No movable parts.
//
// COLLIDER. compound — a box for the seat slab (0.43 × 0.04 × 0.40 centred at y = 0.425) plus a thin
// upright box for the back (0.34 × 0.40 × 0.05, leaned with the bow). The compiled sidecar builds a
// real 972-triangle manifold closed hull off the visual meshes (no AABB fallback), which a physics
// consumer can use directly; a plain AABB is the cheap fallback and costs nothing real at café scale.

import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  Shape,
  Vector3,
  type DataTexture,
  type Material,
} from 'three/webgpu'

import {
  acquireKkMaterials,
  cedarGrainTexture,
  createKkPreview,
  creased,
  finishModel,
  member,
  mergeParts,
  revolve,
} from '../kk-core/index.ts'

const ID = 'kk-012-spindle-back-chair'
import { shapeConfig, finiteOption, type CafeShapeConfig, type ShapeControls } from '../kk-core/shape-controls.ts'
export const cafeShapeControls = {
  archSpan: { min: 0.30, max: 0.35, default: 0.336, step: 0.002, label: 'Bow centreline span (m)' },
  archRise: { min: 0.34, max: 0.49, default: 0.421, step: 0.005, label: 'Bow centreline rise (m)' },
  archThickness: { min: 0.024, max: 0.032, default: 0.028, step: 0.001, label: 'Bow diameter (m)' },
} as const satisfies ShapeControls

type Slot = 'cedar' | 'cedarDark'

export interface KkSpindleChairConfig extends CafeShapeConfig {
  /** Spindles between the bow's stiles. 3–7; the reference reads as five. */
  spindles: number
  /** How far the bow's crown leans back per metre of rise. */
  rake: number
}

export interface KkSpindleChairOptions extends Partial<KkSpindleChairConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface KkSpindleChairInstance {
  readonly root: Group
  readonly parts: { seat: Group; back: Group; legs: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkSpindleChairConfig>
  configure(patch: Partial<KkSpindleChairConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: KkSpindleChairConfig = { ...shapeConfig(cafeShapeControls, {}), spindles: 5, rake: 0.25 }

// --- the datum, in metres ----------------------------------------------------------------------------

/** Seat. */
const SEAT_TOP = 0.445
const SEAT_T = 0.04
const SEAT_UNDER = SEAT_TOP - SEAT_T
const SEAT_BULLNOSE = 0.006
/** Half of the seat's plan, front to back, as control points for a closed Catmull-Rom. */
const SEAT_HALF: ReadonlyArray<readonly [number, number]> = [
  [0.158, -0.185],
  [0.186, -0.142],
  [0.203, -0.05],
  [0.214, 0.062],
  [0.204, 0.148],
  [0.15, 0.196],
  [0.085, 0.218],
]
const SEAT_NOSE = 0.209
const SEAT_BACK = -0.185

/** Bow. Vertical stiles tangent into a semicircular crown; the whole plane rakes back. */
const CROWN_Y = 0.668
const CROWN_R = 0.168
const BOW_FOOT_X = 0.168
const BOW_FOOT_Y = 0.415
const BOW_Z0 = -0.145

/** Spindles: tops land on a circle just inside the bow's centreline, so every joint is buried. */
const SPINDLE_SPREAD = 0.132
const SPINDLE_LANDING_R = 0.161
const SPINDLE_FOOT_Y = 0.412

/** Legs. Heads bed inside the seat plank; feet splay to the manifest width. */
const LEG_HEAD_Y = 0.432
const LEG_HEAD: ReadonlyArray<readonly [number, number]> = [
  [0.112, 0.096], [-0.112, 0.096], [0.108, -0.091], [-0.108, -0.091],
]
const LEG_FOOT: ReadonlyArray<readonly [number, number]> = [
  [0.2125, 0.205], [-0.2125, 0.205], [0.2125, -0.195], [-0.2125, -0.195],
]

/** Stretchers. */
const SIDE_STRETCHER_Y = 0.175
const MEDIAL_STRETCHER_Y = 0.168
const STRETCHER_R = 0.011

/**
 * The turned leg, as a half-profile: `[t, radius]` from foot (t = 0) to head (t = 1). The swell under
 * the seat, the cove below it and the slight flare at the foot are the three events the reference shows.
 */
const LEG_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.0118], [0.025, 0.0152], [0.075, 0.0126], [0.3, 0.0148], [0.56, 0.0178],
  [0.65, 0.0205], [0.71, 0.0143], [0.79, 0.0221], [0.87, 0.0256], [0.915, 0.0198],
  [0.95, 0.0252], [1.0, 0.0192],
]

/** The turned spindle: a tenon, a vase swell in the lower third, then a long taper to the bow. */
const SPINDLE_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.008], [0.05, 0.0095], [0.11, 0.0148], [0.185, 0.0176], [0.26, 0.0111],
  [0.31, 0.0079], [0.36, 0.0102], [0.42, 0.0073], [0.68, 0.0067], [1.0, 0.0054],
]

const LATHE_SEGMENTS = 14
const BOW_RADIAL = 8

// --- geometry helpers --------------------------------------------------------------------------------

type Pt = readonly [number, number]

/**
 * A prism with a real bullnose: `segments` bevel rings, so the arris rolls over instead of cutting.
 * The outline is the widest section and the flat face sits `bevel` inside it, which is how a seat edge
 * is actually worked. (`bevelPrism` in the core is a one-facet chamfer that pre-insets to preserve
 * extents — the opposite trade.)
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

/** Lay a geometry authored along +Y from the origin onto the segment `from` → `to`. */
function alongAxis(geometry: BufferGeometry, from: Vector3, to: Vector3): BufferGeometry {
  const direction = new Vector3().subVectors(to, from).normalize()
  const spin = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction)
  geometry.applyMatrix4(new Matrix4().makeRotationFromQuaternion(spin))
  geometry.translate(from.x, from.y, from.z)
  return geometry
}

/**
 * Shear a vertical geometry outward as it descends, so it rakes while both end cuts stay horizontal.
 * A raked leg that is ROTATED instead stands on the edge of an ellipse; a sheared one sits flat.
 */
function shearOut(
  geometry: BufferGeometry, head: Pt, foot: Pt, headY: number,
): BufferGeometry {
  const pos = geometry.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const t = Math.min(1, Math.max(0, 1 - y / headY))
    pos.setXYZ(
      i,
      pos.getX(i) + head[0] + (foot[0] - head[0]) * t,
      y,
      pos.getZ(i) + head[1] + (foot[1] - head[1]) * t,
    )
  }
  pos.needsUpdate = true
  return geometry
}

/** Where a sheared leg's axis actually is at height `y` — the only honest anchor for a stretcher. */
function legAxisAt(head: Pt, foot: Pt, headY: number, y: number): Vector3 {
  const t = Math.min(1, Math.max(0, 1 - y / headY))
  return new Vector3(head[0] + (foot[0] - head[0]) * t, y, head[1] + (foot[1] - head[1]) * t)
}

/** The seat's plan: the measured half mirrored, closed and smoothed. */
function seatOutline(samples: number): Pt[] {
  const control: Vector3[] = [new Vector3(0, SEAT_NOSE, 0)]
  for (let i = SEAT_HALF.length - 1; i >= 0; i--) {
    control.push(new Vector3(SEAT_HALF[i]![0], SEAT_HALF[i]![1], 0))
  }
  control.push(new Vector3(0, SEAT_BACK, 0))
  for (const [x, z] of SEAT_HALF) control.push(new Vector3(-x, z, 0))
  const curve = new CatmullRomCurve3(control, true, 'catmullrom', 0.4)
  return curve.getPoints(samples).slice(0, samples).map((p) => [p.x, p.y] as Pt)
}

/**
 * The bow's centreline: a stile rising to meet the crown VERTICALLY (so the bend is tangent and the
 * hoop reads as one bent stick, not two sticks and a kink), then a semicircular crown, then the mirror.
 * The whole plane is raked back about the seat.
 */
function bowPath(rake: number, span: number, rise: number): Vector3[] {
  const plane = (u: number, y: number): Vector3 => new Vector3(u, y, BOW_Z0 + rake * (SEAT_TOP - y))
  const stileRun = CROWN_Y - BOW_FOOT_Y
  const flare = BOW_FOOT_X - CROWN_R
  /** Stile x, easing to vertical at the crown so the tangent matches. */
  const stileX = (y: number): number => CROWN_R + flare * ((CROWN_Y - y) / stileRun) ** 1.7
  const stileYs = [BOW_FOOT_Y, BOW_FOOT_Y + stileRun * 0.38, BOW_FOOT_Y + stileRun * 0.72, CROWN_Y]

  const path: Vector3[] = []
  for (const y of stileYs) path.push(plane(-stileX(y), y))
  const crownSteps = 8
  for (let i = 1; i < crownSteps; i++) {
    const a = Math.PI - (i / crownSteps) * Math.PI
    path.push(plane(CROWN_R * Math.cos(a), CROWN_Y + CROWN_R * Math.sin(a)))
  }
  for (let i = stileYs.length - 1; i >= 0; i--) path.push(plane(stileX(stileYs[i]!), stileYs[i]!))
  for (const point of path) {
    point.x *= span / defaults.archSpan
    point.y = BOW_FOOT_Y + (point.y - BOW_FOOT_Y) * (rise / defaults.archRise)
    point.z = BOW_Z0 + rake * (SEAT_TOP - point.y)
  }
  return path
}

/**
 * Sweep a round section along a path, closed with a flat fan at each end.
 *
 * Local rather than the core's `taperedTube`, which derives its own segment count from the control-point
 * count — a bent hoop needs its stiles coarse and its crown fine, i.e. the segment count decided by the
 * shape, not by how many points were needed to describe it.
 */
function sweepTube(path: Vector3[], radius: number, radial: number, segments: number): BufferGeometry {
  const curve = new CatmullRomCurve3(path)
  const frames = curve.computeFrenetFrames(segments, false)
  const positions = new Float32Array((segments + 1) * radial * 3)
  const uvs = new Float32Array((segments + 1) * radial * 2)
  const indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const centre = curve.getPointAt(i / segments)
    const normal = frames.normals[i]!
    const binormal = frames.binormals[i]!
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2
      const p = centre.clone()
        .addScaledVector(normal, radius * Math.cos(a))
        .addScaledVector(binormal, radius * Math.sin(a))
      const o = (i * radial + k) * 3
      positions[o] = p.x
      positions[o + 1] = p.y
      positions[o + 2] = p.z
      const t = (i * radial + k) * 2
      uvs[t] = i / segments
      uvs[t + 1] = k / radial
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k
      const b = i * radial + ((k + 1) % radial)
      indices.push(a, a + radial, b, b, a + radial, b + radial)
    }
  }
  // Caps: both ends are buried in the seat, so a flat fan is all the shell needs to stay closed.
  for (let k = 1; k < radial - 1; k++) indices.push(0, k + 1, k)
  const last = segments * radial
  for (let k = 1; k < radial - 1; k++) indices.push(last, last + k, last + k + 1)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

// --- model -----------------------------------------------------------------------------------------

export function createModel(options: KkSpindleChairOptions = {}): KkSpindleChairInstance {
  const config: KkSpindleChairConfig = {
    ...shapeConfig(cafeShapeControls, options),
    spindles: Math.min(7, Math.max(3, Math.round(finiteOption(options.spindles ?? defaults.spindles, 'spindles')))),
    rake: Math.min(0.4, Math.max(0, finiteOption(options.rake ?? defaults.rake, 'rake'))),
  }

  const bundle = acquireKkMaterials()
  const kit = bundle.materials
  const materialSlots: Record<Slot, Material> = { cedar: options.materials?.cedar ?? kit.cedar, cedarDark: options.materials?.cedarDark ?? kit.cedarDark }

  // One shared 256 px grain map across BOTH cedar slots. It has to be both or neither: the map multiplies
  // its slot's base colour, so mapping only the seat sank it a full value step below the frame and
  // inverted the reference's relationship (scrubbed seat, darker handled frame). Never applied over a
  // material the consumer handed in (rule 17).
  let grain: DataTexture | undefined
  const wantsGrain = options.materials?.cedar === undefined || options.materials?.cedarDark === undefined
  if (wantsGrain) {
    grain = cedarGrainTexture(256)
    grain.repeat.set(2.2, 2.2)
    if (options.materials?.cedar === undefined) kit.cedar.map = grain
    if (options.materials?.cedarDark === undefined) kit.cedarDark.map = grain
  }

  const root = new Group(); root.name = ID
  const seat = new Group(); seat.name = 'seat'
  const back = new Group(); back.name = 'back'
  const legs = new Group(); legs.name = 'legs'
  root.add(seat, back, legs)
  const content = new Map([seat, back, legs].map(part => { const group = new Group(); part.add(group); return [part, group] as const }))
  let disposed = false

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { cedar: [], cedarDark: [] }

  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, materialSlots[slot])
    mesh.name = `${ID} / ${name}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    content.get(group)!.add(mesh)
  }

  const release = (): void => {
    content.forEach(group => group.clear())
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    meshesBySlot.cedar.length = 0
    meshesBySlot.cedarDark.length = 0
  }

  const rebuild = (): void => {
    release()

    // Seat — one plank, rolled edge, laid flat.
    const plank = bullnosePrism(seatOutline(40), SEAT_T, SEAT_BULLNOSE, 2)
    plank.rotateX(Math.PI / 2)
    plank.translate(0, SEAT_UNDER + SEAT_T / 2, 0)
    emit('cedar', plank, seat, 'seat-plank')

    // Back — one bent hoop and the turned spindles that land on its centreline.
    const backParts: BufferGeometry[] = []
    backParts.push(sweepTube(bowPath(config.rake, config.archSpan, config.archRise), config.archThickness / 2, BOW_RADIAL, 60))
    const count = config.spindles
    for (let i = 0; i < count; i++) {
      const f = count === 1 ? 0 : (i / (count - 1)) * 2 - 1
      const x = f * SPINDLE_SPREAD
      // Solve the spindle's top ON the landing circle. The floor here must be 0, not a "safe" positive
      // number: a 0.02 floor silently overrode the real solution for the two OUTER spindles (whose
      // x² term is larger), lifting their tips to radius 0.194 — 11 mm OUTSIDE a hoop of radius 0.168
      // + 0.014 — so both end spindles crossed in front of the bow instead of entering it. The clamp
      // fired on exactly the cases it was meant to protect, and it is invisible to every visual lens
      // at the kit's preview angle. `SPINDLE_SPREAD < SPINDLE_LANDING_R` is what actually keeps this
      // real, so it is asserted rather than clamped around.
      const landing = SPINDLE_LANDING_R * SPINDLE_LANDING_R - x * x
      if (landing <= 0) throw new Error(`${ID}: spindle ${i} at x=${x} cannot reach the bow`)
      const topY = CROWN_Y + Math.sqrt(landing)
      const scaledX = x * (config.archSpan / defaults.archSpan)
      const scaledTopY = BOW_FOOT_Y + (topY - BOW_FOOT_Y) * (config.archRise / defaults.archRise)
      const from = new Vector3(scaledX, SPINDLE_FOOT_Y, BOW_Z0 + config.rake * (SEAT_TOP - SPINDLE_FOOT_Y))
      const to = new Vector3(scaledX, scaledTopY, BOW_Z0 + config.rake * (SEAT_TOP - scaledTopY))
      const length = from.distanceTo(to)
      backParts.push(alongAxis(
        revolve(SPINDLE_PROFILE, { yBot: 0, yTop: length, segments: LATHE_SEGMENTS }), from, to,
      ))
    }
    emit('cedarDark', mergeParts(backParts, `${ID}: back`), back, 'bow-and-spindles')

    // Legs and the H-stretcher.
    const frame: BufferGeometry[] = []
    for (let i = 0; i < 4; i++) {
      frame.push(shearOut(
        revolve(LEG_PROFILE, { yBot: 0, yTop: LEG_HEAD_Y, segments: LATHE_SEGMENTS + 2 }),
        LEG_HEAD[i]!, LEG_FOOT[i]!, LEG_HEAD_Y,
      ))
    }
    const side: Vector3[] = []
    for (const [frontIdx, backIdx] of [[0, 2], [1, 3]] as const) {
      const a = legAxisAt(LEG_HEAD[frontIdx]!, LEG_FOOT[frontIdx]!, LEG_HEAD_Y, SIDE_STRETCHER_Y)
      const b = legAxisAt(LEG_HEAD[backIdx]!, LEG_FOOT[backIdx]!, LEG_HEAD_Y, SIDE_STRETCHER_Y)
      frame.push(member(a, b, STRETCHER_R, 10))
      side.push(a.clone().lerp(b, 0.5))
    }
    // Medial stretcher — 7 mm below the side pair, its ends run past their axes and bury inside them.
    const medial = side.map((p) => new Vector3(p.x, MEDIAL_STRETCHER_Y, p.z))
    frame.push(member(medial[0]!, medial[1]!, STRETCHER_R * 0.92, 10))
    emit('cedarDark', mergeParts(frame, `${ID}: legs`), legs, 'legs-and-stretchers')
  }

  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated })

  return {
    root,
    parts: { seat, back, legs },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (disposed) return
      const next = { ...config, ...shapeConfig(cafeShapeControls, patch, config),
        spindles: Math.min(7, Math.max(3, Math.round(finiteOption(patch.spindles ?? config.spindles, 'spindles')))),
        rake: Math.min(0.4, Math.max(0, finiteOption(patch.rake ?? config.rake, 'rake'))) }
      Object.assign(config, next)
      rebuild()
    },
    setMaterial(slot, material) {
      if (disposed) return
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      if (disposed) return
      disposed = true
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
 * only `aspect` silently renders all eight panels from the default angle. This model's first 8-view
 * sheet was eight copies of the hero shot, which is exactly why a spindle breaching the bow survived my
 * own inspection of it and had to be caught by an outside critic instead.
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
