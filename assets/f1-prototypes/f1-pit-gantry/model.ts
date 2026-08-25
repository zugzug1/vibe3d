// f1-pit-gantry — the overhead structure spanning a pit bay: four braced truss columns carrying a flat
// roof truss grid, with a tensioned banner slung beneath the front run and downlights clamped to the
// front run's bottom chord either side of it.
//
// Real pit gantries are assembled from one modular aluminium box-truss product, and that single fact
// drives the whole silhouette. Every run — column, perimeter, rib — is the same square section, four
// chords with an X-brace on each face of each bay. Nothing tapers and nothing is a solid beam, so the
// structure reads as open framework with sky through it at any distance. A post-and-beam of plain boxes,
// or a doubled roof rectangle packed with cross-ties, has no such read: it closes up into a slab.
//
// The banner colour is genericised (no team livery — plain corporate blue by default).

import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  AXIS_X,
  AXIS_Y,
  TOKEN,
  acquireF1Materials,
  bevelBox,
  bevelRing,
  bolt,
  createF1Preview,
  disposeF1Materials,
  member,
  mergeParts,
  shade,
  tubeSection,
} from '../f1-kit-core/index.ts'

type Slot = 'post' | 'banner' | 'fitting'

export interface F1PitGantryConfig {
  /** Distance between the two columns along local +X, metres. */
  span: number
  /** Column height / beam elevation, metres. */
  height: number
  /** Truss bays across the span. Doubles as the LOD knob. */
  bays: number
}

