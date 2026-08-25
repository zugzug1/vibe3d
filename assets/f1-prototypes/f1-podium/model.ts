// f1-podium — Albert Park GP dais (Wikimedia 028A8788 / 028A8821).
//
// Two curvatures, both load-bearing. The whole structure sits on one 3.30 m bow, so the 3.56 m of
// Appendix 5 frontage turns P2 and P3 a visible 21 degrees away from the lens instead of lining them up as
// a flat row. Each F1-supplied block is then its own D-drum on that bow: straight back, short sides and a
// shallow convex camera face carrying an ivory pinstripe under the top edge, a second at the base, and a
// large ivory numeral between them. A low frameless glass lip on spigot clamps guards each surface.
//
// Trophies, champagne and flags are separate props.

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

/** Radius of the bow the three blocks are set out on. */
const FACE_R = 3.3
const BACK_R = FACE_R - PODIUM.p1.depth
/** The walkway is the apron the drivers stand on; its front riser is the band the cameras see. */
const APRON = { depth: 0.4, height: 0.34 } as const
const APRON_R = FACE_R + APRON.depth
/** Model Z of the dais face crown, which puts the whole structure roughly on the origin. */
const FACE_Z = 0.3
const ARC_Z = FACE_Z - FACE_R

/**
 * Crown rise of a block's own camera face, as a fraction of its depth. Shallow on purpose: it has to read
 * as convex from the front while staying flat enough under a 0.26 m numeral for that numeral to sit in the
 * paint rather than float off the ends of it (rule 8).
 */
const DRUM_BULGE = 0.15

/** Ivory pinstripe: 6 mm into the paint, 10 mm proud of it. */
const TRIM_IN = 0.006
const TRIM_OUT = 0.01
/** Numerals are set deeper than the pinstripe so their outer ends still bite the curved face. */
const NUMERAL_IN = 0.01
const NUMERAL_OUT = 0.034
/**
 * Frameless glass. Low is the whole point — a shin-height lip on the apron and an ankle-height one on each
 * block, both barely tinted, so the paint and the numerals stay the subject instead of a milky barrier.
 */
const GLASS_T = 0.019
const GLASS_STANDOFF = 0.004
const APRON_GLASS_RISE = 0.22
const DAIS_GLASS_RISE = 0.16
const GLASS_GRIP = 0.05

/** Half the dais band's angular sweep, measured along the bow. */
const DAIS_HALF_A = (PODIUM.p1.width / 2 + PODIUM.gap + PODIUM.p2.width) / FACE_R
/** The apron has to clear the outer blocks before it can read as a step around them. */
const MIN_WIDTH = 2 * APRON_R * Math.sin(DAIS_HALF_A + 0.02)
const defaults: F1PodiumConfig = { width: 4.4 }

interface Block {
  readonly place: 1 | 2 | 3
  readonly digit: '1' | '2' | '3'
  /** Angle of this block's crown on the bow. */
  readonly mid: number
  /** Radius of the block's own camera face. */
  readonly crownR: number
  /** Half sweep of that face, about its own centre. */
  readonly half: number
  /** Standing surface, in metres above the ground. */
  readonly top: number
  /** Exposed front-face height above the apron. */
  readonly face: number
  readonly width: number
  readonly depth: number
}

function daisSpec(place: 1 | 2 | 3) {
  if (place === 1) return PODIUM.p1
  if (place === 2) return PODIUM.p2
  return PODIUM.p3
}

/** Radius and half sweep of a block face `width` wide bulging `DRUM_BULGE * depth` at its crown. */
function drumFace(width: number, depth: number): { crownR: number; half: number } {
  const hw = width / 2
  const bulge = depth * DRUM_BULGE
  const crownR = (hw * hw + bulge * bulge) / (2 * bulge)
  return { crownR, half: Math.asin(Math.min(1, hw / crownR)) }
}

/** Camera-facing sweep: P2 turns to −X, P1 holds the crown, P3 turns to +X. */
function blocks(): readonly Block[] {
  const gap = PODIUM.gap / FACE_R
  const half = PODIUM.p1.width / FACE_R / 2
  const outer = PODIUM.p2.width / FACE_R
  const mids: Record<1 | 2 | 3, number> = {
    1: 0,
    2: -half - gap - outer / 2,
    3: half + gap + outer / 2,
  }
  return ([2, 1, 3] as const).map((place) => {
    const spec = daisSpec(place)
    return {
      place,
      digit: String(place) as '1' | '2' | '3',
      mid: mids[place],
      ...drumFace(spec.width, spec.depth),
      top: APRON.height + spec.height,
      face: spec.height,
      width: spec.width,
      depth: spec.depth,
    }
  })
}

