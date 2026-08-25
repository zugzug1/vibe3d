// f1-tyre-stack — a long chrome two-tier trolley packed with individually blanketed F1 tyres: the
// pit-lane landmark a garage is read by. Each padded warmer covers its tyre with a dished face, a hard
// shoulder and a flat tread wrap, so the row grooves into distinct courses instead of merging into one
// drum. The outermost warmer carries the supplier's ring mark, and the near course of the bottom tier
// goes out unbagged so the tyre's own sidewall and tread mass stay readable. Depends on `f1-tyre` for
// that anatomy while keeping stable stack-level runtime anchors and configuration.

import {
  BufferGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  COMPOUND_TOKEN,
  TOKEN,
  acquireF1Materials,
  arcBand,
  bevelBox,
  castor,
  createCompoundMaterial,
  createF1Preview,
  disposeF1Materials,
  mergeParts,
  shade,
  taperedTube,
} from '../f1-kit-core/index.ts'
import {
  createModel as createTyre,
  type F1Compound,
  type F1TyreInstance,
} from '../f1-tyre/model.ts'

type Slot = 'blanket' | 'strap' | 'cable'

export interface F1TyreStackConfig {
  /** Number of tyres in the stack. */
  count: number
  /** Which compound the stacked tyres are graded as, using the sport's official sidewall colour key. */
  compound: F1Compound
  /** Rim colour, passed through to every tyre's `cover` slot. */
  coverColor: number
  /** Livery accent, passed through to every tyre's `accent` slot. */
  accentColor: number
}

