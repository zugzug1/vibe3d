// f1-team-motorhome — assembled Cadillac / Schuler 2026 hospitality house.
// 15 × 17 m, three storeys + slatted rooftop terrace. Floating stair in a
// glazed atrium. Crest + wordmark are drawn stamps, not photo textures.

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

function crestTexture(): DataTexture {
  const n = 128
  const data = new Uint8Array(n * n * 4)
  const gold: readonly [number, number, number] = [201, 168, 88]
  const ink: readonly [number, number, number] = [12, 14, 18]
  for (let i = 0; i < data.length; i += 4) {
    data[i] = ink[0]
    data[i + 1] = ink[1]
    data[i + 2] = ink[2]
    data[i + 3] = 255
  }
  const cx = 64
  const cy = 52
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x - cx
      const dy = y - cy
      const r = Math.hypot(dx, dy)
      const i = (y * n + x) * 4
      if (r > 28 && r < 34) {
        const a = Math.atan2(dy, dx)
        if (Math.floor(a * 7 + 8) % 2 === 0) {
          data[i] = gold[0]
          data[i + 1] = gold[1]
          data[i + 2] = gold[2]
        }
      }
      if (Math.abs(dx) < 12 && dy > -8 && dy < 18 && r < 22) {
        data[i] = gold[0]
        data[i + 1] = gold[1]
        data[i + 2] = gold[2]
      }
      if (Math.abs(dx) < 7 && dy > -2 && dy < 12 && r < 16) {
        data[i] = ink[0]
        data[i + 1] = ink[1]
        data[i + 2] = ink[2]
      }
    }
  }
  writeGlyphWord(data, n, 18, 100, 'CADILLAC', gold, 3)
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType)
  tex.colorSpace = SRGBColorSpace
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
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
    opacity: 0.72,
  })
  extras.push(blackMat, creamMat, glassMat)

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

  const releaseGenerated = (): void => {
    shell.clear(); glass.clear(); deck.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
    for (const texture of textures) texture.dispose()
    textures.length = 0
    for (let i = 3; i < extras.length; i++) extras[i]!.dispose()
    extras.length = 3
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

  const rebuild = (): void => {
    releaseGenerated()
    const w = config.width
    const d = config.depth
    const h = STOREYS * STOREY
    const atriumX0 = -ATRIUM_W / 2
    const atriumX1 = ATRIUM_W / 2

    const plinth = bevelBox(w + 0.6, 0.18, d + 0.6, 0.02)
    plinth.translate(0, 0.09, 0)
    emit('shell', plinth, shell, 'plinth', kit.graphite)

    const dark: BufferGeometry[] = []
    const light: BufferGeometry[] = []
    for (let s = 0; s < STOREYS; s++) {
      const y0 = s * STOREY
      const band = s === 1 ? light : dark
      const left = bevelBox(WALL, STOREY - 0.04, d, 0.016)
      left.translate(-(w / 2 - WALL / 2), y0 + STOREY / 2, 0)
      const right = bevelBox(WALL, STOREY - 0.04, d, 0.016)
      right.translate(w / 2 - WALL / 2, y0 + STOREY / 2, 0)
      const back = bevelBox(w - WALL * 2, STOREY - 0.04, WALL, 0.016)
      back.translate(0, y0 + STOREY / 2, -(d / 2 - WALL / 2))
      band.push(left, right, back)

      const frontLeft = bevelBox((w - ATRIUM_W) / 2 - WALL, STOREY - 0.04, WALL, 0.016)
      frontLeft.translate(-(w / 2 + ATRIUM_W / 2) / 2, y0 + STOREY / 2, d / 2 - WALL / 2)
      const frontRight = bevelBox((w - ATRIUM_W) / 2 - WALL, STOREY - 0.04, WALL, 0.016)
      frontRight.translate((w / 2 + ATRIUM_W / 2) / 2, y0 + STOREY / 2, d / 2 - WALL / 2)
      band.push(frontLeft, frontRight)

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
      const yMid = s * STOREY + STOREY * 0.55
      const gh = STOREY * 0.62
      for (const face of [
        { x: 0, z: d / 2 - 0.06, sx: w - ATRIUM_W - 1.2, sz: 0.04, split: 6 },
        { x: -(w / 2 - 0.08), z: 0, sx: 0.04, sz: d - 1.2, split: 7 },
        { x: w / 2 - 0.08, z: 0, sx: 0.04, sz: d - 1.2, split: 7 },
      ] as const) {
        const pane = bevelBox(face.sx, gh, face.sz, 0.004)
        pane.translate(face.x, yMid, face.z)
        glassParts.push(pane)
        const horizontal = face.sx >= face.sz
        for (let k = 0; k <= face.split; k++) {
          const t = k / face.split
          if (horizontal) {
            const x = face.x - face.sx / 2 + t * face.sx
            frames.push(bevelBox(0.07, gh + 0.08, 0.08, 0.004).translate(x, yMid, face.z + 0.02))
          } else {
            const z = face.z - face.sz / 2 + t * face.sz
            frames.push(bevelBox(0.08, gh + 0.08, 0.07, 0.004).translate(face.x + 0.02, yMid, z))
          }
        }
        frames.push(bevelBox(
          horizontal ? face.sx : 0.08,
          0.07,
          horizontal ? 0.08 : face.sz,
          0.004,
        ).translate(face.x, yMid - gh / 2, face.z + (horizontal ? 0.02 : 0)))
        frames.push(bevelBox(
          horizontal ? face.sx : 0.08,
          0.07,
          horizontal ? 0.08 : face.sz,
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

    const canopy = bevelBox(ATRIUM_W + 0.8, 0.1, 1.4, 0.012)
    canopy.translate(0, 2.55, d / 2 + 0.55)
    emit('shell', canopy, shell, 'canopy', blackMat)

    const stair: BufferGeometry[] = []
    const treads = 18
    const rise = (h - 1.1) / treads
    for (let i = 0; i < treads; i++) {
      const tread = bevelBox(1.35, 0.07, 0.32, 0.01)
      const x = -1.55 + i * 0.16
      tread.translate(x, 0.28 + i * rise, d / 2 - 1.35)
      stair.push(tread)
    }
    emit('deck', mergeParts(stair, 'stair'), deck, 'stair', creamMat)
    const rails: BufferGeometry[] = []
    rails.push(member(
      new Vector3(-1.5, 1.1, d / 2 - 1.2),
      new Vector3(1.5, h - 0.6, d / 2 - 1.2),
      0.02,
      6,
    ))
    rails.push(member(
      new Vector3(-1.5, 1.1, d / 2 - 1.55),
      new Vector3(1.5, h - 0.6, d / 2 - 1.55),
      0.02,
      6,
    ))
    emit('glass', mergeParts(rails, 'stair-rail'), glass, 'stair-rail', kit.steel)
    const baluster = bevelBox(ATRIUM_W - 0.5, h - 0.8, 0.03, 0.003)
    baluster.translate(0, h / 2, d / 2 - 1.15)
    emit('glass', baluster, glass, 'stair-glass', glassMat)

    const crest = new PlaneGeometry(1.7, 1.7)
    crest.rotateY(Math.PI)
    crest.translate(0, 3.55, d / 2 + 0.06 + LAYER_CLEARANCE * 3)
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

    const roof = bevelBox(w + 0.35, 0.12, d + 0.35, 0.012)
    roof.translate(0, h + 0.06, 0)
    emit('deck', roof, deck, 'terrace-deck', creamMat)

    const slats: BufferGeometry[] = []
    const slatN = 18
    for (let i = 0; i < slatN; i++) {
      const z = -d / 2 + 0.4 + (i + 0.5) * ((d - 0.8) / slatN)
      slats.push(bevelBox(w - 0.8, 0.06, 0.12, 0.008).translate(0, h + TERRACE + 0.9, z))
    }
    for (const sx of [-1, 1] as const) {
      slats.push(bevelBox(0.12, TERRACE + 1.0, d - 0.6, 0.01).translate(sx * (w / 2 - 0.5), h + (TERRACE + 1.0) / 2, 0))
    }
    slats.push(bevelBox(w - 0.8, 0.1, 0.12, 0.008).translate(0, h + TERRACE + 1.15, 0))
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
