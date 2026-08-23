// f1-gravel-trap — a placeable raked-gravel TILE, not terrain. Weyl-cycled
// irregular pebbles (no PRNG), packed into a displaced bed. Not sugar cubes.

import {
  BufferGeometry,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  type Material,
} from 'three/webgpu'

import {
  TOKEN,
  acquireF1Materials,
  bevelBox,
  createF1Preview,
  disposeF1Materials,
  mergeParts,
  revolve,
  shade,
} from '../f1-kit-core/index.ts'

type Slot = 'bed' | 'stone'

export interface F1GravelTrapConfig {
  modules: number
  /** Weyl-cycled stones per 2.5 m tile. Sheet default 780; scene uses ~90. */
  pebblesPerModule: number
}

export interface F1GravelTrapOptions extends Partial<F1GravelTrapConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1GravelTrapInstance {
  readonly root: Group
  readonly parts: { bed: Group; stone: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1GravelTrapConfig>
  configure(patch: Partial<F1GravelTrapConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1GravelTrapConfig = { modules: 2, pebblesPerModule: 780 }
const TILE = 2.5
const THICK = 0.04
const GOLDEN = 0.6180339887498949
const FURROWS = 9
const FURROW_HALF = 0.018

function gravelTexture(): DataTexture {
  const n = 256
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4
      const a = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
      const b = Math.sin(x * 4.141 + y * 19.17) * 23421.631
      const chip = a - Math.floor(a)
      const grit = b - Math.floor(b)
      const k = 0.42 + chip * 0.38 + grit * 0.16
      data[i] = Math.round(118 + 70 * k)
      data[i + 1] = Math.round(102 + 58 * k)
      data[i + 2] = Math.round(82 + 44 * k)
      data[i + 3] = 255
    }
  }
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

export function createModel(options: F1GravelTrapOptions = {}): F1GravelTrapInstance {
  const config: F1GravelTrapConfig = {
    modules: Math.max(1, Math.round(options.modules ?? defaults.modules)),
    pebblesPerModule: options.pebblesPerModule != null && Number.isFinite(options.pebblesPerModule)
      ? Math.max(0, Math.round(options.pebblesPerModule))
      : defaults.pebblesPerModule,
  }

  const bundle = acquireF1Materials()
  const extras: Material[] = []
  const textures: DataTexture[] = []
  const materialSlots: Record<Slot, Material> = {
    bed: options.materials?.bed ?? (() => {
      const mat = new MeshStandardMaterial({
        name: 'f1-kit / gravel bed',
        color: shade(TOKEN.DUST_300, -0.42),
        roughness: 0.98,
        metalness: 0,
      })
      extras.push(mat)
      return mat
    })(),
    stone: options.materials?.stone ?? (() => {
      const mat = new MeshStandardMaterial({
        name: 'f1-kit / gravel stone',
        color: shade(TOKEN.DUST_300, -0.18),
        roughness: 0.88,
        metalness: 0.04,
      })
      extras.push(mat)
      return mat
    })(),
  }
  const stoneDark = new MeshStandardMaterial({
    name: 'f1-kit / gravel stone dark',
    color: shade(TOKEN.DUST_300, -0.52),
    roughness: 0.93,
    metalness: 0.03,
  })
  const rakeMat = new MeshStandardMaterial({
    name: 'f1-kit / gravel rake',
    color: shade(TOKEN.DUST_300, -0.48),
    roughness: 0.99,
    metalness: 0,
  })
  extras.push(stoneDark, rakeMat)

  const root = new Group()
  root.name = 'f1-gravel-trap'
  const bed = new Group(); bed.name = 'bed'
  const stone = new Group(); stone.name = 'stone'
  root.add(bed, stone)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { bed: [], stone: [] }

  const releaseGenerated = (): void => {
    bed.clear(); stone.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
    for (const texture of textures) texture.dispose()
    textures.length = 0
  }

  const emit = (slot: Slot, geometry: BufferGeometry, material: Material, group: Group, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.castShadow = name === 'bed' || name === 'rake'
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const rebuild = (): void => {
    releaseGenerated()
    const length = config.modules * TILE
    const furrowZ: number[] = []
    for (let f = 0; f < FURROWS; f++) furrowZ.push(-TILE / 2 + (f + 0.5) * (TILE / FURROWS))

    const segsX = Math.max(8, config.modules * 12)
    const segsZ = 18
    const slab = new PlaneGeometry(length, TILE, segsX, segsZ)
    slab.rotateX(-Math.PI / 2)
    const bedPos = slab.getAttribute('position')
    for (let i = 0; i < bedPos.count; i++) {
      const z = bedPos.getZ(i)
      let y = THICK
      y += ((i * 17) % 5) * 0.0016
      for (const fz of furrowZ) {
        const d = Math.abs(z - fz)
        if (d < FURROW_HALF * 1.6) y -= 0.011 * (1 - d / (FURROW_HALF * 1.6))
      }
      bedPos.setY(i, y)
    }
    slab.computeVertexNormals()
    const bedMap = gravelTexture()
    textures.push(bedMap)
    bedMap.repeat.set(length * 2.4, TILE * 2.4)
    const bedMat = materialSlots.bed as MeshStandardMaterial
    bedMat.map = bedMap
    bedMat.needsUpdate = true
    emit('bed', slab, bedMat, bed, 'bed')

    const rake: BufferGeometry[] = []
    for (const z of furrowZ) {
      const groove = bevelBox(length - 0.12, 0.005, 0.022, 0.0015)
      groove.translate(0, THICK - 0.004, z)
      rake.push(groove)
    }
    emit('bed', mergeParts(rake, 'rake'), rakeMat, bed, 'rake')

    const light: BufferGeometry[] = []
    const dark: BufferGeometry[] = []
    const count = config.modules * config.pebblesPerModule
    for (let i = 0; i < count; i++) {
      const u = (i * GOLDEN) % 1
      const v = (i * 0.41421356237) % 1
      const x = (u - 0.5) * (length - 0.16)
      const z = (v - 0.5) * (TILE - 0.16)
      let onFurrow = false
      for (const fz of furrowZ) {
        if (Math.abs(z - fz) < FURROW_HALF) {
          onFurrow = true
          break
        }
      }
      if (onFurrow && i % 3 !== 0) continue
      const cls = i % 11
      const span = 0.022 + (cls % 5) * 0.008
      const sy = span * (0.55 + (cls % 3) * 0.08)
      const pebble = revolve(
        [
          [0.00, 0.002],
          [0.12, 0.72],
          [0.38, 1.00],
          [0.68, 0.86],
          [0.90, 0.42],
          [1.00, 0.002],
        ],
        { yBot: 0, yTop: sy, scaleW: span * 0.48, segments: 8 },
      )
      pebble.scale(1, 1, 0.78 + (cls % 4) * 0.06)
      pebble.rotateY(((i * 13) % 20) * 0.31)
      pebble.rotateX(((i * 5) % 5) * 0.11)
      pebble.rotateZ(((i * 7) % 5) * 0.09)
      const bury = onFurrow ? 0.08 : 0.28
      pebble.translate(x, THICK + sy * bury, z)
      ;(cls % 2 === 0 ? light : dark).push(pebble)
    }
    emit('stone', mergeParts(light, 'stones'), materialSlots.stone, stone, 'stones')
    emit('stone', mergeParts(dark, 'stones-dark'), stoneDark, stone, 'stones-dark')
  }
  rebuild()

  return {
    root,
    parts: { bed, stone },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.modules !== undefined) config.modules = Math.max(1, Math.round(patch.modules))
      if (typeof patch.pebblesPerModule === 'number' && Number.isFinite(patch.pebblesPerModule)) {
        config.pebblesPerModule = Math.max(0, Math.round(patch.pebblesPerModule))
      }
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) {
        if (slot === 'stone' && mesh.name === 'stones-dark') continue
        if (slot === 'bed' && mesh.name === 'rake') continue
        mesh.material = material
      }
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      for (const material of extras) material.dispose()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel({ modules: 2 }), {
    aspect,
    target: [0, 0.04, 0],
    distance: 3.2,
    fov: 28,
    yaw: -0.78,
    pitch: 0.66,
  })
}
