// f1-pit-wall — FIA signalling gantry standing on the pit-lane barrier: 1.00 m deep counter, ≤ 2.20 m
// overall, one bay per GARAGE_BAY_PITCH.
//
// Depth convention: -Z is the track, +Z is the pit lane. The concrete barrier and the glazed debris
// screen take the track edge; the crew work from the pit-lane side, so the monitor bank faces +Z and the
// branded apron under the counter carries the sponsor run and the box number a driver reads on his way
// in. The counter cantilevers off the barrier onto a raked leg frame standing on the barrier footing,
// which is what gives the prop an underside instead of leaving a shelf floating at 1.10 m.
//
// Nothing leaves the 1.00 m x 2.20 m envelope and nothing oversails the bay pitch in X, so a host can
// abut instances end to end at `bays * GARAGE_BAY_PITCH` without the canopies colliding.

import {
  BufferGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  GARAGE_BAY_PITCH,
  PIT_WALL,
  TOKEN,
  acquireF1Materials,
  bevelBox,
  createF1Preview,
  disposeF1Materials,
  fasciaTexture,
  groundPad,
  layer,
  member,
  mergeParts,
  shade,
  sponsorWallTexture,
  type F1Materials,
} from '../f1-kit-core/index.ts'

type Slot = 'shell' | 'glass' | 'fascia'

export interface F1PitWallConfig {
  bays: number
  labels?: string[]
}