export interface F1PitGantryOptions extends Partial<F1PitGantryConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1PitGantryInstance {
  readonly root: Group
  readonly parts: { posts: Group; beam: Group; banner: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1PitGantryConfig>
  configure(patch: Partial<F1PitGantryConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

// The reference stands about nine truss modules to the roof over a six-metre span — a squat outdoor
// stance, not a walk-through portal. Measured off the photograph: the near column reads roughly six
// X-bays between its base plate and the roof's underside.
const defaults: F1PitGantryConfig = { span: 6.0, height: 2.65, bays: 12 }

/** The one modular truss section used everywhere, chord centre to chord centre, world units. */
const SECTION = 0.29
// Product tube sizes: a 300 mm truss carries ~48 mm chords laced with ~22 mm diagonals. Holding those
// against the section is what keeps the lattice airy — fatten either and the X-band closes into a wall.
const CHORD = 0.024 // truss chord tube radius
const LACE = 0.0115 // X-brace tube radius
/** Depth of the bay as a fraction of its span, from the reference footprint. */
const DEPTH_RATIO = 0.62
/** Bolted base plate: thickness, and the chord centreline where a column lands on it. */
const PLATE_T = 0.038
const BASE_Y = 0.055

/**
 * Baked lattice occlusion, as a vertex-colour multiplier on the mill finish.
 *
 * The kit's rig has no shadow map and no ambient occlusion, so a single-material truss renders its chords
 * and its laces at exactly the same value and the X-band flattens into a printed pattern. The laces sit
 * inside the section, shaded by the four chords around them, so carrying that as vertex colour is what
 * restores the deep recesses the reference shows between bright chord highlights.
 */
const CHORD_VALUE = 1.0
const LACE_VALUE = 0.32

/** Interpolate one structural node along a chord. */
function pointOn(from: Vector3, to: Vector3, t: number): Vector3 {
  return from.clone().lerp(to, t)
}

/**
 * The four chord offsets of a square truss section running along `direction`. Every run in this model is
 * axis-aligned, so the fallback reference axis only has to avoid the degenerate vertical case.
 */
function sectionCorners(direction: Vector3, section: number): Vector3[] {
  const reference = Math.abs(direction.y) > 0.9
    ? new Vector3(0, 0, 1)
    : new Vector3(0, 1, 0)
  const u = new Vector3().crossVectors(direction, reference).normalize()
  const v = new Vector3().crossVectors(direction, u).normalize()
  const h = section / 2
  return [
    u.clone().multiplyScalar(h).addScaledVector(v, h),
    u.clone().multiplyScalar(-h).addScaledVector(v, h),
    u.clone().multiplyScalar(-h).addScaledVector(v, -h),
    u.clone().multiplyScalar(h).addScaledVector(v, -h),
  ]
}

/**
 * One run of modular box truss between two centreline points: four continuous chords plus a full X-brace
 * on all four faces of every bay. Adjacent bays share their chord nodes, so the braces chain into the
 * unbroken zig-zag band that identifies this product, rather than floating mid-chord.
 *
 * Chords and laces are collected separately because they carry different baked values; the chords also
 * take more radial segments, since they are the tubes whose specular band the eye actually follows.
 */
function boxTruss(
  chordParts: BufferGeometry[],
  laceParts: BufferGeometry[],
  from: Vector3,
  to: Vector3,
  bays: number,
  section = SECTION,
): void {
  const direction = to.clone().sub(from).normalize()
  const corners = sectionCorners(direction, section)
  for (const corner of corners) {
    chordParts.push(member(from.clone().add(corner), to.clone().add(corner), CHORD, 12))
  }
  for (let bay = 0; bay < bays; bay++) {
    const near = pointOn(from, to, bay / bays)
    const far = pointOn(from, to, (bay + 1) / bays)
    for (let face = 0; face < 4; face++) {
      const a = corners[face]!
      const b = corners[(face + 1) % 4]!
      laceParts.push(member(near.clone().add(a), far.clone().add(b), LACE, 6))
      laceParts.push(member(near.clone().add(b), far.clone().add(a), LACE, 6))
    }
  }
}

/**
 * Merge one structural batch, tagging the chords bright and the laces shadowed.
 *
 * The colour attribute is written after the merge on purpose: `mergeParts` strips everything but position,
 * normal and uv so that mixed sources can batch at all, and `mergeGeometries` concatenates in argument
 * order, so the two vertex spans are exactly the two counts read here.
 */
function mergeShaded(
  chordParts: BufferGeometry[],
  laceParts: BufferGeometry[],
  label: string,
): BufferGeometry {
  const chords = mergeParts(chordParts, `${label}: chords`)
  const laces = mergeParts(laceParts, `${label}: laces`)
  const chordVertices = chords.getAttribute('position').count
  const laceVertices = laces.getAttribute('position').count
  const merged = mergeParts([chords, laces], label)
  const values = new Float32Array((chordVertices + laceVertices) * 3)
  values.fill(CHORD_VALUE, 0, chordVertices * 3)
  values.fill(LACE_VALUE, chordVertices * 3)
  merged.setAttribute('color', new Float32BufferAttribute(values, 3))
  return merged
}

export function createModel(options: F1PitGantryOptions = {}): F1PitGantryInstance {
  const config: F1PitGantryConfig = {
    span: Math.max(2, options.span ?? defaults.span),
    height: Math.max(1.5, options.height ?? defaults.height),
    bays: Math.max(3, Math.round(options.bays ?? defaults.bays)),
  }

  // Shared kit materials. Overrides handed in through `options` belong to the caller and are never
  // disposed here (rule 16); the dark slot is reserved for bolted hardware so it still reads.
  const bundle = acquireF1Materials()
  const m = bundle.materials
  const owned: Material[] = []
  const own = (material: Material): Material => {
    owned.push(material)
    return material
  }

  // Bare mill-finish alloy. The kit's `steel` is authored for machined hardware, and at metalness 0.85
  // with no environment map in the rig it has almost no diffuse term left to catch — which is what made
  // this frame render as chalky grey rather than bright aluminium. Half-metal at a low roughness keeps a
  // bright alloy body and lays a tight specular band down every round chord, and vertex colours let the
  // baked lattice occlusion sink the laces behind it.
  const millFinish = options.materials?.post ?? own(new MeshStandardMaterial({
    name: 'f1-kit / pit-gantry mill finish',
    color: shade(TOKEN.SHELL_200, 0.06),
    roughness: 0.19,
    metalness: 0.55,
    vertexColors: true,
  }))

  const materialSlots: Record<Slot, Material> = {
    post: millFinish,
    banner: options.materials?.banner ?? m.cobalt,
    fitting: options.materials?.fitting ?? m.graphite,
  }

  // Runtime anchors: created once, never replaced (rules 10, 14).
  const root = new Group()
  root.name = 'f1-pit-gantry'
  const posts = new Group(); posts.name = 'posts'
  const beam = new Group(); beam.name = 'beam'
  const banner = new Group(); banner.name = 'banner'
  root.add(posts, beam, banner)

  // Per-rebuild geometry ownership. Geometry is regenerated by configure(), so it is tracked separately
  // from the bag and released at the top of every rebuild — putting it in the bag would both grow the bag
  // without bound and double-dispose everything it already released.
  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { post: [], banner: [], fitting: [] }

  const releaseGenerated = (): void => {
    for (const group of [posts, beam, banner]) group.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  /** One merged geometry per material slot, so there is exactly one mesh per slot and one draw call. */
  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  /**
   * Every dimension the parts below share. One bay length is solved once from the span and carried into
   * the columns and the transverse runs, because a modular kit cannot change bay pitch between members
   * and an uneven pitch is the first thing that makes a truss look generated.
   */
  const solve = () => {
    const { span, height, bays } = config
    const half = span / 2
    const halfDepth = (span * DEPTH_RATIO) / 2
    const inset = SECTION / 2
    const bayLength = span / bays
    // Chord centres of the perimeter runs. The outer chord lands exactly on the footprint edge, so the
    // roof ends flush over its column instead of overhanging it.
    const railX = half - inset
    const railZ = halfDepth - inset
    const roofBottom = height - SECTION
    const roofCentre = height - inset
    const depthBays = Math.max(2, Math.round((halfDepth * 2) / bayLength))
    const columnBays = Math.max(2, Math.round((roofBottom - BASE_Y) / bayLength))
    // Interior ribs, spaced across the span at roughly the section's own module.
    const ribCount = Math.max(1, Math.round(span / (SECTION * 7)) - 1)
    const ribX: number[] = []
    for (let i = 0; i < ribCount; i++) {
      ribX.push(-railX + (2 * railX * (i + 1)) / (ribCount + 1))
    }
    return {
      half, halfDepth, railX, railZ, roofBottom, roofCentre, depthBays, columnBays, ribX,
    }
  }

  /**
   * Four X-braced columns, each landing on a bolted base plate.
   *
   * The plate is mill finish rather than dark hardware, and steps proud of the section on all four sides,
   * because that is how the reference's feet read: a wider alloy pad with dark bolt heads on it, not a
   * black block the column disappears into.
   */
  const buildColumns = (
    chordParts: BufferGeometry[],
    laceParts: BufferGeometry[],
    fittingParts: BufferGeometry[],
    d: ReturnType<typeof solve>,
  ): void => {
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const cx = sx * d.railX
        const cz = sz * d.railZ
        boxTruss(
          chordParts,
          laceParts,
          new Vector3(cx, BASE_Y, cz),
          new Vector3(cx, d.roofBottom, cz),
          d.columnBays,
        )
        const plate = bevelBox(SECTION + 0.17, PLATE_T, SECTION + 0.17, 0.006)
        plate.translate(cx, PLATE_T / 2, cz)
        chordParts.push(plate)
        // Corner fixings, outboard of the chords rather than on a circle through them.
        for (const bx of [-1, 1] as const) {
          for (const bz of [-1, 1] as const) {
            fittingParts.push(bolt(
              [cx + bx * 0.19, PLATE_T, cz + bz * 0.19],
              0.016, 0.022, AXIS_Y,
            ))
          }
        }
      }
    }
  }

  /**
   * The flat roof: a single rectangular perimeter of box truss plus full-depth interior ribs. One
   * perimeter rather than two concentric rectangles is what leaves sky between the members.
   */
  const buildRoof = (
    chordParts: BufferGeometry[],
    laceParts: BufferGeometry[],
    d: ReturnType<typeof solve>,
  ): void => {
    for (const sz of [-1, 1] as const) {
      boxTruss(
        chordParts,
        laceParts,
        new Vector3(-d.half, d.roofCentre, sz * d.railZ),
        new Vector3(d.half, d.roofCentre, sz * d.railZ),
        config.bays,
      )
    }
    for (const x of [-d.railX, ...d.ribX, d.railX]) {
      boxTruss(
        chordParts,
        laceParts,
        new Vector3(x, d.roofCentre, -d.halfDepth),
        new Vector3(x, d.roofCentre, d.halfDepth),
        d.depthBays,
      )
    }
    // Corner couplers, where the perimeter's outermost chords cross. Real truss is bolted through a block
    // here, and without one the crossing tubes read as an intersection error. They stay in the frame's own
    // alloy, because a dark block on each corner punches holes in the roof's silhouette.
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        for (const y of [d.roofBottom, config.height]) {
          const block = bevelBox(0.085, 0.085, 0.085, 0.010)
          block.translate(sx * d.half, y, sz * d.halfDepth)
          chordParts.push(block)
        }
      }
    }
  }

