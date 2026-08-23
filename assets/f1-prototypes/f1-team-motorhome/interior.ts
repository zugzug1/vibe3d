// Cadillac / Schuler hospitality interior — dressed from the 2026 Monaco tour
// (MotorBiscuit, The Race, Cadillac F1). Ceremony pieces are the kit vibe
// models. Soft seats stay local lathes + one padded back. No PRNG.

import {
  BufferGeometry,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  type Material,
} from 'three/webgpu'

import {
  LAYER_CLEARANCE,
  MOTORHOME,
  TROPHY_TABLE,
  bevelBox,
  bevelDisc,
  mergeParts,
  revolve,
  writeGlyphWord,
} from '../f1-kit-core/index.ts'
import { createModel as createChampagne } from '../f1-champagne/model.ts'
import { createModel as createIceBucket } from '../f1-ice-bucket/model.ts'
import { createModel as createTrophyCup } from '../f1-trophy-cup/model.ts'
import { createModel as createTrophyTable } from '../f1-trophy-table/model.ts'

export type InteriorSlot = 'shell' | 'glass' | 'deck'

export interface InteriorMats {
  black: Material
  cream: Material
  glass: Material
  wood: Material
  stone: Material
  grey: Material
  fire: Material
  kit: { graphite: Material; steel: Material; ink: Material; cobalt: Material }
}

export interface InteriorEmit {
  (slot: InteriorSlot, geometry: BufferGeometry, name: string, material?: Material): void
}

export interface InteriorLive {
  readonly root: Group
  dispose(): void
}

export interface InteriorPlace {
  (instance: InteriorLive, x: number, y: number, z: number, yaw?: number): void
}

const STOREY = MOTORHOME.storey
const ATRIUM_W = 4.2

function stampTexture(n: number, paint: (data: Uint8Array, n: number) => void): DataTexture {
  const data = new Uint8Array(n * n * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 10
    data[i + 1] = 12
    data[i + 2] = 16
    data[i + 3] = 255
  }
  paint(data, n)
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType)
  tex.colorSpace = SRGBColorSpace
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

/** Dark field, repeating V grooves in warm white — the tour's illuminated chevron hall. */
export function chevronTexture(): DataTexture {
  return stampTexture(256, (data, n) => {
    const ink: readonly [number, number, number] = [14, 16, 20]
    const lit: readonly [number, number, number] = [236, 232, 220]
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4
        data[i] = ink[0]
        data[i + 1] = ink[1]
        data[i + 2] = ink[2]
        const col = ((x / n) * 4) % 1
        const row = ((y / n) * 6) % 1
        const chev = Math.abs((col - 0.5) * 2) - (0.72 - row)
        if (Math.abs(chev) < 0.055) {
          data[i] = lit[0]
          data[i + 1] = lit[1]
          data[i + 2] = lit[2]
        }
      }
    }
  })
}

/** Oversized white CADILLAC word for the G1 fireplace wall. 3×5 atlas only. */
export function scriptTexture(): DataTexture {
  return stampTexture(256, (data, n) => {
    const white: readonly [number, number, number] = [244, 242, 236]
    writeGlyphWord(data, n, 12, 88, 'CADILLAC', white, 6)
    for (let x = 16; x < 240; x++) {
      const y = 152 + Math.round(Math.sin(x * 0.09) * 3)
      for (let t = -1; t <= 1; t++) {
        const row = y + t
        if (row < 0 || row >= n) continue
        const i = (row * n + x) * 4
        data[i] = white[0]
        data[i + 1] = white[1]
        data[i + 2] = white[2]
      }
    }
  })
}

/** Pedestal lounge chair: lathe seat + padded back. Distinct from a mushroom blob. */
function loungeChairAt(x: number, y: number, z: number, yaw: number): BufferGeometry {
  const pedestal = revolve(
    [
      [0, 0.28],
      [0.12, 0.22],
      [0.55, 0.07],
      [0.88, 0.08],
      [1, 0.2],
    ],
    { yBot: 0, yTop: 0.34, scaleW: 0.16, segments: 14 },
  )
  const seat = revolve(
    [
      [0, 0.12],
      [0.18, 0.92],
      [0.62, 1],
      [0.9, 0.7],
      [1, 0.1],
    ],
    { yBot: 0.34, yTop: 0.46, scaleW: 0.27, segments: 16 },
  )
  const back = bevelBox(0.46, 0.5, 0.08, 0.03)
  back.translate(0, 0.68, -0.2)
  const chair = mergeParts([pedestal, seat, back], 'chair')
  chair.rotateY(yaw)
  chair.translate(x, y, z)
  return chair
}

