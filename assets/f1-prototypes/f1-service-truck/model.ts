// f1-service-truck — DAF XG+ high-roof cab-over + aero box trailer.
// EU 96/53 artic ≤ 16.50 m. Unbranded: no DAF / Cadillac / Tesla marks.
// Wheels live on axle hubs (configure({ wheelRpm }) + update). Lamps are a slot
// (configure({ lamps }) / setMaterial('lamps', shader)). Live preview spins in
// place — raycast ride, no root translation.

import { LoftGeometry } from 'three/examples/jsm/geometries/LoftGeometry.js'
import {
  BufferGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  ExtrudeGeometry,
  FrontSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Path,
  PlaneGeometry,
  PointLight,
  Raycaster,
  Shape,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  AXIS_Z,
  DRIVER,
  LAYER_CLEARANCE,
  TRUCK,
  acquireF1Materials,
  bevelBox,
  bevelDisc,
  bevelPrism,
  bevelRing,
  boltRun,
  createF1Preview,
  createLampMaterial,
  disposeF1Materials,
  isFasciaStyle,
  isTruckKind,
  loftRoundedBox,
  member,
  mergeParts,
  truckLiveryTexture,
  type FasciaStyle,
  type TruckKind,
} from '../f1-kit-core/index.ts'

type Slot = 'cab' | 'glass' | 'lamps' | 'chassis' | 'cargo' | 'wheels' | 'livery'
type WheelKind = 'steer' | 'drive' | 'trailer'

export interface F1ServiceTruckConfig {
  kind: TruckKind
  wheelbase: number
  boxLength: number
  axles: number
  livery: FasciaStyle
  lamps: boolean
  wheelRpm: number
  paint: number
  legend: string
  number: string
  paper: number
  ink: number
  accent: number
}

export interface F1ServiceTruckOptions extends Partial<F1ServiceTruckConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1ServiceTruckInstance {
  readonly root: Group
  readonly parts: {
    cab: Group
    chassis: Group
    cargo: Group
    wheels: Group
    fascia: Group
    lamps: Group
  }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1ServiceTruckConfig>
  configure(patch: Partial<F1ServiceTruckConfig>): void
  setMaterial(slot: Slot, material: Material): void
  setGround(mesh: Object3D | null): void
  update(deltaSeconds: number): void
  dispose(): void
}

const TRACTOR = TRUCK.tractor
const CAB_LEN = TRUCK.cab
const WIDTH = TRUCK.width
const HEIGHT = TRUCK.height
const TYRE = TRUCK.tyreOd
const TYRE_W = 0.315
const GAP = TRUCK.gap
const MAX_LEN = TRUCK.length
const CLEAR = LAYER_CLEARANCE * 3
const DEMO_SPEED = 8
const DECK = 1.22

/** High-roof crown: the cab stands proud of the box and the spoiler ramps down onto it. */
const CAB_TOP = HEIGHT + 0.07

/** Trailer roof, held below the crown so the cab-over reads as the tall mass. */
const BOX_TOP = HEIGHT - 0.34

/** Reference truck is a signal-red special edition: high chroma, near-full value. */
const SIGNAL_RED = 0xd8121c

/** Bumper-to-tail. Trailer overlaps the tractor; overall is cab + hitch + box. */
function articLength(boxLen: number): number {
  return CAB_LEN + GAP + boxLen
}

const defaults: F1ServiceTruckConfig = {
  kind: 'box',
  wheelbase: TRUCK.wheelbase,
  boxLength: TRUCK.boxLength,
  axles: TRUCK.axles,
  livery: 'stamp',
  lamps: true,
  wheelRpm: 0,
  paint: SIGNAL_RED,
  legend: 'TEAM',
  number: DRIVER.number,
  paper: 0xf2f4f6,
  ink: 0x0c0c0e,
  accent: 0xf8f8fa,
}

function splitHex(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

function clampHex(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return value >>> 0 & 0xffffff
}

/** Rounded-rect ring in YZ at X — same width at belt and roof (not a Semi teardrop). */
function boxRing(
  x: number,
  yBot: number,
  yTop: number,
  width: number,
  radius: number,
): Vector3[] {
  const h = yTop - yBot
  const r = Math.min(radius, width / 2 - 1e-4, h * 0.18)
  const hz = width / 2
  const seg = 6
  const pts: Vector3[] = []
  const corner = (cz: number, cy: number, a0: number, rad: number): void => {
    for (let j = 0; j <= seg; j++) {
      const a = a0 + (j / seg) * (Math.PI / 2)
      pts.push(new Vector3(x, cy + rad * Math.sin(a), cz + rad * Math.cos(a)))
    }
  }
  corner(hz - r, yBot + r, -Math.PI / 2, r)
  corner(hz - r, yTop - r, 0, r)
  corner(-(hz - r), yTop - r, Math.PI / 2, r)
  corner(-(hz - r), yBot + r, Math.PI, r)
  pts.reverse()
  return pts
}

/** Trapezoidal panel standing in the face plane, extruded along X (the face normal). */
function facePanel(
  height: number,
  wBottom: number,
  wTop: number,
  depth: number,
  bevel: number,
): BufferGeometry {
  const h = height / 2
  const geo = bevelPrism(
    [[-wBottom / 2, -h], [wBottom / 2, -h], [wTop / 2, h], [-wTop / 2, h]],
    depth,
    bevel,
  )
  geo.rotateY(Math.PI / 2)
  return geo
}

function clampConfig(config: F1ServiceTruckConfig): void {
  config.kind = isTruckKind(config.kind) ? config.kind : 'box'
  config.axles = config.axles >= 3 ? 3 : 2
  const maxBox = MAX_LEN - CAB_LEN - GAP
  config.boxLength = Math.min(maxBox, Math.max(6.0, config.boxLength))
  config.wheelbase = Math.min(4.2, Math.max(3.2, config.wheelbase))
  config.livery = isFasciaStyle(config.livery) ? config.livery : 'stamp'
  config.lamps = Boolean(config.lamps)
  config.wheelRpm = Math.max(0, config.wheelRpm)
  config.paint = clampHex(config.paint, SIGNAL_RED)
  config.paper = clampHex(config.paper, 0xf2f4f6)
  config.ink = clampHex(config.ink, 0x0c0c0e)
  config.accent = clampHex(config.accent, 0xf8f8fa)
  config.legend = String(config.legend ?? '').replace(/[^0-9A-Za-z ]/g, '').slice(0, 8).toUpperCase()
  config.number = String(config.number ?? '').replace(/[^0-9A-Za-z]/g, '').slice(0, 3).toUpperCase() || DRIVER.number
}

/** Solid of revolution about +Z (the axle) from `[radius, z]` samples. */
function latheZ(profile: ReadonlyArray<readonly [number, number]>, segments: number): BufferGeometry {
  const points = profile.map(([r, z]) => new Vector2(Math.max(1e-4, r), z))
  const geo = new LatheGeometry(points, segments)
  geo.rotateX(Math.PI / 2)
  geo.computeVertexNormals()
  return geo
}

/** 315/80R22.5 casing: sidewall bulge, four circumferential grooves, blank sidewall. */
function highwayTyre(od: number, width: number, radial = 64): BufferGeometry {
  const r = od / 2
  const h = width / 2
  const bead = 0.286
  const g = 0.020
  const pts: Array<readonly [number, number]> = [
    [bead, -h],
    [bead + 0.018, -h + 0.008],
    [r * 0.68, -h * 0.92],
    [r * 0.86, -h * 0.52],
    [r * 0.96, -h * 0.22],
    [r * 0.995, -0.128],
    [r, -0.118],
    [r, -0.102],
    [r - g, -0.086],
    [r - g, -0.068],
    [r, -0.054],
    [r, -0.022],
    [r - g, -0.008],
    [r - g, 0.008],
    [r, 0.022],
    [r, 0.054],
    [r - g, 0.068],
    [r - g, 0.086],
    [r, 0.102],
    [r, 0.118],
    [r * 0.995, 0.128],
    [r * 0.96, h * 0.22],
    [r * 0.86, h * 0.52],
    [r * 0.68, h * 0.92],
    [bead + 0.018, h - 0.008],
    [bead, h],
  ]
  return latheZ(pts, radial)
}

/** Face Z of the 10-hole disc. Drive sits deep in the barrel. */
function rimFaceZ(kind: WheelKind): number {
  if (kind === 'drive') return 0.002
  if (kind === 'trailer') return 0.034
  return 0.056
}

/** Dark well behind the hand holes — kit.ink, never chrome. */
function wheelWell(kind: WheelKind): BufferGeometry {
  const well = bevelDisc(kind === 'trailer' ? 0.232 : 0.246, 0.012, 0.002, 28)
  well.translate(0, 0, rimFaceZ(kind) - 0.018)
  return well
}

/** Punched 10-hole disc (Alcoa / steel) — holes are paths, not spoke gaps. */
function punchedTenHole(
  outer: number,
  inner: number,
  pitch: number,
  holeR: number,
  depth: number,
): BufferGeometry {
  const shape = new Shape()
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false)
  const hub = new Path()
  hub.absarc(0, 0, inner, 0, Math.PI * 2, true)
  shape.holes.push(hub)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const hole = new Path()
    hole.absarc(Math.cos(a) * pitch, Math.sin(a) * pitch, holeR, 0, Math.PI * 2, true)
    shape.holes.push(hole)
  }
  const geo = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0024,
    bevelSize: 0.0024,
    bevelSegments: 1,
    curveSegments: 24,
    steps: 1,
  })
  geo.translate(0, 0, -depth / 2)
  geo.computeVertexNormals()
  return geo
}