  /**
   * A slung banner on the front run, framed on its own rails and hung from two straps. Deliberately short
   * of the span and tucked hard under the truss: the open bay is the silhouette, and a full-width board
   * across it turns the gantry back into a billboard on legs.
   */
  const buildBanner = (
    fittingParts: BufferGeometry[],
    d: ReturnType<typeof solve>,
  ): BufferGeometry => {
    const bannerW = config.span * 0.46
    const bannerH = 0.38
    const bannerTop = d.roofBottom - 0.08
    const bannerBottom = bannerTop - bannerH
    // Clear of the front chord's outer surface by more than the kit's minimum applied-layer gap (rule 8).
    const bannerZ = d.halfDepth + CHORD + 0.018 + 0.014
    const panel = bevelBox(bannerW, bannerH, 0.028, 0.006)
    panel.translate(0, (bannerTop + bannerBottom) / 2, bannerZ)

    const edges: Array<[Vector3, Vector3]> = [
      [new Vector3(-bannerW / 2, bannerTop, bannerZ), new Vector3(bannerW / 2, bannerTop, bannerZ)],
      [
        new Vector3(-bannerW / 2, bannerBottom, bannerZ),
        new Vector3(bannerW / 2, bannerBottom, bannerZ),
      ],
    ]
    for (const sx of [-1, 1] as const) {
      edges.push([
        new Vector3((sx * bannerW) / 2, bannerBottom, bannerZ),
        new Vector3((sx * bannerW) / 2, bannerTop, bannerZ),
      ])
    }
    for (const [from, to] of edges) fittingParts.push(member(from, to, 0.020, 8))
    for (const sx of [-1, 1] as const) {
      fittingParts.push(member(
        new Vector3((sx * bannerW) / 2, d.roofBottom, d.halfDepth),
        new Vector3((sx * bannerW) / 2, bannerTop, bannerZ),
        0.010,
        6,
      ))
    }
    return panel
  }

