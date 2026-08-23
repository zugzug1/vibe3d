// f1-astroturf-strip — 2.0 m Grade 1 artificial-grass verge. Dark soil bed,
// two-tone mown pile as a displaced carpet (not Minecraft card blades).

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
  ASTROTURF,
  TOKEN,
  acquireF1Materials,
  bevelBox,
  createF1Preview,
  disposeF1Materials,
  shade,
} from '../f1-kit-core/index.ts'

type Slot = 'mat'

export interface F1AstroturfStripConfig {
  modules: number
  /** Blade spacing in metres. Sheet default 0.05; scene uses ~0.22. */
  pileStep: number
}

export interface F1AstroturfStripOptions extends Partial<F1AstroturfStripConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1AstroturfStripInstance {
  readonly root: Group
  readonly parts: { mat: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1AstroturfStripConfig>
  configure(patch: Partial<F1AstroturfStripConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1AstroturfStripConfig = { modules: 6, pileStep: 0.05 }
const BAND = ASTROTURF.pitch
const WIDTH = ASTROTURF.width
const THICK = ASTROTURF.thick
const PILE = 0.038
const STRIPE = 0.28
const RIM = 0.04

function turfTexture(): DataTexture {
  const n = 256
  const data = new Uint8Array(n * n * 4)
  const lit: readonly [number, number, number] = [62, 108, 58]
  const dim: readonly [number, number, number] = [38, 72, 40]
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4
      const stripe = Math.floor((y / n) * (2 / STRIPE)) % 2 === 0
      const fiber = Math.sin(x * 0.9 + y * 0.07) * 0.5 + 0.5
      const grain = (Math.sin(x * 17.1 + y * 3.3) * 43758.5453) % 1
      const g = grain < 0 ? grain + 1 : grain
      const k = 0.72 + fiber * 0.18 + g * 0.1
      const c = stripe ? lit : dim
      data[i] = Math.round(c[0] * k)
      data[i + 1] = Math.round(c[1] * k)
      data[i + 2] = Math.round(c[2] * k)
      data[i + 3] = 255
    }
  }
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(6, 2)
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

export function createModel(options: F1AstroturfStripOptions = {}): F1AstroturfStripInstance {
  const config: F1AstroturfStripConfig = {
    modules: Math.max(1, Math.round(options.modules ?? defaults.modules)),
    pileStep: options.pileStep != null && Number.isFinite(options.pileStep) && options.pileStep > 0
      ? options.pileStep
      : defaults.pileStep,
  }

  const bundle = acquireF1Materials()
  const extras: Material[] = []
  const textures: DataTexture[] = []
  const materialSlots: Record<Slot, Material> = {
    mat: options.materials?.mat ?? (() => {
      const mat = new MeshStandardMaterial({
        name: 'f1-kit / astroturf',
        color: shade(TOKEN.FIELD_500, -0.28),
        roughness: 0.95,
        metalness: 0,
      })
      extras.push(mat)
      return mat
    })(),
  }
  const bedMat = new MeshStandardMaterial({
    name: 'f1-kit / astroturf bed',
    color: shade(TOKEN.FIELD_500, -0.84),
    roughness: 1,
    metalness: 0,
  })
  const pileDark = new MeshStandardMaterial({
    name: 'f1-kit / astroturf pile',
    color: shade(TOKEN.FIELD_500, -0.48),
    roughness: 0.97,
    metalness: 0,
  })
  extras.push(bedMat, pileDark)

  const root = new Group()
  root.name = 'f1-astroturf-strip'
  const mat = new Group(); mat.name = 'mat'
  root.add(mat)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { mat: [] }

  const releaseGenerated = (): void => {
    mat.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    meshesBySlot.mat.length = 0
    for (const texture of textures) texture.dispose()
    textures.length = 0
  }

  const emit = (geometry: BufferGeometry, material: Material, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.castShadow = name === 'bed'
    mesh.receiveShadow = true
    meshesBySlot.mat.push(mesh)
    mat.add(mesh)
  }

  const rebuild = (): void => {
    releaseGenerated()
    const length = config.modules * BAND
    const bed = bevelBox(length, THICK, WIDTH, 0.004)
    bed.translate(0, THICK / 2, 0)
    emit(bed, bedMat, 'bed')

    const innerL = length - RIM * 2
    const innerW = WIDTH - RIM * 2
    const step = Math.min(config.pileStep, 0.08)
    const nx = Math.max(8, Math.round(innerL / step))
    const nz = Math.max(6, Math.round(innerW / step))

    const under = bevelBox(innerL, PILE * 0.72, innerW, 0.006)
    under.translate(0, THICK + PILE * 0.36, 0)
    emit(under, pileDark, 'pile-dark')

    const pile = new PlaneGeometry(innerL, innerW, nx, nz)
    pile.rotateX(-Math.PI / 2)
    const pos = pile.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const k = Math.abs((Math.floor((x + 40) * 19) * 13 + Math.floor((z + 8) * 23) * 7) % 11)
      pos.setY(i, THICK + PILE * (0.88 + k * 0.014))
    }
    pile.computeVertexNormals()
    const map = turfTexture()
    textures.push(map)
    map.repeat.set(innerL, innerW)
    const pileMat = materialSlots.mat as MeshStandardMaterial
    pileMat.map = map
    pileMat.needsUpdate = true
    emit(pile, pileMat, 'pile')
  }
  rebuild()

  return {
    root,
    parts: { mat },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.modules !== undefined) config.modules = Math.max(1, Math.round(patch.modules))
      if (typeof patch.pileStep === 'number' && Number.isFinite(patch.pileStep) && patch.pileStep > 0) {
        config.pileStep = patch.pileStep
      }
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) {
        if (mesh.name === 'pile') mesh.material = material
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
  return createF1Preview(createModel({ modules: 3 }), {
    aspect,
    target: [0, 0.04, 0],
    distance: 2.85,
    fov: 28,
    yaw: -1.05,
    pitch: 0.3,
  })
}
