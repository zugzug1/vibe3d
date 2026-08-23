// f1-team-motorhome — assembled Cadillac / Schuler 2026 hospitality house.
// 15 × 17 m, three storeys + slatted rooftop terrace. Floating stair in a
// glazed atrium. Crest + wordmark are drawn stamps, not photo textures.
// Interior is dressed from the official tour stills (see interior.ts).

import {
  BufferGeometry,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  LAYER_CLEARANCE,
  MOTORHOME,
  TOKEN,
  acquireF1Materials,
  bevelBox,
  bevelDisc,
  createF1Preview,
  disposeF1Materials,
  member,
  mergeParts,
  shade,
  writeGlyphWord,
} from '../f1-kit-core/index.ts'
import { dressInterior, type InteriorLive, type InteriorMats } from './interior.ts'

type Slot = 'shell' | 'glass' | 'deck'

export interface F1TeamMotorhomeConfig {
  /** Footprint width along local X, metres. */
  width: number
  /** Footprint depth along local Z, metres. */
  depth: number
}

export interface F1TeamMotorhomeOptions extends Partial<F1TeamMotorhomeConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1TeamMotorhomeInstance {
  readonly root: Group
  readonly parts: { shell: Group; glass: Group; deck: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1TeamMotorhomeConfig>
  configure(patch: Partial<F1TeamMotorhomeConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1TeamMotorhomeConfig = { width: MOTORHOME.width, depth: MOTORHOME.depth }
const STOREY = MOTORHOME.storey
const STOREYS = MOTORHOME.storeys
const TERRACE = MOTORHOME.terrace
const WALL = 0.22
const ATRIUM_W = 4.2
const REVEAL = 0.045
const PERSIST = 7

function crestTexture(): DataTexture {
  const n = 256
  const data = new Uint8Array(n * n * 4)
  const gold: readonly [number, number, number] = [201, 168, 88]
  const ink: readonly [number, number, number] = [12, 14, 18]
  for (let i = 0; i < data.length; i += 4) {
    data[i] = ink[0]
    data[i + 1] = ink[1]
    data[i + 2] = ink[2]
    data[i + 3] = 255
  }
  const cx = 128
  const cy = 118
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x - cx
      const dy = y - cy
      const r = Math.hypot(dx, dy)
      const a = Math.atan2(dy, dx)
      const i = (y * n + x) * 4
      const leaf = 58 + Math.sin(a * 14) * 6
      if (r > leaf - 5 && r < leaf + 5) {
        data[i] = gold[0]
        data[i + 1] = gold[1]
        data[i + 2] = gold[2]
      }
      if (Math.abs(dx) < 28 && dy > -18 && dy < 36 && r < 44) {
        data[i] = gold[0]
        data[i + 1] = gold[1]
        data[i + 2] = gold[2]
      }
      if (Math.abs(dx) < 16 && dy > -6 && dy < 24 && r < 32) {
        data[i] = ink[0]
        data[i + 1] = ink[1]
        data[i + 2] = ink[2]
      }
    }
  }
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType)
  tex.colorSpace = SRGBColorSpace
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

function wordmarkTexture(): DataTexture {
  const n = 256
  const data = new Uint8Array(n * n * 4)
  const gold: readonly [number, number, number] = [201, 168, 88]
  const ink: readonly [number, number, number] = [12, 14, 18]
  for (let i = 0; i < data.length; i += 4) {
    data[i] = ink[0]
    data[i + 1] = ink[1]
    data[i + 2] = ink[2]
    data[i + 3] = 255
  }
  writeGlyphWord(data, n, 16, 100, 'CADILLAC', gold, 6)
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType)
  tex.colorSpace = SRGBColorSpace
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

/** Vertical Schuler panels along X or Z. Widths cycle by index, not a PRNG. */
function paneledWall(
  span: number,
  height: number,
  thick: number,
  count: number,
  along: 'x' | 'z',
): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const scales = [1, 0.92, 1.06] as const
  let cursor = -span / 2
  for (let i = 0; i < count; i++) {
    const remaining = count - i
    const raw = (span - (cursor + span / 2)) / remaining
    const pw = Math.min(raw - REVEAL, raw * scales[i % 3]!)
    const mid = cursor + pw / 2
    if (along === 'x') parts.push(bevelBox(pw, height, thick, 0.012).translate(mid, 0, 0))
    else parts.push(bevelBox(thick, height, pw, 0.012).translate(0, 0, mid))
    cursor += pw + REVEAL
  }
  return parts
}