  /**
   * Downlights clamped to the outer bottom chord of the front run, flanking the banner, where the light
   * actually has to reach the car. Each one carries the hardware a truss clamp is recognised by: a collar
   * round the chord, a bolted jaw under it, then the drop stem and the fixture.
   *
   * They sit midway between rib lines rather than at a fraction of the span, so a clamp can never land on
   * the coupler block where a rib crosses the rail, whatever span the consumer configures.
   */
  const buildLights = (fittingParts: BufferGeometry[], d: ReturnType<typeof solve>): void => {
    const ribLines = [-d.railX, ...d.ribX, d.railX]
    const midpoints = ribLines.slice(1).map((x, i) => (x + ribLines[i]!) / 2)
    const z = d.halfDepth
    const clampRadius = CHORD + 0.021
    const jawHeight = 0.018

    for (const x of [midpoints[0]!, midpoints[midpoints.length - 1]!]) {
      fittingParts.push(tubeSection(clampRadius, 0.078, [x, d.roofBottom, z], AXIS_X, 12))
      // The jaw bites 6 mm up into the collar, so the two parts are bolted together rather than stacked.
      const jawY = d.roofBottom - clampRadius - jawHeight / 2 + 0.006
      const jaw = bevelBox(0.078, jawHeight, 0.115, 0.004)
      jaw.translate(x, jawY, z)
      fittingParts.push(jaw)
      const jawFace = jawY - jawHeight / 2
      for (const bz of [-1, 1] as const) {
        fittingParts.push(bolt([x, jawFace, z + bz * 0.04], 0.012, 0.018, [0, -1, 0]))
      }
      const stemEnd = jawFace - 0.095
      fittingParts.push(member(
        new Vector3(x, jawFace, z),
        new Vector3(x, stemEnd, z),
        0.014,
        8,
      ))
      const bodyTop = stemEnd + 0.01
      const body = new CylinderGeometry(0.07, 0.086, 0.15, 14)
      body.translate(x, bodyTop - 0.075, z)
      fittingParts.push(body)
      const trim = bevelRing(0.084, 0.098, 0.014, 0.003, 22)
      trim.rotateX(Math.PI / 2)
      trim.translate(x, bodyTop - 0.145, z)
      fittingParts.push(trim)
    }
  }

  const rebuild = (): void => {
    releaseGenerated()
    const d = solve()

    const columnChords: BufferGeometry[] = []
    const columnLaces: BufferGeometry[] = []
    const roofChords: BufferGeometry[] = []
    const roofLaces: BufferGeometry[] = []
    const fittingParts: BufferGeometry[] = []

    buildColumns(columnChords, columnLaces, fittingParts, d)
    buildRoof(roofChords, roofLaces, d)
    const panel = buildBanner(fittingParts, d)
    buildLights(fittingParts, d)

    emit('post', mergeShaded(columnChords, columnLaces, 'columns'), posts, 'columns')
    emit('post', mergeShaded(roofChords, roofLaces, 'roof-truss'), beam, 'roof-truss')
    emit('banner', mergeParts([panel], 'banner'), banner, 'panel')
    emit('fitting', mergeParts(fittingParts, 'fittings'), posts, 'fittings')
  }
  rebuild()

  return {
    root,
    parts: { posts, beam, banner },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.span !== undefined) config.span = Math.max(2, patch.span)
      if (patch.height !== undefined) config.height = Math.max(1.5, patch.height)
      if (patch.bays !== undefined) config.bays = Math.max(3, Math.round(patch.bays))
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      for (const material of owned) material.dispose()
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  // The reference is photographed from standing height, below the roof. That matters more than it sounds:
  // seen from underneath, the far roof run projects above the near one, and the grid between them opens
  // up. Level with the roof plane the whole thing collapses into a single band.
  //
  // The eye height sits just under the roof rather than halfway up the legs, which is where the reference
  // photographer stood: from below the mid-point the columns rake away and read taller than they are.
  return createF1Preview(createModel(), {
    aspect,
    target: [0, 1.5, 0],
    distance: 8.6,
    pitch: 0.08,
    fov: 50,
  })
}
