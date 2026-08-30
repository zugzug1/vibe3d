// f1-sector-gantry — trackside sector-timing gantry: battered lattice masts, a warren box truss over the
// racing surface, and a signal head hung under the span carrying the sector plate beside an SC panel.
//
// Datums: SECTOR_BOARD for the timing plate, FIA_LIGHT_PANEL for the SC cabinet, 5.2 m soffit so the head
// hangs clear inside the same overhead envelope as the kit's spectator bridge.

import {
  BufferGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  AXIS_X,
  FIA_LIGHT_PANEL,
  LAYER_CLEARANCE,
  SECTOR_BOARD,
  acquireF1Materials,
  bevelBox,
  boltRun,
  createF1Preview,
  disposeF1Materials,
  circuitSignTexture,
  groundPad,
  layer,
  member,
  mergeParts,
  tubeSection,
} from '../f1-kit-core/index.ts'

type Slot = 'truss' | 'fascia'

export interface F1SectorGantryConfig {
  span: number
  sector: number
}

export interface F1SectorGantryOptions extends Partial<F1SectorGantryConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1SectorGantryInstance {
  readonly root: Group
  readonly parts: { truss: Group; fascia: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1SectorGantryConfig>
  configure(patch: Partial<F1SectorGantryConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1SectorGantryConfig = { span: 8, sector: 1 }

/** Bottom-chord height. Overhead signage sits under the kit's 5.5 m bridge deck, above a 5 m catch fence. */
const SOFFIT = 5.2

/** Square-section box truss: chord centres are `width` apart in Z and `depth` apart in Y. */
const TRUSS = {
  width: 0.56,
  depth: 0.62,
  chord: 0.046,
  brace: 0.022,
  bay: 1.35,
  overhang: 0.45,
} as const

/** Battered four-leg mast. `spread` is how far each foot steps outboard of its head, in metres. */
const MAST = {
  section: 0.36,
  spread: 0.28,
  leg: 0.046,
  brace: 0.022,
  bays: 4,
  haunch: 1.05,
} as const

/** Carcass frame margin around the two display cells. */
const HEAD_MARGIN = 0.12
const HEAD_GAP = 0.12
const HEAD_DEPTH = SECTOR_BOARD.depth
const HEAD_DROP = 0.36
const CELL_FRAME = 0.05
const CELL_PROUD = 0.045

export function createModel(options: F1SectorGantryOptions = {}): F1SectorGantryInstance {
  const config: F1SectorGantryConfig = {
    span: Math.max(4, options.span ?? defaults.span),
    sector: Math.max(1, Math.round(options.sector ?? defaults.sector)),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const extras: Material[] = []
  const textures: DataTexture[] = []
  const ownsFascia = options.materials?.fascia === undefined
  const materialSlots: Record<Slot, Material> = {
    truss: options.materials?.truss ?? kit.steel,
    fascia: options.materials?.fascia ?? kit.shell,
  }

  const root = new Group(); root.name = 'f1-sector-gantry'
  const truss = new Group(); truss.name = 'truss'
  const fascia = new Group(); fascia.name = 'fascia'
  root.add(truss, fascia)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { truss: [], fascia: [] }

  const releaseGenerated = (): void => {
    truss.clear(); fascia.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
    if (ownsFascia) {
      for (const texture of textures) texture.dispose()
      textures.length = 0
      for (const material of extras) material.dispose()
      extras.length = 0
    }
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

  const between = (a: Vector3, b: Vector3, t: number): Vector3 => new Vector3().lerpVectors(a, b, t)

  /**
   * Warren bracing across the face bounded by chord lines `a0`-`a1` and `b0`-`b1`: one diagonal per bay,
   * alternating which chord it rises from, plus a vertical at every interior station.
   *
   * `phase` flips the first diagonal so two opposite faces of the same truss do not mirror each other.
   */
  const braceFace = (
    out: BufferGeometry[],
    a0: Vector3, a1: Vector3, b0: Vector3, b1: Vector3,
    bays: number, radius: number, phase = 0,
  ): void => {
    for (let i = 0; i < bays; i++) {
      const t0 = i / bays
      const t1 = (i + 1) / bays
      const fromA = (i + phase) % 2 === 0
      out.push(member(
        fromA ? between(a0, a1, t0) : between(b0, b1, t0),
        fromA ? between(b0, b1, t1) : between(a0, a1, t1),
        radius,
        6,
      ))
      if (i > 0) out.push(member(between(a0, a1, t0), between(b0, b1, t0), radius * 0.85, 6))
    }
  }

  const rebuild = (): void => {
    releaseGenerated()
    const { span, sector } = config
    const half = span / 2
    const halfW = TRUSS.width / 2
    const topY = SOFFIT + TRUSS.depth
    const reach = half + TRUSS.overhang

    // --- masts -----------------------------------------------------------------------------------
    const mastParts: BufferGeometry[] = []
    const footParts: BufferGeometry[] = []
    for (const sx of [-1, 1] as const) {
      const cx = sx * half
      const inward = -sx
      const legs: Array<readonly [Vector3, Vector3]> = []
      for (const ox of [-1, 1] as const) {
        for (const oz of [-1, 1] as const) {
          const foot = new Vector3(
            cx + ox * (MAST.section / 2 + MAST.spread),
            0.08,
            oz * (halfW + MAST.spread * 0.55),
          )
          const head = new Vector3(cx + ox * (MAST.section / 2), topY, oz * halfW)
          legs.push([foot, head])
          mastParts.push(member(foot, head, MAST.leg, 10))
          footParts.push(groundPad([0.26, 0.26], [foot.x, 0.02, foot.z], 0.06))
          footParts.push(boltRun([foot.x, 0.08, foot.z], 0.085, 4, 0.014, 0.02))
        }
      }
      // Each adjacent leg pair is one lattice face; the phase walk keeps opposite faces out of step.
      const faces: ReadonlyArray<readonly [number, number]> = [[0, 1], [2, 3], [0, 2], [1, 3]]
      faces.forEach(([ia, ib], index) => {
        const [a0, a1] = legs[ia]!
        const [b0, b1] = legs[ib]!
        braceFace(mastParts, a0, a1, b0, b1, MAST.bays, MAST.brace, (index + (sx > 0 ? 1 : 0)) % 2)
      })
      const cap = bevelBox(MAST.section + 0.1, 0.045, TRUSS.width + 0.1, 0.01)
      cap.translate(cx, topY + 0.035, 0)
      mastParts.push(cap)
      const splice = bevelBox(MAST.section + 0.07, 0.09, TRUSS.width + 0.07, 0.012)
      splice.translate(cx, SOFFIT - 0.11, 0)
      mastParts.push(splice)
      // Haunches springing from the mast into the bottom chord. Without them the span reads as a
      // separate bar resting on two towers rather than a moment joint.
      for (const oz of [-1, 1] as const) {
        mastParts.push(member(
          new Vector3(cx + inward * 0.04, SOFFIT - MAST.haunch, oz * halfW),
          new Vector3(cx + inward * MAST.haunch, SOFFIT - TRUSS.chord * 0.6, oz * halfW),
          0.03,
          8,
        ))
      }
    }
    emit('truss', mergeParts(mastParts, 'masts'), truss, 'masts')
    emit('truss', mergeParts(footParts, 'footings'), truss, 'footings', kit.graphite)

    // --- span ------------------------------------------------------------------------------------
    const spanParts: BufferGeometry[] = []
    const chordEnds = new Map<string, readonly [Vector3, Vector3]>()
    for (const oy of [0, 1] as const) {
      for (const oz of [-1, 1] as const) {
        const y = oy === 0 ? SOFFIT : topY
        const a = new Vector3(-reach, y, oz * halfW)
        const b = new Vector3(reach, y, oz * halfW)
        chordEnds.set(`${oy}:${oz}`, [a, b])
        spanParts.push(member(a, b, TRUSS.chord, 10))
      }
    }
    const bays = Math.max(6, Math.round((reach * 2) / TRUSS.bay))
    for (const oz of [-1, 1] as const) {
      const [b0, b1] = chordEnds.get(`0:${oz}`)!
      const [t0, t1] = chordEnds.get(`1:${oz}`)!
      braceFace(spanParts, b0, b1, t0, t1, bays, TRUSS.brace, oz > 0 ? 0 : 1)
    }
    for (const oy of [0, 1] as const) {
      const [n0, n1] = chordEnds.get(`${oy}:-1`)!
      const [p0, p1] = chordEnds.get(`${oy}:1`)!
      braceFace(spanParts, n0, n1, p0, p1, bays, TRUSS.brace * 0.9, oy)
    }
    for (const sx of [-1, 1] as const) {
      const ex = sx * reach
      for (const oz of [-1, 1] as const) {
        spanParts.push(member(
          new Vector3(ex, SOFFIT, oz * halfW),
          new Vector3(ex, topY, oz * halfW),
          TRUSS.brace * 1.15,
          6,
        ))
      }
      for (const y of [SOFFIT, topY] as const) {
        spanParts.push(member(
          new Vector3(ex, y, -halfW),
          new Vector3(ex, y, halfW),
          TRUSS.brace * 1.15,
          6,
        ))
      }
    }
    emit('truss', mergeParts(spanParts, 'span'), truss, 'span', kit.slate)

    // --- timing cabinet and the loop cable it feeds ------------------------------------------------
    const headX = -Math.min(1.5, span * 0.14)
    const cabX = half - MAST.section / 2 - 0.34
    const cabZ = halfW + MAST.spread * 0.55 + 0.22
    const serviceParts: BufferGeometry[] = []
    const plinth = bevelBox(0.66, 0.2, 0.44, 0.014)
    plinth.translate(cabX, 0.1, cabZ)
    serviceParts.push(plinth)
    const cabinet = bevelBox(0.54, 0.76, 0.32, 0.014)
    cabinet.translate(cabX, 0.58, cabZ)
    serviceParts.push(cabinet)
    const cabFace = cabZ + 0.16
    for (let i = 0; i < 4; i++) {
      const louvre = bevelBox(0.36, 0.026, 0.014, 0.004)
      louvre.translate(cabX, 0.82 - i * 0.085, layer(cabFace, 2) + 0.007)
      serviceParts.push(louvre)
    }

    const trayY = SOFFIT - 0.13
    const trayZ = halfW - 0.03
    serviceParts.push(member(
      new Vector3(cabX, 0.98, cabZ),
      new Vector3(cabX, trayY, trayZ),
      0.03,
      8,
    ))
    const trayRun = Math.max(0.4, cabX - headX)
    const tray = bevelBox(trayRun, 0.06, 0.12, 0.008)
    tray.translate((cabX + headX) / 2, trayY, trayZ)
    serviceParts.push(tray)
    for (let i = 1; i < 4; i++) {
      const cleat = bevelBox(0.05, 0.13, 0.05, 0.006)
      cleat.translate(headX + (trayRun * i) / 4, trayY + 0.09, trayZ)
      serviceParts.push(cleat)
    }
    emit('truss', mergeParts(serviceParts, 'service'), truss, 'service', kit.graphite)

    // --- signal head -------------------------------------------------------------------------------
    const cellH = FIA_LIGHT_PANEL.height
    const cellsW = SECTOR_BOARD.width + HEAD_GAP + FIA_LIGHT_PANEL.width
    const carcassW = cellsW + HEAD_MARGIN * 2
    const carcassH = cellH + HEAD_MARGIN
    const headTop = SOFFIT - TRUSS.chord - HEAD_DROP
    const headY = headTop - carcassH / 2
    const faceZ = HEAD_DEPTH / 2

    const rigParts: BufferGeometry[] = []
    for (const sx of [-1, 1] as const) {
      const hx = headX + sx * cellsW * 0.31
      const strap = bevelBox(0.1, HEAD_DROP + 0.16, 0.12, 0.008)
      strap.translate(hx, headTop + HEAD_DROP / 2 - 0.04, 0)
      rigParts.push(strap)
      const gusset = bevelBox(0.1, 0.14, 0.28, 0.008)
      gusset.translate(hx, headTop + 0.06, 0)
      rigParts.push(gusset)
      for (const oz of [-1, 1] as const) {
        rigParts.push(tubeSection(TRUSS.chord + 0.026, 0.11, [hx, SOFFIT, oz * halfW], AXIS_X, 12))
      }
      rigParts.push(member(
        new Vector3(hx, headTop + 0.1, 0.04),
        new Vector3(hx, SOFFIT - 0.03, -halfW + 0.05),
        0.02,
        6,
      ))
    }
    const spreader = bevelBox(cellsW * 0.74, 0.08, 0.14, 0.008)
    spreader.translate(headX, headTop + 0.02, 0)
    rigParts.push(spreader)
    emit('fascia', mergeParts(rigParts, 'rig'), fascia, 'rig', kit.graphite)

    const carcass = bevelBox(carcassW, carcassH, HEAD_DEPTH, 0.014)
    carcass.translate(headX, headY, 0)
    emit('fascia', carcass, fascia, 'carcass', kit.graphite)

    const sectorX = headX - cellsW / 2 + SECTOR_BOARD.width / 2
    const scX = headX + cellsW / 2 - FIA_LIGHT_PANEL.width / 2

    // Each cell gets a proud surround, so the plate reads as recessed in a well rather than glued on.
    // The surround bites a full layer step into the carcass so the seam cannot z-fight (rule 8).
    const bezelParts: BufferGeometry[] = []
    const cells: ReadonlyArray<readonly [number, number, number]> = [
      [sectorX, SECTOR_BOARD.width, SECTOR_BOARD.height],
      [scX, FIA_LIGHT_PANEL.width, FIA_LIGHT_PANEL.height],
    ]
    const bezelZ = faceZ + CELL_PROUD / 2 - LAYER_CLEARANCE
    for (const [cx, cw, ch] of cells) {
      for (const oy of [-1, 1] as const) {
        const rail = bevelBox(cw + CELL_FRAME * 2, CELL_FRAME, CELL_PROUD, 0.006)
        rail.translate(cx, headY + oy * (ch / 2 + CELL_FRAME / 2), bezelZ)
        bezelParts.push(rail)
      }
      for (const ox of [-1, 1] as const) {
        const stile = bevelBox(CELL_FRAME, ch, CELL_PROUD, 0.006)
        stile.translate(cx + ox * (cw / 2 + CELL_FRAME / 2), headY, bezelZ)
        bezelParts.push(stile)
      }
    }
    emit('fascia', mergeParts(bezelParts, 'bezels'), fascia, 'bezels', kit.steel)

    let sectorMat: Material | undefined
    let scMat: Material | undefined
    if (ownsFascia) {
      const sectorTex = circuitSignTexture({ kind: `SEC ${Math.min(9, sector)}` })
      const scTex = circuitSignTexture({ kind: 'SC', width: 128, height: 128 })
      textures.push(sectorTex, scTex)
      sectorMat = new MeshStandardMaterial({
        name: `f1-kit / sector ${sector}`,
        map: sectorTex,
        roughness: 0.55,
        metalness: 0.05,
      })
      scMat = new MeshStandardMaterial({
        name: 'f1-kit / sector gantry SC',
        map: scTex,
        roughness: 0.55,
        metalness: 0.05,
      })
      extras.push(sectorMat, scMat)
    }
    const plateZ = layer(faceZ, 3)
    const sectorFace = new PlaneGeometry(SECTOR_BOARD.width, SECTOR_BOARD.height)
    sectorFace.translate(sectorX, headY, plateZ)
    emit('fascia', sectorFace, fascia, 'plate', sectorMat)
    const scFace = new PlaneGeometry(FIA_LIGHT_PANEL.width, FIA_LIGHT_PANEL.height)
    scFace.translate(scX, headY, plateZ)
    emit('fascia', scFace, fascia, 'sc-panel', scMat)

    // A raked visor and its end fins are what separate a signal head from a plate on a bracket.
    const shadeParts: BufferGeometry[] = []
    const visor = bevelBox(carcassW + 0.22, 0.05, 0.34, 0.01)
    visor.rotateX(-0.24)
    visor.translate(headX, headY + carcassH / 2 + 0.07, 0.17)
    shadeParts.push(visor)
    for (const sx of [-1, 1] as const) {
      const fin = bevelBox(0.05, 0.32, 0.32, 0.008)
      fin.rotateX(-0.12)
      fin.translate(headX + sx * (carcassW / 2 + 0.08), headY + carcassH / 2 - 0.15, 0.12)
      shadeParts.push(fin)
    }
    emit('fascia', mergeParts(shadeParts, 'shade'), fascia, 'shade', kit.slate)

    const lip = bevelBox(carcassW + 0.1, 0.07, 0.15, 0.008)
    lip.translate(headX, headY - carcassH / 2 - 0.03, 0.05)
    emit('fascia', lip, fascia, 'lip', kit.cobalt)

    const lampParts: BufferGeometry[] = []
    for (const sx of [-1, 1] as const) {
      const lamp = bevelBox(0.1, 0.07, 0.07, 0.008)
      lamp.translate(headX + sx * (carcassW / 2 - 0.11), headY - carcassH / 2 - 0.03, layer(0.125, 2))
      lampParts.push(lamp)
    }
    emit('fascia', mergeParts(lampParts, 'markers'), fascia, 'markers', kit.amber)
  }
  rebuild()

  return {
    root,
    parts: { truss, fascia },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.span !== undefined) config.span = Math.max(4, patch.span)
      if (patch.sector !== undefined) config.sector = Math.max(1, Math.round(patch.sector))
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel({ span: 9, sector: 2 }), {
    aspect,
    target: [-0.3, 3.05, 0],
    distance: 19.5,
    fov: 32,
    yaw: -0.5,
    pitch: 0.16,
    ground: true,
  })
}
