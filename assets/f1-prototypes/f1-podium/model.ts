// f1-podium — Albert Park GP dais (Wikimedia 028A8788 / 028A8821).
//
// One curved maroon structure, not three loose blocks: a single concentric band bowed toward the cameras
// and cut into P2 | P1 | P3 sectors at Appendix 5 heights, seated on a full-width walkway apron of the
// same paint. Every camera-facing arc carries an ivory pinstripe under its top edge and a second at its
// base, a large ivory numeral between them, and a low frameless glass run held by spigot clamps that lap
// down over the paint. Trophies, champagne and flags are separate props.
//
// The arc is what makes the reference read: 3.56 m of dais frontage on a 4.80 m radius bows 0.33 m at the
// crown, so the outer sectors turn visibly away from the lens instead of lining up as a flat wall.

import {
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Material,
} from 'three/webgpu'

import {
  PODIUM,
  TOKEN,
  acquireF1Materials,
  arcBand,
  bevelBox,
  bevelPrism,
  createF1Preview,
  disposeF1Materials,
  mergeParts,
  shade,
} from '../f1-kit-core/index.ts'

type Slot = 'steps' | 'deck' | 'barrier' | 'frame' | 'plate'

export interface F1PodiumConfig {
  /** Front chord of the walkway apron, in metres. The dais band inside it is fixed by Appendix 5. */
  width: number
}