export interface F1TyreStackOptions extends Partial<F1TyreStackConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1TyreStackInstance {
  readonly root: Group
  readonly parts: { tyres: Group; blanket: Group; cable: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1TyreStackConfig>
  configure(patch: Partial<F1TyreStackConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1TyreStackConfig = {
  // A trolley, not a set. Four tyres on a two-tier rack leaves a frame taller than it is long, which
  // reads as a cage with two drums in it; a garage stages three sets at a time, and the long dense row
  // of courses is the whole silhouette of this prop.
  count: 12,
  compound: 'medium',
  coverColor: shade(TOKEN.INK_950, 0.04),
  // A tyre waiting on a trolley is undressed: black rubber, dark forged rim, no team colour on it
  // anywhere. Livery belongs to whoever installs the prop, so the default keeps the unbagged course
  // reading as rubber rather than putting a bright ring through the one wheel on show.
  accentColor: TOKEN.GRAPHITE_800,
}

const R = 0.36             // tyre outer radius, matching a default f1-tyre (720 mm OD)
const BLANKET_HALF = 0.18  // half a padded warmer's width, measured at its widest point
const BLANKET_R = R + 0.04 // a warmer's outer radius over the tread
const TH = 0.366           // course pitch: a warmer's full width plus a 6 mm seam

const FRAME_HALF_D = 0.42  // frame half-depth — clear of the 0.80 m courses, so posts read in front of them
const CRADLE_Z = 0.2       // how far off centre the pair of rails each tier nests between sits
const TIER_Y = [0.56, 1.4] as const
const HOOP_TOP = 1.52      // the push handles are the only frame member that rises past the top tier

// Buried tyres do not need the hero tread resolution — the blanket hides most of the crown, and only the
// bottom course and the top sidewall are ever seen. This is the tyre's single LOD knob.
const STACK_TREAD_SEGMENTS = 12

// ---------------------------------------------------------------------------------------------------
// Local geometry helpers, deliberately private to this file rather than shared through f1-kit-core:
// every `.ts` under f1-kit-core ships to kit consumers as permanent public surface.
// ---------------------------------------------------------------------------------------------------

/** A solid of revolution about +Y from an absolute `[radius, y]` profile. */
function latheY(profile: ReadonlyArray<readonly [number, number]>, segments: number): BufferGeometry {
  return new LatheGeometry(profile.map(([r, y]) => new Vector2(Math.max(1e-4, r), y)), segments)
}

/** A stable per-course value in -1..1, so a dozen bagged tyres are not a dozen identical ones. */
function jitter(index: number, salt: number): number {
  return Math.sin((index + 1) * 12.9898 + salt * 4.1414)
}

/**
 * Wobble a revolve's radius as a smooth function of angle and height.
 *
 * A LatheGeometry is a machined arc by construction: every horizontal cross-section is a perfect circle,
 * which is exactly what makes a swept blanket read as a moulded drum however well the vertical profile is
 * shaped. Perturbing the radius per vertex breaks that circle without needing a hand-authored sweep, and
 * `phase` moves the perturbation on per course, so the row is not one slack shape repeated a dozen times.
 */
function wobble(geometry: BufferGeometry, amount: number, phase: number): BufferGeometry {
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const radius = Math.hypot(x, z)
    if (radius < 1e-5) continue
    const angle = Math.atan2(z, x)
    // Two incommensurate harmonics, so the section never repeats cleanly around the circumference.
    const scale = 1 + amount * (
      Math.sin(angle * 3 + y * 4.1 + phase) * 0.6 + Math.sin(angle * 5 - y * 2.7 + phase * 1.7) * 0.4
    )
    position.setX(i, x * scale)
    position.setZ(i, z * scale)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Sample a polyline with a rounded bend at each interior corner, for bent tube stock.
 *
 * `taperedTube` runs a Catmull-Rom through whatever it is given, so feeding it bare corners rounds every
 * bend by an amount nobody chose and overshoots the outside of tight ones. Sampling the fillet here makes
 * the bend radius a stated dimension instead.
 */
function bentPath(corners: readonly Vector3[], fillet: number, perCorner = 5): Vector3[] {
  const path: Vector3[] = [corners[0].clone()]
  for (let i = 1; i < corners.length - 1; i++) {
    const [previous, here, next] = [corners[i - 1], corners[i], corners[i + 1]]
    const back = new Vector3().subVectors(previous, here)
    const forward = new Vector3().subVectors(next, here)
    const radius = Math.min(fillet, back.length() * 0.48, forward.length() * 0.48)
    const start = here.clone().addScaledVector(back.normalize(), radius)
    const end = here.clone().addScaledVector(forward.normalize(), radius)
    for (let step = 0; step <= perCorner; step++) {
      const t = step / perCorner
      path.push(start.clone().multiplyScalar((1 - t) * (1 - t))
        .addScaledVector(here, 2 * (1 - t) * t)
        .addScaledVector(end, t * t))
    }
  }
  path.push(corners[corners.length - 1].clone())
  return path
}

/**
 * The half-profile of a padded warmer, as `[radius, inset from the widest plane]`.
 *
 * This shape carries the whole read of the prop, and the governing dimension is the radius at which the
 * profile is widest — because that is what a neighbouring course butts against, and the drop from the
 * tread wrap down to it is the groove the eye counts courses by. Put the widest point on the face, as a
 * crowned barrel does, and each course pinches to a peanut with a 90 mm valley chewed out between them.
 * Put it just under the wrap, as a bag pulled tight over a wheel does, and the row closes up into
 * distinct drums parted by a seam. Inboard of that corner the face runs nearly flat and dishes into the
 * rim well, which is the surface the printed marks need.
 */
const BLANKET_HALF_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.001, 0.036],
  [R * 0.32, 0.022],
  [R * 0.66, 0.008],
  [R * 0.88, 0.002],
  [R + 0.024, 0],     // widest: 96% of the wrap radius, so courses part with a seam and not a notch
  [R + 0.036, 0.01],
  [BLANKET_R, 0.026], // and the tread wrap runs at constant radius from here
]

export function createModel(options: F1TyreStackOptions = {}): F1TyreStackInstance {
  const config: F1TyreStackConfig = {
    count: Math.max(1, Math.round(options.count ?? defaults.count)),
    compound: options.compound ?? defaults.compound,
    coverColor: options.coverColor ?? defaults.coverColor,
    accentColor: options.accentColor ?? defaults.accentColor,
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const extras: Material[] = []
  const own = <T extends Material>(material: T): T => {
    extras.push(material)
    return material
  }

  // Warmers photograph near black with a soft sheen. The shared `fabric` value is pitched for a single
  // strap or bag read against a dark garage; a whole row of it turns the courses mid grey and the
  // grading bands stop being the brightest thing on the prop.
  const quilt = own(kit.fabric.clone())
  quilt.name = 'f1-tyre-stack / warmer shell'
  quilt.color.set(shade(TOKEN.INK_950, -0.1))
  quilt.roughness = 0.9

  // The webbing is the compound's grading colour, which is what a row of these is actually read by from
  // the pit wall — dyed a value step down from the moulded sidewall paint the token names, or a dozen
  // bands across a black row blow out to cream. Owned here so `configure({ compound })` recolours it,
  // and never mutated if a consumer supplied their own strap material (rule 16).
  const webbing = own(createCompoundMaterial(config.compound))
  webbing.name = 'f1-tyre-stack / webbing'
  webbing.color.set(shade(COMPOUND_TOKEN[config.compound], -0.22))
  webbing.roughness = 0.82

  const materialSlots: Record<Slot, Material> = {
    blanket: options.materials?.blanket ?? quilt,
    strap: options.materials?.strap ?? webbing,
    cable: options.materials?.cable ?? kit.ink,
  }

  // Runtime anchors: created once, never replaced (rules 10, 14).
  const root = new Group()
  root.name = 'f1-tyre-stack'
  const tyresGroup = new Group(); tyresGroup.name = 'tyres'
  const blanketGroup = new Group(); blanketGroup.name = 'blanket'
  const cableGroup = new Group(); cableGroup.name = 'cable'
  root.add(tyresGroup, blanketGroup, cableGroup)

  // Shared cover/accent materials handed to every tyre instance (one pair, not one per tyre) — owned here
  // so recolouring the stack recolours every tyre in one place. The children treat these as
  // consumer-supplied and never dispose them, so ownership stays here (rule 16).
  const tyreCover = own(new MeshStandardMaterial({ color: config.coverColor, roughness: 0.4, metalness: 0.2 }))
  const tyreAccent = own(new MeshStandardMaterial({ color: config.accentColor, roughness: 0.5, metalness: 0.1 }))

  let prototype: F1TyreInstance | null = null
  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { blanket: [], strap: [], cable: [] }

  const releaseGenerated = (): void => {
    tyresGroup.clear()
    prototype?.dispose()
    prototype = null
    blanketGroup.clear()
    cableGroup.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  /** Rack hardware and printed marks: geometry the stack owns outright, with no consumer material slot. */
  const fixture = (geometry: BufferGeometry, material: Material, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    blanketGroup.add(mesh)
  }

  const rebuild = (): void => {
    releaseGenerated()
    const { count, compound } = config

    const columns = Math.ceil(count / 2)
    const rowHalf = ((columns - 1) / 2) * TH + BLANKET_HALF
    // On a row this long one course can be spared: the near one on the bottom tier goes out unbagged, so
    // the prop still shows what is inside all the others.
    const bare = count >= 8 ? 0 : -1
    const tyrePosition = (index: number): Vector3 =>
      new Vector3(((index % columns) - (columns - 1) / 2) * TH, TIER_Y[index < columns ? 0 : 1], 0)

    // --- The tyres themselves ------------------------------------------------------------------------
    // One tyre geometry set, drawn `count` times via InstancedMesh. GPU buffers exist once; dispose
    // runs once on the prototype. The prototype root stays off-scene so its meshes are not extra draws.
    prototype = createTyre({
      compound,
      treadSegments: STACK_TREAD_SEGMENTS,
      materials: { cover: tyreCover, accent: tyreAccent },
    })
    prototype.root.updateMatrixWorld(true)
    const pose = new Matrix4()
    const composed = new Matrix4()
    prototype.root.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const instanced = new InstancedMesh(mesh.geometry, mesh.material, count)
      instanced.name = mesh.name
      instanced.castShadow = true
      instanced.receiveShadow = true
      for (let i = 0; i < count; i++) {
        pose.makeRotationY(Math.PI / 2)
        pose.setPosition(tyrePosition(i))
        composed.copy(pose).multiply(mesh.matrixWorld)
        instanced.setMatrixAt(i, composed)
      }
      instanced.instanceMatrix.needsUpdate = true
      tyresGroup.add(instanced)
    })

    // --- Individual full-coverage warmers ------------------------------------------------------------
    const profile: Array<readonly [number, number]> = [
      ...BLANKET_HALF_PROFILE.map(([r, inset]) => [r, -BLANKET_HALF + inset] as const),
      ...[...BLANKET_HALF_PROFILE].reverse().map(([r, inset]) => [r, BLANKET_HALF - inset] as const),
    ]
    const blanketParts: BufferGeometry[] = []
    for (let i = 0; i < count; i++) {
      if (i === bare) continue
      const position = tyrePosition(i)
      const warmer = wobble(latheY(profile, 44), 0.008, jitter(i, 0) * Math.PI)
      warmer.rotateZ(-Math.PI / 2)
      warmer.translate(position.x, position.y, position.z)
      blanketParts.push(warmer)
    }
    emit('blanket', mergeParts(blanketParts, 'blankets'), blanketGroup, 'blankets')

    // --- Flat grading webbing and its closure --------------------------------------------------------
    const strapParts: BufferGeometry[] = []
    for (let i = 0; i < count; i++) {
      if (i === bare) continue
      const position = tyrePosition(i)
      // About a fifth of the course pitch. Any thinner and it reads as piping on a black bag; any wider
      // and a dozen of them turn the whole row into a banded pattern with no black left to sit on.
      const half = 0.038
      const band = latheY([
        [BLANKET_R - 0.002, -half],
        [BLANKET_R + 0.011, -half + 0.005],
        [BLANKET_R + 0.011, half - 0.005],
        [BLANKET_R - 0.002, half],
        [BLANKET_R - 0.002, -half],
      ], 44)
      band.rotateZ(-Math.PI / 2)
      band.translate(position.x, position.y, position.z)
      strapParts.push(band)
      // Nobody does the buckles up at the same point on the clock, and a row of a dozen identical ones
      // at bottom-dead-centre is the tell that this was generated. Spread them over the aisle side.
      const closure = bevelBox(0.058, 0.052, 0.03, 0.005)
      closure.translate(0, 0, BLANKET_R + 0.006)
      closure.rotateX(jitter(i, 1) * 0.85 - 0.35)
      closure.translate(position.x, position.y, position.z)
      strapParts.push(closure)
    }
    emit('strap', mergeParts(strapParts, 'straps'), blanketGroup, 'straps')

    // --- The supplier's ring mark, on the one face that is actually seen -----------------------------
    // Every other face is buried by the next course, and the bottom tier's near course is unbagged, so
    // this is one pair of arcs rather than `count` of them. They sit inside the flat of the face: run
    // them out near the shoulder and the surface has already begun to turn, which foreshortens the ring
    // to a thread from any angle that shows the row.
    const faceX = -rowHalf + 0.012 // 4 mm into the face at the radii the arcs occupy, 8 mm proud of it
    const mark = (rIn: number, rOut: number, from: number, to: number): BufferGeometry => {
      const band = arcBand(BLANKET_R * rIn, BLANKET_R * rOut, from * Math.PI, to * Math.PI, 0.012, 0.002)
      band.rotateY(-Math.PI / 2)
      band.translate(faceX, TIER_Y[1], 0)
      return band
    }
    fixture(mergeParts([
      mark(0.53, 0.66, -0.28, 1.08),
      mark(0.44, 0.75, 0.8, 1.2),
    ], 'face-marks'), kit.amber, 'face-marks')

    // --- Chrome two-tier wheeled trolley -------------------------------------------------------------
    // The frame is deliberately subordinate. It stops at the upper cradle, so the top tier crowns free
    // and only the push hoops rise past it: boxing the row in on all six sides is what made the previous
    // rack read as a cage with drums inside rather than a trolley carrying tyres. Two bays rather than
    // three for the same reason — a centre upright lands square in the middle of the row and splits the
    // silhouette in half.
    const rackParts: BufferGeometry[] = []
    const endX = rowHalf + 0.1
    const cradleY = (centre: number): number => centre - Math.sqrt(BLANKET_R ** 2 - CRADLE_Z ** 2) + 0.012
    const bays = [-(rowHalf - 0.26), rowHalf - 0.26]

    for (const sx of [-1, 1] as const) {
      rackParts.push(taperedTube(bentPath([
        new Vector3(sx * endX, 0.16, -FRAME_HALF_D),
        new Vector3(sx * endX, HOOP_TOP, -FRAME_HALF_D),
        new Vector3(sx * endX, HOOP_TOP, FRAME_HALF_D),
        new Vector3(sx * endX, 0.16, FRAME_HALF_D),
      ], 0.26), 0.028, 10))
    }
    for (const y of [0.16, 0.99]) {
      for (const sz of [-1, 1] as const) {
        rackParts.push(taperedTube([
          new Vector3(-endX, y, sz * FRAME_HALF_D),
          new Vector3(endX, y, sz * FRAME_HALF_D),
        ], 0.023, 10))
      }
    }
    for (const centre of TIER_Y) {
      const y = cradleY(centre)
      for (const sz of [-1, 1] as const) {
        rackParts.push(taperedTube([
          new Vector3(-rowHalf - 0.05, y, sz * CRADLE_Z),
          new Vector3(rowHalf + 0.05, y, sz * CRADLE_Z),
        ], 0.021, 10))
      }
      for (const x of bays) {
        rackParts.push(taperedTube([
          new Vector3(x, y, -FRAME_HALF_D),
          new Vector3(x, y, FRAME_HALF_D),
        ], 0.021, 10))
      }
    }
    for (const x of bays) {
      for (const sz of [-1, 1] as const) {
        rackParts.push(taperedTube([
          new Vector3(x, 0.16, sz * FRAME_HALF_D),
          new Vector3(x, cradleY(TIER_Y[1]) + 0.02, sz * FRAME_HALF_D),
        ], 0.022, 10))
      }
    }
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        rackParts.push(castor([sx * (rowHalf - 0.26), 0, sz * FRAME_HALF_D], 0.074, sx * sz * 0.4))
      }
    }
    fixture(mergeParts(rackParts, 'rack'), kit.steel, 'two-tier-rack')

    // --- One short lead and connector per warmer ----------------------------------------------------
    const cableParts: BufferGeometry[] = []
    for (let i = 0; i < count; i++) {
      if (i === bare) continue
      const position = tyrePosition(i)
      const side = i % 2 === 0 ? 1 : -1
      // Leaves the wrap up near the crown, angled out toward the aisle a garage would plug it in from.
      const lift = 0.5 + jitter(i, 2) * 0.14
      const start = new Vector3(
        position.x + side * 0.05,
        position.y + BLANKET_R * Math.cos(lift),
        BLANKET_R * Math.sin(lift),
      )
      cableParts.push(taperedTube([
        start,
        new Vector3(start.x + side * 0.06, start.y + 0.028, start.z + 0.05),
        new Vector3(start.x + side * 0.11, start.y - 0.008, start.z + 0.076),
      ], 0.011, 8))
      const connector = bevelBox(0.046, 0.026, 0.028, 0.004)
      connector.translate(start.x + side * 0.13, start.y - 0.012, start.z + 0.076)
      cableParts.push(connector)
    }
    emit('cable', mergeParts(cableParts, 'cables'), cableGroup, 'cables')
  }
  rebuild()

  return {
    root,
    parts: { tyres: tyresGroup, blanket: blanketGroup, cable: cableGroup },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.count !== undefined) config.count = Math.max(1, Math.round(patch.count))
      if (patch.compound !== undefined) { config.compound = patch.compound; webbing.color.set(shade(COMPOUND_TOKEN[patch.compound], -0.22)) }
      if (patch.coverColor !== undefined) { config.coverColor = patch.coverColor; tyreCover.color.set(patch.coverColor) }
      if (patch.accentColor !== undefined) { config.accentColor = patch.accentColor; tyreAccent.color.set(patch.accentColor) }
      rebuild()
    },
    setMaterial(slot, material) {
      // One mesh per slot, so this is a direct reassignment with no rebuild.
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      disposeF1Materials(bundle)
      for (const material of extras) material.dispose()
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), { aspect, target: [0, 0.95, 0], distance: 5.1, yaw: -0.62, pitch: 0.18 })
}
