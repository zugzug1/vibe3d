// f1-pit-gantry — the cantilever boom that stands in a modern F1 pit box: one white mast on a wheeled
// base plate, a slim horizontal boom reaching out over the car, a wishbone brace opening the elbow, a
// thin camera mast raked up off the joint, and a hi-vis umbilical dropped off the boom to the ground.
//
// The typology matters more than any detail on it. This is not a portal: nothing stands on the far side
// of the car, because a pit stop needs the whole outboard face of the box clear for a crew of twenty.
// Everything the structure has to do is therefore done by a single root at one end, and that constraint
// is the silhouette — a mast that is deep front-to-back and shallow across, a boom that is slim because
// it only carries services, and a brace at the elbow because a bare right angle in a cantilever this
// long would be visibly wrong. Four legs and a flat truss roof read as a concert stage, not a pit box.
//
// The second thing the reference sells is finish. These are moulded, semi-gloss white panelled bodies
// with generous radii — a paddock-branded product, not site scaffolding. So the mast is lofted through
// measured rounded-rectangle sections rather than assembled from tubes, and every hard edge carries a
// real fillet. Open lattice anywhere in it destroys the read.
//
// No livery: the body is neutral white and the only saturated colour is the hi-vis cable, which is the
// landmark that fixes the scale and tells you the thing is plugged in.

