// f1-parc-ferme — the scrutineering compound: braced corner posts, a run of
// clipped-together mesh panels on their own feet, and a vehicle gate under a
// signed portal. Identity is the enclosure and its entrance. A continuous wire
// wall reads as garden railing, so the panel joints, the screening course and
// the portal are what carry the prop.

import { BufferGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3, type Material } from 'three/webgpu'

import {
  LAYER_CLEARANCE,
  acquireF1Materials,
  bevelBox,
  bevelPrism,
  boltRun,
  createF1Preview,
  disposeF1Materials,
  groundPad,
  marshalPlateTexture,
  member,
  mergeParts,
  tubeSection,
  AXIS_Y,
} from '../f1-kit-core/index.ts'

type Slot = 'post' | 'rail'

export interface F1ParcFermeConfig {
  bays: number
}

export interface F1ParcFermeOptions extends Partial<F1ParcFermeConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1ParcFermeInstance {
  readonly root: Group
  readonly parts: { posts: Group; rails: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1ParcFermeConfig>
  configure(patch: Partial<F1ParcFermeConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1ParcFermeConfig = { bays: 4 }

/** Panel bay pitch along the long runs, and the clear gap left at every panel joint. */
const PITCH = 2.4
const JOINT = 0.08
/** Bays across the short runs. A compound is a rectangle; a corridor is not. */
const DEPTH_BAYS = 2
/**
 * Top-rail centreline. Waist-high railing is crowd control, not security, and a compound has to
 * stand over what it encloses: the run is set so a leaf swung clear of the opening is still taller
 * than the car that just passed under it.
 */
const HEIGHT = 2.25
/** Panels stand in feet, so the mesh starts clear of the ground. */
const SILL = 0.17
/**
 * Welded infill: square aperture and wire radius, in metres. The frame tube is deliberately far
 * heavier than the wire — a panel whose perimeter matches its infill reads as a lit lattice rather
 * than as stock that was welded up and craned into place.
 *
 * The infill is also carried a value step below the frame (see the `mesh` emit). Equal-value wire
 * and tube average into a single grey field at any distance, and the section stops reading.
 */
const APERTURE = 0.16
const WIRE = 0.0042
const FRAME = 0.031
/** The opening has to pass a car — most of why this reads as parc fermé. */
const GATE_W = 3.0
/**
 * Screening scrim is privacy skirting: it takes the whole lower course of the panel, blanking the
 * wheels and feet inside while the mesh above stays open. Depth is what makes it read — a shallow
 * sheet carrying printing becomes a decorative stripe, which is the one thing a screened compound
 * never looks like — so the marks are held to a thin header inset near its top edge and the rest
 * of the sheet stays an unbroken dark field.
 *
 * It is tied off clear of the sill rather than run to the ground, so the ballast feet still read as
 * separate castings and water and debris pass under the sheet.
 */
const SCRIM_H = 0.68
const SCRIM_Y = SILL + 0.1 + SCRIM_H / 2
/** Top edge of the skirt: the printed header hangs off it, and the low coupler clears it. */
const SCRIM_TOP = SCRIM_Y + SCRIM_H / 2

interface PanelSpec {
  readonly cx: number
  readonly cz: number
  /** Outward face normal, unit length in XZ. */
  readonly nx: number
  readonly nz: number
  readonly width: number
  readonly bottom?: number
  readonly top?: number
  readonly frame?: number
  readonly feet?: boolean
  readonly scrim?: boolean
  readonly brace?: boolean
  /** Gate leaves are hung ironwork, not galvanised panel stock. */
  readonly dark?: boolean
}

export function createModel(options: F1ParcFermeOptions = {}): F1ParcFermeInstance {
  const config: F1ParcFermeConfig = {
    bays: Math.max(2, Math.round(options.bays ?? defaults.bays)),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const extras: Material[] = []
  const textures: ReturnType<typeof marshalPlateTexture>[] = []
  const materialSlots: Record<Slot, Material> = {
    post: options.materials?.post ?? kit.graphite,
    rail: options.materials?.rail ?? kit.slate,
  }

  const root = new Group(); root.name = 'f1-parc-ferme'
  const posts = new Group(); posts.name = 'posts'
  const rails = new Group(); rails.name = 'rails'
  root.add(posts, rails)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { post: [], rail: [] }

  const releaseGenerated = (): void => {
    posts.clear(); rails.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
    for (const texture of textures) texture.dispose()
    textures.length = 0
    for (const material of extras) material.dispose()
    extras.length = 0
  }

  // A mesh given an explicit material is not tracked against its slot: `setMaterial('post', …)`
  // is a request to repaint the structure, not to strip the signage off the portal.
  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string, material?: Material): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, material ?? materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (!material) meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const rebuild = (): void => {
    releaseGenerated()
    const bays = config.bays
    const span = Math.max(bays * PITCH, GATE_W + 2 * 1.1)
    const half = span / 2
    const halfD = (DEPTH_BAYS * PITCH) / 2
    const jamb = GATE_W / 2

    const postParts: BufferGeometry[] = []
    const frameParts: BufferGeometry[] = []
    const meshParts: BufferGeometry[] = []
    const footParts: BufferGeometry[] = []
    const gateParts: BufferGeometry[] = []
    const scrimParts: BufferGeometry[] = []
    const bandParts: BufferGeometry[] = []
    const accentParts: BufferGeometry[] = []

    /**
     * One panel: a welded perimeter frame with the infill held inside it, so the frame
     * owns the silhouette and the mesh only fills the aperture.
     */
    const addPanel = (spec: PanelSpec): void => {
      const { cx, cz, nx, nz, width } = spec
      const bottom = spec.bottom ?? SILL
      const top = spec.top ?? HEIGHT
      const r = spec.frame ?? FRAME
      const frames = spec.dark ? gateParts : frameParts
      const infill = spec.dark ? gateParts : meshParts
      const theta = Math.atan2(nx, nz)
      const ux = nz
      const uz = -nx
      const hw = width / 2
      const at = (t: number, y: number): Vector3 => new Vector3(cx + ux * t, y, cz + uz * t)

      frames.push(member(at(-hw, bottom), at(-hw, top), r, 8))
      frames.push(member(at(hw, bottom), at(hw, top), r, 8))
      frames.push(member(at(-hw, top), at(hw, top), r, 8))
      frames.push(member(at(-hw, bottom), at(hw, bottom), r, 8))
      frames.push(member(at(-hw, (bottom + top) / 2), at(hw, (bottom + top) / 2), r * 0.78, 6))
      if (spec.brace) {
        frames.push(member(at(-hw + r, bottom + r), at(hw - r, top - r), r * 0.7, 6))
      }

      const inset = r + APERTURE * 0.4
      const spanT = hw - inset
      const cols = Math.max(2, Math.floor((spanT * 2) / APERTURE))
      for (let i = 0; i <= cols; i++) {
        const t = -spanT + (i / cols) * spanT * 2
        infill.push(member(at(t, bottom + r), at(t, top - r), WIRE, 5))
      }
      const rise = top - bottom - inset * 2
      const rows = Math.max(2, Math.floor(rise / APERTURE))
      for (let i = 0; i <= rows; i++) {
        const y = bottom + inset + (i / rows) * rise
        infill.push(member(at(-hw + r, y), at(hw - r, y), WIRE, 5))
      }

      if (spec.feet !== false) {
        for (const side of [-1, 1] as const) {
          const t = side * Math.max(0.2, hw - 0.3)
          const block = bevelBox(0.56, 0.14, 0.3, 0.016)
          block.rotateY(theta)
          block.translate(cx + ux * t, 0.07, cz + uz * t)
          footParts.push(block)
        }
      }

      if (spec.scrim) {
        const place = (geometry: BufferGeometry, y: number, offset: number): void => {
          geometry.rotateY(theta)
          geometry.translate(cx + nx * offset, y, cz + nz * offset)
        }
        const scrimHalf = 0.012
        const scrimAt = r + 0.015 + scrimHalf
        const sheet = bevelBox(width - 0.16, SCRIM_H, scrimHalf * 2, 0.005)
        place(sheet, SCRIM_Y, scrimAt)
        scrimParts.push(sheet)

        // A printed header band with a rule under it, inset from the sheet's edges rather than run
        // to them. Both are kept shallow, so roughly four fifths of the skirt stays unbroken: this
        // is screening that happens to carry printing, not banner stock hung on a fence.
        const bandHalf = 0.006
        const bandAt = scrimAt + scrimHalf + LAYER_CLEARANCE + bandHalf
        const band = bevelBox(width - 0.34, 0.09, bandHalf * 2, 0.004)
        place(band, SCRIM_TOP - 0.135, bandAt)
        bandParts.push(band)

        const ruleHalf = 0.004
        const ruleAt = bandAt + bandHalf + LAYER_CLEARANCE + ruleHalf
        const rule = bevelBox(Math.max(0.3, width - 0.62), 0.018, ruleHalf * 2, 0.003)
        place(rule, SCRIM_TOP - 0.205, ruleAt)
        accentParts.push(rule)
      }
    }

    /** The clamp that couples two panels across a joint — what makes the gap read as deliberate. */
    const addCoupler = (x: number, z: number, nx: number, nz: number): void => {
      const theta = Math.atan2(nx, nz)
      for (const y of [HEIGHT - 0.075, SCRIM_TOP + 0.16]) {
        const clamp = bevelBox(JOINT + 0.1, 0.08, 0.08, 0.009)
        clamp.rotateY(theta)
        clamp.translate(x, y, z)
        postParts.push(clamp)
      }
    }

    const addRun = (
      x0: number, z0: number, x1: number, z1: number, count: number, nx: number, nz: number,
    ): void => {
      const dx = (x1 - x0) / count
      const dz = (z1 - z0) / count
      const cell = Math.hypot(dx, dz)
      for (let i = 0; i < count; i++) {
        addPanel({
          cx: x0 + dx * (i + 0.5),
          cz: z0 + dz * (i + 0.5),
          nx, nz,
          width: cell - JOINT,
          scrim: true,
        })
        if (i > 0) addCoupler(x0 + dx * i, z0 + dz * i, nx, nz)
      }
    }

    const addCorner = (sx: number, sz: number): void => {
      const x = sx * half
      const z = sz * halfD
      const tall = HEIGHT + 0.24
      const shaft = bevelBox(0.095, tall, 0.095, 0.011)
      shaft.translate(x, tall / 2, z)
      postParts.push(shaft)
      const cap = bevelBox(0.13, 0.032, 0.13, 0.006)
      cap.translate(x, tall + 0.016, z)
      postParts.push(cap)
      postParts.push(groundPad([0.28, 0.28], [x, 0, z], 0.026))
      postParts.push(boltRun([x, 0.026, z], 0.09, 4, 0.011, 0.014, AXIS_Y, 0.125))

      // Two raking stays per corner, one splayed down each fence axis rather than a single
      // kicker on the 45-degree bisector. The bisector stay foreshortens into a stub from
      // most azimuths, which is precisely when an erected compound stops looking braced.
      const stay = (dx: number, dz: number): void => {
        const reach = 1.35
        const head = new Vector3(x + dx * 0.055, tall - 0.2, z + dz * 0.055)
        const foot = new Vector3(x + dx * reach, 0.14, z + dz * reach)
        postParts.push(member(head, foot, 0.033, 8))

        // A horizontal tie back to the post closes the triangle, so the stay reads as bracing
        // instead of a pole left leaning against the fence.
        const knee = head.clone().lerp(foot, 0.62)
        postParts.push(member(new Vector3(x + dx * 0.05, knee.y, z + dz * 0.05), knee, 0.017, 6))

        postParts.push(groundPad(
          [dx !== 0 ? 0.36 : 0.22, dz !== 0 ? 0.36 : 0.22], [foot.x, 0, foot.z], 0.055,
        ))
        postParts.push(boltRun(
          [foot.x, 0.055, foot.z], 0.085, 2, 0.011, 0.014, AXIS_Y, dx !== 0 ? 0 : 0.25,
        ))
      }
      stay(sx, 0)
      stay(0, sz)
    }

    const flankBays = Math.max(1, Math.round((half - jamb) / PITCH))
    addRun(-half, -halfD, half, -halfD, bays, 0, -1)
    addRun(-half, halfD, -half, -halfD, DEPTH_BAYS, -1, 0)
    addRun(half, -halfD, half, halfD, DEPTH_BAYS, 1, 0)
    addRun(-half, halfD, -jamb, halfD, flankBays, 0, 1)
    addRun(jamb, halfD, half, halfD, flankBays, 0, 1)
    for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) addCorner(sx, sz)

    // --- the gate portal -------------------------------------------------------
    const jambH = HEIGHT + 0.5
    for (const side of [-1, 1] as const) {
      const x = side * jamb
      const stile = bevelBox(0.115, jambH, 0.115, 0.013)
      stile.translate(x, jambH / 2, halfD)
      postParts.push(stile)
      postParts.push(groundPad([0.32, 0.32], [x, 0, halfD], 0.032))
      postParts.push(boltRun([x, 0.032, halfD], 0.11, 4, 0.013, 0.016, AXIS_Y, 0.125))
      postParts.push(member(
        new Vector3(x, jambH - 0.55, halfD),
        new Vector3(x + side * 0.06, 0.13, halfD - 0.85),
        0.026, 8,
      ))
      postParts.push(groundPad([0.22, 0.22], [x + side * 0.06, 0, halfD - 0.85], 0.045))
    }

    const headerY = jambH - 0.13
    const header = bevelBox(GATE_W + 0.3, 0.2, 0.12, 0.014)
    header.translate(0, headerY, halfD)
    postParts.push(header)
    for (const side of [-1, 1] as const) {
      const gusset = bevelPrism([[0, 0], [side * 0.36, 0], [0, -0.32]], 0.05, 0.006)
      gusset.translate(side * (jamb - 0.058), headerY - 0.1, halfD)
      postParts.push(gusset)
    }

    // The crown carries the compound's name above the header, where the silhouette can hold it.
    const crownY = jambH + 0.23
    const crownW = 1.02
    for (const side of [-1, 1] as const) {
      postParts.push(member(
        new Vector3(side * 0.36, headerY + 0.08, halfD),
        new Vector3(side * 0.36, crownY - 0.14, halfD),
        0.03, 8,
      ))
      const capBlock = bevelBox(0.16, 0.34, 0.055, 0.008)
      capBlock.translate(side * (crownW / 2 + 0.08), crownY, halfD)
      accentParts.push(capBlock)
    }
    const crown = bevelBox(crownW, 0.34, 0.055, 0.008)
    crown.translate(0, crownY, halfD)
    bandParts.push(crown)

    // --- the leaves ------------------------------------------------------------
    // One leaf pinned shut and screened, one swung wide and bare: the pair reads as a
    // gate at a glance, which a matched pair sitting in the fence line never does.
    const leafW = jamb - 0.1
    const leafTop = HEIGHT + 0.15
    const leafBottom = 0.16
    addPanel({
      cx: jamb - 0.05 - leafW / 2, cz: halfD,
      nx: 0, nz: 1,
      width: leafW, bottom: leafBottom, top: leafTop,
      frame: 0.035, feet: false, brace: true, scrim: true, dark: true,
    })

    const swing = -1.15
    const sx = Math.cos(swing)
    const sz = -Math.sin(swing)
    addPanel({
      cx: -jamb + sx * (leafW / 2), cz: halfD + sz * (leafW / 2),
      nx: -sz, nz: sx,
      width: leafW, bottom: leafBottom, top: leafTop,
      frame: 0.035, feet: false, brace: true, dark: true,
    })

    for (const side of [-1, 1] as const) {
      for (const y of [0.44, leafTop - 0.24]) {
        gateParts.push(tubeSection(0.048, 0.14, [side * (jamb - 0.05), y, halfD], AXIS_Y, 10))
      }
    }
    // Drop bolt and its ground socket: the closed leaf is pinned, the compound is sealed.
    gateParts.push(member(
      new Vector3(0.05, 0.05, halfD), new Vector3(0.05, 0.64, halfD), 0.019, 8,
    ))
    gateParts.push(tubeSection(0.055, 0.06, [0.05, 0.03, halfD], AXIS_Y, 12))
    const latch = bevelBox(0.13, 0.18, 0.085, 0.009)
    latch.translate(0.05, 1.1, halfD + 0.06)
    gateParts.push(latch)

    emit('post', mergeParts(postParts, 'posts'), posts, 'posts')
    emit('rail', mergeParts(frameParts, 'panel-frames'), rails, 'panel-frames')
    // The infill takes the dark structural slot instead of the frame's mid-value one, so wire and
    // tube separate by value and the frame owns the section. It is still a tracked slot mesh, so
    // repainting the compound repaints it; it is simply the darker of the two.
    emit('post', mergeParts(meshParts, 'mesh'), rails, 'mesh')
    emit('post', mergeParts(footParts, 'feet'), posts, 'feet', kit.ink)
    emit('rail', mergeParts(gateParts, 'gate'), rails, 'gate', kit.graphite)
    emit('rail', mergeParts(scrimParts, 'scrim'), rails, 'scrim', kit.fabric)
    emit('rail', mergeParts(bandParts, 'scrim-bands'), rails, 'scrim-bands', kit.cobalt)
    emit('rail', mergeParts(accentParts, 'scrim-rules'), rails, 'scrim-rules', kit.amber)

    const tex = marshalPlateTexture('PF')
    textures.push(tex)
    const mat = new MeshStandardMaterial({
      name: 'f1-kit / parc-ferme plate',
      map: tex,
      roughness: 0.55,
      metalness: 0.04,
    })
    extras.push(mat)
    const face = new PlaneGeometry(0.45, 0.3)
    face.translate(0, crownY, halfD + 0.0275 + 0.016)
    emit('post', face, posts, 'sign', mat)
  }
  rebuild()

  return {
    root,
    parts: { posts, rails },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.bays !== undefined) config.bays = Math.max(2, Math.round(patch.bays))
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      for (const texture of textures) texture.dispose()
      textures.length = 0
      for (const material of extras) material.dispose()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel({ bays: 3 }), {
    aspect,
    target: [0, 1.05, 0.9],
    distance: 12.5,
    fov: 33,
    yaw: -0.5,
    pitch: 0.16,
    ground: true,
  })
}