/**
 * An annular sector standing on end about the shared bow centre: the band lies in XZ, bows toward +Z, and
 * extrudes `height` along Y centred on the origin. Angles are measured from the crown, +A toward +X.
 */
function arcSolid(
  rIn: number,
  rOut: number,
  a0: number,
  a1: number,
  height: number,
  bevel: number,
  segments: number,
): BufferGeometry {
  const geo = arcBand(rIn, rOut, a0 - Math.PI / 2, a1 - Math.PI / 2, height, bevel, segments)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0, ARC_Z)
  return geo
}

/**
 * The same band in a block's own frame: `crownR` is the radius whose crown lands on the local origin, so
 * an applied layer only has to name the radius it wants and everything stays concentric with the face.
 */
function localBand(
  rIn: number,
  rOut: number,
  crownR: number,
  half: number,
  height: number,
  bevel: number,
  segments: number,
): BufferGeometry {
  const geo = arcBand(rIn, rOut, -Math.PI / 2 - half, -Math.PI / 2 + half, height, bevel, segments)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0, -crownR)
  return geo
}

/**
 * Plan of one F1-supplied block: shallow convex camera face, short sides, straight back. Sampled with an
 * even count so no vertex lands on an axis, which is what lets `bevelPrism` chamfer it at all.
 */
function drumOutline(block: Block): Array<readonly [number, number]> {
  const { crownR, half, width, depth } = block
  const hw = width / 2
  const yFront = -depth / 2
  const centre = yFront + crownR
  const outline: Array<readonly [number, number]> = []
  const samples = 12
  for (let i = 0; i < samples; i++) {
    const a = -half + (2 * half * i) / (samples - 1)
    outline.push([crownR * Math.sin(a), centre - crownR * Math.cos(a)])
  }
  outline.push([hw, depth / 2], [-hw, depth / 2])
  return outline
}