export function dressInterior(
  w: number,
  d: number,
  emit: InteriorEmit,
  mats: InteriorMats,
  textures: DataTexture[],
  extras: Material[],
  place: InteriorPlace,
): void {
  const atriumHalf = ATRIUM_W / 2 + 0.15
  const wellZ = d / 2 - 2.55
  const steel: BufferGeometry[] = []
  const wood: BufferGeometry[] = []
  const grey: BufferGeometry[] = []
  const cream: BufferGeometry[] = []
  const stone: BufferGeometry[] = []
  const fire: BufferGeometry[] = []
  const dark: BufferGeometry[] = []

  const g1Floor = bevelBox(w - 0.5, 0.08, d - 0.5, 0.01)
  g1Floor.translate(0, 0.1, 0)
  wood.push(g1Floor)

  for (const s of [1, 2] as const) {
    const y = s * STOREY
    const back = bevelBox(w - 0.5, 0.1, d - 3.4, 0.01)
    back.translate(0, y, -1.2)
    const left = bevelBox((w - ATRIUM_W) / 2 - 0.15, 0.1, 3.1, 0.01)
    left.translate(-(w / 2 + atriumHalf) / 2 + 0.1, y, wellZ)
    const right = bevelBox((w - ATRIUM_W) / 2 - 0.15, 0.1, 3.1, 0.01)
    right.translate((w / 2 + atriumHalf) / 2 - 0.1, y, wellZ)
    wood.push(back, left, right)
    const ceil = bevelBox(w - 0.7, 0.06, d - 0.7, 0.008)
    ceil.translate(0, y - 0.08, 0)
    dark.push(ceil)
  }

  const chevTex = chevronTexture()
  textures.push(chevTex)
  const chevMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome chevron',
    map: chevTex,
    emissiveMap: chevTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.55,
    roughness: 0.62,
    metalness: 0.04,
  })
  extras.push(chevMat)
  const hall = new PlaneGeometry(7.2, 2.7)
  hall.rotateY(Math.PI / 2)
  hall.translate(-(w / 2 - 0.46), 1.45, -2.2)
  emit('shell', hall, 'chevron-hall', chevMat)
  for (const sx of [-1, 1] as const) {
    const flank = new PlaneGeometry(2.4, 2.5)
    flank.translate(sx * 3.15, 1.4, -(d / 2 - 0.5) + LAYER_CLEARANCE * 3)
    emit('shell', flank, sx < 0 ? 'chevron-left' : 'chevron-right', chevMat)
  }

  dark.push(bevelBox(3.9, 0.58, 0.24, 0.016).translate(0, 0.42, -(d / 2 - 0.7)))
  fire.push(bevelBox(3.35, 0.13, 0.08, 0.006).translate(0, 0.44, -(d / 2 - 0.56)))
  stone.push(bevelBox(4.05, 0.05, 0.34, 0.008).translate(0, 0.16, -(d / 2 - 0.66)))

  const scriptTex = scriptTexture()
  textures.push(scriptTex)
  const scriptMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome script',
    map: scriptTex,
    emissiveMap: scriptTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.35,
    roughness: 0.5,
    metalness: 0.02,
  })
  extras.push(scriptMat)
  const script = new PlaneGeometry(3.8, 1.15)
  script.translate(0, 1.85, -(d / 2 - 0.5) + LAYER_CLEARANCE * 3)
  emit('deck', script, 'script-g1', scriptMat)

  for (const [x, z, yaw] of [
    [-2.6, -5.4, 0.15],
    [2.6, -5.4, -0.15],
    [-3.4, -3.8, 0.6],
    [3.4, -3.8, -0.6],
  ] as const) {
    grey.push(loungeChairAt(x, 0, z, yaw))
  }

  const tableTop = 0.12 + TROPHY_TABLE.height
  place(createTrophyTable(), -2.4, 0.12, 3.4, 0.06)
  place(createTrophyTable(), 2.2, 0.12, 2.6, -0.1)
  place(createChampagne(), -1.95, tableTop, 3.55)
  place(createChampagne(), 2.55, tableTop, 2.75)
  place(createIceBucket(), -2.95, tableTop, 3.2)
  place(createTrophyCup(), 1.85, tableTop, 2.45)

  const y2 = STOREY
  for (const [x, z] of [
    [-2.2, 2.4],
    [1.1, 0.2],
  ] as const) {
    const top = bevelDisc(0.55, 0.04, 0.008, 24)
    top.translate(x, y2 + 0.74, z)
    const stem = revolve(
      [
        [0, 0.35],
        [0.2, 0.18],
        [0.85, 0.1],
        [1, 0.22],
      ],
      { yBot: y2, yTop: y2 + 0.72, scaleW: 0.09, segments: 14 },
    )
    stem.translate(x, 0, z)
    dark.push(top, stem)
    for (let k = 0; k < 4; k++) {
      const a = (k + 0.25) * (Math.PI / 2)
      grey.push(loungeChairAt(x + Math.sin(a) * 0.95, y2, z + Math.cos(a) * 0.95, a + Math.PI))
    }
  }

  const sofaBack = bevelBox(0.14, 0.52, 4.2, 0.03)
  sofaBack.rotateY(-0.12)
  sofaBack.translate(4.15, y2 + 0.62, -3.8)
  cream.push(sofaBack)
  for (let i = 0; i < 5; i++) {
    const t = (i - 2) / 2
    const cushion = revolve(
      [
        [0, 0.15],
        [0.2, 0.95],
        [0.7, 1],
        [1, 0.12],
      ],
      { yBot: 0.34, yTop: 0.48, scaleW: 0.3, segments: 14 },
    )
    cushion.rotateY(t * 0.2)
    cushion.translate(3.7, y2, -3.8 + t * 0.85)
    cream.push(cushion)
  }

  dark.push(bevelBox(3.4, 1.02, 0.58, 0.02).translate(-4.2, y2 + 0.51, -5.4))
  stone.push(bevelBox(3.5, 0.05, 0.68, 0.01).translate(-4.2, y2 + 1.04, -5.4))
  dark.push(bevelBox(0.62, 0.38, 0.32, 0.012).translate(-3.5, y2 + 1.28, -5.38))
  const group = revolve(
    [
      [0, 0.4],
      [0.35, 1],
      [0.7, 0.85],
      [1, 0.2],
    ],
    { yBot: y2 + 1.12, yTop: y2 + 1.28, scaleW: 0.07, segments: 12 },
  )
  group.translate(-3.5, 0, -5.18)
  steel.push(group)
  const cupA = revolve(
    [
      [0, 0.3],
      [0.4, 1],
      [1, 0.85],
    ],
    { yBot: 0, yTop: 0.07, scaleW: 0.035, segments: 10 },
  )
  cupA.translate(-4.6, y2 + 1.06, -5.25)
  cream.push(cupA)
  place(createIceBucket(), -5.2, y2 + 1.06, -5.35)
  place(createChampagne(), -1.75, y2 + 0.78, 2.55)
  place(createChampagne(), 1.45, y2 + 0.78, 0.35)

  const y3 = STOREY * 2
  for (const x of [-3.4, 3.4] as const) {
    wood.push(bevelBox(1.7, 0.06, 0.78, 0.01).translate(x, y3 + 0.74, -4.6))
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        dark.push(bevelBox(0.05, 0.7, 0.05, 0.006).translate(
          x + sx * 0.72,
          y3 + 0.35,
          -4.6 + sz * 0.28,
        ))
      }
    }
    const screen = bevelBox(0.62, 0.38, 0.03, 0.004)
    screen.translate(x, y3 + 1.12, -4.92)
    dark.push(screen)
    cream.push(loungeChairAt(x, y3, -3.7, Math.PI))
  }
  wood.push(bevelBox(2.2, 0.06, 1.1, 0.01).translate(0, y3 + 0.74, 1.4))
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      dark.push(bevelBox(0.05, 0.7, 0.05, 0.006).translate(sx * 0.95, y3 + 0.35, 1.4 + sz * 0.42))
    }
  }
  for (const [x, z, yaw] of [
    [-0.9, 0.55, 0.15],
    [0.9, 0.55, -0.15],
    [-0.9, 2.15, 2.95],
    [0.9, 2.15, 3.25],
  ] as const) {
    grey.push(loungeChairAt(x, y3, z, yaw))
  }
  dark.push(bevelBox(2.9, 0.5, 0.22, 0.014).translate(0, y3 + 0.38, -(d / 2 - 0.7)))
  fire.push(bevelBox(2.45, 0.11, 0.07, 0.005).translate(0, y3 + 0.4, -(d / 2 - 0.56)))
  place(createChampagne(), 0.35, y3 + 0.78, 1.55)

  emit('shell', mergeParts(dark, 'interior-dark'), 'interior-dark', mats.black)
  emit('deck', mergeParts(wood, 'interior-wood'), 'interior-wood', mats.wood)
  emit('deck', mergeParts(stone, 'interior-stone'), 'interior-stone', mats.stone)
  emit('deck', mergeParts(grey, 'interior-grey'), 'interior-grey', mats.grey)
  emit('deck', mergeParts(cream, 'interior-cream'), 'interior-cream', mats.cream)
  emit('deck', mergeParts(fire, 'interior-fire'), 'interior-fire', mats.fire)
  emit('deck', mergeParts(steel, 'interior-steel'), 'interior-steel', mats.kit.steel)
}