export function createModel(options: F1TeamMotorhomeOptions = {}): F1TeamMotorhomeInstance {
  const config: F1TeamMotorhomeConfig = {
    width: Math.max(10, options.width ?? defaults.width),
    depth: Math.max(12, options.depth ?? defaults.depth),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const extras: Material[] = []
  const textures: DataTexture[] = []

  const blackMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome black',
    color: shade(TOKEN.INK_950, 0.06),
    roughness: 0.62,
    metalness: 0.08,
  })
  const creamMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome cream',
    color: shade(TOKEN.SHELL_050, -0.04),
    roughness: 0.7,
    metalness: 0.02,
  })
  const glassMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome glass',
    color: 0x0a1218,
    roughness: 0.08,
    metalness: 0.42,
    transparent: true,
    opacity: 0.38,
  })
  const woodMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome wood',
    color: shade(TOKEN.DUST_300, -0.28),
    roughness: 0.68,
    metalness: 0.04,
  })
  const stoneMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome stone',
    color: shade(TOKEN.DUST_300, -0.08),
    roughness: 0.78,
    metalness: 0.02,
  })
  const greyMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome grey',
    color: shade(TOKEN.SLATE_650, 0.12),
    roughness: 0.82,
    metalness: 0.02,
  })
  const fireMat = new MeshStandardMaterial({
    name: 'f1-kit / motorhome fire',
    color: TOKEN.ORANGE_500,
    emissive: TOKEN.AMBER_400,
    emissiveIntensity: 1.55,
    roughness: 0.42,
    metalness: 0,
    toneMapped: false,
  })
  extras.push(blackMat, creamMat, glassMat, woodMat, stoneMat, greyMat, fireMat)

  const materialSlots: Record<Slot, Material> = {
    shell: options.materials?.shell ?? blackMat,
    glass: options.materials?.glass ?? glassMat,
    deck: options.materials?.deck ?? creamMat,
  }

  const root = new Group()
  root.name = 'f1-team-motorhome'
  const shell = new Group(); shell.name = 'shell'
  const glass = new Group(); glass.name = 'glass'
  const deck = new Group(); deck.name = 'deck'
  root.add(shell, glass, deck)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { shell: [], glass: [], deck: [] }
  const groups: Record<Slot, Group> = { shell, glass, deck }
  const kitRoot = new Group()
  kitRoot.name = 'interior-kit'
  root.add(kitRoot)
  const kitLive: InteriorLive[] = []

  const releaseKit = (): void => {
    for (const instance of kitLive) instance.dispose()
    kitLive.length = 0
  }

  const releaseGenerated = (): void => {
    releaseKit()
    shell.clear(); glass.clear(); deck.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
    for (const texture of textures) texture.dispose()
    textures.length = 0
    for (let i = PERSIST; i < extras.length; i++) extras[i]!.dispose()
    extras.length = PERSIST
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

  const interiorMats = (): InteriorMats => ({
    black: blackMat,
    cream: creamMat,
    glass: glassMat,
    wood: woodMat,
    stone: stoneMat,
    grey: greyMat,
    fire: fireMat,
    kit: { graphite: kit.graphite, steel: kit.steel, ink: kit.ink, cobalt: kit.cobalt },
  })

  const rebuild = (): void => {
    releaseGenerated()
    const w = config.width
    const d = config.depth
    const h = STOREYS * STOREY
    const wing = (w - ATRIUM_W) / 2 - WALL

    const plinth = bevelBox(w + 0.6, 0.18, d + 0.6, 0.02)
    plinth.translate(0, 0.09, 0)
    emit('shell', plinth, shell, 'plinth', kit.graphite)

    const dark: BufferGeometry[] = []
    const light: BufferGeometry[] = []
    for (let s = 0; s < STOREYS; s++) {
      const y0 = s * STOREY
      const band = s === 1 ? light : dark
      const vip = s === 1
      const sill = vip ? 0.48 : 0.95
      const gh = STOREY * (vip ? 0.78 : 0.38)
      const head = Math.max(0.28, STOREY - sill - gh - 0.04)
      const sideN = 7 + (s % 2)
      const frontN = 3 + (s % 2)
      const stack = (span: number, along: 'x' | 'z', count: number, ox: number, oz: number): void => {
        for (const part of paneledWall(span, sill, WALL, count, along)) {
          part.translate(ox, y0 + sill / 2, oz)
          band.push(part)
        }
        for (const part of paneledWall(span, head, WALL, count, along)) {
          part.translate(ox, y0 + sill + gh + head / 2, oz)
          band.push(part)
        }
      }
      stack(d, 'z', sideN, -(w / 2 - WALL / 2), 0)
      stack(d, 'z', sideN, w / 2 - WALL / 2, 0)
      stack(w - WALL * 2, 'x', 8, 0, -(d / 2 - WALL / 2))
      stack(wing, 'x', frontN, -(w / 2 + ATRIUM_W / 2) / 2, d / 2 - WALL / 2)
      stack(wing, 'x', frontN, (w / 2 + ATRIUM_W / 2) / 2, d / 2 - WALL / 2)
      if (s < STOREYS - 1) {
        const slab = bevelBox(w - WALL * 2, 0.12, d - WALL * 2, 0.01)
        slab.translate(0, y0 + STOREY, 0)
        dark.push(slab)
      }
    }
    emit('shell', mergeParts(dark, 'mass-dark'), shell, 'mass-dark', blackMat)
    emit('shell', mergeParts(light, 'mass-cream'), shell, 'mass-cream', creamMat)

    const glassParts: BufferGeometry[] = []
    const frames: BufferGeometry[] = []
    for (let s = 0; s < STOREYS; s++) {
      const vip = s === 1
      const sill = vip ? 0.48 : 0.95
      const gh = STOREY * (vip ? 0.78 : 0.38)
      const yMid = s * STOREY + sill + gh / 2
      const split = vip ? 4 : 5
      const faces = [
        { x: 0, z: d / 2 + 0.02, sx: w - ATRIUM_W - 1.2, sz: 0.04, split },
        { x: -(w / 2 - 0.08), z: 0, sx: 0.04, sz: d - 1.2, split: vip ? 5 : 6 },
        { x: w / 2 - 0.08, z: 0, sx: 0.04, sz: d - 1.2, split: vip ? 5 : 6 },
      ] as const
      for (const face of faces) {
        const pane = bevelBox(face.sx, gh, face.sz, 0.004)
        pane.translate(face.x, yMid, face.z)
        glassParts.push(pane)
        const horizontal = face.sx >= face.sz
        for (let k = 0; k <= face.split; k++) {
          const t = k / face.split
          if (horizontal) {
            const x = face.x - face.sx / 2 + t * face.sx
            frames.push(bevelBox(0.06, gh + 0.08, 0.07, 0.004).translate(x, yMid, face.z + 0.02))
          } else {
            const z = face.z - face.sz / 2 + t * face.sz
            frames.push(bevelBox(0.07, gh + 0.08, 0.06, 0.004).translate(face.x + 0.02, yMid, z))
          }
        }
        frames.push(bevelBox(
          horizontal ? face.sx : 0.07,
          0.06,
          horizontal ? 0.07 : face.sz,
          0.004,
        ).translate(face.x, yMid - gh / 2, face.z + (horizontal ? 0.02 : 0)))
        frames.push(bevelBox(
          horizontal ? face.sx : 0.07,
          0.06,
          horizontal ? 0.07 : face.sz,
          0.004,
        ).translate(face.x, yMid + gh / 2, face.z + (horizontal ? 0.02 : 0)))
      }
    }
    const atrium = bevelBox(ATRIUM_W - 0.2, h - 0.3, 0.05, 0.004)
    atrium.translate(0, h / 2, d / 2 - 0.08)
    glassParts.push(atrium)
    emit('glass', mergeParts(glassParts, 'glazing'), glass, 'glazing', glassMat)
    emit('shell', mergeParts(frames, 'mullions'), shell, 'mullions', kit.graphite)

    const door = bevelBox(1.4, 2.3, 0.08, 0.01)
    door.translate(0, 1.25, d / 2 + 0.03)
    emit('shell', door, shell, 'door', kit.ink)
    const handle = bevelBox(0.08, 0.28, 0.06, 0.004)
    handle.translate(0.55, 1.25, d / 2 + 0.09)
    emit('shell', handle, shell, 'handle', kit.steel)

    const canopy = bevelBox(ATRIUM_W + 0.8, 0.12, 1.5, 0.012)
    canopy.translate(0, 2.55, d / 2 + 0.58)
    emit('shell', canopy, shell, 'canopy', blackMat)

    const stair: BufferGeometry[] = []
    const treads = 16
    const rise = (h - 1.2) / treads
    const run = 0.34
    for (let i = 0; i < treads; i++) {
      const flight = i < 8 ? 0 : 1
      const local = flight === 0 ? i : i - 8
      const tread = bevelBox(1.25, 0.09, run, 0.012)
      const x = flight === 0 ? -1.35 + local * 0.32 : 1.15 - local * 0.32
      const z = d / 2 - 1.45 - flight * 0.62
      tread.translate(x, 0.32 + i * rise, z)
      stair.push(tread)
    }
    emit('deck', mergeParts(stair, 'stair'), deck, 'stair', stoneMat)
    const glassRail: BufferGeometry[] = []
    for (let f = 0; f < 2; f++) {
      const z = d / 2 - 1.28 - f * 0.62
      const pane = bevelBox(2.7, h * 0.48, 0.02, 0.003)
      pane.translate(0, 0.4 + (f + 0.5) * (h * 0.42), z)
      glassRail.push(pane)
    }
    emit('glass', mergeParts(glassRail, 'stair-glass'), glass, 'stair-glass', glassMat)

    const crest = new PlaneGeometry(1.7, 1.7)
    crest.translate(0, STOREY + 1.2, d / 2 + 0.04 + LAYER_CLEARANCE * 3)
    const tex = crestTexture()
    textures.push(tex)
    const crestMat = new MeshStandardMaterial({
      name: 'f1-kit / motorhome crest',
      map: tex,
      roughness: 0.48,
      metalness: 0.12,
    })
    extras.push(crestMat)
    emit('shell', crest, shell, 'crest', crestMat)

    const mark = new PlaneGeometry(2.8, 0.44)
    mark.translate(0, STOREY + 0.42, d / 2 + 0.04 + LAYER_CLEARANCE * 3)
    const wordTex = wordmarkTexture()
    textures.push(wordTex)
    const wordMat = new MeshStandardMaterial({
      name: 'f1-kit / motorhome wordmark',
      map: wordTex,
      roughness: 0.48,
      metalness: 0.1,
    })
    extras.push(wordMat)
    emit('shell', mark, shell, 'wordmark', wordMat)

    const roof = bevelBox(w + 0.35, 0.14, d + 0.35, 0.012)
    roof.translate(0, h + 0.07, 0)
    emit('deck', roof, deck, 'terrace-deck', creamMat)

    const slats: BufferGeometry[] = []
    const slatN = 20
    const slatH = 0.16
    for (let i = 0; i < slatN; i++) {
      const z = -d / 2 + 0.45 + (i + 0.5) * ((d - 0.9) / slatN)
      slats.push(bevelBox(w - 0.7, slatH, 0.18, 0.008).translate(0, h + TERRACE + 0.95, z))
    }
    for (const sx of [-1, 1] as const) {
      slats.push(bevelBox(0.16, TERRACE + 1.15, d - 0.5, 0.01).translate(
        sx * (w / 2 - 0.42),
        h + (TERRACE + 1.15) / 2,
        0,
      ))
    }
    slats.push(bevelBox(w - 0.7, 0.14, 0.18, 0.008).translate(0, h + TERRACE + 1.22, -d / 2 + 0.4))
    slats.push(bevelBox(w - 0.7, 0.14, 0.18, 0.008).translate(0, h + TERRACE + 1.22, d / 2 - 0.4))
    slats.push(bevelBox(w - 0.55, 0.12, d - 0.55, 0.01).translate(0, h + TERRACE + 0.78, 0))
    emit('shell', mergeParts(slats, 'pergola'), shell, 'pergola', blackMat)

    const terraceRail: BufferGeometry[] = []
    const railH = h + 1.05
    for (const sx of [-1, 1] as const) {
      terraceRail.push(member(
        new Vector3(sx * w / 2, h + 0.12, -d / 2),
        new Vector3(sx * w / 2, railH, -d / 2),
        0.03,
        6,
      ))
      terraceRail.push(member(
        new Vector3(sx * w / 2, h + 0.12, d / 2),
        new Vector3(sx * w / 2, railH, d / 2),
        0.03,
        6,
      ))
      terraceRail.push(member(
        new Vector3(sx * w / 2, railH, -d / 2),
        new Vector3(sx * w / 2, railH, d / 2),
        0.024,
        6,
      ))
    }
    for (const sz of [-1, 1] as const) {
      terraceRail.push(member(
        new Vector3(-w / 2, railH, sz * d / 2),
        new Vector3(w / 2, railH, sz * d / 2),
        0.024,
        6,
      ))
    }
    emit('shell', mergeParts(terraceRail, 'terrace-rail'), shell, 'terrace-rail', kit.steel)

    const rim = bevelDisc(0.55, 0.05, 0.01, 16)
    rim.translate(w / 2 - 1.4, h + 0.2, -d / 2 + 1.2)
    emit('deck', rim, deck, 'hearth', kit.graphite)

    dressInterior(w, d, (slot, geometry, name, material) => {
      emit(slot, geometry, groups[slot], name, material)
    }, interiorMats(), textures, extras, (instance, x, y, z, yaw = 0) => {
      instance.root.position.set(x, y, z)
      instance.root.rotation.y = yaw
      kitRoot.add(instance.root)
      kitLive.push(instance)
    })
  }
  rebuild()

  return {
    root,
    parts: { shell, glass, deck },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.width !== undefined) config.width = Math.max(10, patch.width)
      if (patch.depth !== undefined) config.depth = Math.max(12, patch.depth)
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      kitRoot.removeFromParent()
      for (const material of extras) material.dispose()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0, 5.2, 2],
    distance: 32,
    fov: 30,
    yaw: 0.72,
    pitch: 0.18,
  })
}

export function createAltPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0, 4.4, 6],
    distance: 22,
    fov: 32,
    yaw: 0.08,
    pitch: 0.12,
  })
}

export function createGroundPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0, 1.4, -5.4],
    distance: 9.2,
    fov: 36,
    yaw: 0.42,
    pitch: 0.08,
    bloom: true,
  })
}

export function createVipPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0.2, STOREY + 1.15, -1.4],
    distance: 9,
    fov: 36,
    yaw: 0.62,
    pitch: 0.1,
    bloom: true,
  })
}

export function createOfficePreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0, STOREY * 2 + 1.15, -3.8],
    distance: 8.2,
    fov: 36,
    yaw: 0.48,
    pitch: 0.1,
    bloom: true,
  })
}