import {
  BufferGeometry,
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three/webgpu'
import { LoftGeometry } from 'three/examples/jsm/geometries/LoftGeometry.js'

import {
  AXIS_X,
  AXIS_Y,
  TOKEN,
  acquireF1Materials,
  bevelBox,
  bevelDisc,
  bolt,
  castor,
  createF1Preview,
  creased,
  disposeF1Materials,
  loftRoundedBox,
  member,
  mergeParts,
  shade,
  taperedTube,
  tubeSection,
} from '../f1-kit-core/index.ts'
import { mixToken } from '../f1-kit-core/palette.ts'

type Slot = 'post' | 'banner' | 'fitting' | 'lens' | 'band'

export interface F1PitGantryConfig {
  /** Boom reach: mast centreline to boom tip, metres. The cantilever's defining dimension. */
  span: number
  /** Soffit height: the boom's underside above the pit-box floor, metres. */
  height: number
  /** Service pods along the boom soffit. Doubles as the LOD knob. */
  bays: number
}

export interface F1PitGantryOptions extends Partial<F1PitGantryConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1PitGantryInstance {
  readonly root: Group
  readonly parts: { mast: Group; boom: Group; umbilical: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1PitGantryConfig>
  configure(patch: Partial<F1PitGantryConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

// Measured against the crew in the reference: the soffit clears a walking mechanic with room to spare
// (2.8 m), and the boom reaches the far side of a car plus a wheel man (4.3 m from the mast).
const defaults: F1PitGantryConfig = { span: 5.0, height: 2.8, bays: 3 }

/** How far the boom carries on *behind* the mast. Short, but a flush end would read as a broken beam. */
const BACKSPAN = 0.62

/**
 * Boom section: slim enough that the eye follows it as one line.
 *
 * This came down twice. A boom heavy enough to look structural is wrong for what it carries — services,
 * not load — and any second member run alongside it reads as truss, which is the language this typology
 * is defined by not speaking.
 */
const BOOM_H = 0.125
const BOOM_Z = 0.1
const BOOM_R = 0.042

/** Wheeled base plate. The plate floats on castors, so its underside is above the floor. */
const PLATE_T = 0.13
const CASTOR_R = 0.05
const PLATE_BOTTOM = 0.092
const PLATE_TOP = PLATE_BOTTOM + PLATE_T
/** The plate is offset toward the boom so the cantilever's overturning moment lands inside it. */
const PLATE_X = 0.12

/** Hi-vis cable radius, and the proud radius of its black wrap bands. */
const CABLE_R = 0.036
const BAND_R = 0.046

/**
 * The mast's measured sections, bottom to top: `t` along the mast, then the section's back and front X
 * faces, its half-depth across the lane, and its corner fillet.
 *
 * Two things are deliberate. The front face rakes hard (0.68 -> 0.21) while the back face is nearly
 * plumb, which is what makes the mast read as a wedge braced against the boom rather than a plain post.
 * And the fillet shrinks with the section instead of staying constant, because a 110 mm radius on a
 * 420 mm neck would swallow the flats and turn the top of the mast into a cylinder.
 */
const MAST_SECTIONS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [-0.035, -0.398, 0.762, 0.325, 0.105],
  [0.000, -0.310, 0.660, 0.265, 0.085],
  [0.160, -0.311, 0.549, 0.252, 0.080],
  [0.400, -0.316, 0.402, 0.230, 0.072],
  [0.660, -0.316, 0.272, 0.205, 0.066],
  [0.860, -0.308, 0.185, 0.185, 0.060],
  [1.000, -0.298, 0.135, 0.172, 0.056],
]

interface MastSection {
  xMin: number
  xMax: number
  halfZ: number
  radius: number
}

/** Linear interpolation through {@link MAST_SECTIONS}, clamped at both ends. */
function sectionAt(t: number): MastSection {
  const first = MAST_SECTIONS[0]!
  const last = MAST_SECTIONS[MAST_SECTIONS.length - 1]!
  if (t <= first[0]) return { xMin: first[1], xMax: first[2], halfZ: first[3], radius: first[4] }
  if (t >= last[0]) return { xMin: last[1], xMax: last[2], halfZ: last[3], radius: last[4] }
  for (let i = 1; i < MAST_SECTIONS.length; i++) {
    const b = MAST_SECTIONS[i]!
    if (t > b[0]) continue
    const a = MAST_SECTIONS[i - 1]!
    const k = (t - a[0]) / (b[0] - a[0])
    return {
      xMin: a[1] + (b[1] - a[1]) * k,
      xMax: a[2] + (b[2] - a[2]) * k,
      halfZ: a[3] + (b[3] - a[3]) * k,
      radius: a[4] + (b[4] - a[4]) * k,
    }
  }
  return { xMin: last[1], xMax: last[2], halfZ: last[3], radius: last[4] }
}

/**
 * One rounded-rectangle loft station in the XZ plane at height `y`, for a body swept up +Y.
 *
 * The point order is the truck cab's ring order permuted one axis round (advance X -> advance Y), which
 * is what keeps `LoftGeometry` generating outward normals; reversing it inverts the whole body and the
 * mast renders as a hole. Fixed point count per ring, because a loft cannot stitch uneven stations.
 */
function slabRing(
  y: number, xMin: number, xMax: number, zMin: number, zMax: number, radius: number,
): Vector3[] {
  const x0 = Math.min(xMin, xMax)
  const x1 = Math.max(xMin, xMax)
  const z0 = Math.min(zMin, zMax)
  const z1 = Math.max(zMin, zMax)
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const hx = (x1 - x0) / 2
  const hz = (z1 - z0) / 2
  const r = Math.max(1e-4, Math.min(radius, hx - 1e-4, hz - 1e-4))
  const seg = 5
  const pts: Vector3[] = []
  const corner = (ax: number, az: number, a0: number): void => {
    for (let j = 0; j <= seg; j++) {
      const a = a0 + (j / seg) * (Math.PI / 2)
      pts.push(new Vector3(cx + ax + r * Math.cos(a), y, cz + az + r * Math.sin(a)))
    }
  }
  corner(hx - r, -(hz - r), -Math.PI / 2)
  corner(hx - r, hz - r, 0)
  corner(-(hx - r), hz - r, Math.PI / 2)
  corner(-(hx - r), -(hz - r), Math.PI)
  pts.reverse()
  return pts
}

/** A slim rounded-rectangle bar running along X, centred on `(0, y, z)` over `x0..x1`. */
function railBar(
  x0: number, x1: number, y: number, z: number, height: number, depth: number, radius: number,
): BufferGeometry {
  const geo = loftRoundedBox(depth, height, Math.max(1e-3, x1 - x0), radius)
  geo.rotateY(Math.PI / 2)
  geo.translate((x0 + x1) / 2, y, z)
  return geo
}

export function createModel(options: F1PitGantryOptions = {}): F1PitGantryInstance {
  const config: F1PitGantryConfig = {
    span: Math.max(1.6, options.span ?? defaults.span),
    height: Math.max(1.8, options.height ?? defaults.height),
    bays: Math.min(8, Math.max(1, Math.round(options.bays ?? defaults.bays))),
  }

  // Shared kit materials. Overrides handed in through `options` belong to the caller and are never
  // disposed here (rule 16).
  const bundle = acquireF1Materials()
  const m = bundle.materials
  const owned: Material[] = []
  const own = (material: Material): Material => {
    owned.push(material)
    return material
  }

  // Moulded semi-gloss white. The kit's `shell` is a matt coated panel at roughness 0.55, which under
  // this rig gives the body no highlight at all and drops a 3 m mast into a flat grey cutout. A lifted
  // neutral at roughness 0.33 keeps the value high while still laying a soft sheen down the mast's
  // rounded flanks, which is the only thing that describes the loft's curvature without an env map.
  const bodyWhite = options.materials?.post ?? own(new MeshStandardMaterial({
    name: 'f1-kit / pit-gantry body white',
    color: shade(TOKEN.SHELL_200, 0.2),
    roughness: 0.4,
    metalness: 0.04,
  }))

  // Hi-vis cable sheath, mixed off the ramp between `LIME-400` and `AMBER-400`.
  //
  // Neat `LIME-400` is the closer literal match to the sheath, but against the black bands it reads
  // green, and green is not what makes a hi-vis cable the landmark in this frame. Pulling it 45% toward
  // amber lands red and green level with each other — a hot yellow — which is the only saturated value in
  // the model and has to hold its own against a body that is almost white and bands that are almost
  // black. Both endpoints are canonical tokens, so this stays a point on the palette rather than a
  // hand-picked hex.
  const hiVis = options.materials?.banner ?? own(new MeshStandardMaterial({
    name: 'f1-kit / pit-gantry hi-vis umbilical',
    color: mixToken(TOKEN.LIME_400, TOKEN.AMBER_400, 0.45),
    roughness: 0.45,
    metalness: 0.0,
  }))

  const materialSlots: Record<Slot, Material> = {
    post: bodyWhite,
    banner: hiVis,
    fitting: options.materials?.fitting ?? m.graphite,
    lens: options.materials?.lens ?? m.orange,
    // The wrap bands need to be black, not the graphite the rest of the hardware uses: at this size they
    // are read purely as the dark half of a hazard stripe, and graphite's blue cast greys that out.
    band: options.materials?.band ?? m.ink,
  }

  // Runtime anchors: created once, never replaced (rules 10, 14).
  const root = new Group()
  root.name = 'f1-pit-gantry'
  const mast = new Group(); mast.name = 'mast'
  const boom = new Group(); boom.name = 'boom'
  const umbilical = new Group(); umbilical.name = 'umbilical'
  root.add(mast, boom, umbilical)

  // Per-rebuild geometry ownership. Geometry is regenerated by configure(), so it is tracked separately
  // and released at the top of every rebuild.
  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = {
    post: [], banner: [], fitting: [], lens: [], band: [],
  }

  const releaseGenerated = (): void => {
    for (const group of [mast, boom, umbilical]) group.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  /** One merged geometry per material slot per part group: one mesh, one draw call, one anchor. */
  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  /** Every dimension the parts below share, solved once from the config. */
  const solve = () => {
    const { span, height } = config
    const neckY = height - 0.34
    const rise = Math.max(0.4, neckY - PLATE_TOP)
    const boomX0 = -BACKSPAN
    const boomX1 = span
    const boomCy = height + BOOM_H / 2
    const boomTop = boomCy + BOOM_H / 2
    return {
      neckY,
      rise,
      boomX0,
      boomX1,
      boomCy,
      boomTop,
      /** Height of a mast station, from its normalised `t`. */
      mastY: (t: number) => PLATE_TOP + t * rise,
      /** Where the umbilical is glanded onto the boom: outboard, but short of the tip fitting. */
      dropX: boomX1 * 0.82,
    }
  }

  type Solved = ReturnType<typeof solve>

  /**
   * The base plate and the mast lofted up through its measured sections.
   *
   * The lowest station sits *below* the plate's top face and flares wider than the section above it, so
   * the mast grows out of a fillet instead of being planted on the deck as a separate box. That flare is
   * the whole reason the reference's foot reads as one moulding.
   */
  const buildMast = (body: BufferGeometry[], hardware: BufferGeometry[], d: Solved): void => {
    const plate = loftRoundedBox(1.50, 0.86, PLATE_T, 0.075)
    plate.rotateX(Math.PI / 2)
    plate.translate(PLATE_X, PLATE_BOTTOM + PLATE_T / 2, 0)
    body.push(plate)

    // A shallower deck stepped in from the plate edge: a real 40 mm shadow line round the base, which a
    // single slab cannot give at any bevel width.
    const deck = loftRoundedBox(1.20, 0.66, 0.05, 0.06)
    deck.rotateX(Math.PI / 2)
    deck.translate(PLATE_X, PLATE_TOP - 0.012, 0)
    body.push(deck)

    const rings: Vector3[][] = []
    for (const [t] of MAST_SECTIONS) {
      const s = sectionAt(t)
      rings.push(slabRing(d.mastY(t), s.xMin, s.xMax, -s.halfZ, s.halfZ, s.radius))
    }
    body.push(creased(new LoftGeometry(rings, { closed: true, capStart: true, capEnd: true }), 55))

    const collar: Vector3[][] = []
    for (const t of [0.685, 0.7, 0.715]) {
      const s = sectionAt(t)
      const grow = t === 0.7 ? 0.014 : 0.002
      collar.push(slabRing(
        d.mastY(t), s.xMin - grow, s.xMax + grow,
        -(s.halfZ + grow), s.halfZ + grow, s.radius + grow,
      ))
    }
    body.push(creased(new LoftGeometry(collar, { closed: true, capStart: true, capEnd: true }), 50))

    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        hardware.push(castor([PLATE_X + sx * 0.54, 0, sz * 0.3], CASTOR_R, sx * sz * 0.5))
      }
    }
    const deckTop = PLATE_TOP + 0.018
    for (const sz of [-1, 1] as const) {
      for (const x of [PLATE_X - 0.42, PLATE_X + 0.4]) {
        hardware.push(bolt([x, deckTop, sz * 0.24], 0.015, 0.018, AXIS_Y))
      }
    }
  }

  /**
   * The wishbone: two splayed arms off the neck into a saddle under the boom.
   *
   * The arms are what make a cantilever legible — they turn a bare right angle into a triangulated
   * elbow, and the triangular void they leave is as much of the read as the arms themselves. Filling it
   * with a spine would give back the solid post the reference does not have. The two arms differ in
   * length and rake because the boom is not centred on the mast (rule 3).
   */
  const buildWishbone = (body: BufferGeometry[], d: Solved): void => {
    const armTop = config.height + 0.02
    for (const [x0, x1] of [[-0.04, 0.46], [-0.13, -0.4]] as const) {
      const from = new Vector3(x0, d.neckY - 0.1, 0)
      const to = new Vector3(x1, armTop, 0)
      const delta = to.clone().sub(from)
      const arm = bevelBox(delta.length() + 0.11, 0.235, 0.3, 0.03)
      arm.rotateZ(Math.atan2(delta.y, delta.x))
      arm.translate((from.x + to.x) / 2, (from.y + to.y) / 2, 0)
      body.push(arm)
    }

    // Saddle under the boom, spanning both arm tops. It bites 17 mm up into the boom so the two read as
    // one moulding rather than a rail resting on a block.
    const saddle = loftRoundedBox(1.08, 0.125, 0.34, 0.05)
    saddle.translate(0.0, config.height - 0.05, 0)
    body.push(saddle)
  }

  /**
   * The boom: one unbroken white rail with a dark fitting on each end.
   *
   * It carried a small-bore service tube on standoffs, copied off the reference, and that was a mistake:
   * a second member marching along above the first reads as a ladder at any distance the prop is
   * actually seen from, and a ladder is a truss. The detail was true and the impression it left was
   * false, so the boom is now the single line its silhouette needs, and the loom that tube justified is
   * simply clipped to the crown instead.
   */
  const buildBoom = (
    body: BufferGeometry[], hardware: BufferGeometry[], d: Solved,
  ): void => {
    body.push(railBar(d.boomX0, d.boomX1, d.boomCy, 0, BOOM_H, BOOM_Z, BOOM_R))

    for (const [x, sign] of [[d.boomX1, 1], [d.boomX0, -1]] as const) {
      const cap = loftRoundedBox(BOOM_Z * 0.74, BOOM_H * 0.74, 0.1, 0.03)
      cap.rotateY(Math.PI / 2)
      cap.translate(x + sign * 0.03, d.boomCy, 0)
      hardware.push(cap)
    }
  }

  /**
   * Recessed pods along the boom soffit, plus the hero pod at the elbow.
   *
   * The soffit pods are the working lights, so they sit on the underside where the light has to reach
   * the car; `bays` is what a consumer turns down for a distant instance. The elbow pod is the reference
   * photograph's most identifiable single object — a fat white teardrop on a short neck with a warm lens
   * looking straight down at the car's nose — and it is worth its own geometry.
   */
  const buildPods = (
    body: BufferGeometry[], lenses: BufferGeometry[], d: Solved,
  ): void => {
    const { height } = config
    const first = 0.95
    const last = Math.max(first + 0.2, d.boomX1 - 0.55)
    for (let i = 0; i < config.bays; i++) {
      const x = config.bays === 1 ? (first + last) / 2 : first + ((last - first) * i) / (config.bays - 1)
      const housing = loftRoundedBox(0.34, 0.11, 0.17, 0.04)
      housing.translate(x, height + 0.006 - 0.055, 0)
      body.push(housing)
      const lens = bevelBox(0.2, 0.014, 0.095, 0.003)
      lens.translate(x, height - 0.107, 0)
      lenses.push(lens)
    }

    const podX = 0.92
    body.push(tubeSection(0.055, 0.12, [podX, height - 0.035, 0.02], AXIS_Y, 12))
    const pod = loftRoundedBox(0.36, 0.22, 0.28, 0.10)
    pod.translate(podX, height - 0.19, 0.02)
    body.push(pod)
    const podLens = bevelDisc(0.105, 0.02, 0.005, 24)
    podLens.rotateX(Math.PI / 2)
    podLens.translate(podX, height - 0.295, 0.02)
    lenses.push(podLens)
  }

  /**
   * The camera mast: a thin tube raked up and back off the elbow to a boxed head, with a stay.
   *
   * It reads at any distance because it is the only line in the model that leaves the two structural
   * axes, and it is what tells you the prop belongs to a broadcast pit lane. The stay matters as much as
   * the mast — an unbraced 1.7 m spike off a service boom would visibly wobble.
   */
  const buildCameraMast = (
    body: BufferGeometry[], hardware: BufferGeometry[], lenses: BufferGeometry[], d: Solved,
  ): void => {
    const foot = new Vector3(0.2, d.boomTop - 0.04, -0.05)
    const tip = new Vector3(-0.55, d.boomTop + 1.42, -0.28)
    body.push(taperedTube(
      [foot, new Vector3(-0.16, d.boomTop + 0.72, -0.17), tip], 0.024, 8,
    ))

    const head = loftRoundedBox(0.26, 0.22, 0.26, 0.05)
    head.translate(tip.x - 0.02, tip.y + 0.08, tip.z)
    body.push(head)
    const cowl = bevelBox(0.09, 0.17, 0.2, 0.018)
    cowl.translate(tip.x - 0.17, tip.y + 0.07, tip.z)
    hardware.push(cowl)
    const eye = bevelDisc(0.05, 0.016, 0.004, 18)
    eye.rotateY(-Math.PI / 2)
    eye.translate(tip.x - 0.215, tip.y + 0.07, tip.z)
    lenses.push(eye)

    hardware.push(member(
      new Vector3(tip.x + 0.1, tip.y - 0.22, tip.z + 0.03),
      new Vector3(Math.min(d.boomX1 - 0.4, 0.98), d.boomTop - 0.01, -0.02),
      0.009,
      6,
    ))

    // Service loom off the elbow and down the mast's raked front face. It hangs clear of the loft rather
    // than tracing it, because a cable pulled tight to a curved flank reads as a moulded rib.
    //
    // It used to run the whole boom before dropping, which is truer to the photograph and wrong here: a
    // dark line held parallel to the boom for four metres rebuilds the ladder the top rail was removed
    // for, at a tenth of the diameter. Off the elbow it is a cable; along the boom it is a second chord.
    hardware.push(taperedTube([
      new Vector3(0.72, d.boomTop - 0.012, 0.05),
      new Vector3(0.34, config.height - 0.22, 0.12),
      new Vector3(0.4, d.mastY(0.6), 0.18),
      new Vector3(0.38, d.mastY(0.22), 0.2),
      new Vector3(0.22, PLATE_TOP + 0.05, 0.16),
    ], 0.013, 6))
  }

  /**
   * The umbilical: one continuous hi-vis run from a gland on the boom, down in a slack catenary, into a
   * loose coil left on the tarmac, wrapped at intervals with black bands.
   *
   * It is modelled as a single curve so the drop and the coil cannot part company at the transition, and
   * the coil is what stops the drop reading as a stiff rod hung off the boom. Sagging outboard on the
   * way down and doubling back into the coil also puts the cable *across* the boom's line, which is what
   * makes both objects legible in a single silhouette.
   */
  const buildUmbilical = (
    cable: BufferGeometry[], bands: BufferGeometry[], d: Solved,
  ): void => {
    const { height } = config
    const coilCx = d.dropX - 0.78
    const coilCz = -0.55
    const coil: Vector3[] = []
    const turns = 31
    for (let i = 0; i <= turns; i++) {
      const k = i / turns
      const a = 0.5 + k * Math.PI * 3.1
      const r = 0.62 - k * 0.26
      coil.push(new Vector3(
        coilCx + Math.cos(a) * r,
        0.052 + Math.sin(i * 0.9) * 0.006,
        coilCz + Math.sin(a) * r * 0.86,
      ))
    }

    const path: Vector3[] = [
      new Vector3(d.dropX, height + 0.01, 0.02),
      new Vector3(d.dropX + 0.13, height - 0.62, 0.1),
      new Vector3(d.dropX + 0.26, height - 1.35, 0.16),
      new Vector3(d.dropX + 0.22, Math.max(0.6, height - 2.05), 0.11),
      new Vector3(d.dropX + 0.04, 0.42, -0.04),
      ...coil,
    ]
    cable.push(taperedTube(path, CABLE_R, 8))

    const curve = new CatmullRomCurve3(path)
    for (const t of [0.05, 0.13, 0.22, 0.31, 0.40, 0.52, 0.64, 0.78, 0.9]) {
      const p = curve.getPointAt(t)
      const tangent = curve.getTangentAt(t)
      bands.push(tubeSection(
        BAND_R, 0.085, [p.x, p.y, p.z], [tangent.x, tangent.y, tangent.z], 10,
      ))
    }

    // Gland on the boom, and the moulded boot on the free end lying in the coil.
    bands.push(tubeSection(0.082, 0.11, [d.dropX, d.boomCy, 0], AXIS_X, 14))
    const tail = coil[coil.length - 1]!
    bands.push(tubeSection(0.058, 0.16, [tail.x - 0.07, tail.y + 0.005, tail.z], AXIS_X, 12))
  }

  const rebuild = (): void => {
    releaseGenerated()
    const d = solve()

    const mastBody: BufferGeometry[] = []
    const mastHardware: BufferGeometry[] = []
    const boomBody: BufferGeometry[] = []
    const boomHardware: BufferGeometry[] = []
    const boomLenses: BufferGeometry[] = []
    const cable: BufferGeometry[] = []
    const bands: BufferGeometry[] = []

    buildMast(mastBody, mastHardware, d)
    buildWishbone(mastBody, d)
    buildBoom(boomBody, boomHardware, d)
    buildPods(boomBody, boomLenses, d)
    buildCameraMast(boomBody, boomHardware, boomLenses, d)
    buildUmbilical(cable, bands, d)

    emit('post', mergeParts(mastBody, 'mast: body'), mast, 'body')
    emit('fitting', mergeParts(mastHardware, 'mast: hardware'), mast, 'hardware')
    emit('post', mergeParts(boomBody, 'boom: body'), boom, 'body')
    emit('fitting', mergeParts(boomHardware, 'boom: hardware'), boom, 'hardware')
    emit('lens', mergeParts(boomLenses, 'boom: lenses'), boom, 'lenses')
    emit('banner', mergeParts(cable, 'umbilical: cable'), umbilical, 'cable')
    emit('band', mergeParts(bands, 'umbilical: bands'), umbilical, 'bands')
  }
  rebuild()

  return {
    root,
    parts: { mast, boom, umbilical },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.span !== undefined) config.span = Math.max(1.6, patch.span)
      if (patch.height !== undefined) config.height = Math.max(1.8, patch.height)
      if (patch.bays !== undefined) config.bays = Math.min(8, Math.max(1, Math.round(patch.bays)))
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      for (const material of owned) material.dispose()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  // Framed the way the reference was shot: low, near the mast, with the boom running away across frame.
  // The eye sits under the soffit, which is what opens the underside up and lets the wishbone's void and
  // the soffit pods read at all — level with the boom they collapse into its own line. The camera stays
  // off the mast's plane of symmetry so the mast reads as a wedge with depth rather than a flat blade.
  return createF1Preview(createModel(), {
    aspect,
    target: [1.5, 1.95, 0],
    distance: 8.3,
    yaw: -0.6,
    pitch: 0.05,
    fov: 46,
  })
}