/** 10-hole rim. Barrel stops at the hub tube so holes read against the dark well. */
function wheelRim(kind: WheelKind): BufferGeometry {
  const parts: BufferGeometry[] = []
  const deep = kind === 'drive'
  const simple = kind === 'trailer'
  const faceZ = rimFaceZ(kind)
  const dish = deep ? 0.112 : simple ? 0.044 : 0.032
  const outer = simple ? 0.268 : 0.276
  const holeR = simple ? 0.028 : 0.033
  const pitch = simple ? 0.168 : 0.176
  const faceDepth = deep ? 0.018 : simple ? 0.012 : 0.016
  parts.push(
    latheZ(
      [
        [0.048, -dish],
        [0.070, -dish + 0.008],
        [0.078, -0.006],
        [0.074, faceZ - 0.008],
        [0.052, faceZ - 0.004],
      ],
      28,
    ),
  )
  const face = punchedTenHole(outer, 0.078, pitch, holeR, faceDepth)
  face.translate(0, 0, faceZ)
  parts.push(face)
  const lip = bevelRing(outer - 0.010, outer + 0.006, faceDepth + 0.004, 0.002, 28)
  lip.translate(0, 0, faceZ)
  parts.push(lip)
  const cap = bevelDisc(deep ? 0.076 : 0.068, deep ? 0.036 : 0.028, 0.004)
  cap.translate(0, 0, faceZ + (deep ? 0.012 : 0.010))
  parts.push(cap)
  parts.push(boltRun([0, 0, faceZ + 0.018], 0.092, 10, 0.010, 0.018, AXIS_Z))
  return mergeParts(parts, `rim-${kind}`)
}

function demoRpm(speed = DEMO_SPEED): number {
  return (speed / (TYRE / 2)) * 60 / (Math.PI * 2)
}

