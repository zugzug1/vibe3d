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
const BOX_TOP = HEIGHT - 0.20

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
  // Closed dark greenhouse. The XG+ band reads as one near-black gloss ribbon
  // from outside, so the glass is opaque: see-through glazing turns the cab
  // into a lit vitrine of seats instead of a silhouette landmark.
  const glassMat = options.materials?.glass ?? new MeshPhysicalMaterial({
    name: 'f1-kit / cab glass',
    color: 0x0a1017,
    metalness: 0.24,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    side: FrontSide,
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
  const vinyl = new MeshStandardMaterial({
    name: 'f1-kit / cab vinyl',
    color: 0x2b2e33,
    roughness: 0.82,
    metalness: 0.04,
    side: FrontSide,
  })
  owned.push(vinyl)
  const lampOn = options.materials?.lamps ?? createLampMaterial({
    on: true,
    color: 0xeef4ff,
    intensity: 3.4,
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
    intensity: 8.4,
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
    for (const mesh of meshesBySlot.lamps) {
      mesh.material = amberMeshes.includes(mesh) ? amber : white
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

    const dash = bevelBox(0.52, 0.46, WIDTH - 0.50, 0.02)
    dash.rotateZ(-0.14)
    dash.translate(cabX0 + 0.62, yCabin + 0.32, 0)
    emit('cab', dash, cab, 'dash', kit.graphite)
    const cluster = bevelBox(0.16, 0.10, 0.42, 0.012)
    cluster.translate(cabX0 + 0.78, yCabin + 0.48, 0.48)
    emit('cab', cluster, cab, 'cluster', kit.ink)

    const wheel = new TorusGeometry(0.22, 0.026, 8, 24)
    wheel.rotateY(Math.PI / 2)
    wheel.rotateZ(-0.22)
    wheel.translate(cabX0 + 0.88, yCabin + 0.50, 0.48)
    emit('cab', wheel, cab, 'steer-wheel', kit.ink)
    const column = new CylinderGeometry(0.022, 0.028, 0.36, 8)
    column.rotateZ(Math.PI / 2 + 0.22)
    column.translate(cabX0 + 0.70, yCabin + 0.36, 0.48)
    emit('cab', column, cab, 'steer-column', kit.graphite)

    for (const sz of [0.52, -0.52] as const) {
      const post = bevelBox(0.14, 0.10, 0.14, 0.012)
      post.translate(cabX0 + 1.36, yCabin + 0.06, sz)
      emit('cab', post, cab, `seat-post-${sz}`, kit.graphite)
      const cushion = loftRoundedBox(0.50, 0.10, 0.44, 0.04)
      cushion.translate(cabX0 + 1.34, yCabin + 0.16, sz)
      emit('cab', cushion, cab, `seat-${sz}`, vinyl)
      const back = loftRoundedBox(0.12, 0.50, 0.44, 0.04)
      back.rotateZ(0.08)
      back.translate(cabX0 + 1.66, yCabin + 0.48, sz)
      emit('cab', back, cab, `seat-back-${sz}`, vinyl)
      for (const side of [-1, 1] as const) {
        const bolster = loftRoundedBox(0.08, 0.32, 0.07, 0.024)
        bolster.rotateZ(0.08)
        bolster.translate(cabX0 + 1.62, yCabin + 0.42, sz + side * 0.22)
        emit('cab', bolster, cab, `seat-bolster-${sz}-${side}`, vinyl)
      }
      const head = loftRoundedBox(0.09, 0.14, 0.26, 0.03)
      head.translate(cabX0 + 1.68, yCabin + 0.86, sz)
      emit('cab', head, cab, `seat-head-${sz}`, vinyl)
    }

    const bunk = bevelBox(0.70, 0.10, WIDTH - 0.70, 0.016)
    bunk.translate(cabX1 - 0.55, yCabin + 1.08, 0)
    emit('cab', bunk, cab, 'bunk', vinyl)

    // XG+ face. The reference grille is not a flat vent: thick dark bars run wider
    // than the recess behind them, so the middle of every gap shows the deep dark
    // well while the outer end of the same gap shows a red body wedge. That pairing
    // is what makes the stack read as a grille rather than a dark panel.
    const wBot = WIDTH - 0.28
    const bumpY0 = 0.40
    const bumpY1 = 1.16
    const wellY0 = 1.10
    const wellY1 = 2.06
    const wellW0 = 1.26
    const wellW1 = 1.38
    const barW0 = 1.90
    const barW1 = 2.02
    const faceX = cabX0 + 0.185
    const beltY = (wellY0 + wellY1) / 2
    const bars = 5
    const beltBar = 2
    const barPitch = (wellY1 - wellY0) / bars
    const barH = barPitch - 0.066
    const faceAt = (y: number): number => cabX0 + 0.02 - (wellY1 - y) * 0.045
    const spanAt = (y: number, at0: number, at1: number): number =>
      at0 + ((y - wellY0) / (wellY1 - wellY0)) * (at1 - at0)
    const wellHalfAt = (y: number): number => spanAt(y, wellW0, wellW1) / 2
    const barHalfAt = (y: number): number => spanAt(y, barW0, barW1) / 2

    // The recess sits just ahead of the red face plate, deep enough that the gaps
    // between the bars never expose body colour at the centre of the face.
    for (const [tierY0, tierY1, tag] of [
      [wellY0, 1.42, 'lower'],
      [1.42, 1.74, 'mid'],
      [1.74, wellY1, 'upper'],
    ] as const) {
      const cassette = facePanel(
        tierY1 - tierY0,
        wellHalfAt(tierY0) * 2,
        wellHalfAt(tierY1) * 2,
        0.40,
        0.02,
      )
      cassette.translate(faceAt(tierY1) + 0.224, (tierY0 + tierY1) / 2, 0)
      emit('cab', cassette, cab, `grille-well-${tag}`, kit.ink)
    }

    // Bars are dark satin, never chrome — a chrome ladder is a US look. The middle
    // bar stops at the recess and hands its outer ends to the headlight belt.
    const barParts: BufferGeometry[] = []
    for (let i = 0; i < bars; i++) {
      const y = wellY0 + (i + 0.5) * barPitch
      const x = faceAt(y) + 0.010
      const thick = i === bars - 1 ? barH + 0.03 : barH
      const width = i === beltBar ? wellHalfAt(y) * 2 + 0.06 : barHalfAt(y) * 2
      const bar = bevelBox(0.115, thick, width, 0.010)
      bar.translate(x, y, 0)
      barParts.push(bar)
    }
    emit('cab', mergeParts(barParts, 'grille-bars'), cab, 'grille-bars', kit.ink)

    // Mid-height headlight belt: the middle bar continues outboard of the recess as
    // a slim lit band in a dark housing, so the belt reads as one horizontal run
    // from the cassette edge to the corner of the face.
    //
    // The lit cells are planes, and there are four of them per side, because the
    // shared lamp map is one radial disc addressed in 0..1: an extruded lens carries
    // world-space cap UVs and samples the map's dark corner, and a single wide plane
    // stretches the disc into a round blob. A row of small cells blooms into a bar.
    const beltZ0 = wellHalfAt(beltY) + 0.03
    const beltZ1 = barHalfAt(beltY) + 0.02
    const beltZ = (beltZ0 + beltZ1) / 2
    const beltX = faceAt(beltY)
    const beltCells = 4
    const cellPitch = (beltZ1 - beltZ0 - 0.03) / beltCells
    for (const sz of [-1, 1] as const) {
      const housing = bevelBox(0.14, 0.175, beltZ1 - beltZ0 + 0.03, 0.012)
      housing.translate(beltX + 0.012, beltY, sz * beltZ)
      emit('cab', housing, cab, `headlight-housing-${sz}`, kit.ink)
      for (let c = 0; c < beltCells; c++) {
        const z = beltZ0 + 0.015 + (c + 0.5) * cellPitch
        const cell = new PlaneGeometry(cellPitch - 0.012, 0.080)
        cell.rotateY(-Math.PI / 2)
        cell.translate(beltX - 0.070, beltY, sz * z)
        emit('lamps', cell, lamps, `headlight-${sz}-${c}`)
      }
    }

    // Cassette surround: a proud lip that caps the bar ends and pushes everything
    // inside it back into shadow.
    const surround: BufferGeometry[] = [
      (() => {
        const rail = bevelBox(0.10, 0.05, barHalfAt(wellY1) * 2 + 0.05, 0.008)
        rail.translate(faceAt(wellY1) - 0.010, wellY1 + 0.03, 0)
        return rail
      })(),
    ]
    for (const sz of [-1, 1] as const) {
      const post = bevelBox(0.10, wellY1 - wellY0 + 0.06, 0.055, 0.008)
      post.translate(faceAt(beltY) - 0.010, beltY, sz * (barHalfAt(beltY) + 0.028))
      surround.push(post)
    }
    emit('cab', mergeParts(surround, 'grille-surround'), cab, 'grille-surround', kit.ink)

    // The bumper stays the most forward mass, and nothing on the face reaches past
    // it: the whole artic has to stay inside the 16.50 m box.
    const bumper = bevelBox(0.34, bumpY1 - bumpY0, wBot, 0.035)
    bumper.translate(faceX - 0.09, (bumpY0 + bumpY1) / 2, 0)
    emit('cab', bumper, cab, 'bumper')
    const centre = bevelBox(0.12, 0.44, 1.28, 0.02)
    centre.translate(faceX - 0.195, bumpY0 + 0.46, 0)
    emit('cab', centre, cab, 'bumper-centre', bumperMat)
    const intake = bevelBox(0.10, 0.16, 0.96, 0.02)
    intake.translate(faceX - 0.19, bumpY0 + 0.13, 0)
    emit('cab', intake, cab, 'bumper-intake', kit.ink)
    const airDam = bevelBox(0.24, 0.12, wBot - 0.30, 0.02)
    airDam.translate(faceX - 0.10, bumpY0 - 0.05, 0)
    emit('cab', airDam, cab, 'air-dam', bumperMat)
    const plate = bevelBox(0.05, 0.16, 0.42, 0.006)
    plate.translate(faceX - 0.225, bumpY0 + 0.46, 0)
    emit('cab', plate, cab, 'plate-pocket', kit.graphite)

    // Visor is a flush body-coloured continuation of the roof; only the recessed
    // light bar under it is dark.
    const visor = bevelBox(0.28, 0.14, WIDTH - 0.26, 0.02)
    visor.rotateZ(0.03)
    visor.translate(cabX0 + 0.29, CAB_TOP - 0.08, 0)
    emit('cab', visor, cab, 'visor')
    const visorBar = bevelBox(0.10, 0.08, WIDTH - 0.62, 0.012)
    visorBar.translate(cabX0 + 0.23, CAB_TOP - 0.21, 0)
    emit('cab', visorBar, cab, 'visor-bar', kit.ink)
    for (const vz of [-0.86, -0.30, 0.30, 0.86] as const) {
      const spot = bevelDisc(0.046, 0.030, 0.004, 14)
      spot.rotateY(Math.PI / 2)
      spot.translate(cabX0 + 0.17, CAB_TOP - 0.21, vz)
      emit('lamps', spot, lamps, `visor-spot-${vz}`)
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
      const lampZ = sz * (wBot / 2 - 0.28)
      const lampY = bumpY0 + 0.44
      const pod = bevelBox(0.14, 0.24, 0.46, 0.022)
      pod.translate(faceX - 0.16, lampY, lampZ)
      emit('cab', pod, cab, `lamp-pod-${sz}`, kit.ink)
      const lens = bevelBox(0.05, 0.11, 0.34, 0.012)
      lens.translate(faceX - 0.215, lampY, lampZ)
      emit('lamps', lens, lamps, `lamp-${sz}`)
      const cornerLamp = bevelBox(0.06, 0.15, 0.10, 0.010)
      cornerLamp.translate(faceX - 0.205, lampY + 0.02, sz * (wBot / 2 - 0.03))
      emitAmber(cornerLamp, `corner-lamp-${sz}`)

      const fogBucket = bevelBox(0.10, 0.14, 0.26, 0.016)
      fogBucket.translate(faceX - 0.16, bumpY0 + 0.14, sz * 0.62)
      emit('cab', fogBucket, cab, `fog-bucket-${sz}`, kit.ink)
      const fog = bevelDisc(0.052, 0.020, 0.003, 16)
      fog.rotateY(Math.PI / 2)
      fog.translate(faceX - 0.23, bumpY0 + 0.14, sz * 0.62)
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

      const arm = member(
        new Vector3(cabX0 + 0.58, 3.24, sz * (hz - 0.08)),
        new Vector3(cabX0 + 0.40, 3.16, sz * (hz + 0.34)),
        0.022,
        8,
      )
      emit('cab', arm, cab, `cam-arm-${sz}`, kit.ink)
      const cam = loftRoundedBox(0.11, 0.62, 0.13, 0.03)
      cam.translate(cabX0 + 0.44, 2.90, sz * (hz + 0.30))
      emit('cab', cam, cab, `cam-${sz}`, kit.graphite)

      const marker = new CylinderGeometry(0.046, 0.046, 0.08, 12)
      marker.translate(cabX0 + 0.52, CAB_TOP + 0.02, sz * (hz - 0.16))
      emitAmber(marker, `roof-marker-${sz}`)
      const markerLens = bevelDisc(0.048, 0.014, 0.002, 12)
      markerLens.rotateX(-Math.PI / 2)
      markerLens.translate(cabX0 + 0.52, CAB_TOP + 0.062, sz * (hz - 0.16))
      emitAmber(markerLens, `roof-marker-lens-${sz}`)

      const extender = bevelBox(0.55, 2.00, 0.07, 0.012)
      extender.translate(cabX1 + 0.18, 2.98, sz * (hz - 0.04))
      emit('cab', extender, cab, `extender-${sz}`)
    }

    const centerMark = new CylinderGeometry(0.046, 0.046, 0.08, 12)
    centerMark.translate(cabX0 + 0.52, CAB_TOP + 0.02, 0)
    emitAmber(centerMark, 'roof-marker-0')
    const centerLens = bevelDisc(0.048, 0.014, 0.002, 12)
    centerLens.rotateX(-Math.PI / 2)
    centerLens.translate(cabX0 + 0.52, CAB_TOP + 0.062, 0)
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
  const cabLight = new PointLight(0xffe8c8, 2.6, 2.3, 1.8)
  cabLight.name = 'f1-kit / cab light'
  cabLight.userData.excludeFromExport = true
  cabLight.position.set(nose + 1.75, 2.74, 0)
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
  const preview = createF1Preview(model, {
    aspect,
    target: [-4.4, 2.05, 0],
    distance: 19.5,
    fov: 30,
    yaw: -0.62,
    pitch: 0.12,
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
