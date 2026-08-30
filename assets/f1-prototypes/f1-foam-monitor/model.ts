// f1-foam-monitor — a fire-service foam monitor trailer (FHC / Delta DF2000 typology): red powdercoat
// flatbed chassis with a hazard-chevron skirt, A-frame tongue and swing-away jack, twin axle on
// pneumatic tyres with bright eight-lug hubs, four screw stabilisers, a yellow 4000 L foam tank with
// manway and level gauge, and a deck-mounted stainless monitor with tiller handwheels and a
// multi-stage induction bell.
//
// Model axes: +Z is the towing end (tongue, monitor), -Z is the tank end. The deck top sits at
// y = 0.74 so every deck-mounted part is authored from that datum.

import {
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three/webgpu'

import { mixToken } from '../f1-kit-core/palette.ts'
import {
  TOKEN,
  acquireF1Materials,
  bevelBox,
  bevelDisc,
  bevelPrism,
  bevelRing,
  boltRun,
  createF1Preview,
  disposeF1Materials,
  groundPad,
  member,
  mergeParts,
  revolve,
  shade,
  taperedTube,
  tubeSection,
  AXIS_X,
  AXIS_Y,
  AXIS_Z,
} from '../f1-kit-core/index.ts'

type Slot = 'base' | 'cannon'

export interface F1FoamMonitorConfig {
  yaw: number
}

export interface F1FoamMonitorOptions extends Partial<F1FoamMonitorConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1FoamMonitorInstance {
  readonly root: Group
  readonly parts: { base: Group; nozzle: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1FoamMonitorConfig>
  configure(patch: Partial<F1FoamMonitorConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1FoamMonitorConfig = { yaw: 0 }

/** Deck datum: every deck-mounted part measures up from here. */
const DECK_TOP = 0.74
const DECK_W = 1.50
const DECK_L = 3.40
const HALF_L = DECK_L / 2
/** Skirt outer face — the surface the hazard chevrons and Storz inlets are applied to. */
const SKIRT_X = 0.75
const SKIRT_BOT = 0.435
const SKIRT_TOP = 0.755

/** Monitor pedestal centre on the deck, and the barrel elevation above horizontal. */
const MONITOR_Z = 0.98
const ELEV = 0.78
/** Elevation pivot height above the deck, and the bare barrel length out to the bell throat. */
const PIVOT_Y = 0.62
const BARREL = 0.54
const BELL_LEN = 0.34

/** Tank box, seated on skids over the rear half of the deck. */
const TANK_Z = -0.86
const TANK_HALF_W = 0.63
const TANK_HALF_L = 0.79
const TANK_BOT = 0.795
const TANK_TOP = 1.575

/** Axle line positions and rolling radius. */
const AXLE_Z = [-0.45, -1.25] as const
const TYRE_R = 0.335
const TYRE_HALF = 0.1025
const WHEEL_X = 0.60
/** Corner stabiliser stations. */
const JACK_Z = 1.52

export function createModel(options: F1FoamMonitorOptions = {}): F1FoamMonitorInstance {
  const config: F1FoamMonitorConfig = { yaw: options.yaw ?? defaults.yaw }

  const bundle = acquireF1Materials()
  const kit = bundle.materials

  // Three model-owned finishes the shared bundle has no slot for. Each is derived from a canonical
  // token rather than hand-picked. The capture key is hot enough to desaturate a highlight shoulder,
  // so both signature colours are sunk down their own value ramp and left rough: at token value
  // RED-500 photographs salmon and AMBER-400 photographs cream.
  const owned: MeshStandardMaterial[] = []
  const own = (material: MeshStandardMaterial): MeshStandardMaterial => {
    owned.push(material)
    return material
  }
  const fireRed = own(new MeshStandardMaterial({
    name: 'f1-foam-monitor / powdercoat red',
    color: shade(TOKEN.RED_500, -0.38),
    roughness: 0.52,
    metalness: 0.05,
  }))
  const safetyYellow = own(new MeshStandardMaterial({
    name: 'f1-foam-monitor / tank yellow',
    color: shade(mixToken(TOKEN.AMBER_400, TOKEN.LIME_400, 0.28), -0.14),
    roughness: 0.72,
    metalness: 0.02,
  }))
  const hoseGreen = own(new MeshStandardMaterial({
    name: 'f1-foam-monitor / induction hose',
    color: shade(TOKEN.FIELD_500, -0.28),
    roughness: 0.80,
    metalness: 0.04,
  }))

  const materialSlots: Record<Slot, Material> = {
    base: options.materials?.base ?? fireRed,
    cannon: options.materials?.cannon ?? fireRed,
  }

  const root = new Group(); root.name = 'f1-foam-monitor'
  const base = new Group(); base.name = 'base'
  const nozzle = new Group(); nozzle.name = 'nozzle'
  nozzle.position.set(0, DECK_TOP, MONITOR_Z)
  root.add(base, nozzle)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { base: [], cannon: [] }

  const releaseGenerated = (): void => {
    base.clear(); nozzle.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string, material?: Material): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, material ?? materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (!material) meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  /** One raised diamond of chequer-plate tread, laid flat on the deck. */
  const treadLozenge = (x: number, z: number, lean: number): BufferGeometry => {
    const geo = bevelPrism([[-0.048, 0], [0, -0.019], [0.048, 0], [0, 0.019]], 0.01, 0)
    geo.rotateX(-Math.PI / 2)
    geo.rotateY(lean)
    geo.translate(x, DECK_TOP + 0.002, z)
    return geo
  }

  /**
   * One hazard stripe on a side skirt: a parallelogram so the band keeps horizontal top and bottom
   * edges while the stripe itself leans, which is what the reference's chevron tape does.
   */
  const hazardStripe = (side: 1 | -1, z: number): BufferGeometry => {
    const halfRun = 0.078
    const lean = 0.055
    const halfH = 0.0675
    const geo = bevelPrism(
      [
        [-halfRun - lean, -halfH],
        [halfRun - lean, -halfH],
        [halfRun + lean, halfH],
        [-halfRun + lean, halfH],
      ],
      0.022,
      0,
    )
    geo.rotateY((side * Math.PI) / 2)
    geo.translate(side * (SKIRT_X + 0.007), 0.6675, side * z)
    return geo
  }

  /** A three-spoke handwheel in the plane whose normal is `axis`. */
  const handwheel = (
    centre: readonly [number, number, number],
    rimR: number,
    axis: 'x' | 'y',
  ): { rim: BufferGeometry; hub: BufferGeometry } => {
    const rim = bevelRing(rimR - 0.024, rimR, 0.026, 0.007, 26)
    const spokes: BufferGeometry[] = []
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const spoke = axis === 'x'
        ? bevelBox(0.020, rimR * 1.9, 0.024, 0.003)
        : bevelBox(rimR * 1.9, 0.020, 0.024, 0.003)
      if (axis === 'x') spoke.rotateX(a)
      else spoke.rotateY(a)
      spokes.push(spoke)
    }
    const boss = tubeSection(0.028, 0.08, [0, 0, 0], axis === 'x' ? AXIS_X : AXIS_Y, 10)
    if (axis === 'x') {
      rim.rotateY(Math.PI / 2)
      for (const spoke of spokes) spoke.rotateY(Math.PI / 2)
    } else {
      rim.rotateX(Math.PI / 2)
    }
    const hub = mergeParts([...spokes, boss], 'handwheel hub')
    rim.translate(...(centre as [number, number, number]))
    hub.translate(...(centre as [number, number, number]))
    return { rim, hub }
  }

  const rebuild = (): void => {
    releaseGenerated()

    // ---------------------------------------------------------------- chassis
    const chassis: BufferGeometry[] = []
    for (const side of [-1, 1] as const) {
      const skirt = bevelBox(0.06, SKIRT_TOP - SKIRT_BOT, DECK_L, 0.008)
      skirt.translate(side * (SKIRT_X - 0.03), (SKIRT_TOP + SKIRT_BOT) / 2, 0)
      chassis.push(skirt)
    }
    for (const z of [-HALF_L + 0.03, HALF_L - 0.03] as const) {
      const cap = bevelBox(DECK_W, SKIRT_TOP - SKIRT_BOT, 0.06, 0.008)
      cap.translate(0, (SKIRT_TOP + SKIRT_BOT) / 2, z)
      chassis.push(cap)
    }
    // A-frame drawbar converging on the tongue.
    for (const side of [-1, 1] as const) {
      const arm = bevelBox(0.085, 0.12, 0.86, 0.008)
      arm.rotateY((-side * Math.PI) / 4)
      arm.translate(side * 0.30, 0.60, HALF_L + 0.30)
      chassis.push(arm)
    }
    const tongue = bevelBox(0.11, 0.13, 0.52, 0.008)
    tongue.translate(0, 0.60, HALF_L + 0.56)
    chassis.push(tongue)
    // Foam concentrate outlet valve off the tank front bulkhead.
    const outletValve = bevelBox(0.12, 0.14, 0.11, 0.008)
    outletValve.translate(0.17, 0.90, 0.05)
    chassis.push(outletValve)
    chassis.push(handwheel([0.26, 0.90, 0.05], 0.058, 'x').rim)
    // Hazard chevrons: every other stripe is chassis red, the rest amber.
    const hazardAmber: BufferGeometry[] = []
    const bandHalf = HALF_L - 0.14
    const stripes = 20
    for (let i = 0; i < stripes; i++) {
      const z = -bandHalf + (i + 0.5) * ((bandHalf * 2) / stripes)
      for (const side of [-1, 1] as const) {
        const stripe = hazardStripe(side, z)
        if (i % 2 === 0) hazardAmber.push(stripe)
        else chassis.push(stripe)
      }
    }
    emit('base', mergeParts(chassis, 'chassis'), base, 'chassis')
    emit('base', mergeParts(hazardAmber, 'hazard'), base, 'hazard', kit.amber)

    // ------------------------------------------------------------------- deck
    const deck: BufferGeometry[] = []
    const slab = bevelBox(DECK_W - 0.09, 0.06, DECK_L - 0.09, 0.008)
    slab.translate(0, DECK_TOP - 0.03, 0)
    deck.push(slab)
    for (const side of [-1, 1] as const) {
      const rail = bevelBox(0.10, 0.15, DECK_L - 0.12, 0.008)
      rail.translate(side * 0.36, 0.605, 0)
      deck.push(rail)
    }
    for (const z of [-1.36, -0.68, 0, 0.68, 1.36] as const) {
      const rib = bevelBox(DECK_W - 0.16, 0.065, 0.08, 0.006)
      rib.translate(0, 0.645, z)
      deck.push(rib)
    }
    // Kerbside utility box hung off the near skirt.
    const utilityBox = bevelBox(0.34, 0.20, 0.07, 0.008)
    utilityBox.translate(-0.782, 0.525, -0.30)
    deck.push(utilityBox)
    emit('base', mergeParts(deck, 'deck'), base, 'deck', kit.graphite)

    const tread: BufferGeometry[] = []
    for (let ix = 0; ix < 10; ix++) {
      const x = -0.585 + ix * 0.13
      for (let iz = 0; iz < 12; iz++) {
        const z = 0.10 + iz * 0.13
        tread.push(treadLozenge(x, z, (ix + iz) % 2 === 0 ? 0.62 : -0.62))
      }
    }
    emit('base', mergeParts(tread, 'tread'), base, 'tread', kit.slate)

    // -------------------------------------------------- wheels and running gear
    const tyres: BufferGeometry[] = []
    const treadBands: BufferGeometry[] = []
    const hubs: BufferGeometry[] = []
    for (const z of AXLE_Z) {
      for (const side of [-1, 1] as const) {
        const x = side * WHEEL_X
        const carcass = bevelRing(0.205, TYRE_R, TYRE_HALF * 2, 0.036, 30)
        carcass.rotateY(Math.PI / 2)
        carcass.translate(x, TYRE_R, z)
        tyres.push(carcass)

        const band = bevelRing(0.300, TYRE_R + 0.005, 0.17, 0.012, 30)
        band.rotateY(Math.PI / 2)
        band.translate(x, TYRE_R, z)
        treadBands.push(band)

        const rim = bevelDisc(0.206, 0.11, 0.02, 26)
        rim.rotateY(Math.PI / 2)
        rim.translate(side * 0.655, TYRE_R, z)
        hubs.push(rim)

        const cap = bevelDisc(0.076, 0.05, 0.014, 20)
        cap.rotateY(Math.PI / 2)
        cap.translate(side * 0.723, TYRE_R, z)
        hubs.push(cap)

        hubs.push(boltRun([side * 0.713, TYRE_R, z], 0.128, 8, 0.014, 0.014, AXIS_X))
      }
    }
    // Spare wheel stood on the deck between the monitor and the tank.
    const spare = bevelRing(0.205, TYRE_R, 0.19, 0.032, 26)
    spare.rotateY(Math.PI / 2)
    spare.translate(0.44, DECK_TOP + TYRE_R, 0.36)
    tyres.push(spare)
    const spareRim = bevelDisc(0.206, 0.10, 0.018, 22)
    spareRim.rotateY(Math.PI / 2)
    spareRim.translate(0.49, DECK_TOP + TYRE_R, 0.36)
    hubs.push(spareRim)

    emit('base', mergeParts(tyres, 'wheels'), base, 'wheels', kit.ink)
    emit('base', mergeParts(treadBands, 'treads'), base, 'treads', kit.tread)
    emit('base', mergeParts(hubs, 'hubs'), base, 'hubs', kit.steel)

    const gear: BufferGeometry[] = []
    const springMid = (AXLE_Z[0] + AXLE_Z[1]) / 2
    for (const z of AXLE_Z) {
      const beam = bevelBox(1.22, 0.085, 0.09, 0.008)
      beam.translate(0, TYRE_R, z)
      gear.push(beam)
    }
    for (const side of [-1, 1] as const) {
      const leaf = bevelBox(0.062, 0.03, 0.80, 0.004)
      leaf.translate(side * 0.545, 0.445, springMid)
      gear.push(leaf)
      const leafShort = bevelBox(0.058, 0.026, 0.58, 0.004)
      leafShort.translate(side * 0.545, 0.415, springMid)
      gear.push(leafShort)
      for (const z of [AXLE_Z[0], springMid, AXLE_Z[1]] as const) {
        const hanger = bevelBox(0.05, 0.15, 0.07, 0.005)
        hanger.translate(side * 0.545, 0.525, z)
        gear.push(hanger)
      }
      // Screw stabilisers on all four corners, deployed to the ground.
      for (const z of [-JACK_Z, JACK_Z] as const) {
        const x = side * WHEEL_X
        const housing = bevelBox(0.095, 0.30, 0.095, 0.008)
        housing.translate(x, 0.31, z)
        gear.push(housing)
        const leg = bevelBox(0.07, 0.22, 0.07, 0.006)
        leg.translate(x, 0.10, z)
        gear.push(leg)
        gear.push(groundPad([0.19, 0.19], [x, 0, z], 0.032))
        gear.push(tubeSection(0.014, 0.24, [x + side * 0.13, 0.44, z], AXIS_X, 8))
        gear.push(tubeSection(0.012, 0.10, [x + side * 0.24, 0.44, z + 0.05], AXIS_Z, 8))
      }
    }
    // Tongue jack: mast, bracket and foot.
    const jackZ = HALF_L + 0.42
    gear.push(tubeSection(0.048, 0.40, [0.20, 0.46, jackZ], AXIS_Y, 12))
    const jackBracket = bevelBox(0.10, 0.17, 0.10, 0.006)
    jackBracket.translate(0.145, 0.60, jackZ)
    gear.push(jackBracket)
    gear.push(groundPad([0.16, 0.16], [0.20, 0, jackZ], 0.03))
    // Tank skids under the foam tank.
    for (const side of [-1, 1] as const) {
      const skid = bevelBox(0.11, 0.055, 1.52, 0.006)
      skid.translate(side * 0.42, TANK_BOT - 0.028, TANK_Z)
      gear.push(skid)
    }
    emit('base', mergeParts(gear, 'running gear'), base, 'running-gear', kit.graphite)

    // ------------------------------------------------------------------- tank
    const tank: BufferGeometry[] = []
    const shell = bevelBox(TANK_HALF_W * 2, TANK_TOP - TANK_BOT, TANK_HALF_L * 2, 0.022)
    shell.translate(0, (TANK_TOP + TANK_BOT) / 2, TANK_Z)
    tank.push(shell)
    const cap = bevelBox(1.28, 0.05, 1.60, 0.012)
    cap.translate(0, TANK_TOP + 0.02, TANK_Z)
    tank.push(cap)
    for (const side of [-1, 1] as const) {
      for (const z of [TANK_Z + 0.60, TANK_Z - 0.26] as const) {
        const lug = bevelBox(0.07, 0.12, 0.22, 0.008)
        lug.translate(side * 0.56, TANK_TOP + 0.10, z)
        tank.push(lug)
      }
    }
    const hatch = bevelBox(0.42, 0.12, 0.42, 0.014)
    hatch.translate(0.30, TANK_TOP + 0.10, TANK_Z - 0.25)
    tank.push(hatch)
    emit('base', mergeParts(tank, 'tank'), base, 'tank', safetyYellow)

    const straps: BufferGeometry[] = []
    for (const z of [TANK_Z + 0.60, TANK_Z - 0.26] as const) {
      const over = bevelBox(1.32, 0.02, 0.075, 0.004)
      over.translate(0, TANK_TOP + 0.052, z)
      straps.push(over)
      for (const side of [-1, 1] as const) {
        const down = bevelBox(0.02, TANK_TOP - TANK_BOT - 0.02, 0.075, 0.004)
        down.translate(side * 0.650, (TANK_TOP + TANK_BOT) / 2, z)
        straps.push(down)
      }
    }
    // Dark carrier plate so the sight glass reads against the yellow flank.
    const gaugePlate = bevelBox(0.03, 0.70, 0.13, 0.005)
    gaugePlate.translate(-0.641, 1.19, TANK_Z + 0.54)
    straps.push(gaugePlate)
    // Safety chains off the drawbar.
    const chainZ = HALF_L + 0.28
    for (const side of [-1, 1] as const) {
      straps.push(taperedTube([
        new Vector3(side * 0.15, 0.58, chainZ),
        new Vector3(side * 0.14, 0.44, chainZ + 0.12),
        new Vector3(side * 0.09, 0.41, chainZ + 0.24),
        new Vector3(side * 0.05, 0.52, chainZ + 0.32),
      ], 0.012, 6))
    }
    emit('base', mergeParts(straps, 'straps'), base, 'straps', kit.ink)

    // --------------------------------------------------------------- plumbing
    const plumbing: BufferGeometry[] = []
    // Tow eye on the tongue.
    const towEye = bevelRing(0.048, 0.10, 0.06, 0.008, 24)
    towEye.rotateY(Math.PI / 2)
    towEye.translate(0, 0.60, HALF_L + 0.84)
    plumbing.push(towEye)
    // Tongue jack screw and crank.
    plumbing.push(tubeSection(0.026, 0.36, [0.20, 0.17, jackZ], AXIS_Y, 10))
    const crank = handwheel([0.20, 0.70, jackZ], 0.062, 'y')
    plumbing.push(crank.rim, crank.hub)
    plumbing.push(tubeSection(0.014, 0.07, [0.26, 0.735, jackZ], AXIS_Y, 8))
    // Tank manway: flange, bolted lid, and the sight-glass level gauge on the near flank.
    const flange = bevelDisc(0.175, 0.05, 0.012, 26)
    flange.rotateX(Math.PI / 2)
    flange.translate(-0.26, TANK_TOP + 0.045, TANK_Z + 0.32)
    plumbing.push(flange)
    const lid = bevelDisc(0.13, 0.05, 0.014, 22)
    lid.rotateX(Math.PI / 2)
    lid.translate(-0.26, TANK_TOP + 0.09, TANK_Z + 0.32)
    plumbing.push(lid)
    plumbing.push(boltRun([-0.26, TANK_TOP + 0.075, TANK_Z + 0.32], 0.152, 8, 0.011, 0.014, AXIS_Y))
    plumbing.push(tubeSection(0.030, 0.62, [-0.664, 1.19, TANK_Z + 0.54], AXIS_Y, 10))
    for (const y of [0.88, 1.50] as const) {
      const fitting = bevelBox(0.08, 0.06, 0.11, 0.005)
      fitting.translate(-0.664, y, TANK_Z + 0.54)
      plumbing.push(fitting)
    }
    // Water inlets: two Storz couplings through the near skirt. The gallery linking them runs inboard
    // and under the deck, so all that shows above the plate is one flanged riser beside the pedestal.
    plumbing.push(tubeSection(0.055, 0.86, [-0.58, 0.60, 0.86], AXIS_Z, 12))
    for (const z of [0.55, 1.15] as const) {
      plumbing.push(tubeSection(0.068, 0.16, [-0.70, 0.52, z], AXIS_X, 14))
      const lip = bevelRing(0.068, 0.092, 0.028, 0.007, 22)
      lip.rotateY(Math.PI / 2)
      lip.translate(-0.782, 0.52, z)
      plumbing.push(lip)
      plumbing.push(member(new Vector3(-0.68, 0.52, z), new Vector3(-0.58, 0.60, z), 0.05, 10))
    }
    const penetration = bevelDisc(0.09, 0.022, 0.005, 20)
    penetration.rotateX(Math.PI / 2)
    penetration.translate(-0.24, DECK_TOP + 0.008, MONITOR_Z)
    plumbing.push(penetration)
    plumbing.push(member(
      new Vector3(-0.24, DECK_TOP + 0.012, MONITOR_Z),
      new Vector3(-0.11, DECK_TOP + 0.058, MONITOR_Z),
      0.045,
      12,
    ))
    // Tank outlet stub feeding the induction line.
    plumbing.push(tubeSection(0.05, 0.18, [0.17, 0.90, -0.04], AXIS_Z, 12))
    emit('base', mergeParts(plumbing, 'plumbing'), base, 'plumbing', kit.steel)

    // Rear DOT lamps.
    const lamps: BufferGeometry[] = []
    for (const side of [-1, 1] as const) {
      const lamp = bevelBox(0.12, 0.16, 0.05, 0.008)
      lamp.translate(side * 0.58, 0.60, -HALF_L - 0.02)
      lamps.push(lamp)
    }
    emit('base', mergeParts(lamps, 'lamps'), base, 'lamps', kit.amber)

    // Foam concentrate line from the tank valve forward to the monitor base.
    emit('base', taperedTube([
      new Vector3(0.17, 0.90, 0.12),
      new Vector3(0.24, 0.84, 0.42),
      new Vector3(0.22, 0.80, 0.72),
      new Vector3(0.11, 0.80, 0.89),
    ], 0.034, 8), base, 'induction-line', hoseGreen)

    // ---------------------------------------------------------------- monitor
    // One short waterway with a single induction stage and a bell that is large against it, which is
    // how the reference head reads; three collars on a long barrel read as a striped hose instead.
    const dir = new Vector3(0, Math.sin(ELEV), Math.cos(ELEV))
    const pivot = new Vector3(0, PIVOT_Y, 0.02)
    const at = (t: number): Vector3 => pivot.clone().addScaledVector(dir, t)
    const throat = at(BARREL - 0.02)
    const mouth = at(BARREL - 0.02 + BELL_LEN)

    const monitorRed: BufferGeometry[] = []
    monitorRed.push(tubeSection(0.088, 0.42, [0, 0.24, 0], AXIS_Y, 18))
    monitorRed.push(tubeSection(0.078, 0.15, [0, 0.545, 0], AXIS_Y, 16))
    monitorRed.push(member(pivot, at(BARREL), 0.070, 14))
    // Tiller handwheels hung on the kerb side where they read: elevation above, rotation below.
    const elevWheel = handwheel([-0.215, 0.50, -0.02], 0.105, 'x')
    const rotWheel = handwheel([-0.200, 0.21, 0.02], 0.086, 'x')
    monitorRed.push(elevWheel.rim, rotWheel.rim)
    monitorRed.push(member(
      new Vector3(0.10, PIVOT_Y, -0.04),
      new Vector3(0.36, 0.30, -0.34),
      0.020,
      8,
    ))
    emit('cannon', mergeParts(monitorRed, 'monitor body'), nozzle, 'monitor-body')

    const monitorSteel: BufferGeometry[] = []
    const flangePad = bevelDisc(0.20, 0.055, 0.014, 26)
    flangePad.rotateX(Math.PI / 2)
    flangePad.translate(0, 0.032, 0)
    monitorSteel.push(flangePad)
    monitorSteel.push(boltRun([0, 0.055, 0], 0.168, 6, 0.012, 0.016, AXIS_Y))
    const collar = bevelRing(0.088, 0.142, 0.075, 0.012, 26)
    collar.rotateX(Math.PI / 2)
    collar.translate(0, 0.475, 0)
    monitorSteel.push(collar)
    // Elevation pivot boss, proud of both yoke cheeks so the joint reads as a hinge.
    monitorSteel.push(tubeSection(0.055, 0.28, [0, PIVOT_Y, 0.02], AXIS_X, 14))
    monitorSteel.push(elevWheel.hub, rotWheel.hub)
    // Worm shafts from the handwheels into the pedestal.
    monitorSteel.push(tubeSection(0.020, 0.16, [-0.145, 0.50, -0.02], AXIS_X, 8))
    monitorSteel.push(tubeSection(0.020, 0.15, [-0.135, 0.21, 0.02], AXIS_X, 8))
    const bellRim = bevelRing(0.150, 0.182, 0.038, 0.008, 26)
    bellRim.rotateX(-ELEV)
    bellRim.translate(mouth.x, mouth.y, mouth.z)
    monitorSteel.push(bellRim)
    emit('cannon', mergeParts(monitorSteel, 'monitor hardware'), nozzle, 'monitor-hardware', kit.steel)

    const monitorJoints: BufferGeometry[] = []
    for (const side of [-1, 1] as const) {
      const cheek = bevelBox(0.032, 0.22, 0.21, 0.006)
      cheek.translate(side * 0.090, PIVOT_Y + 0.01, 0.02)
      monitorJoints.push(cheek)
    }
    // The single induction stage: a stepped collar low on the barrel.
    monitorJoints.push(member(at(0.16), at(0.30), 0.096, 14))
    emit('cannon', mergeParts(monitorJoints, 'monitor joints'), nozzle, 'monitor-joints', kit.slate)

    const bell = revolve(
      [[0, 0.46], [0.18, 0.48], [0.42, 0.57], [0.66, 0.72], [0.86, 0.90], [1, 1.0]],
      { yBot: 0, yTop: BELL_LEN, scaleW: 0.165, segments: 24 },
    )
    bell.rotateX(Math.PI / 2 - ELEV)
    bell.translate(throat.x, throat.y, throat.z)
    emit('cannon', bell, nozzle, 'nozzleBell', kit.slate)

    // Induction hose climbing the barrel to the stage collar, and the tiller grip.
    emit('cannon', taperedTube([
      new Vector3(0.11, 0.08, -0.03),
      new Vector3(0.17, 0.26, 0.02),
      new Vector3(0.16, 0.48, 0.07),
      new Vector3(0.10, 0.68, 0.14),
      new Vector3(0.03, 0.78, 0.19),
    ], 0.031, 8), nozzle, 'monitor-hose', hoseGreen)
    emit('cannon', tubeSection(0.026, 0.11, [0.37, 0.29, -0.35], AXIS_Z, 10), nozzle, 'grip', kit.ink)

    nozzle.rotation.y = config.yaw
  }

  rebuild()

  return {
    root,
    parts: { base, nozzle },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.yaw !== undefined) {
        config.yaw = patch.yaw
        nozzle.rotation.y = config.yaw
      }
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
  return createF1Preview(createModel({ yaw: 0 }), {
    aspect,
    target: [0, 0.98, 0.42],
    distance: 8.3,
    fov: 30,
    yaw: -0.72,
    pitch: 0.20,
    ground: true,
  })
}
