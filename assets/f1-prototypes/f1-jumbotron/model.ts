// f1-jumbotron — trackside broadcast installation whose silhouette is a single large LED
// cabinet lifted high on one thick dark mast, braced back to ground pads, with a compact
// service plinth and perimeter barrier. The video feed remains deterministic and generic.

import {
  BufferGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  RGBAFormat,
  UnsignedByteType,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  acquireF1Materials,
  bevelBox,
  createF1Preview,
  disposeF1Materials,
  fillGlyphRect,
  member,
  mergeParts,
  writeGlyphWord,
} from '../f1-kit-core/index.ts'

type Slot = 'frame' | 'screen' | 'leg'

/** One timing-sheet row. `code` is a short alphanumeric — never a driver or team name. */
export interface F1JumbotronEntry {
  p: number
  code?: string
  lap: number | string
  time: string
}

export interface F1JumbotronConfig {
  width: number
  entries: readonly F1JumbotronEntry[]
}

export interface F1JumbotronOptions extends Partial<F1JumbotronConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1JumbotronInstance {
  readonly root: Group
  readonly parts: { frame: Group; screen: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1JumbotronConfig>
  configure(patch: Partial<F1JumbotronConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const DEFAULT_ENTRIES: readonly F1JumbotronEntry[] = [
  { p: 1, code: '11', lap: 14, time: '1:22.4' },
  { p: 2, code: 'B2', lap: 14, time: '1:22.7' },
  { p: 3, code: 'C3', lap: 14, time: '1:23.1' },
  { p: 4, code: 'D4', lap: 13, time: '1:23.4' },
]

const defaults: F1JumbotronConfig = { width: 8, entries: DEFAULT_ENTRIES }

function sanitizeCode(code: string | undefined): string | undefined {
  if (!code) return undefined
  const next = code.replace(/[^0-9A-Za-z-]/g, '').slice(0, 4).toUpperCase()
  return next || undefined
}

function normalizeEntries(entries: readonly F1JumbotronEntry[]): F1JumbotronEntry[] {
  const rows = entries.slice(0, 8).map((entry, i) => ({
    p: Math.max(1, Math.round(entry.p || i + 1)),
    code: sanitizeCode(entry.code),
    lap: entry.lap,
    time: String(entry.time ?? ''),
  }))
  return rows.length > 0 ? rows : [...DEFAULT_ENTRIES]
}

function timingSheet(entries: readonly F1JumbotronEntry[]): DataTexture {
  const w = 512
  const h = 288
  const data = new Uint8Array(w * h * 4)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = px / w
      const y = py / h
      const centre = 0.57 + Math.sin(x * 5.2 - 0.9) * 0.12
      const trackDistance = Math.abs(y - centre)
      const horizon = y < 0.42
      const base = horizon ? 12 + Math.floor(y * 22) : 7
      const offset = (py * w + px) * 4
      data[offset] = base
      data[offset + 1] = base + (horizon ? 10 : 4)
      data[offset + 2] = base + (horizon ? 15 : 7)
      if (trackDistance < 0.115) {
        const shade = 42 + Math.floor((0.115 - trackDistance) * 90)
        data[offset] = shade
        data[offset + 1] = shade + 2
        data[offset + 2] = shade + 7
      }
      if (trackDistance > 0.103 && trackDistance < 0.122) {
        const kerb = Math.floor(x * 38) % 2 === 0
        data[offset] = kerb ? 210 : 230
        data[offset + 1] = kerb ? 26 : 230
        data[offset + 2] = kerb ? 34 : 230
      }
      data[offset + 3] = 255
    }
  }
  const pale: [number, number, number] = [224, 233, 240]
  const cyan: [number, number, number] = [42, 190, 224]
  const red: [number, number, number] = [225, 42, 48]
  fillGlyphRect(data, w, 0, 0, 76, 26, [4, 7, 12])
  writeGlyphWord(data, w, 8, 5, 'LIVE', pale, 3)
  fillGlyphRect(data, w, 8, 32, 52, 6, red)
  const carCount = Math.max(3, Math.min(7, entries.length + 1))
  for (let i = 0; i < carCount; i++) {
    const x = 178 + i * 39
    const y = 163 + Math.round(Math.sin((x / w) * 5.2 - 0.9) * h * 0.12)
    fillGlyphRect(data, w, x, y, 18, 7, i % 2 === 0 ? cyan : red)
    fillGlyphRect(data, w, x + 4, y - 4, 10, 4, pale)
  }
  const tex = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType)
  tex.minFilter = NearestFilter
  tex.magFilter = NearestFilter
  tex.needsUpdate = true
  tex.flipY = true
  return tex
}