export interface F1PodiumOptions extends Partial<F1PodiumConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1PodiumInstance {
  readonly root: Group
  readonly parts: { steps: Group; deck: Group; barrier: Group; frame: Group; plates: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1PodiumConfig>
  configure(patch: Partial<F1PodiumConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

/** Radius of the dais front face. Sized so the Appendix 5 frontage bows ~0.33 m at the crown. */
const FACE_R = 4.8
const BACK_R = FACE_R - PODIUM.p1.depth
/** The walkway is the apron the drivers stand on; its front riser is the band the cameras see. */
const APRON = { depth: 0.55, height: 0.34 } as const
const APRON_R = FACE_R + APRON.depth
/** Model Z of the dais face crown, which puts the whole structure roughly on the origin. */
const FACE_Z = 0.3
const ARC_Z = FACE_Z - FACE_R

/** Ivory pinstripe: 6 mm into the paint, 10 mm proud of it. */
const TRIM_IN = 0.006
const TRIM_OUT = 0.01
/** Frameless glass sits just off the paint and rises this far above the surface it guards. */
const GLASS_T = 0.019
const GLASS_STANDOFF = 0.004
const GLASS_RISE = 0.32
const GLASS_GRIP = 0.05

/** Half the dais band's angular sweep, measured along the front face. */
const DAIS_HALF_A = (PODIUM.p1.width / 2 + PODIUM.gap + PODIUM.p2.width) / FACE_R
/** The apron has to clear the outer dais corners before it can read as a step around them. */
const MIN_WIDTH = 2 * APRON_R * Math.sin(DAIS_HALF_A + 0.02)
const defaults: F1PodiumConfig = { width: 4.4 }

interface Sector {
  readonly place: 1 | 2 | 3
  readonly digit: '1' | '2' | '3'
  readonly a0: number
  readonly a1: number
  readonly mid: number
  /** Standing surface, in metres above the ground. */
  readonly top: number
  /** Exposed front-face height above the apron. */
  readonly face: number
}

function daisSpec(place: 1 | 2 | 3) {
  if (place === 1) return PODIUM.p1
  if (place === 2) return PODIUM.p2
  return PODIUM.p3
}

/** Camera-facing sweep: P2 turns to −X, P1 holds the crown, P3 turns to +X. */
function sectors(): readonly Sector[] {
  const gap = PODIUM.gap / FACE_R
  const half = PODIUM.p1.width / FACE_R / 2
  const p2 = PODIUM.p2.width / FACE_R
  const p3 = PODIUM.p3.width / FACE_R
  const spans: Record<1 | 2 | 3, readonly [number, number]> = {
    1: [-half, half],
    2: [-half - gap - p2, -half - gap],
    3: [half + gap, half + gap + p3],
  }
  return ([2, 1, 3] as const).map((place) => {
    const [a0, a1] = spans[place]
    return {
      place,
      digit: String(place) as '1' | '2' | '3',
      a0,
      a1,
      mid: (a0 + a1) / 2,
      top: APRON.height + daisSpec(place).height,
      face: daisSpec(place).height,
    }
  })
}

/**
 * An annular sector standing on end: the band lies in XZ about the shared arc centre, bows toward +Z, and
 * extrudes `height` along Y centred on the origin. Angles are measured from the crown, +A toward +X.
 */
function arcSolid(
  rIn: number,
  rOut: number,
  a0: number,
  a1: number,
  height: number,
  bevel: number,
  segments = 22,
): BufferGeometry {
  const geo = arcBand(rIn, rOut, a0 - Math.PI / 2, a1 - Math.PI / 2, height, bevel, segments)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0, ARC_Z)
  return geo
}

/** Ivory pinstripe following a painted arc, held back from each end so it cannot overshoot the corner. */
function pinstripe(r: number, a0: number, a1: number, y: number, height: number): BufferGeometry {
  return arcSolid(r - TRIM_IN, r + TRIM_OUT, a0 + 0.01, a1 - 0.01, height, 0.003, 18)
    .translate(0, y, 0)
}

/** World point on an arc of `r` at angle `a`, as `[x, z]`. */
function arcPoint(r: number, a: number): readonly [number, number] {
  return [r * Math.sin(a), ARC_Z + r * Math.cos(a)]
}

/**
 * A tier numeral: real arc bowls for 2 and 3, a flagged polygon for 1, so the digits read as painted
 * signage rather than a seven-segment display. Authored facing +Z, `h` tall, centred on the origin.
 */
function numeral(digit: '1' | '2' | '3', h: number, proud: number): BufferGeometry {
  const t = h * 0.19
  const parts: BufferGeometry[] = []
  const bowl = (cy: number, r: number, a0: number, a1: number): void => {
    parts.push(arcBand(r - t / 2, r + t / 2, a0, a1, proud, 0.004, 20).translate(0, cy, 0))
  }

  if (digit === '1') {
    const sw = t * 0.62
    const flag = h * 0.3
    parts.push(
      bevelPrism(
        [
          [-sw, -h / 2],
          [sw, -h / 2],
          [sw, h / 2],
          [-sw * 0.4, h / 2],
          [-flag, h * 0.3],
          [-flag * 0.82, h * 0.13],
          [-sw, h * 0.24],
        ],
        proud,
        0.004,
      ),
    )
  } else if (digit === '2') {
    const r = h * 0.245
    const cy = h * 0.5 - t / 2 - r
    const open = -0.62
    bowl(cy, r, open, Math.PI + 0.12)
    const from = [Math.cos(open) * r, cy + Math.sin(open) * r] as const
    const to = [-h * 0.24, -h * 0.3] as const
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const diagonal = bevelBox(Math.hypot(dx, dy) + t * 0.4, t, proud, 0.004)
    diagonal.rotateZ(Math.atan2(dy, dx))
    diagonal.translate((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0)
    parts.push(diagonal)
    parts.push(bevelBox(h * 0.68, t, proud, 0.004).translate(0, -h / 2 + t / 2, 0))
  } else {
    const r = (h - t) / 4
    bowl(r, r, -1.3, Math.PI * 0.96)
    bowl(-r, r, -Math.PI * 0.96, 1.3)
  }
  return mergeParts(parts, `f1-podium: numeral ${digit}`)
}

/**
 * Spigot clamps along a guarded front edge: a dark bracket that bites into the paint, straddles the glass
 * and laps down over the face. This is the detail that reads as frameless glass rather than a railing.
 */
function clampRun(r: number, a0: number, a1: number, top: number): BufferGeometry {
  const start = a0 + 0.024
  const end = a1 - 0.024
  const count = Math.max(2, Math.round(((end - start) * r) / 0.62) + 1)
  const parts: BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const a = start + ((end - start) * i) / (count - 1)
    const block = bevelBox(0.058, 0.22, 0.072, 0.005)
    block.rotateY(a)
    const [x, z] = arcPoint(r + 0.026, a)
    block.translate(x, top - 0.04, z)
    parts.push(block)
  }
  return mergeParts(parts, 'f1-podium: clamps')
}

export function createModel(options: F1PodiumOptions = {}): F1PodiumInstance {
  const config: F1PodiumConfig = {
    width: Math.max(MIN_WIDTH, options.width ?? defaults.width),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const extras: Material[] = []
  const paint = new MeshStandardMaterial({
    name: 'f1-kit / podium maroon',
    color: shade(TOKEN.RED_500, -0.4),
    roughness: 0.58,
    metalness: 0.04,
  })
  const apronPaint = new MeshStandardMaterial({
    name: 'f1-kit / podium apron maroon',
    color: shade(TOKEN.RED_500, -0.5),
    roughness: 0.62,
    metalness: 0.04,
  })
  const ivory = new MeshStandardMaterial({
    name: 'f1-kit / podium ivory',
    color: shade(TOKEN.DUST_300, 0.62),
    roughness: 0.44,
    metalness: 0.05,
  })
  const glass = new MeshStandardMaterial({
    name: 'f1-kit / podium glass',
    color: shade(TOKEN.ICE_300, -0.08),
    roughness: 0.06,
    metalness: 0.02,
    transparent: true,
    opacity: 0.24,
    side: DoubleSide,
    depthWrite: false,
  })
  const fascia = new MeshStandardMaterial({
    name: 'f1-kit / podium fascia',
    color: shade(TOKEN.RED_500, -0.58),
    roughness: 0.8,
    metalness: 0,
  })
  const rigging = new MeshStandardMaterial({
    name: 'f1-kit / podium rigging',
    color: shade(TOKEN.RED_500, -0.78),
    roughness: 0.86,
    metalness: 0,
  })
  extras.push(paint, apronPaint, ivory, glass, fascia, rigging)

  const materialSlots: Record<Slot, Material> = {
    steps: options.materials?.steps ?? paint,
    deck: options.materials?.deck ?? apronPaint,
    barrier: options.materials?.barrier ?? glass,
    frame: options.materials?.frame ?? fascia,
    plate: options.materials?.plate ?? ivory,
  }

  const root = new Group(); root.name = 'f1-podium'
  const steps = new Group(); steps.name = 'steps'
  const deck = new Group(); deck.name = 'deck'
  const barrier = new Group(); barrier.name = 'barrier'
  const frame = new Group(); frame.name = 'frame'
  const plates = new Group(); plates.name = 'plates'
  root.add(steps, deck, barrier, frame, plates)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = {
    steps: [], deck: [], barrier: [], frame: [], plate: [],
  }

  const releaseGenerated = (): void => {
    steps.clear(); deck.clear(); barrier.clear(); frame.clear(); plates.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  const emit = (
    slot: Slot,
    geometry: BufferGeometry,
    group: Group,
    name: string,
    material?: Material,
  ): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, material ?? materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const rebuild = (): void => {
    releaseGenerated()
    const apronHalf = Math.asin(Math.min(0.92, config.width / (2 * APRON_R)))
    const deckTop = APRON.height

    emit(
      'deck',
      arcSolid(BACK_R, APRON_R, -apronHalf, apronHalf, deckTop, 0.01, 26)
        .translate(0, deckTop / 2, 0),
      deck,
      'apron',
    )
    emit(
      'plate',
      pinstripe(APRON_R, -apronHalf, apronHalf, deckTop - 0.066, 0.032),
      deck,
      'apron-stripe-top',
    )
    emit(
      'plate',
      pinstripe(APRON_R, -apronHalf, apronHalf, 0.037, 0.018),
      deck,
      'apron-stripe-base',
    )

    for (const sector of sectors()) {
      const { place, a0, a1, mid, top, face } = sector
      // Sunk 20 mm into the apron so the seated cap never co-planes with the deck it stands on.
      const height = face + 0.02
      emit(
        'steps',
        arcSolid(BACK_R, FACE_R, a0, a1, height, 0.01)
          .translate(0, deckTop - 0.02 + height / 2, 0),
        steps,
        `dais-${place}`,
      )

      const stripeTop = top - 0.071
      const stripeBase = deckTop + 0.042
      emit('plate', pinstripe(FACE_R, a0, a1, stripeTop, 0.032), steps, `stripe-top-${place}`)
      emit('plate', pinstripe(FACE_R, a0, a1, stripeBase, 0.02), steps, `stripe-base-${place}`)

      const proud = 0.026
      const digit = numeral(sector.digit, Math.min(0.34, (face - 0.1) * 0.72), proud)
      digit.rotateY(mid)
      const [dx, dz] = arcPoint(FACE_R - TRIM_IN + proud / 2, mid)
      digit.translate(dx, (stripeBase + 0.01 + stripeTop - 0.016) / 2, dz)
      emit('plate', digit, plates, `numeral-${place}`)

      const glassH = GLASS_RISE + GLASS_GRIP
      emit(
        'barrier',
        arcSolid(
          FACE_R + GLASS_STANDOFF,
          FACE_R + GLASS_STANDOFF + GLASS_T,
          a0 + 0.012,
          a1 - 0.012,
          glassH,
          0.002,
          18,
        ).translate(0, top - GLASS_GRIP + glassH / 2, 0),
        barrier,
        `glass-${place}`,
      )
    }

    const apronGlassH = GLASS_RISE + GLASS_GRIP
    emit(
      'barrier',
      arcSolid(
        APRON_R + GLASS_STANDOFF,
        APRON_R + GLASS_STANDOFF + GLASS_T,
        -apronHalf + 0.012,
        apronHalf - 0.012,
        apronGlassH,
        0.002,
        22,
      ).translate(0, deckTop - GLASS_GRIP + apronGlassH / 2, 0),
      barrier,
      'rail',
    )

    const clamps: BufferGeometry[] = [clampRun(APRON_R, -apronHalf, apronHalf, deckTop)]
    for (const sector of sectors()) {
      clamps.push(clampRun(FACE_R, sector.a0, sector.a1, sector.top))
    }
    emit('barrier', mergeParts(clamps, 'f1-podium: clamps'), barrier, 'clamps', kit.graphite)

    const wallW = config.width + 2.0
    const wallH = PODIUM.backdropH
    const wallT = PODIUM.backdropT
    const wallZ = ARC_Z + BACK_R - PODIUM.flagGap - wallT / 2 - 0.04
    emit('frame', bevelBox(wallW, wallH, wallT, 0.008).translate(0, wallH / 2, wallZ), frame, 'backdrop')
    emit(
      'frame',
      bevelBox(wallW + 0.06, 0.22, wallT + 0.05, 0.006).translate(0, 0.11, wallZ),
      frame,
      'skirt',
      rigging,
    )
    const seamH = wallH - 0.34
    const seamParts: BufferGeometry[] = []
    for (let i = 0; i < 5; i++) {
      const x = (i / 4 - 0.5) * (wallW - 0.9)
      seamParts.push(
        bevelBox(0.07, seamH, 0.02, 0.003).translate(x, 0.28 + seamH / 2, wallZ + wallT / 2 - 0.008),
      )
    }
    emit('frame', mergeParts(seamParts, 'f1-podium: seams'), frame, 'seams', rigging)
    emit(
      'frame',
      bevelBox(wallW, 0.87, wallT * 0.7, 0.006).translate(0, wallH + 0.415, wallZ),
      frame,
      'rigging',
      rigging,
    )
  }
  rebuild()

  return {
    root,
    parts: { steps, deck, barrier, frame, plates },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.width !== undefined) config.width = Math.max(MIN_WIDTH, patch.width)
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      for (const material of extras) material.dispose()
      extras.length = 0
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

/** Near-frontal long lens at dais-top height: the reference framing, with the fascia filling the top. */
export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0, 1.05, 0.1],
    distance: 10,
    fov: 30,
    yaw: -0.15,
    pitch: 0.2,
  })
}