export function createModel(options: F1ServiceTruckOptions = {}): F1ServiceTruckInstance {
  const config: F1ServiceTruckConfig = {
    kind: options.kind ?? defaults.kind,
    wheelbase: options.wheelbase ?? defaults.wheelbase,
    boxLength: options.boxLength ?? defaults.boxLength,
    axles: options.axles ?? defaults.axles,
    livery: options.livery ?? defaults.livery,
    lamps: options.lamps ?? defaults.lamps,
    wheelRpm: options.wheelRpm ?? defaults.wheelRpm,
    paint: options.paint ?? defaults.paint,
    legend: options.legend ?? defaults.legend,
    number: options.number ?? defaults.number,
    paper: options.paper ?? defaults.paper,
    ink: options.ink ?? defaults.ink,
    accent: options.accent ?? defaults.accent,
  }
  clampConfig(config)

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const extras: Material[] = []
  const owned: Material[] = []
  const textures: DataTexture[] = []
  let ownsLivery = options.materials?.livery === undefined
  const ownsCab = options.materials?.cab === undefined
  const cabPaint = options.materials?.cab ?? new MeshPhysicalMaterial({
    name: 'f1-kit / cab paint',
    color: config.paint,
    metalness: 0.10,
    roughness: 0.13,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    side: FrontSide,
  })
  if (ownsCab) owned.push(cabPaint)
  const tyreMat = kit.ink.clone()
  tyreMat.name = 'f1-kit / highway tyre'
  tyreMat.side = DoubleSide
  tyreMat.color.set(0x1a1a1c)
  tyreMat.roughness = 0.58
  owned.push(tyreMat)
  // Dark tinted greenhouse — see-through enough to sell cream seats / dash / screens
  // like the XG+ ref, without turning the cab into a clear display case.
  const glassMat = options.materials?.glass ?? new MeshStandardMaterial({
    name: 'f1-kit / cab glass',
    color: 0x243040,
    metalness: 0.12,
    roughness: 0.1,
    transparent: true,
    opacity: 0.10,
    side: FrontSide,
    depthWrite: true,
  })
  if (options.materials?.glass === undefined) owned.push(glassMat)
  const rimBright = new MeshPhysicalMaterial({
    name: 'f1-kit / steer rim',
    color: 0xe6eef4,
    metalness: 0.68,
    roughness: 0.12,
    clearcoat: 0.9,
    clearcoatRoughness: 0.05,
    side: FrontSide,
  })
  const rimSteel = new MeshPhysicalMaterial({
    name: 'f1-kit / steel rim',
    color: 0xa8b0b6,
    metalness: 0.38,
    roughness: 0.28,
    clearcoat: 0.22,
    clearcoatRoughness: 0.16,
    side: FrontSide,
  })
  owned.push(rimBright, rimSteel)
  const bumperMat = new MeshStandardMaterial({
    name: 'f1-kit / cab bumper',
    color: 0x121416,
    roughness: 0.62,
    metalness: 0.08,
    side: FrontSide,
  })
  owned.push(bumperMat)
  // Three values inside one cassette. Without the split the whole grille collapses
  // into a single dark rectangle at trailer distance.
  const grilleWell = new MeshStandardMaterial({
    name: 'f1-kit / grille well',
    color: 0x05070a,
    roughness: 0.94,
    metalness: 0.02,
    side: FrontSide,
  })
  const grilleBar = new MeshPhysicalMaterial({
    name: 'f1-kit / grille bar',
    color: 0x15181c,
    roughness: 0.22,
    metalness: 0.30,
    clearcoat: 0.85,
    clearcoatRoughness: 0.10,
    side: FrontSide,
  })
  const grilleEdge = new MeshPhysicalMaterial({
    name: 'f1-kit / grille separator',
    color: 0x6d767e,
    roughness: 0.34,
    metalness: 0.66,
    clearcoat: 0.5,
    clearcoatRoughness: 0.12,
    side: FrontSide,
  })
  owned.push(grilleWell, grilleBar, grilleEdge)
  // DRL blades are flat emissive strips, not lens-mapped cells. The shared lamp map
  // is a radial disc in 0..1: a wide lens stretches it into a blob and a row of
  // cells reads as buttons, which is what made the old face look studded.
  const drlOn = new MeshStandardMaterial({
    name: 'f1-kit / drl blade on',
    color: 0xdde6f2,
    emissive: 0x8fb2e0,
    emissiveIntensity: 0.75,
    roughness: 0.28,
    metalness: 0,
    side: FrontSide,
  })
  const drlOff = new MeshStandardMaterial({
    name: 'f1-kit / drl blade off',
    color: 0x1c2128,
    roughness: 0.16,
    metalness: 0.36,
    side: FrontSide,
  })
  owned.push(drlOn, drlOff)
  const vinyl = new MeshStandardMaterial({
    name: 'f1-kit / cab vinyl',
    color: 0xb8aea0,
    roughness: 0.72,
    metalness: 0.04,
    side: FrontSide,
  })
  owned.push(vinyl)
  const dashMat = new MeshStandardMaterial({
    name: 'f1-kit / cab dash',
    color: 0xcfc6b8,
    roughness: 0.62,
    metalness: 0.04,
    side: FrontSide,
  })
  owned.push(dashMat)
  const screenMat = new MeshStandardMaterial({
    name: 'f1-kit / cab screen',
    color: 0x1a2433,
    emissive: 0x9ec8ff,
    emissiveIntensity: 4.0,
    roughness: 0.35,
    metalness: 0.1,
    side: FrontSide,
  })
  owned.push(screenMat)
  const lampOn = options.materials?.lamps ?? createLampMaterial({
    on: true,
    color: 0xeef4ff,
    intensity: 5.2,
    name: 'f1-kit / cab lamp on',
  })
  const lampOff = createLampMaterial({
    on: false,
    color: 0xeef4ff,
    name: 'f1-kit / cab lamp off',
  })
  const amberOn = createLampMaterial({
    on: true,
    color: 0xffaa33,
    intensity: 2.8,
    name: 'f1-kit / marker on',
  })
  const amberOff = createLampMaterial({
    on: false,
    color: 0xffaa33,
    name: 'f1-kit / marker off',
  })
  if (options.materials?.lamps === undefined) owned.push(lampOn)
  owned.push(lampOff, amberOn, amberOff)
  const materialSlots: Record<Slot, Material> = {
    cab: cabPaint,
    glass: glassMat,
    lamps: lampOn,
    chassis: options.materials?.chassis ?? kit.graphite,
    cargo: options.materials?.cargo ?? cabPaint,
    wheels: options.materials?.wheels ?? kit.ink,
    livery: options.materials?.livery ?? kit.shell,
  }

  const root = new Group(); root.name = 'f1-service-truck'
  const cab = new Group(); cab.name = 'cab'
  const chassis = new Group(); chassis.name = 'chassis'
  const cargo = new Group(); cargo.name = 'cargo'
  const wheels = new Group(); wheels.name = 'wheels'
  const fascia = new Group(); fascia.name = 'fascia'
  const lamps = new Group(); lamps.name = 'lamps'
  root.add(cab, chassis, cargo, wheels, fascia, lamps)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = {
    cab: [], glass: [], lamps: [], chassis: [], cargo: [], wheels: [], livery: [],
  }
  const amberMeshes: Mesh[] = []
  const drlMeshes: Mesh[] = []
  const hubs: Group[] = []
  let spin = 0
  let ground: Object3D | null = null
  const raycaster = new Raycaster()
  const down = new Vector3(0, -1, 0)
  const origin = new Vector3()
  const tyreR = TYRE / 2

  const releaseOwnedLivery = (): void => {
    for (const texture of textures) texture.dispose()
    textures.length = 0
    for (const material of extras) material.dispose()
    extras.length = 0
  }

  const releaseGenerated = (): void => {
    cab.clear(); chassis.clear(); cargo.clear(); wheels.clear(); fascia.clear(); lamps.clear()
    hubs.length = 0
    amberMeshes.length = 0
    drlMeshes.length = 0
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
    if (ownsLivery) releaseOwnedLivery()
  }

  const emit = (
    slot: Slot,
    geometry: BufferGeometry,
    group: Group,
    name: string,
    material?: Material,
  ): Mesh => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, material ?? materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
    return mesh
  }

  const emitAmber = (geometry: BufferGeometry, name: string): void => {
    const mesh = emit('lamps', geometry, lamps, name, amberOn)
    amberMeshes.push(mesh)
  }

  const emitDrl = (geometry: BufferGeometry, name: string): void => {
    const mesh = emit('lamps', geometry, lamps, name, drlOn)
    drlMeshes.push(mesh)
  }

  const applySpin = (): void => {
    for (const hub of hubs) hub.rotation.z = spin
  }

  const applyRide = (): void => {
    if (!ground) {
      for (const hub of hubs) hub.position.y = tyreR
      return
    }
    root.updateMatrixWorld(true)
    ground.updateMatrixWorld(true)
    for (const hub of hubs) {
      hub.getWorldPosition(origin)
      origin.y += 2.4
      raycaster.set(origin, down)
      const hits = raycaster.intersectObject(ground, true)
      if (hits[0]) hub.position.y = hits[0].point.y - root.position.y + tyreR - 0.006
      else hub.position.y = tyreR
    }
  }

  const applyLamps = (): void => {
    const white = config.lamps ? materialSlots.lamps : lampOff
    const amber = config.lamps ? amberOn : amberOff
    // A consumer shader supplied through setMaterial('lamps') owns every lit
    // surface; the blade pair is only the default look.
    const blade = config.lamps
      ? (materialSlots.lamps === lampOn ? drlOn : materialSlots.lamps)
      : drlOff
    for (const mesh of meshesBySlot.lamps) {
      if (amberMeshes.includes(mesh)) mesh.material = amber
      else if (drlMeshes.includes(mesh)) mesh.material = blade
      else mesh.material = white
    }
  }

  const rebuild = (): void => {
    releaseGenerated()
    const boxLen = config.boxLength
    const overall = articLength(boxLen)
    const nose = -overall / 2
    const cabX0 = nose
    const cabX1 = nose + CAB_LEN
    const fifth = nose + TRACTOR
    const boxX0 = cabX1 + GAP
    const boxX1 = boxX0 + boxLen
    const boxX = boxX0 + boxLen / 2
    const steerX = nose + 1.38
    const driveX = steerX + config.wheelbase
    const trailerAxles = config.axles
    const bogie0 = overall / 2 - 1.02 - (trailerAxles - 1) * 1.32
    const axleXs = [steerX, driveX]
    for (let i = 0; i < trailerAxles; i++) axleXs.push(bogie0 + i * 1.32)
    // XG+ datums: cab floor 1.58 m (three steps up), belt 2.30, screen header
    // 3.38 — the greenhouse is a ~1.08 m ribbon high on a tall slab-sided shell,
    // which leaves a 1.2 m continuous red slab below it.
    const yFloor = 0.98
    const yBelt = 2.30
    const yCabin = 1.58
    const yWin = 3.38
    const yRoof = CAB_TOP - 0.02
    const hz = WIDTH / 2
    const bandY = (yBelt + yWin) / 2
    const bandH = yWin - yBelt
    const glassX0 = cabX0 + 0.62
    const glassX1 = cabX0 + 1.98

    // The lower body keeps full width along the flanks and tucks the front corners
    // in only enough to leave a red border around the grille cassette — the face is
    // narrower than the widest point, but not tapered into a toy nose.
    const cabBody = new LoftGeometry(
      [
        boxRing(cabX0 + 0.07, yFloor + 0.02, yBelt + 0.02, WIDTH - 0.38, 0.11),
        boxRing(cabX0 + 0.18, yFloor - 0.02, yBelt + 0.06, WIDTH - 0.29, 0.14),
        boxRing(cabX0 + 0.36, yFloor - 0.06, yBelt + 0.08, WIDTH - 0.19, 0.17),
        boxRing(cabX0 + 0.66, yFloor - 0.10, yBelt + 0.10, WIDTH - 0.06, 0.19),
        boxRing(cabX0 + 1.25, yFloor - 0.10, yBelt + 0.10, WIDTH, 0.16),
        boxRing(cabX1 - 0.22, yFloor - 0.06, yBelt + 0.08, WIDTH - 0.04, 0.14),
        boxRing(cabX1, yFloor + 0.08, yBelt + 0.04, WIDTH - 0.18, 0.12),
      ],
      { closed: true, capStart: true, capEnd: true },
    )
    emit('cab', cabBody, cab, 'body')

    // Roof front sits well behind the lower face — that setback, not a tapered
    // nose, is the XG+ rake. The crown clears the trailer roof.
    const cabRoof = new LoftGeometry(
      [
        boxRing(cabX0 + 0.24, yWin, yRoof - 0.13, WIDTH - 0.38, 0.09),
        boxRing(cabX0 + 0.34, yWin - 0.02, yRoof - 0.04, WIDTH - 0.22, 0.11),
        boxRing(cabX0 + 0.50, yWin - 0.02, CAB_TOP - 0.03, WIDTH - 0.08, 0.12),
        boxRing(cabX0 + 0.74, yWin - 0.02, CAB_TOP, WIDTH, 0.12),
        boxRing(cabX0 + 1.24, yWin - 0.02, CAB_TOP, WIDTH, 0.14),
        boxRing(cabX1 - 0.22, yWin, CAB_TOP - 0.08, WIDTH - 0.04, 0.12),
        boxRing(cabX1, yWin + 0.06, CAB_TOP - 0.22, WIDTH - 0.18, 0.10),
      ],
      { closed: true, capStart: true, capEnd: true },
    )
    emit('cab', cabRoof, cab, 'roof')

    // Painted shell across the belt-to-header band, pierced only by the screen
    // and the door windows. Without it the whole cab reads as a glass box.
    for (const sz of [-1, 1] as const) {
      const quarter = bevelBox(cabX1 - glassX1, bandH, 0.18, 0.02)
      quarter.translate((glassX1 + cabX1) / 2, bandY, sz * (hz - 0.09))
      emit('cab', quarter, cab, `sleeper-panel-${sz}`)
      const nook = bevelBox(glassX0 - cabX0 - 0.20, bandH, 0.12, 0.02)
      nook.rotateZ(-0.30)
      nook.translate((cabX0 + 0.28 + glassX0) / 2, bandY, sz * (hz - 0.11))
      emit('cab', nook, cab, `screen-corner-${sz}`)
    }
    const cabRear = bevelBox(0.16, bandH, WIDTH - 0.08, 0.03)
    cabRear.translate(cabX1 - 0.10, bandY, 0)
    emit('cab', cabRear, cab, 'cab-rear')

    const packH = yCabin - 1.08
    const cabinPack = bevelBox(CAB_LEN - 0.55, packH, WIDTH - 0.42, 0.01)
    cabinPack.translate(cabX0 + CAB_LEN / 2 + 0.08, 1.08 + packH / 2, 0)
    emit('cab', cabinPack, cab, 'cabin-pack', kit.ink)
    const cabFloor = bevelBox(CAB_LEN - 0.55, 0.06, WIDTH - 0.42, 0.008)
    cabFloor.translate(cabX0 + CAB_LEN / 2 + 0.08, yCabin + 0.02, 0)
    emit('cab', cabFloor, cab, 'cabin-floor', kit.slate)

    const liner = bevelBox(CAB_LEN - 0.7, 0.04, WIDTH - 0.48, 0.006)
    liner.translate(cabX0 + 1.55, CAB_TOP - 0.16, 0)
    emit('cab', liner, cab, 'headliner', kit.graphite)

    const bulkhead = bevelBox(0.07, CAB_TOP - yCabin - 0.22, WIDTH - 0.38, 0.01)
    bulkhead.translate(cabX1 - 0.10, (yCabin + CAB_TOP) / 2 - 0.02, 0)
    emit('cab', bulkhead, cab, 'bulkhead', kit.ink)

    // Interior lives in the open greenhouse band (yBelt→yWin). The lower loft is a
    // solid red volume through yBelt — anything ≤ yBelt is invisible forever.
    const dash = bevelBox(0.38, 0.22, WIDTH - 0.50, 0.02)
    dash.rotateZ(-0.10)
    dash.translate(cabX0 + 0.55, yBelt + 0.14, 0)
    emit('cab', dash, cab, 'dash', dashMat)
    const dashTop = bevelBox(0.30, 0.03, WIDTH - 0.58, 0.01)
    dashTop.rotateZ(-0.10)
    dashTop.translate(cabX0 + 0.50, yBelt + 0.28, 0)
    emit('cab', dashTop, cab, 'dash-top', dashMat)
    const cluster = bevelBox(0.05, 0.10, 0.34, 0.010)
    cluster.translate(cabX0 + 0.68, yBelt + 0.26, 0.44)
    emit('cab', cluster, cab, 'cluster', kit.ink)
    const clusterGlass = new PlaneGeometry(0.28, 0.08)
    clusterGlass.rotateY(Math.PI / 2)
    clusterGlass.translate(cabX0 + 0.74, yBelt + 0.26, 0.44)
    emit('cab', clusterGlass, cab, 'cluster-glass', screenMat)
    const centerScreen = bevelBox(0.045, 0.20, 0.26, 0.010)
    centerScreen.rotateZ(-0.08)
    centerScreen.translate(cabX0 + 0.62, yBelt + 0.18, 0.02)
    emit('cab', centerScreen, cab, 'center-screen', kit.ink)
    const centerGlass = new PlaneGeometry(0.22, 0.16)
    centerGlass.rotateY(Math.PI / 2)
    centerGlass.rotateZ(-0.08)
    centerGlass.translate(cabX0 + 0.68, yBelt + 0.18, 0.02)
    emit('cab', centerGlass, cab, 'center-glass', screenMat)

    const wheel = new TorusGeometry(0.36, 0.055, 12, 40)
    wheel.rotateY(Math.PI / 2)
    wheel.rotateZ(-0.18)
    wheel.translate(cabX0 + 0.70, yBelt + 0.30, 0.42)
    emit('cab', wheel, cab, 'steer-wheel', kit.ink)
    const hub = bevelDisc(0.09, 0.04, 0.01, 16)
    hub.rotateY(Math.PI / 2)
    hub.translate(cabX0 + 0.70, yBelt + 0.30, 0.42)
    emit('cab', hub, cab, 'steer-hub', kit.graphite)
    for (const ang of [0, Math.PI / 2] as const) {
      const spoke = bevelBox(0.02, 0.22, 0.02, 0.004)
      spoke.rotateY(Math.PI / 2)
      spoke.rotateZ(-0.18 + ang)
      spoke.translate(cabX0 + 0.70, yBelt + 0.30, 0.42)
      emit('cab', spoke, cab, `steer-spoke-${ang}`, kit.ink)
    }
    const column = new CylinderGeometry(0.024, 0.030, 0.28, 8)
    column.rotateZ(Math.PI / 2 + 0.18)
    column.translate(cabX0 + 0.54, yBelt + 0.14, 0.42)
    emit('cab', column, cab, 'steer-column', kit.graphite)

    for (const sz of [0.50, -0.50] as const) {
      const cushion = loftRoundedBox(0.50, 0.11, 0.46, 0.04)
      cushion.translate(cabX0 + 1.12, yBelt + 0.08, sz)
      emit('cab', cushion, cab, `seat-${sz}`, vinyl)
      const back = loftRoundedBox(0.13, 0.70, 0.46, 0.04)
      back.rotateZ(0.05)
      back.translate(cabX0 + 1.40, yBelt + 0.48, sz)
      emit('cab', back, cab, `seat-back-${sz}`, vinyl)
      for (const side of [-1, 1] as const) {
        const bolster = loftRoundedBox(0.08, 0.40, 0.07, 0.022)
        bolster.rotateZ(0.05)
        bolster.translate(cabX0 + 1.36, yBelt + 0.40, sz + side * 0.22)
        emit('cab', bolster, cab, `seat-bolster-${sz}-${side}`, vinyl)
      }
      const head = loftRoundedBox(0.10, 0.15, 0.28, 0.028)
      head.translate(cabX0 + 1.42, yBelt + 0.92, sz)
      emit('cab', head, cab, `seat-head-${sz}`, vinyl)
    }

    // Dark cabin side liners inset well inside the glass — walls, not window fill.
    for (const sz of [-1, 1] as const) {
      const sideLiner = bevelBox(1.05, bandH - 0.28, 0.025, 0.006)
      sideLiner.translate((glassX0 + glassX1) / 2 + 0.08, bandY - 0.04, sz * (hz - 0.38))
      emit('cab', sideLiner, cab, `cabin-liner-${sz}`, kit.graphite)
    }

    const bunk = bevelBox(0.70, 0.10, WIDTH - 0.70, 0.016)
    bunk.translate(cabX1 - 0.55, yCabin + 1.08, 0)
    emit('cab', bunk, cab, 'bunk', vinyl)

    // XG+ face. Three values live inside one cassette: a matte well, gloss-black
    // bars standing proud of it, and a thin bright separator floating in every gap.
    // The bars run wider than the well, so the middle of a gap shows the deep dark
    // well while its outer end shows a red body wedge — that pairing is what makes
    // the stack read as a grille rather than a dark panel.
    const wBot = WIDTH - 0.28
    const bumpY0 = 0.40
    const bumpY1 = 1.16
    const wellY0 = 1.10
    const wellY1 = 2.06
    const wellW0 = 1.02
    const wellW1 = 1.12
    const barW0 = 1.55
    const barW1 = 1.65
    const faceX = cabX0 + 0.185
    const bars = 7
    const barPitch = (wellY1 - wellY0) / bars
    const barH = barPitch - 0.034
    // Sharper fascia rake. The face leans out towards the bumper so the screen and
    // the crown sit visibly behind the grille instead of stacking up vertically.
    const faceAt = (y: number): number => cabX0 + 0.040 - (wellY1 - y) * 0.060
    const spanAt = (y: number, at0: number, at1: number): number =>
      at0 + ((y - wellY0) / (wellY1 - wellY0)) * (at1 - at0)
    const wellHalfAt = (y: number): number => spanAt(y, wellW0, wellW1) / 2
    const barHalfAt = (y: number): number => spanAt(y, barW0, barW1) / 2
    // Lamps ride low in the stack, level with the second bar up, the way the XG+
    // carries its blades just above the bumper step rather than across mid-face.
    const beltBar = 1
    const beltY = wellY0 + (beltBar + 0.5) * barPitch

    // The recess sits well behind the bars, deep enough that the gaps between them
    // never expose body colour at the centre of the face.
    for (const [tierY0, tierY1, tag] of [
      [wellY0, 1.42, 'lower'],
      [1.42, 1.74, 'mid'],
      [1.74, wellY1, 'upper'],
    ] as const) {
      const cassette = facePanel(
        tierY1 - tierY0,
        wellHalfAt(tierY0) * 2,
        wellHalfAt(tierY1) * 2,
        0.44,
        0.02,
      )
      cassette.translate(faceAt(tierY1) + 0.268, (tierY0 + tierY1) / 2, 0)
      emit('cab', cassette, cab, `grille-well-${tag}`, grilleWell)
    }

    // Seven gloss-black bars, never chrome — a chrome ladder is a US look. A thin
    // bright separator floats in each gap and does the work the bar edges cannot.
    // The belt bar stops at the recess and hands its outer ends to the DRL blade.
    const barParts: BufferGeometry[] = []
    const sepParts: BufferGeometry[] = []
    for (let i = 0; i < bars; i++) {
      const y = wellY0 + (i + 0.5) * barPitch
      const x = faceAt(y) + 0.028
      const thick = i === bars - 1 ? barH + 0.026 : barH
      const width = i === beltBar ? wellHalfAt(y) * 2 + 0.05 : barHalfAt(y) * 2
      const bar = bevelBox(0.130, thick, width, 0.008)
      bar.translate(x, y, 0)
      barParts.push(bar)
      if (i === bars - 1) continue
      const sep = bevelBox(0.034, 0.011, width - 0.07, 0.003)
      sep.translate(x - 0.052, y + barPitch / 2, 0)
      sepParts.push(sep)
    }
    emit('cab', mergeParts(barParts, 'grille-bars'), cab, 'grille-bars', grilleBar)
    emit('cab', mergeParts(sepParts, 'grille-separators'), cab, 'grille-separators', grilleEdge)

    // DRL blade: one continuous emissive strip per side, recessed into a black
    // blade housing cut into the fascia and capped by a proud gloss brow.
    const beltZ0 = wellHalfAt(beltY) + 0.025
    const beltZ1 = barHalfAt(beltY) + 0.055
    const beltZ = (beltZ0 + beltZ1) / 2
    const beltSpan = beltZ1 - beltZ0
    const beltX = faceAt(beltY)
    for (const sz of [-1, 1] as const) {
      const housing = bevelBox(0.17, 0.24, beltSpan + 0.05, 0.014)
      housing.translate(beltX + 0.048, beltY, sz * beltZ)
      emit('cab', housing, cab, `headlight-housing-${sz}`, grilleWell)
      const blade = bevelBox(0.05, 0.075, beltSpan - 0.02, 0.006)
      blade.translate(beltX - 0.020, beltY + 0.018, sz * beltZ)
      emitDrl(blade, `drl-${sz}`)
      const flank = bevelBox(0.042, 0.026, beltSpan - 0.13, 0.004)
      flank.translate(beltX - 0.016, beltY - 0.052, sz * (beltZ + 0.02))
      emitDrl(flank, `drl-low-${sz}`)
    }

    // A proud lip caps the top of the cassette and pushes the stack into shadow.
    const capRail = bevelBox(0.12, 0.06, barHalfAt(wellY1) * 2 + 0.06, 0.008)
    capRail.translate(faceAt(wellY1) - 0.016, wellY1 + 0.038, 0)
    emit('cab', capRail, cab, 'grille-surround', grilleBar)

    // The bumper stays the most forward mass, and nothing on the face reaches past
    // it: the whole artic has to stay inside the 16.50 m box.
    // The bumper is two beams with a real slot between them. A one-piece bumper
    // can only hide an intake behind its own front face, so the mouth and its slats
    // live in the gap and the whole face stays inside the bumper's front plane.
    const slotY0 = 0.58
    const slotY1 = 0.80
    const upperBeam = bevelBox(0.34, bumpY1 - slotY1, wBot, 0.035)
    upperBeam.translate(faceX - 0.105, (slotY1 + bumpY1) / 2, 0)
    emit('cab', upperBeam, cab, 'bumper')
    const lowerBeam = bevelBox(0.34, slotY0 - bumpY0, wBot, 0.030)
    lowerBeam.translate(faceX - 0.105, (bumpY0 + slotY0) / 2, 0)
    emit('cab', lowerBeam, cab, 'bumper-lower')
    const mouth = bevelBox(0.20, slotY1 - slotY0, wBot - 0.10, 0.014)
    mouth.translate(faceX - 0.145, (slotY0 + slotY1) / 2, 0)
    emit('cab', mouth, cab, 'bumper-intake', grilleWell)
    const slats: BufferGeometry[] = []
    for (const sy of [0.645, 0.735] as const) {
      const slat = bevelBox(0.05, 0.026, 1.20, 0.004)
      slat.translate(faceX - 0.233, sy, 0)
      slats.push(slat)
    }
    emit('cab', mergeParts(slats, 'intake-slats'), cab, 'intake-slats', grilleBar)
    const centre = bevelBox(0.12, 0.30, 1.28, 0.02)
    centre.translate(faceX - 0.20, (slotY1 + bumpY1) / 2, 0)
    emit('cab', centre, cab, 'bumper-centre', bumperMat)
    const airDam = bevelBox(0.24, 0.12, wBot - 0.30, 0.02)
    airDam.translate(faceX - 0.115, bumpY0 - 0.05, 0)
    emit('cab', airDam, cab, 'air-dam', bumperMat)
    const plate = bevelBox(0.05, 0.16, 0.42, 0.006)
    plate.translate(faceX - 0.248, (slotY1 + bumpY1) / 2, 0)
    emit('cab', plate, cab, 'plate-pocket', kit.graphite)

    // Black sun-visor blade over the screen with a roof light-bar stack standing
    // on the crown above it. Two dark horizontal bands stepping down onto red is
    // the landmark that names a high-roof cab; a body-coloured visor vanishes.
    const visor = bevelBox(0.32, 0.13, WIDTH - 0.20, 0.018)
    visor.rotateZ(0.06)
    visor.translate(cabX0 + 0.26, CAB_TOP - 0.085, 0)
    emit('cab', visor, cab, 'visor', grilleBar)
    const visorLip = bevelBox(0.09, 0.05, WIDTH - 0.26, 0.008)
    visorLip.rotateZ(0.06)
    visorLip.translate(cabX0 + 0.105, CAB_TOP - 0.145, 0)
    emit('cab', visorLip, cab, 'visor-lip', grilleEdge)
    const visorBar = bevelBox(0.12, 0.10, WIDTH - 0.50, 0.012)
    visorBar.translate(cabX0 + 0.22, CAB_TOP - 0.21, 0)
    emit('cab', visorBar, cab, 'visor-bar', kit.ink)
    // Roof light-bar: a black rail on stanchions carrying four round cans, the
    // show-spec stack the reference wears above its visor.
    const railZ = WIDTH - 0.52
    const railY = CAB_TOP + 0.060
    const roofRail = bevelBox(0.17, 0.110, railZ, 0.014)
    roofRail.translate(cabX0 + 0.44, railY, 0)
    emit('cab', roofRail, cab, 'roof-bar', grilleBar)
    for (const bz of [-0.75, -0.25, 0.25, 0.75] as const) {
      const can = new CylinderGeometry(0.056, 0.056, 0.11, 14)
      can.rotateZ(Math.PI / 2)
      can.translate(cabX0 + 0.415, railY, bz)
      emit('cab', can, cab, `roof-can-${bz}`, grilleWell)
      // A square plane samples the whole radial lens map, so the disc lands as a
      // round lamp; an extruded lens would sample the map's dark corner instead.
      const lens = new PlaneGeometry(0.080, 0.080)
      lens.rotateY(-Math.PI / 2)
      lens.translate(cabX0 + 0.352, railY, bz)
      emit('lamps', lens, lamps, `roof-spot-${bz}`)
    }
    for (const sz of [-1, 1] as const) {
      const post = bevelBox(0.06, 0.13, 0.06, 0.008)
      post.translate(cabX0 + 0.46, CAB_TOP + 0.005, sz * (railZ / 2 - 0.10))
      emit('cab', post, cab, `roof-bar-post-${sz}`, kit.ink)
    }

    const screenH = bandH + 0.10
    const screen = bevelPrism(
      [
        [-1.16, -screenH / 2],
        [1.16, -screenH / 2],
        [0.92, screenH / 2 - 0.05],
        [0, screenH / 2 + 0.05],
        [-0.92, screenH / 2 - 0.05],
      ],
      0.020,
      0.005,
    )
    screen.rotateY(Math.PI / 2)
    screen.rotateZ(-0.30)
    screen.translate(cabX0 + 0.38, bandY + 0.05, 0)
    emit('glass', screen, cab, 'windshield')
    for (const [wz, ang] of [[-0.42, 0.18], [0.22, -0.12]] as const) {
      const arm = bevelBox(0.02, 0.58, 0.018, 0.004)
      arm.rotateZ(-0.30 + ang)
      arm.translate(cabX0 + 0.40, bandY - 0.18, wz)
      emit('cab', arm, cab, `wiper-${wz}`, kit.ink)
    }

    const header = bevelBox(0.05, 0.06, WIDTH - 0.58, 0.008)
    header.rotateZ(-0.16)
    header.translate(cabX0 + 0.24, yWin + 0.04, 0)
    emit('cab', header, cab, 'screen-header', kit.ink)

    for (const sz of [-1, 1] as const) {
      const zFace = sz * (hz + 0.048)
      // Door skin is body-coloured; only the sill strip below it is dark.
      const door = bevelBox(1.42, yBelt - 1.18, 0.045, 0.012)
      door.translate(cabX0 + 1.32, (1.18 + yBelt) / 2, sz * (hz + 0.032))
      emit('cab', door, cab, `door-${sz}`)
      const sill = bevelBox(1.42, 0.15, 0.050, 0.010)
      sill.translate(cabX0 + 1.32, 1.10, sz * (hz + 0.034))
      emit('cab', sill, cab, `door-sill-${sz}`, kit.ink)

      const pillar = bevelBox(0.20, bandH + 0.06, 0.16, 0.022)
      pillar.rotateZ(-0.30)
      pillar.translate(cabX0 + 0.50, bandY, sz * (hz - 0.14))
      emit('cab', pillar, cab, `a-pillar-${sz}`, kit.ink)

      const rearPillar = bevelBox(0.07, bandH + 0.04, 0.07, 0.01)
      rearPillar.translate(glassX1 + 0.02, bandY, sz * (hz + 0.022))
      emit('cab', rearPillar, cab, `b-pillar-${sz}`, kit.ink)

      const sideGlass = bevelPrism(
        [[-0.68, -0.44], [0.66, -0.39], [0.68, 0.46], [-0.54, 0.44]],
        0.028,
        0.004,
      )
      sideGlass.translate((glassX0 + glassX1) / 2, bandY - 0.02, zFace)
      emit('glass', sideGlass, cab, `side-glass-${sz}`)

      const sleeper = bevelBox(0.34, 0.34, 0.026, 0.006)
      sleeper.translate(cabX0 + 2.72, bandY + 0.08, zFace)
      emit('glass', sleeper, cab, `sleeper-${sz}`)

      const trim = bevelBox(2.30, 0.05, 0.035, 0.008)
      trim.translate(cabX0 + 1.75, yBelt - 0.06, sz * (hz + 0.038))
      emit('cab', trim, cab, `chrome-${sz}`, kit.ink)

      // Bumper corner clusters stay secondary now that the mid-height belt is the
      // hero; an amber marker still wraps the corner beside them.
      // The corner cluster is a dark reflector on the upper beam now. One lit
      // horizontal blade per side is the whole lamp read; three glowing cells beside
      // it made a cluster of point lights instead of a lamp.
      const lampZ = sz * (wBot / 2 - 0.26)
      const lampY = (slotY1 + bumpY1) / 2
      const pod = bevelBox(0.16, 0.22, 0.46, 0.022)
      pod.translate(faceX - 0.175, lampY, lampZ)
      emit('cab', pod, cab, `lamp-pod-${sz}`, grilleWell)
      const reflector = bevelBox(0.05, 0.080, 0.34, 0.010)
      reflector.translate(faceX - 0.245, lampY, lampZ)
      emit('cab', reflector, cab, `lamp-reflector-${sz}`, grilleEdge)
      const cornerLamp = new PlaneGeometry(0.06, 0.12)
      cornerLamp.rotateY(-Math.PI / 2)
      cornerLamp.translate(faceX - 0.26, lampY + 0.02, sz * (wBot / 2 - 0.04))
      emitAmber(cornerLamp, `corner-lamp-${sz}`)

      // Fog lamps live inside the bumper slot, forward of the mouth panel.
      const fogBucket = bevelBox(0.10, 0.16, 0.24, 0.016)
      fogBucket.translate(faceX - 0.208, (slotY0 + slotY1) / 2, sz * 0.86)
      emit('cab', fogBucket, cab, `fog-bucket-${sz}`, kit.ink)
      const fog = new PlaneGeometry(0.075, 0.075)
      fog.rotateY(-Math.PI / 2)
      fog.translate(faceX - 0.262, (slotY0 + slotY1) / 2, sz * 0.86)
      emit('lamps', fog, lamps, `fog-${sz}`)

      const step: BufferGeometry[] = []
      for (let s = 0; s < 4; s++) {
        const tread = bevelBox(0.44, 0.05, 0.17, 0.006)
        tread.translate(cabX0 + 1.02, 0.46 + s * 0.29, sz * (hz + 0.115))
        step.push(tread)
      }
      emit('cab', mergeParts(step, `steps-${sz}`), cab, `steps-${sz}`, bumperMat)

      const arch = new CylinderGeometry(0.60, 0.60, 0.24, 20, 1, true, 0, Math.PI)
      arch.rotateZ(Math.PI / 2)
      arch.rotateY(sz > 0 ? 0 : Math.PI)
      arch.translate(steerX, tyreR + 0.02, sz * (hz - 0.12))
      emit('cab', arch, cab, `steer-arch-${sz}`, kit.ink)
      const fender = bevelBox(1.12, 0.07, 0.16, 0.012)
      fender.translate(steerX, tyreR + 0.58, sz * (hz + 0.03))
      emit('cab', fender, cab, `steer-fender-${sz}`, kit.ink)

      // Mirrorless camera stalks: a stubby arm off the A-pillar carrying a tall
      // black blade pod, with a short kerb-view stalk under it. Chunkier than a
      // wire so the pair still reads at trailer distance.
      const arm = member(
        new Vector3(cabX0 + 0.62, 3.34, sz * (hz - 0.06)),
        new Vector3(cabX0 + 0.40, 3.30, sz * (hz + 0.38)),
        0.032,
        8,
      )
      emit('cab', arm, cab, `cam-arm-${sz}`, kit.ink)
      const stem = member(
        new Vector3(cabX0 + 0.42, 3.32, sz * (hz + 0.36)),
        new Vector3(cabX0 + 0.42, 2.78, sz * (hz + 0.36)),
        0.026,
        8,
      )
      emit('cab', stem, cab, `cam-stem-${sz}`, kit.ink)
      const cam = loftRoundedBox(0.12, 0.62, 0.13, 0.032)
      cam.translate(cabX0 + 0.42, 3.02, sz * (hz + 0.36))
      emit('cab', cam, cab, `cam-${sz}`, grilleBar)
      const kerbArm = member(
        new Vector3(cabX0 + 0.70, 2.50, sz * (hz - 0.02)),
        new Vector3(cabX0 + 0.62, 2.46, sz * (hz + 0.30)),
        0.022,
        6,
      )
      emit('cab', kerbArm, cab, `cam-kerb-arm-${sz}`, kit.ink)
      const kerbCam = loftRoundedBox(0.11, 0.18, 0.11, 0.03)
      kerbCam.translate(cabX0 + 0.62, 2.40, sz * (hz + 0.30))
      emit('cab', kerbCam, cab, `cam-kerb-${sz}`, grilleBar)
      const camLens = new PlaneGeometry(0.05, 0.05)
      camLens.rotateY(sz > 0 ? Math.PI / 2 : -Math.PI / 2)
      camLens.translate(cabX0 + 0.34, 3.10, sz * (hz + 0.42))
      emit('cab', camLens, cab, `cam-lens-${sz}`, kit.graphite)

      const marker = new CylinderGeometry(0.040, 0.040, 0.07, 12)
      marker.translate(cabX0 + 0.62, CAB_TOP + 0.015, sz * (hz - 0.16))
      emitAmber(marker, `roof-marker-${sz}`)
      const markerLens = bevelDisc(0.042, 0.012, 0.002, 12)
      markerLens.rotateX(-Math.PI / 2)
      markerLens.translate(cabX0 + 0.62, CAB_TOP + 0.052, sz * (hz - 0.16))
      emitAmber(markerLens, `roof-marker-lens-${sz}`)

      const extender = bevelBox(0.55, 2.00, 0.07, 0.012)
      extender.translate(cabX1 + 0.18, 2.98, sz * (hz - 0.04))
      emit('cab', extender, cab, `extender-${sz}`)
    }

    const centerMark = new CylinderGeometry(0.040, 0.040, 0.07, 12)
    centerMark.translate(cabX0 + 0.62, CAB_TOP + 0.015, 0)
    emitAmber(centerMark, 'roof-marker-0')
    const centerLens = bevelDisc(0.042, 0.012, 0.002, 12)
    centerLens.rotateX(-Math.PI / 2)
    centerLens.translate(cabX0 + 0.62, CAB_TOP + 0.052, 0)
    emitAmber(centerLens, 'roof-marker-lens-0')

    const spoiler = new LoftGeometry(
      [
        boxRing(cabX1 - 0.12, CAB_TOP - 0.20, CAB_TOP, WIDTH - 0.12, 0.04),
        boxRing(cabX1 + 0.20, CAB_TOP - 0.16, CAB_TOP + 0.01, WIDTH - 0.08, 0.05),
        boxRing(boxX0 - 0.02, BOX_TOP - 0.16, BOX_TOP + 0.04, WIDTH - 0.18, 0.04),
      ],
      { closed: true, capStart: true, capEnd: true },
    )
    emit('cab', spoiler, cab, 'roof-spoiler')

    for (const sz of [-1, 1] as const) {
      const rail = bevelBox(TRACTOR - 0.55, 0.22, 0.14, 0.016)
      rail.translate(nose + TRACTOR / 2 + 0.06, 0.50, sz * 0.40)
      emit('chassis', rail, chassis, `rail-${sz}`, bumperMat)
    }
    const cross = bevelBox(0.18, 0.16, 0.92, 0.014)
    cross.translate(nose + TRACTOR / 2, 0.48, 0)
    emit('chassis', cross, chassis, 'crossmember', kit.graphite)

    const hitch = bevelBox(GAP - 0.06, 0.10, 1.08, 0.012)
    hitch.translate((cabX1 + boxX0) / 2, DECK - 0.08, 0)
    emit('chassis', hitch, chassis, 'hitch-plate', bumperMat)

    const kingpin = bevelBox(0.72, 0.12, 0.84, 0.02)
    kingpin.translate(fifth - 0.08, DECK - 0.08, 0)
    emit('chassis', kingpin, chassis, 'fifth-wheel')

    const tank = new CylinderGeometry(0.18, 0.18, 1.15, 16)
    tank.rotateZ(Math.PI / 2)
    tank.translate((steerX + driveX) / 2, 0.52, 0)
    emit('chassis', tank, chassis, 'tank', kit.graphite)

    // Side fairings run the whole depth of the chassis gap: body colour down to a
    // thin dark rubbing strip, so cab, chassis and trailer read as one continuous
    // lower mass instead of a body floating over open frame.
    const skirtX0 = steerX + 0.58
    const skirtX1 = driveX - 0.52
    const skirtLen = Math.max(0.60, skirtX1 - skirtX0)
    const skirtX = (skirtX0 + skirtX1) / 2
    const noseX0 = cabX0 + 0.26
    const noseX1 = steerX - 0.58
    const noseSkirtLen = Math.max(0.30, noseX1 - noseX0)
    for (const sz of [-1, 1] as const) {
      const fairing = bevelBox(skirtLen, 0.92, 0.12, 0.018)
      fairing.translate(skirtX, 0.80, sz * (hz - 0.03))
      emit('cab', fairing, chassis, `cab-skirt-${sz}`)
      const skirtFoot = bevelBox(skirtLen - 0.06, 0.26, 0.14, 0.012)
      skirtFoot.translate(skirtX, 0.27, sz * (hz - 0.045))
      emit('chassis', skirtFoot, chassis, `cab-skirt-foot-${sz}`, bumperMat)
      const noseSkirt = bevelBox(noseSkirtLen, 0.66, 0.11, 0.016)
      noseSkirt.translate((noseX0 + noseX1) / 2, 0.60, sz * (hz - 0.05))
      emit('cab', noseSkirt, chassis, `nose-skirt-${sz}`)
      const driveArch = new CylinderGeometry(0.56, 0.56, 0.20, 18, 1, true, 0, Math.PI)
      driveArch.rotateZ(Math.PI / 2)
      driveArch.rotateY(sz > 0 ? 0 : Math.PI)
      driveArch.translate(driveX, tyreR + 0.02, sz * (hz - 0.16))
      emit('chassis', driveArch, chassis, `drive-arch-${sz}`, kit.ink)
    }

    const yBot = DECK
    const yTop = BOX_TOP
    const cargoH = yTop - yBot
    const cargoBox = new LoftGeometry(
      [
        boxRing(boxX0, yBot, yTop, WIDTH - 0.02, 0.12),
        boxRing(boxX0 + 0.28, yBot, yTop, WIDTH, 0.06),
        boxRing(boxX1 - 0.08, yBot, yTop, WIDTH, 0.03),
        boxRing(boxX1, yBot, yTop, WIDTH - 0.04, 0.03),
      ],
      { closed: true, capStart: true, capEnd: true },
    )
    emit('cargo', cargoBox, cargo, 'box')

    const noseCap = bevelBox(0.22, cargoH - 0.08, WIDTH - 0.12, 0.03)
    noseCap.translate(boxX0 + 0.08, yBot + cargoH / 2, 0)
    emit('cargo', noseCap, cargo, 'nose', cabPaint)

    const blackNose = bevelBox(2.15, cargoH - 0.18, 0.04, 0.01)
    blackNose.translate(boxX0 + 1.15, yBot + cargoH / 2, hz + 0.04)
    emit('cargo', blackNose, cargo, 'nose-side', cabPaint)

    for (const sz of [-1, 1] as const) {
      const topRail = bevelBox(boxLen - 1.6, 0.07, 0.05, 0.008)
      topRail.translate(boxX + 0.15, yTop - 0.22, sz * (hz + 0.04))
      emit('chassis', topRail, cargo, `trailer-rail-top-${sz}`)
      const lowRail = bevelBox(boxLen - 1.6, 0.06, 0.05, 0.008)
      lowRail.translate(boxX + 0.15, yBot + 0.22, sz * (hz + 0.04))
      emit('chassis', lowRail, cargo, `trailer-rail-low-${sz}`)

      const skirt = bevelBox(boxLen - 0.55, 0.80, 0.08, 0.014)
      skirt.translate(boxX, 0.78, sz * (hz - 0.02))
      emit('cargo', skirt, chassis, `trailer-skirt-${sz}`)

      const sideMark = new CylinderGeometry(0.028, 0.028, 0.05, 8)
      sideMark.rotateX(Math.PI / 2)
      sideMark.translate(boxX0 + 0.55, 1.15, sz * (hz + 0.02))
      emitAmber(sideMark, `trailer-marker-${sz}`)
    }

    const legs: BufferGeometry[] = []
    for (const sz of [-1, 1] as const) {
      const leg = bevelBox(0.10, 0.95, 0.10, 0.01)
      leg.translate(boxX0 + 0.85, 0.72, sz * 0.55)
      legs.push(leg)
    }
    emit('chassis', mergeParts(legs, 'landing-legs'), chassis, 'landing-legs')

    const underrun = bevelBox(0.12, 0.18, WIDTH - 0.35, 0.016)
    underrun.translate(boxX1 - 0.08, 0.58, 0)
    emit('chassis', underrun, chassis, 'underrun')

    const rearDoor = bevelBox(0.05, cargoH - 0.22, WIDTH - 0.22, 0.012)
    rearDoor.translate(boxX1 + CLEAR, yBot + cargoH / 2, 0)
    emit('cargo', rearDoor, cargo, 'rear-door', kit.shell)

    for (const sz of [-1, 1] as const) {
      const rearMark = bevelBox(0.04, 0.08, 0.18, 0.006)
      rearMark.translate(boxX1 + CLEAR * 2, yTop - 0.18, sz * (hz - 0.28))
      emitAmber(rearMark, `rear-marker-${sz}`)
    }

    if (config.kind === 'curtainside') {
      const ribs: BufferGeometry[] = []
      const count = Math.max(4, Math.round(boxLen / 1.2))
      for (let i = 0; i < count; i++) {
        const x = boxX0 + (i + 0.5) * (boxLen / count)
        for (const sz of [-1, 1] as const) {
          const rib = bevelBox(0.05, cargoH - 0.22, 0.04, 0.004)
          rib.translate(x, yBot + cargoH / 2, sz * (hz - 0.02))
          ribs.push(rib)
        }
      }
      emit('cargo', mergeParts(ribs, 'ribs'), cargo, 'ribs')
    }
    if (config.kind === 'reefer') {
      const unit = loftRoundedBox(0.80, 0.40, 1.2, 0.05)
      unit.translate(boxX0 + 0.85, HEIGHT + 0.06, 0)
      emit('cargo', unit, cargo, 'reefer-unit')
    }

    for (let a = 0; a < axleXs.length; a++) {
      const x = axleXs[a]!
      const dual = a > 0
      const kind: WheelKind = a === 0 ? 'steer' : a === 1 ? 'drive' : 'trailer'
      const axle = new CylinderGeometry(0.07, 0.07, WIDTH - 0.48, 12)
      axle.rotateX(Math.PI / 2)
      axle.translate(x, tyreR, 0)
      emit('chassis', axle, chassis, `axle-${a}`)
      if (a >= 2) {
        const guard = bevelBox(0.85, 0.08, WIDTH - 0.2, 0.012)
        guard.translate(x, tyreR + 0.58, 0)
        emit('chassis', guard, chassis, `mudguard-${a}`, bumperMat)
      }
      for (const sz of [-1, 1] as const) {
        const hub = new Group()
        hub.name = `hub-${a}-${sz}`
        hub.position.set(x, tyreR, sz * (hz - 0.30))
        wheels.add(hub)
        hubs.push(hub)
        emit('wheels', highwayTyre(TYRE, TYRE_W), hub, `tyre-${a}-${sz}`, tyreMat)
        const rimMat = kind === 'steer' ? rimBright : rimSteel
        const wellGeo = wheelWell(kind)
        if (sz < 0) wellGeo.rotateY(Math.PI)
        emit('wheels', wellGeo, hub, `well-${a}-${sz}`, kit.ink)
        const rimGeo = wheelRim(kind)
        if (sz < 0) rimGeo.rotateY(Math.PI)
        emit('wheels', rimGeo, hub, `rim-${a}-${sz}`, rimMat)
        const clock = bevelBox(0.055, 0.10, 0.016, 0.002)
        clock.translate(0.50, 0, 0.11)
        if (sz < 0) clock.rotateY(Math.PI)
        emit('wheels', clock, hub, `tyre-clock-${a}-${sz}`, kit.slate)
        if (dual) {
          const inner = highwayTyre(TYRE, TYRE_W)
          inner.translate(0, 0, -sz * 0.34)
          emit('wheels', inner, hub, `tyre-inner-${a}-${sz}`, tyreMat)
          const innerWell = wheelWell('trailer')
          if (sz < 0) innerWell.rotateY(Math.PI)
          innerWell.translate(0, 0, -sz * 0.34)
          emit('wheels', innerWell, hub, `well-inner-${a}-${sz}`, kit.ink)
          const innerRim = wheelRim('trailer')
          if (sz < 0) innerRim.rotateY(Math.PI)
          innerRim.translate(0, 0, -sz * 0.34)
          emit('wheels', innerRim, hub, `rim-inner-${a}-${sz}`, rimSteel)
        }
      }
    }

    const side = new PlaneGeometry(boxLen - 0.45, cargoH - 0.28)
    side.translate(boxX, yBot + cargoH / 2, hz + CLEAR)
    const rear = new PlaneGeometry(WIDTH - 0.28, cargoH - 0.28)
    rear.rotateY(Math.PI / 2)
    rear.translate(boxX1 + CLEAR * 2, yBot + cargoH / 2, 0)
    if (ownsLivery) {
      const tex = truckLiveryTexture({
        number: config.number,
        legend: config.livery === 'blank' ? '' : config.legend,
        paper: splitHex(config.paper),
        ink: splitHex(config.ink),
        accent: splitHex(config.accent),
      })
      textures.push(tex)
      const mat = new MeshStandardMaterial({
        name: 'f1-kit / truck livery',
        map: tex,
        roughness: 0.38,
        metalness: 0.06,
      })
      extras.push(mat)
      emit('livery', side, fascia, 'side', mat)
      emit('livery', rear, fascia, 'rear', mat)
    } else {
      emit('livery', side, fascia, 'side')
      emit('livery', rear, fascia, 'rear')
    }

    applySpin()
    applyLamps()
    applyRide()
  }
  rebuild()

  return {
    root,
    parts: { cab, chassis, cargo, wheels, fascia, lamps },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      let dirty = false
      if (patch.kind !== undefined) { config.kind = patch.kind; dirty = true }
      if (patch.wheelbase !== undefined) { config.wheelbase = patch.wheelbase; dirty = true }
      if (patch.boxLength !== undefined) { config.boxLength = patch.boxLength; dirty = true }
      if (patch.axles !== undefined) { config.axles = patch.axles; dirty = true }
      if (patch.livery !== undefined) { config.livery = patch.livery; dirty = true }
      if (patch.paint !== undefined) { config.paint = patch.paint; dirty = true }
      if (patch.legend !== undefined) { config.legend = patch.legend; dirty = true }
      if (patch.number !== undefined) { config.number = patch.number; dirty = true }
      if (patch.paper !== undefined) { config.paper = patch.paper; dirty = true }
      if (patch.ink !== undefined) { config.ink = patch.ink; dirty = true }
      if (patch.accent !== undefined) { config.accent = patch.accent; dirty = true }
      if (patch.wheelRpm !== undefined) config.wheelRpm = patch.wheelRpm
      if (patch.lamps !== undefined) config.lamps = patch.lamps
      clampConfig(config)
      if (ownsCab) {
        (cabPaint as MeshPhysicalMaterial).color.set(config.paint)
      }
      if (dirty) rebuild()
      else {
        applySpin()
        applyLamps()
        applyRide()
      }
    },
    setMaterial(slot, material) {
      if (slot === 'livery' && ownsLivery) {
        releaseOwnedLivery()
        ownsLivery = false
      }
      materialSlots[slot] = material
      if (slot === 'lamps') {
        if (config.lamps) applyLamps()
        return
      }
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    setGround(mesh) {
      ground = mesh
      applyRide()
    },
    update(deltaSeconds) {
      if (config.wheelRpm > 0 && deltaSeconds !== 0) {
        spin += (config.wheelRpm / 60) * Math.PI * 2 * deltaSeconds
        applySpin()
      }
      applyRide()
    },
    dispose() {
      releaseGenerated()
      for (const material of owned) material.dispose()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

function attachCabLight(root: Group): PointLight {
  const overall = articLength(TRUCK.boxLength)
  const nose = -overall / 2
  const cabLight = new PointLight(0xffe8c8, 3.4, 3.0, 1.6)
  cabLight.name = 'f1-kit / cab light'
  cabLight.userData.excludeFromExport = true
  cabLight.position.set(nose + 1.55, 2.55, 0)
  cabLight.visible = true
  root.add(cabLight)
  return cabLight
}

export function createCabPreview({ aspect }: { aspect: number; time?: number }) {
  const model = createModel({ kind: 'box', axles: 3, lamps: true, wheelRpm: 0 })
  const overall = articLength(TRUCK.boxLength)
  const nose = -overall / 2
  const preview = createF1Preview(model, {
    aspect,
    target: [nose + 1.15, 2.30, 0.1],
    distance: 8.6,
    fov: 30,
    yaw: -0.52,
    pitch: 0.12,
    ground: true,
    bloom: true,
  })
  const ground = preview.scene.getObjectByName('f1-kit / preview ground')
  if (ground) model.setGround(ground)
  const cabLight = attachCabLight(model.root)
  const innerDispose = preview.dispose
  return {
    ...preview,
    dispose() {
      model.root.remove(cabLight)
      cabLight.dispose()
      innerDispose()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  const rpm = demoRpm()
  const model = createModel({ kind: 'box', axles: 3, lamps: true, wheelRpm: rpm })
  // Cab-forward three-quarter — sells lights / glass / interior for critic.
  const overall = articLength(TRUCK.boxLength)
  const nose = -overall / 2
  const preview = createF1Preview(model, {
    aspect,
    target: [nose + 1.35, 2.15, 0.05],
    distance: 11.2,
    fov: 28,
    yaw: -0.58,
    pitch: 0.10,
    ground: true,
    bloom: true,
  })
  const ground = preview.scene.getObjectByName('f1-kit / preview ground')
  if (ground) model.setGround(ground)
  const cabLight = attachCabLight(model.root)
  let cabLightOn = true
  const innerDispose = preview.dispose
  return {
    ...preview,
    isCabLightOn: () => cabLightOn,
    toggleCabLight() {
      cabLightOn = !cabLightOn
      cabLight.visible = cabLightOn
      return cabLightOn
    },
    dispose() {
      model.root.remove(cabLight)
      cabLight.dispose()
      innerDispose()
    },
  }
}

export function createWheelPreview({ aspect }: { aspect: number; time?: number }) {
  const model = createModel({ kind: 'box', axles: 3, lamps: true, wheelRpm: demoRpm() })
  const hub = model.root.getObjectByName('hub-0-1')
  const target: [number, number, number] = hub
    ? [hub.position.x, hub.position.y, hub.position.z]
    : [-6.2, 0.54, 0.97]
  for (const name of ['steps-1', 'steps--1', 'steer-arch-1', 'steer-arch--1']) {
    const node = model.root.getObjectByName(name)
    if (node) node.visible = false
  }
  const preview = createF1Preview(model, {
    aspect,
    target,
    distance: 1.48,
    fov: 28,
    yaw: -1.12,
    pitch: 0.20,
    ground: true,
    bloom: true,
  })
  const ground = preview.scene.getObjectByName('f1-kit / preview ground')
  if (ground) model.setGround(ground)
  const cabLight = attachCabLight(model.root)
  const innerDispose = preview.dispose
  return {
    ...preview,
    dispose() {
      model.root.remove(cabLight)
      cabLight.dispose()
      innerDispose()
    },
  }
}