export function createModel(options: F1JumbotronOptions = {}): F1JumbotronInstance {
  const config: F1JumbotronConfig = {
    width: Math.max(3, options.width ?? defaults.width),
    entries: normalizeEntries(options.entries ?? defaults.entries),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const extras: Material[] = []
  const textures: DataTexture[] = []
  const own = (material: Material): Material => {
    extras.push(material)
    return material
  }
  const ownsScreen = options.materials?.screen === undefined
  let tex = timingSheet(config.entries)
  textures.push(tex)
  const screenMat = options.materials?.screen ?? own(new MeshBasicMaterial({
    name: 'f1-kit / jumbotron screen',
    color: 0x59636c,
    map: tex,
    toneMapped: false,
  }))
  const supportMat = options.materials?.frame ?? own(new MeshBasicMaterial({
    name: 'f1-kit / jumbotron equipment base',
    color: 0x070a0e,
    toneMapped: false,
  }))
  // Round braces need a lit material to keep their form, but sit a hair off the mast's flat
  // navy so they recede instead of flashing as pale wings behind a near-black column.
  const braceMat = options.materials?.frame ?? own(new MeshStandardMaterial({
    name: 'f1-kit / jumbotron rear bracing',
    color: 0x0a0e15,
    roughness: 0.92,
    metalness: 0.1,
  }))

  const materialSlots: Record<Slot, Material> = {
    frame: options.materials?.frame ?? kit.graphite,
    screen: screenMat,
    leg: options.materials?.leg ?? kit.slate,
  }

  const root = new Group()
  root.name = 'f1-jumbotron'
  const frame = new Group(); frame.name = 'frame'
  const screen = new Group(); screen.name = 'screen'
  root.add(frame, screen)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { frame: [], screen: [], leg: [] }

  const releaseGenerated = (): void => {
    for (const group of [frame, screen]) group.clear()
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

  const applySheet = (): void => {
    const next = timingSheet(config.entries)
    const previous = textures.pop()
    previous?.dispose()
    textures.push(next)
    tex = next
    if (ownsScreen) {
      const material = screenMat as MeshBasicMaterial
      material.map = next
      material.needsUpdate = true
    }
  }

  const rebuild = (): void => {
    releaseGenerated()
    const w = config.width
    const h = w * 0.5625

    // The cabinet clears the crowd and the grandstand banner, so the mast — not the screen —
    // sets the height of the installation.
    const elev = Math.max(3.8, w * 0.88)
    const y = elev + h / 2
    const bezel = 0.085
    const mastW = Math.max(1.78, w * 0.41)
    const mastD = Math.max(1.15, w * 0.22)
    const mastZ = -0.3
    const mastFront = mastZ + mastD / 2
    const mastBack = mastZ - mastD / 2
    const mastTop = elev + Math.min(0.5, h * 0.12)

    // One thick box column: the panel joints are a shallow proud plate rather than applied
    // ribs, so the mast keeps a single unbroken value at reference distance.
    const mast: BufferGeometry[] = []
    const column = bevelBox(mastW, mastTop, mastD, 0.05)
    column.translate(0, mastTop / 2, mastZ)
    mast.push(column)
    const facePlate = bevelBox(mastW * 0.86, mastTop - 1.15, 0.06, 0.02)
    facePlate.translate(0, mastTop / 2 - 0.1, mastFront + 0.015)
    mast.push(facePlate)
    const yoke = bevelBox(mastW + w * 0.07, 0.2, mastD + 0.08, 0.03)
    yoke.translate(0, elev - 0.12, mastZ)
    mast.push(yoke)
    const collar = bevelBox(mastW + 0.5, 0.5, mastD + 0.44, 0.05)
    collar.translate(0, 0.25, mastZ)
    mast.push(collar)
    emit('frame', mergeParts(mast, 'central-mast'), frame, 'central-mast', supportMat)

    // Slim surround: the dark border is a lip around the LED face, not a housing that
    // competes with it.
    const cabinet: BufferGeometry[] = []
    const shell = bevelBox(w + bezel * 2, h + bezel * 2, 0.46, 0.02)
    shell.translate(0, y, -0.17)
    cabinet.push(shell)
    const walk = bevelBox(w * 0.86, 0.06, 0.44, 0.01)
    walk.translate(0, elev - 0.12, mastBack - 0.28)
    cabinet.push(walk)
    emit('frame', mergeParts(cabinet, 'led-cabinet'), frame, 'led-cabinet', supportMat)

    const rearZ = mastBack - Math.max(1.4, elev * 0.38)
    const bracing: BufferGeometry[] = []
    for (const sx of [-1, 1] as const) {
      const footX = sx * (mastW * 0.5 + 0.7)
      bracing.push(member(
        new Vector3(sx * mastW * 0.32, elev - 0.5, mastBack),
        new Vector3(footX, 0.32, rearZ),
        0.08,
        8,
      ))
      bracing.push(member(
        new Vector3(sx * mastW * 0.32, elev * 0.5, mastBack),
        new Vector3(footX, 0.32, rearZ),
        0.055,
        8,
      ))
      bracing.push(member(
        new Vector3(footX, 0.32, rearZ),
        new Vector3(sx * mastW * 0.4, 0.32, mastBack),
        0.05,
        8,
      ))
      const pad = bevelBox(0.85, 0.32, 0.95, 0.04)
      pad.translate(footX, 0.16, rearZ)
      bracing.push(pad)
    }
    emit('frame', mergeParts(bracing, 'rear-bracing'), frame, 'rear-bracing', braceMat)

    const plinthW = Math.min(w * 0.64, mastW + 1.75)
    const plinthH = 1.2
    const plinthD = Math.max(1.4, mastD + 0.6)
    const plinthZ = mastZ + 0.06
    const plinthFront = plinthZ + plinthD / 2
    const plinth: BufferGeometry[] = []
    const cabin = bevelBox(plinthW, plinthH, plinthD, 0.04)
    cabin.translate(0, plinthH / 2 + 0.1, plinthZ)
    plinth.push(cabin)
    const kerb = bevelBox(plinthW + 0.34, 0.2, plinthD + 0.34, 0.03)
    kerb.translate(0, 0.1, plinthZ)
    plinth.push(kerb)
    emit('frame', mergeParts(plinth, 'service-plinth'), frame, 'service-plinth', supportMat)

    const plinthDetails: BufferGeometry[] = []
    const doorPitch = plinthW / 4
    for (let i = 0; i <= 4; i++) {
      const x = -plinthW / 2 + i * doorPitch
      plinthDetails.push(member(
        new Vector3(x, 0.28, plinthFront + 0.015),
        new Vector3(x, plinthH + 0.04, plinthFront + 0.015),
        0.02,
        6,
      ))
    }
    plinthDetails.push(member(
      new Vector3(-plinthW / 2, plinthH + 0.06, plinthFront + 0.015),
      new Vector3(plinthW / 2, plinthH + 0.06, plinthFront + 0.015),
      0.026,
      8,
    ))
    emit('frame', mergeParts(plinthDetails, 'plinth-door-seams'), frame, 'plinth-door-seams')

    const barriers: BufferGeometry[] = []
    const barrierHalf = Math.max(plinthW / 2 + 1.2, w * 0.34)
    const zFront = plinthFront + 0.95
    const zBack = rearZ - 0.75
    for (const z of [zFront, zBack]) {
      for (const railY of [0.36, 0.74]) {
        barriers.push(member(new Vector3(-barrierHalf, railY, z), new Vector3(barrierHalf, railY, z), 0.034, 8))
      }
      for (let i = 0; i <= 8; i++) {
        const x = -barrierHalf + i * barrierHalf * 2 / 8
        barriers.push(member(new Vector3(x, 0.05, z), new Vector3(x, 0.78, z), 0.03, 8))
      }
    }
    for (const sx of [-1, 1] as const) {
      for (const railY of [0.36, 0.74]) {
        barriers.push(member(new Vector3(sx * barrierHalf, railY, zFront), new Vector3(sx * barrierHalf, railY, zBack), 0.034, 8))
      }
      for (let i = 1; i < 5; i++) {
        const z = zFront + (zBack - zFront) * (i / 5)
        barriers.push(member(new Vector3(sx * barrierHalf, 0.05, z), new Vector3(sx * barrierHalf, 0.78, z), 0.03, 8))
      }
    }
    emit('leg', mergeParts(barriers, 'connected-safety-barriers'), frame, 'connected-safety-barriers')

    const panel = new PlaneGeometry(w, h)
    panel.translate(0, y, 0.09)
    emit('screen', panel, screen, 'continuous-led-video')
  }
  rebuild()

  return {
    root,
    parts: { frame, screen },
    materials: materialSlots,
    getConfig: () => ({ width: config.width, entries: config.entries.map((entry) => ({ ...entry })) }),
    configure(patch) {
      let dirtyGeo = false
      let dirtySheet = false
      if (patch.width !== undefined) {
        config.width = Math.max(3, patch.width)
        dirtyGeo = true
      }
      if (patch.entries !== undefined) {
        config.entries = normalizeEntries(patch.entries)
        dirtySheet = true
      }
      if (dirtySheet) applySheet()
      if (dirtyGeo) rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      for (const texture of textures) texture.dispose()
      for (const material of extras) material.dispose()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel({ width: 6 }), {
    aspect,
    target: [0, 4.7, -0.2],
    distance: 18.1,
    fov: 30,
    pitch: 0.05,
    yaw: -0.1,
  })
}