/** Moves a block-local geometry onto the bow: crown to `mid`, then up to `y`. */
function place(geometry: BufferGeometry, mid: number, y: number): BufferGeometry {
  geometry.rotateY(mid)
  return geometry.translate(FACE_R * Math.sin(mid), y, ARC_Z + FACE_R * Math.cos(mid))
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
 * Spigot clamps along a guarded edge: a dark bracket that bites into the paint, straddles the glass and
 * laps down over the face. This is the detail that reads as frameless glass rather than a railing.
 */
function clamps(r: number, half: number, inset: number): Array<{ a: number }> {
  const reach = half - inset
  const count = Math.max(2, Math.round((2 * reach * r) / 0.62) + 1)
  const run: Array<{ a: number }> = []
  for (let i = 0; i < count; i++) run.push({ a: -reach + (2 * reach * i) / (count - 1) })
  return run
}

function clampBlock(): BufferGeometry {
  return bevelBox(0.05, 0.17, 0.072, 0.005)
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
    color: shade(TOKEN.RED_500, -0.52),
    roughness: 0.62,
    metalness: 0.04,
  })
  const apronPaint = new MeshStandardMaterial({
    name: 'f1-kit / podium apron maroon',
    color: shade(TOKEN.RED_500, -0.62),
    roughness: 0.68,
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
    color: shade(TOKEN.ICE_300, -0.06),
    roughness: 0.04,
    metalness: 0.02,
    transparent: true,
    opacity: 0.09,
    side: DoubleSide,
    depthWrite: false,
  })
  const fascia = new MeshStandardMaterial({
    name: 'f1-kit / podium fascia',
    color: shade(TOKEN.RED_500, -0.68),
    roughness: 0.84,
    metalness: 0,
  })
  const rigging = new MeshStandardMaterial({
    name: 'f1-kit / podium rigging',
    color: shade(TOKEN.RED_500, -0.8),
    roughness: 0.88,
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
      arcSolid(BACK_R, APRON_R, -apronHalf, apronHalf, deckTop, 0.01, 30)
        .translate(0, deckTop / 2, 0),
      deck,
      'apron',
    )
    emit(
      'plate',
      arcSolid(
        APRON_R - TRIM_IN, APRON_R + TRIM_OUT,
        -apronHalf + 0.01, apronHalf - 0.01,
        0.032, 0.003, 26,
      ).translate(0, deckTop - 0.066, 0),
      plates,
      'apron-stripe',
    )

    const clampParts: BufferGeometry[] = []
    for (const { a } of clamps(APRON_R, apronHalf, 0.03)) {
      const block = clampBlock()
      block.rotateY(a)
      clampParts.push(
        block.translate(
          (APRON_R + 0.026) * Math.sin(a),
          deckTop - 0.05,
          ARC_Z + (APRON_R + 0.026) * Math.cos(a),
        ),
      )
    }

    for (const block of blocks()) {
      const { place: p, mid, crownR, half, top, face } = block
      // Sunk 20 mm into the apron so the seated cap never co-planes with the deck it stands on.
      const height = face + 0.02
      const body = bevelPrism(drumOutline(block), height, 0.012)
      body.rotateX(-Math.PI / 2)
      body.translate(0, 0, -block.depth / 2)
      emit('steps', place(body, mid, deckTop - 0.02 + height / 2), steps, `dais-${p}`)

      const stripeTop = top - 0.071
      const stripeBase = deckTop + 0.042
      const graphics: BufferGeometry[] = [
        localBand(crownR - TRIM_IN, crownR + TRIM_OUT, crownR, half - 0.01, 0.032, 0.003, 18)
          .translate(0, stripeTop, 0),
        localBand(crownR - TRIM_IN, crownR + TRIM_OUT, crownR, half - 0.01, 0.02, 0.003, 18)
          .translate(0, stripeBase, 0),
      ]
      const digit = numeral(block.digit, Math.min(0.38, (face - 0.1) * 0.74), NUMERAL_OUT)
      digit.translate(0, (stripeBase + 0.01 + stripeTop - 0.016) / 2, NUMERAL_OUT / 2 - NUMERAL_IN)
      graphics.push(digit)
      emit(
        'plate',
        place(mergeParts(graphics, `f1-podium: graphics ${p}`), mid, 0),
        plates,
        `graphics-${p}`,
      )

      emit(
        'barrier',
        place(
          localBand(
            crownR + GLASS_STANDOFF, crownR + GLASS_STANDOFF + GLASS_T, crownR,
            half - 0.012, DAIS_GLASS_RISE + GLASS_GRIP, 0.002, 18,
          ),
          mid,
          top - GLASS_GRIP + (DAIS_GLASS_RISE + GLASS_GRIP) / 2,
        ),
        barrier,
        `glass-${p}`,
      )

      for (const { a } of clamps(crownR, half, 0.06)) {
        const bracket = clampBlock()
        bracket.rotateY(a)
        bracket.translate(crownR * Math.sin(a), top - 0.05, crownR * (Math.cos(a) - 1))
        clampParts.push(place(bracket, mid, 0))
      }
    }

    emit(
      'barrier',
      arcSolid(
        APRON_R + GLASS_STANDOFF, APRON_R + GLASS_STANDOFF + GLASS_T,
        -apronHalf + 0.012, apronHalf - 0.012,
        APRON_GLASS_RISE + GLASS_GRIP, 0.002, 26,
      ).translate(0, deckTop - GLASS_GRIP + (APRON_GLASS_RISE + GLASS_GRIP) / 2, 0),
      barrier,
      'rail',
    )
    emit('barrier', mergeParts(clampParts, 'f1-podium: clamps'), barrier, 'clamps', kit.graphite)

    const wallW = config.width + 2.4
    const wallH = PODIUM.backdropH
    const wallT = PODIUM.backdropT
    // Appendix 5 flag slot is measured off the structure's rearmost point, not the crown.
    const wallZ = ARC_Z + BACK_R * Math.cos(apronHalf) - PODIUM.flagGap - wallT / 2 - 0.04
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
    for (let i = 0; i < 7; i++) {
      const x = (i / 6 - 0.5) * (wallW - 0.8)
      seamParts.push(
        bevelBox(0.09, seamH, 0.016, 0.003).translate(x, 0.28 + seamH / 2, wallZ + wallT / 2 - 0.008),
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
    target: [0, 1, 0.1],
    distance: 10,
    fov: 30,
    yaw: -0.15,
    pitch: 0.11,
  })
}