export interface F1PitWallOptions extends Partial<F1PitWallConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1PitWallInstance {
  readonly root: Group
  readonly parts: { shell: Group; glass: Group; fascia: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1PitWallConfig>
  configure(patch: Partial<F1PitWallConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1PitWallConfig = { bays: 2 }

const DEPTH = PIT_WALL.depth
const SHELF_H = PIT_WALL.shelf
const GLASS_H = PIT_WALL.glass
const TOTAL_H = PIT_WALL.height
const CAP_H = TOTAL_H - SHELF_H - GLASS_H

/** Track face and pit-lane face of the 1.00 m envelope. */
const TRACK_Z = -DEPTH / 2
const LANE_Z = DEPTH / 2

/** FIA 3501 concrete section on a spread footing, capped by a coping the counter sits on. */
const BARRIER_T = 0.46
const BARRIER_Z = TRACK_Z + BARRIER_T / 2
const FOOTING_H = 0.22
const FOOTING_T = BARRIER_T + 0.36
const COPING_H = 0.08
const DECK_T = 0.09
/** The counter's nose rail: a proud edge band the deck is shortened to make room for. */
const NOSING_T = 0.055
const LIP_H = 0.17
/**
 * The lip stands proud of the deck rather than finishing flush with it. A counter edge level with its
 * top surface has no edge of its own to catch light, which is what let the desk plane sink into the
 * branded apron below it and read as one tall band.
 */
const LIP_PROUD = 0.015

const BARRIER_H = SHELF_H - DECK_T - COPING_H

/**
 * The roof is a panel, not a slab. Spending the whole 0.10 m cap on a thick canopy plus a full-height
 * front band gave the gantry an edge two-fifths the height of the apron, which reads as a beam parked on
 * the monitor bank. The cap is split instead — a thin slate panel over a shallow matte fascia — so the
 * front edge is about a quarter of the apron and the roof line stays a line.
 */
const CANOPY_T = CAP_H * 0.45
const SOFFIT_Y = TOTAL_H - CANOPY_T
const CANOPY_BAND_H = 0.055
const CANOPY_BAND_T = 0.04
/**
 * The roof takes the pit-lane edge of the envelope and stops on the debris-screen head rail rather
 * than running the full metre. It shelters the crew, which is all it has to do, and the track-side
 * setback keeps the largest lit plane in the prop off the barrier line.
 */
const CANOPY_D = DEPTH - 0.10

/** Cantilever legs stand on the footing just inside the pit-lane edge, so the counter nose overhangs. */
const LEG_Z = LANE_Z - 0.16
const LEG_INSET = 0.60
const FOOT_T = 0.024
const TRAY_Y = 0.40

/**
 * Canopy posts sit on the leg line rather than forward of it, so footing, leg, apron and post stack into
 * one line of support and the canopy visibly oversails them. Slimmer than the legs they carry: a post
 * takes roof weight, not the counter.
 */
const POST_W = 0.055
const POST_T = 0.075

/**
 * Clad apron over the leg frame: the branded face. It runs the whole installation so a bay seam is a
 * panel joint rather than a hole, and stops clear of the footing so the frame beneath stays visible.
 */
const APRON_T = 0.06
const APRON_H = 0.42
const APRON_Y = 0.56
const APRON_Z = LANE_Z - 0.11
const GRAPHIC_H = APRON_H - 0.08
const GRAPHIC_Y = APRON_Y + APRON_H / 2
const GRAPHIC_Z = layer(APRON_Z + APRON_T / 2, 2)
const PLATE_W = 0.68
/** Sponsor boards fill the bay either side of the number plate and butt up across the bay joint. */
const SPONSOR_W = (GARAGE_BAY_PITCH - PLATE_W) / 2 - 0.10

/** Debris screen plane, and the sill / head rails that carry it. */
const SCREEN_Z = TRACK_Z + 0.09
const MULLION_W = 0.08
const SILL_H = 0.07
const HEAD_H = 0.10

/** One engineer per metre of counter — the pitch the monitor bank reads at. */
const MONITOR_PITCH = 1.0

/**
 * A built geometry with its ownership slot. `tint` swaps in a shared kit material for value separation,
 * `material` hands in a model-owned one; either way the slot stays the group `setMaterial` retargets.
 */
interface Piece {
  readonly name: string
  readonly slot: Slot
  readonly geometry: BufferGeometry
  readonly tint?: keyof F1Materials
  readonly material?: Material
}

function bayLabel(labels: string[] | undefined, index: number): string {
  if (labels?.[index]) return String(labels[index]).slice(0, 3)
  return index === 0 ? '11' : String(index + 1)
}

/**
 * The parts that run the whole installation: footing, barrier, coping, counter deck, nose rail, clad
 * apron and canopy.
 *
 * Read bottom to top, the elevation alternates: mid footing, dark frame, dark apron, bright lip, mid
 * deck, dark bank, mid canopy. The apron is the darkest thing in the prop and the lip the brightest, and
 * that one pairing is what stops the elevated counter from merging into the barrier band beneath it.
 */
function spinePieces(span: number): Piece[] {
  const footing = bevelBox(span, FOOTING_H, FOOTING_T, 0.012)
  footing.translate(0, FOOTING_H / 2, TRACK_Z + FOOTING_T / 2)

  const barrier = bevelBox(span, BARRIER_H - FOOTING_H, BARRIER_T, 0.014)
  barrier.translate(0, (FOOTING_H + BARRIER_H) / 2, BARRIER_Z)

  // The coping oversails the barrier on the pit-lane side only; the track face is the envelope edge.
  const coping = bevelBox(span, COPING_H, BARRIER_T + 0.03, 0.010)
  coping.translate(0, BARRIER_H + COPING_H / 2, BARRIER_Z + 0.015)

  const apron = bevelBox(span, APRON_H, APRON_T, 0.010)
  apron.translate(0, APRON_Y + APRON_H / 2, APRON_Z)

  const deck = bevelBox(span, DECK_T, DEPTH - NOSING_T, 0.010)
  deck.translate(0, SHELF_H - DECK_T / 2, -NOSING_T / 2)

  const nosing = bevelBox(span, LIP_H, NOSING_T, 0.008)
  nosing.translate(0, SHELF_H + LIP_PROUD - LIP_H / 2, LANE_Z - NOSING_T / 2)

  const canopy = bevelBox(span, CANOPY_T, CANOPY_D, 0.008)
  canopy.translate(0, TOTAL_H - CANOPY_T / 2, LANE_Z - CANOPY_D / 2)

  const band = bevelBox(span, CANOPY_BAND_H, CANOPY_BAND_T, 0.006)
  band.translate(0, SOFFIT_Y - CANOPY_BAND_H / 2, LANE_Z - CANOPY_BAND_T / 2)

  return [
    { name: 'footing', slot: 'shell', geometry: footing },
    { name: 'barrier', slot: 'shell', geometry: barrier },
    { name: 'coping', slot: 'shell', geometry: coping, tint: 'steel' },
    { name: 'apron', slot: 'shell', geometry: apron, tint: 'ink' },
    { name: 'deck', slot: 'shell', geometry: deck },
    { name: 'nosing', slot: 'shell', geometry: nosing, tint: 'steel' },
    { name: 'canopy', slot: 'shell', geometry: canopy },
    { name: 'canopy-band', slot: 'shell', geometry: band, tint: 'ink' },
  ]
}

/** One bay of under-structure: legs, feet, knee brackets, back stays, canopy posts and cable tray. */
function framePieces(x: number, index: number): Piece[] {
  const parts: BufferGeometry[] = []
  const legH = SHELF_H - DECK_T - FOOTING_H - FOOT_T

  for (const side of [-1, 1] as const) {
    const lx = x + side * (GARAGE_BAY_PITCH / 2 - LEG_INSET)

    const leg = bevelBox(0.11, legH, 0.13, 0.008)
    leg.translate(lx, FOOTING_H + FOOT_T + legH / 2, LEG_Z)
    parts.push(leg, groundPad([0.30, 0.32], [lx, FOOTING_H, LEG_Z], FOOT_T))

    const knee = bevelBox(0.09, 0.20, 0.36, 0.006)
    knee.translate(lx, SHELF_H - DECK_T - 0.10, LEG_Z - 0.19)
    parts.push(knee)

    parts.push(member(
      new Vector3(lx, FOOTING_H + 0.10, LEG_Z),
      new Vector3(lx, BARRIER_H, TRACK_Z + BARRIER_T),
      0.028,
    ))

    const post = bevelBox(POST_W, SOFFIT_Y - SHELF_H, POST_T, 0.006)
    post.translate(lx, (SHELF_H + SOFFIT_Y) / 2, LEG_Z)
    parts.push(post)
  }

  const tray = bevelBox(GARAGE_BAY_PITCH - 1.0, 0.11, 0.16, 0.008)
  tray.translate(x, TRAY_Y, LEG_Z)
  parts.push(tray)

  return [{
    name: `frame-${index}`,
    slot: 'shell',
    geometry: mergeParts(parts, `f1-pit-wall: frame ${index}`),
    tint: 'graphite',
  }]
}

/** A monitor: bezel into the shell batch, lit face into the screen batch, both tilted as one body. */
function addMonitor(
  shells: BufferGeometry[], screens: BufferGeometry[],
  x: number, y: number, z: number,
  width: number, height: number, thickness: number, tilt: number,
): void {
  const bezel = bevelBox(width, height, thickness, 0.005)
  bezel.rotateX(tilt)
  bezel.translate(x, y, z)
  shells.push(bezel)

  const face = new PlaneGeometry(width - 0.11, height - 0.09)
  face.translate(0, 0, layer(thickness / 2, 2))
  face.rotateX(tilt)
  face.translate(x, y, z)
  screens.push(face)
}

/**
 * One bay of the monitor bank: an engineer station per metre, batched by material.
 *
 * Every third station is a single screen rather than a stacked pair. A fully regular two-row grid reads
 * as a scoreboard, and the run of a real pit wall is never that tidy.
 */
function bankPieces(x: number, index: number, lit: Material): Piece[] {
  const stations = Math.max(1, Math.round(GARAGE_BAY_PITCH / MONITOR_PITCH))
  const step = GARAGE_BAY_PITCH / stations
  const shells: BufferGeometry[] = []
  const screens: BufferGeometry[] = []

  for (let s = 0; s < stations; s++) {
    const sx = x - GARAGE_BAY_PITCH / 2 + (s + 0.5) * step
    const plinth = bevelBox(step - 0.16, 0.05, 0.30, 0.006)
    plinth.translate(sx, SHELF_H + 0.025, -0.10)
    shells.push(plinth)

    const wide = s % 2 === 0
    addMonitor(shells, screens, sx, SHELF_H + 0.26, -0.06, step - (wide ? 0.22 : 0.30), 0.42, 0.05, -0.10)
    if (s % 3 === 1) continue
    addMonitor(
      shells, screens,
      sx + (wide ? 0.04 : -0.05), SHELF_H + 0.72, -0.17,
      step - 0.40, 0.28, 0.045, -0.16,
    )
  }

  return [
    // Bezels and plinths sit a value above the apron. Sharing `ink` with the branded face let the whole
    // counter read as one dark block, so the bank takes structural metal and the apron keeps the darkest.
    { name: `bank-${index}`, slot: 'shell', geometry: mergeParts(shells, `f1-pit-wall: bank ${index}`), tint: 'graphite' },
    { name: `screens-${index}`, slot: 'fascia', geometry: mergeParts(screens, `f1-pit-wall: screens ${index}`), material: lit },
  ]
}

/** The track-side debris screen: mullions on three-per-bay centres, sill and head rails, and the panes. */
function glazingPieces(span: number, bays: number): Piece[] {
  const bars = bays * 3
  const step = span / bars
  const bandH = SOFFIT_Y - SHELF_H
  const paneH = bandH - SILL_H - HEAD_H
  const frame: BufferGeometry[] = []
  const panes: BufferGeometry[] = []

  for (let m = 0; m <= bars; m++) {
    const mullion = bevelBox(MULLION_W, bandH, 0.11, 0.006)
    // The two end posts tuck inside the run so the screen does not oversail the bay pitch.
    const inset = m === 0 ? MULLION_W / 2 : m === bars ? -MULLION_W / 2 : 0
    mullion.translate(-span / 2 + m * step + inset, SHELF_H + bandH / 2, SCREEN_Z)
    frame.push(mullion)
  }

  const sill = bevelBox(span, SILL_H, 0.12, 0.006)
  sill.translate(0, SHELF_H + SILL_H / 2, SCREEN_Z)
  const head = bevelBox(span, HEAD_H, 0.12, 0.006)
  head.translate(0, SOFFIT_Y - HEAD_H / 2, SCREEN_Z)
  frame.push(sill, head)

  for (let p = 0; p < bars; p++) {
    const pane = bevelBox(step - 0.10, paneH, 0.014, 0.003)
    pane.translate(-span / 2 + (p + 0.5) * step, SHELF_H + SILL_H + paneH / 2, SCREEN_Z)
    panes.push(pane)
  }

  return [
    { name: 'screen-frame', slot: 'shell', geometry: mergeParts(frame, 'f1-pit-wall: screen frame'), tint: 'graphite' },
    { name: 'screen-panes', slot: 'glass', geometry: mergeParts(panes, 'f1-pit-wall: screen panes') },
  ]
}

export function createModel(options: F1PitWallOptions = {}): F1PitWallInstance {
  const config: F1PitWallConfig = {
    bays: Math.max(1, Math.round(options.bays ?? defaults.bays)),
    labels: options.labels,
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const ownsFascia = options.materials?.fascia === undefined

  /** Live for the whole instance. Consumer-supplied materials never land here (rule 16). */
  const ownedOnce: Material[] = []
  const ownedTextures: DataTexture[] = []
  /** Rebuilt with the geometry, so released on every rebuild. */
  const perBuild: Material[] = []
  const perBuildTextures: DataTexture[] = []

  const glassMat = options.materials?.glass ?? (() => {
    const mat = new MeshStandardMaterial({
      name: 'f1-kit / pit wall glass',
      color: 0x0a1218,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.35,
    })
    ownedOnce.push(mat)
    return mat
  })()

  // Live telemetry, not a lamp: `kit.cyan` is an untone-mapped signal lens, and it turns a bank of
  // twenty-odd monitors into a single flat sheet of light.
  const screenMat = new MeshStandardMaterial({
    name: 'f1-kit / pit wall monitor',
    color: shade(TOKEN.INK_950, 0.06),
    emissive: TOKEN.CYAN_400,
    emissiveIntensity: 0.34,
    roughness: 0.24,
    metalness: 0.0,
  })
  ownedOnce.push(screenMat)

  // Three marks per board, sampled from a single row of the grid. A pit-wall apron carries a handful of
  // large marks; tiling the whole grid along 14 m turns the branded face into ticker tape.
  const sponsorTexture = sponsorWallTexture({ width: 384, height: 256, columns: 3, rows: 2 })
  sponsorTexture.wrapS = RepeatWrapping
  sponsorTexture.repeat.set(1, 0.5)
  ownedTextures.push(sponsorTexture)
  const sponsorMat = new MeshStandardMaterial({
    name: 'f1-kit / pit wall sponsor run',
    map: sponsorTexture,
    roughness: 0.62,
    metalness: 0.05,
  })
  ownedOnce.push(sponsorMat)

  const materialSlots: Record<Slot, Material> = {
    shell: options.materials?.shell ?? kit.slate,
    glass: glassMat,
    fascia: options.materials?.fascia ?? kit.shell,
  }

  const root = new Group(); root.name = 'f1-pit-wall'
  const shell = new Group(); shell.name = 'shell'
  const glass = new Group(); glass.name = 'glass'
  const fascia = new Group(); fascia.name = 'fascia'
  root.add(shell, glass, fascia)
  const groupOf: Record<Slot, Group> = { shell, glass, fascia }

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { shell: [], glass: [], fascia: [] }
  let disposed = false

  const releaseGenerated = (): void => {
    shell.clear(); glass.clear(); fascia.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
    for (const texture of perBuildTextures) texture.dispose()
    perBuildTextures.length = 0
    for (const material of perBuild) material.dispose()
    perBuild.length = 0
  }

  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string, material?: Material): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, material ?? materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const emitPiece = (piece: Piece): void => {
    const material = piece.material ?? (piece.tint ? kit[piece.tint] : undefined)
    emit(piece.slot, piece.geometry, groupOf[piece.slot], piece.name, material)
  }

  /**
   * The bay's graphics: a sponsor board either side of a centred box-number plate. The plate is a dark
   * board with a light numeral, not the default white paper — a white rectangle at this size out-reads
   * every other element in the prop. Its material is per bay, so it is rebuilt with the geometry unless
   * the consumer owns the fascia slot.
   */
  const emitGraphics = (x: number, index: number): void => {
    for (const side of [-1, 1] as const) {
      const board = new PlaneGeometry(SPONSOR_W, GRAPHIC_H)
      board.translate(x + side * (GARAGE_BAY_PITCH / 2 - SPONSOR_W / 2), GRAPHIC_Y, GRAPHIC_Z)
      emit('fascia', board, fascia, `sponsor-${index}${side < 0 ? 'a' : 'b'}`, sponsorMat)
    }

    const plate = new PlaneGeometry(PLATE_W, GRAPHIC_H)
    plate.translate(x, GRAPHIC_Y, GRAPHIC_Z)
    if (!ownsFascia) {
      emit('fascia', plate, fascia, `plate-${index}`)
      return
    }
    const texture = fasciaTexture({
      number: bayLabel(config.labels, index),
      legend: 'PIT',
      paper: [14, 22, 30],
      ink: [232, 242, 246],
    })
    perBuildTextures.push(texture)
    const material = new MeshStandardMaterial({
      name: `f1-kit / pit fascia ${index}`,
      map: texture,
      roughness: 0.55,
      metalness: 0.05,
    })
    perBuild.push(material)
    emit('fascia', plate, fascia, `plate-${index}`, material)
  }

  const rebuild = (): void => {
    releaseGenerated()
    const bays = config.bays
    const span = bays * GARAGE_BAY_PITCH
    for (const piece of spinePieces(span)) emitPiece(piece)
    for (const piece of glazingPieces(span, bays)) emitPiece(piece)
    for (let i = 0; i < bays; i++) {
      const x = -span / 2 + (i + 0.5) * GARAGE_BAY_PITCH
      for (const piece of framePieces(x, i)) emitPiece(piece)
      for (const piece of bankPieces(x, i, screenMat)) emitPiece(piece)
      emitGraphics(x, i)
    }
  }
  rebuild()

  return {
    root,
    parts: { shell, glass, fascia },
    materials: materialSlots,
    getConfig: () => ({ ...config, labels: config.labels ? [...config.labels] : undefined }),
    configure(patch) {
      if (patch.bays !== undefined) config.bays = Math.max(1, Math.round(patch.bays))
      if (patch.labels !== undefined) config.labels = patch.labels ? [...patch.labels] : undefined
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      if (disposed) return
      disposed = true
      releaseGenerated()
      for (const texture of ownedTextures) texture.dispose()
      ownedTextures.length = 0
      for (const material of ownedOnce) material.dispose()
      ownedOnce.length = 0
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

/**
 * Three-quarter framing from the pit-lane side, high enough to look onto the counter.
 *
 * A near-frontal view of a 14 m run that is only 1.00 m deep is an elevation drawing: the counter, the
 * canopy overhang and the leg frame all collapse onto the apron and the prop reads as a flat billboard.
 * The oblique is deliberately strong — around 53 degrees — because that is what it takes for a metre of
 * depth to register against fourteen metres of length, and the camera sits close enough for the far bay
 * to foreshorten so the run recedes instead of repeating.
 *
 * Pitch is the tighter constraint: the canopy oversails the top monitor row by half a metre, so much
 * past 15 degrees of elevation and the roof eats the bank it is supposed to shelter.
 */
export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel({ bays: 2 }), {
    aspect,
    target: [-0.70, 0.55, -0.92],
    distance: 17.5,
    fov: 36,
    yaw: -0.92,
    pitch: 0.26,
  })
}
