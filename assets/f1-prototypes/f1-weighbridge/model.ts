// f1-weighbridge — FIA paddock scale: a load-cell deck standing proud of the apron between two
// full-run approach ramps, corralled by guide rails, read out on a kerbside indicator totem.

import {
  BufferGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type Material,
} from 'three/webgpu'

import {
  AXIS_Y,
  AXIS_Z,
  LAYER_CLEARANCE,
  TOKEN,
  acquireF1Materials,
  bevelBox,
  bevelPrism,
  bolt,
  createF1Preview,
  disposeF1Materials,
  fasciaTexture,
  groundPad,
  member,
  mergeParts,
  shade,
  tubeSection,
} from '../f1-kit-core/index.ts'

type Slot = 'deck' | 'ramp' | 'display'

export interface F1WeighbridgeConfig {
  width: number
}

export interface F1WeighbridgeOptions extends Partial<F1WeighbridgeConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1WeighbridgeInstance {
  readonly root: Group
  readonly parts: { deck: Group; ramp: Group; display: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1WeighbridgeConfig>
  configure(patch: Partial<F1WeighbridgeConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1WeighbridgeConfig = { width: 3.2 }

/** Deck length along the direction of travel. */
const DECK_L = 4.2
/** Height of the weighed surface above the apron. Drives the ramp run and the skirt depth. */
const DECK_TOP = 0.3
const PLATE_T = 0.1
/** Near-black band tucked under the plate rim, 2 mm inboard, so the overhang reads as one thick lip. */
const PLATE_EDGE_T = 0.032
/** Underside of the weighed plate: where the load buttons meet it and the skirt stops. */
const PLATE_UNDER = DECK_TOP - PLATE_T
/**
 * The skirt sits inboard of the plate edge so the deck reads as a floating pan, not a solid kerb, and far
 * enough inboard that the load cells at the rim stand clear of it instead of merging into one dark mass.
 */
const SKIRT_INSET = 0.46
/** Daylight left under the skirt. The gap is what makes the pan read as carried on cells. */
const SKIRT_LIFT = 0.02
const SKIRT_H = PLATE_UNDER - SKIRT_LIFT
const RAMP_RUN = 1.55
/** Toe thickness where a ramp meets the apron. */
const RAMP_TOE = 0.024
/** The ramp heel tucks under the deck edge by this much. */
const RAMP_TUCK = 0.04
const RAIL_TOP = 0.86
/** Rotation of the indicator totem so its face turns back toward the approach. */
const HEAD_YAW = -0.95
/** Rake of the indicator sun hood. Shared by the hood plate and the side fins beneath it. */
const HOOD_RAKE = 0.42

export function createModel(options: F1WeighbridgeOptions = {}): F1WeighbridgeInstance {
  const config: F1WeighbridgeConfig = {
    width: Math.max(2, options.width ?? defaults.width),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials

  // Three prop-local finishes, each derived from a canonical token, because this prop's whole subject is
  // one bright weighed surface read against everything that carries it. The shared bundle could not
  // supply that: `steel` is a machined-fastener metal that renders mid grey at metalness 0.85 with no
  // environment map, which left the plate at the same value as the slate ramps and the graphite rails,
  // and `ink` is a matte rubber that renders *lighter* than the metal it sits on. These give the station
  // a ladder — bright plate, mid ramp, dark paint, near-black grate — that holds at reference distance.
  const plateSteel = new MeshStandardMaterial({
    name: 'f1-kit / weighbridge plate',
    color: shade(TOKEN.SHELL_200, -0.16),
    roughness: 0.34,
    metalness: 0.45,
  })
  const paint = new MeshStandardMaterial({
    name: 'f1-kit / weighbridge paint',
    color: shade(TOKEN.GRAPHITE_800, -0.4),
    roughness: 0.68,
    metalness: 0.08,
  })
  const nearBlack = new MeshStandardMaterial({
    name: 'f1-kit / weighbridge grate black',
    color: shade(TOKEN.INK_950, -0.35),
    roughness: 0.8,
    metalness: 0.5,
  })
  // Hazard yellow has to survive being the only chroma in the frame, and the thing that was bleaching it
  // was too much albedo, not too little: the token at full value multiplied by a 2.3-intensity key light
  // clips its red channel long before the green, which lands the stripe a pale cream. Sunk two thirds of
  // the way down its own ramp it comes back through that light as saturated yellow, and dielectric
  // recovers the quarter of the reflected light the shared `amber` loses to metalness with no
  // environment map. The small self-lit term is for the approach face turned away from the key.
  const hazardYellow = new MeshStandardMaterial({
    name: 'f1-kit / weighbridge hazard yellow',
    color: shade(TOKEN.AMBER_400, -0.42),
    roughness: 0.5,
    metalness: 0,
    emissive: TOKEN.AMBER_400,
    emissiveIntensity: 0.06,
  })
  // Darker than the grate black and fully matte, for the surfaces whose job is to return no light: the
  // reveal lining the display cavity and the panel the readout is mounted on.
  const cavity = new MeshStandardMaterial({
    name: 'f1-kit / weighbridge cavity black',
    color: shade(TOKEN.INK_950, -0.62),
    roughness: 0.95,
    metalness: 0.04,
  })
  const finishes: Material[] = [plateSteel, paint, nearBlack, hazardYellow, cavity]

  const extras: Material[] = []
  const textures: DataTexture[] = []
  const ownsDisplay = options.materials?.display === undefined
  const materialSlots: Record<Slot, Material> = {
    deck: options.materials?.deck ?? plateSteel,
    ramp: options.materials?.ramp ?? kit.slate,
    display: options.materials?.display ?? kit.shell,
  }

  const root = new Group(); root.name = 'f1-weighbridge'
  const deck = new Group(); deck.name = 'deck'
  const ramp = new Group(); ramp.name = 'ramp'
  const display = new Group(); display.name = 'display'
  root.add(deck, ramp, display)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { deck: [], ramp: [], display: [] }

  const releaseGenerated = (): void => {
    deck.clear(); ramp.clear(); display.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
    if (ownsDisplay) {
      for (const texture of textures) texture.dispose()
      textures.length = 0
      for (const material of extras) material.dispose()
      extras.length = 0
    }
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

  /** The weighed pan: overhanging top plate, inset skirt, and the load cells it stands on. */
  const buildPan = (w: number): void => {
    const plate = bevelBox(w, PLATE_T, DECK_L, 0.016)
    plate.translate(0, DECK_TOP - PLATE_T / 2, 0)
    emit('deck', plate, deck, 'platform')

    // A near-black band set just inboard of the plate edge. The plate alone photographs as a thin sheet;
    // a bright top over a dark band turns the whole overhang into one thick machined lip.
    const rim: BufferGeometry[] = []
    for (const sx of [-1, 1] as const) {
      const side = bevelBox(0.06, PLATE_EDGE_T, DECK_L - 0.02, 0.006)
      side.translate(sx * (w / 2 - 0.032), PLATE_UNDER - PLATE_EDGE_T / 2, 0)
      rim.push(side)
    }
    for (const sz of [-1, 1] as const) {
      const end = bevelBox(w - 0.144, PLATE_EDGE_T, 0.06, 0.006)
      end.translate(0, PLATE_UNDER - PLATE_EDGE_T / 2, sz * (DECK_L / 2 - 0.032))
      rim.push(end)
    }
    emit('deck', mergeParts(rim, 'plate-edge'), deck, 'plate-edge', nearBlack)

    const skirtY = SKIRT_LIFT + SKIRT_H / 2
    const skirt: BufferGeometry[] = []
    for (const sx of [-1, 1] as const) {
      const side = bevelBox(0.08, SKIRT_H, DECK_L - 0.1, 0.008)
      side.translate(sx * (w / 2 - SKIRT_INSET), skirtY, 0)
      skirt.push(side)
    }
    for (const sz of [-1, 1] as const) {
      const end = bevelBox(w - 2 * SKIRT_INSET - 0.04, SKIRT_H, 0.08, 0.008)
      end.translate(0, skirtY, sz * (DECK_L / 2 - SKIRT_INSET))
      skirt.push(end)
    }
    emit('deck', mergeParts(skirt, 'skirt'), deck, 'skirt', paint)

    // Six cells, each a footing pad, a machined bedplate, a squared body, an overhanging flange and the
    // load button that meets the plate. All of it sits in the plate's own shadow, where a mid-grey body
    // simply averaged into the void behind it. The body is instead the darkest value on the station and
    // is cut out by the two bright plates that sandwich it: bright line, dark chunk, bright line. The
    // block is sized for how little of it the overhang leaves visible — 480 mm along the deck, where the
    // camera has the most pixels to spend, rather than tall, where it has almost none.
    const feet: BufferGeometry[] = []
    const bodies: BufferGeometry[] = []
    const caps: BufferGeometry[] = []
    const padT = 0.026
    const bedT = 0.022
    const flangeT = 0.04
    const flangeTop = 0.178
    const bodyH = flangeTop - flangeT - padT - bedT
    for (const sx of [-1, 1] as const) {
      for (const z of [-1.55, 0, 1.55] as const) {
        const x = sx * (w / 2 - 0.19)
        feet.push(groundPad([0.36, 0.5], [x, 0, z], padT))
        const bed = bevelBox(0.3, bedT, 0.48, 0.005)
        bed.translate(x, padT + bedT / 2, z)
        caps.push(bed)
        const body = bevelBox(0.26, bodyH, 0.44, 0.016)
        body.translate(x, padT + bedT + bodyH / 2, z)
        bodies.push(body)
        const flange = bevelBox(0.32, flangeT, 0.48, 0.006)
        flange.translate(x, flangeTop - flangeT / 2, z)
        caps.push(flange)
        caps.push(tubeSection(
          0.072, PLATE_UNDER - flangeTop, [x, (flangeTop + PLATE_UNDER) / 2, z], AXIS_Y, 16,
        ))
      }
    }
    emit('deck', mergeParts(feet, 'load-cell-feet'), deck, 'load-cell-feet', kit.graphite)
    emit('deck', mergeParts(bodies, 'load-cells'), deck, 'load-cells', nearBlack)
    emit('deck', mergeParts(caps, 'load-cell-caps'), deck, 'load-cell-caps', plateSteel)
  }

  /** Bolted wheel tracks and their grate ribs — the cue that a vehicle is what gets weighed here. */
  const buildTracks = (w: number): void => {
    const trackX = Math.min(w / 2 - 0.42, 1.0)
    const trackW = 0.56
    const trackTop = DECK_TOP + 0.024

    const tracks: BufferGeometry[] = []
    const ribs: BufferGeometry[] = []
    const ribCount = 15
    const ribSpan = DECK_L - 0.5
    for (const sx of [-1, 1] as const) {
      const strip = bevelBox(trackW, 0.03, DECK_L - 0.3, 0.006)
      strip.translate(sx * trackX, DECK_TOP + 0.009, 0)
      tracks.push(strip)
      for (let i = 0; i < ribCount; i++) {
        // Taller and wider than the plate detail around them: the ribs have to hold their own shadow to
        // read as a near-black grate against a bright plate rather than as painted lines.
        const rib = bevelBox(trackW, 0.026, 0.07, 0.004)
        rib.translate(sx * trackX, trackTop + 0.009, -ribSpan / 2 + (i * ribSpan) / (ribCount - 1))
        ribs.push(rib)
      }
    }
    emit('deck', mergeParts(tracks, 'wheel-tracks'), deck, 'wheel-tracks', kit.graphite)
    emit('deck', mergeParts(ribs, 'grate'), deck, 'grate', nearBlack)

    const centreline = bevelBox(0.07, 0.016, DECK_L - 0.9, 0.003)
    centreline.translate(0, DECK_TOP + 0.002, 0)
    emit('deck', centreline, deck, 'centreline', hazardYellow)
  }

  /** Plate hardware: the bolt rows that pin the deck down and the load-cell access hatch. */
  const buildPlateHardware = (w: number): void => {
    const hardware: BufferGeometry[] = []
    const rows = 15
    for (const sx of [-1, 1] as const) {
      for (let i = 0; i < rows; i++) {
        const z = -(DECK_L - 0.5) / 2 + (i * (DECK_L - 0.5)) / (rows - 1)
        hardware.push(bolt([sx * (w / 2 - 0.09), DECK_TOP, z], 0.019, 0.014, AXIS_Y))
      }
    }
    const hatch = bevelBox(0.52, 0.022, 0.36, 0.005)
    hatch.translate(0, DECK_TOP + 0.005, -1.5)
    hardware.push(hatch)
    for (const hx of [-0.2, 0.2] as const) {
      for (const hz of [-1.63, -1.37] as const) {
        hardware.push(bolt([hx, DECK_TOP + 0.016, hz], 0.016, 0.012, AXIS_Y))
      }
    }
    emit('deck', mergeParts(hardware, 'plate-hardware'), deck, 'plate-hardware', kit.graphite)
  }

  /** Approach ramps carried all the way down to the apron, plus their hazard marking. */
  const buildRamps = (w: number): void => {
    const half = RAMP_RUN / 2
    const rise = DECK_TOP / 2
    const slope = Math.atan2(DECK_TOP - RAMP_TOE, RAMP_RUN)
    const heelZ = DECK_L / 2 - RAMP_TUCK
    // Five painted bands per face on a half-painted rhythm, measured from the deck lip and carried to
    // within 35 mm of the toe, with the intervening bands laid in grate black so the pair alternates the
    // whole run. Yellow banding on mid-grey slate reads as a tint of the slate no matter how saturated
    // the yellow is; yellow against black is the safety marking itself, and it holds on the
    // foreshortened approach face where a single-value band washed out.
    const bandRuns = [0.24, 0.54, 0.84, 1.14, 1.44] as const
    const voidRuns = [0.09, 0.39, 0.69, 0.99, 1.29] as const
    const bandDepth = 0.15

    const wedges: BufferGeometry[] = []
    const hazard: BufferGeometry[] = []
    const voids: BufferGeometry[] = []
    /** One band laid on the ramp face at `run` metres down-slope from the deck lip. */
    const band = (run: number, sz: number, lift: number): BufferGeometry => {
      const stripe = bevelBox(w - 0.12, 0.02, bandDepth, 0.004)
      stripe.rotateX(sz * slope)
      stripe.translate(0, DECK_TOP - run * Math.tan(slope) + lift, sz * (heelZ + run))
      return stripe
    }
    for (const sz of [-1, 1] as const) {
      const wedge = bevelPrism(
        [[-half, -rise], [half, -rise], [half, -rise + RAMP_TOE], [-half, rise]],
        w,
        0.012,
      )
      wedge.rotateY(-Math.PI / 2)
      if (sz < 0) wedge.rotateY(Math.PI)
      wedge.translate(0, rise, sz * (heelZ + half))
      wedges.push(wedge)

      for (const run of bandRuns) hazard.push(band(run, sz, 0.006))
      for (const run of voidRuns) voids.push(band(run, sz, 0.004))

      const nosing = bevelBox(w - 0.1, 0.018, 0.16, 0.004)
      nosing.translate(0, DECK_TOP + 0.002, sz * (DECK_L / 2 - 0.12))
      hazard.push(nosing)
    }
    emit('ramp', mergeParts(wedges, 'ramps'), ramp, 'ramps')
    emit('ramp', mergeParts(voids, 'hazard-void'), ramp, 'hazard-void', nearBlack)
    emit('ramp', mergeParts(hazard, 'hazard'), ramp, 'hazard', hazardYellow)
  }

  /** Guide rails that funnel a car onto the pan and give the station its silhouette. */
  const buildRails = (w: number): void => {
    const railX = w / 2 + 0.24
    const rails: BufferGeometry[] = []
    for (const sx of [-1, 1] as const) {
      const x = sx * railX
      for (const z of [-1.9, -0.63, 0.63, 1.9] as const) {
        const post = bevelBox(0.12, RAIL_TOP, 0.12, 0.012)
        post.translate(x, RAIL_TOP / 2, z)
        rails.push(post)
        rails.push(groundPad([0.26, 0.26], [x, 0, z], 0.03))
      }
      rails.push(tubeSection(0.05, DECK_L + 0.6, [x, RAIL_TOP + 0.02, 0], AXIS_Z, 12))
      rails.push(tubeSection(0.038, DECK_L + 0.6, [x, 0.5, 0], AXIS_Z, 10))
    }
    emit('deck', mergeParts(rails, 'guard-rails'), deck, 'guard-rails', paint)
  }

  /** Kerbside indicator totem: terminal cabinet, mast, head, sun hood, and the readout it carries. */
  const buildIndicator = (w: number): void => {
    const px = w / 2 + 0.95
    const pz = -0.55
    const place = (geometry: BufferGeometry): BufferGeometry => {
      geometry.rotateY(HEAD_YAW)
      geometry.translate(px, 0, pz)
      return geometry
    }

    const stand: BufferGeometry[] = []
    stand.push(place(groundPad([0.62, 0.5], [0, 0, 0], 0.07)))
    const cabinet = bevelBox(0.5, 0.66, 0.36, 0.018)
    cabinet.translate(0, 0.4, 0)
    stand.push(place(cabinet))
    const mast = bevelBox(0.2, 1.3, 0.2, 0.016)
    mast.translate(0, 1.28, 0)
    stand.push(place(mast))
    stand.push(member(
      new Vector3(px - 0.16, 0.1, pz),
      new Vector3(w / 2 - 0.13, 0.1, pz),
      0.038,
      8,
    ))
    emit('deck', mergeParts(stand, 'indicator-post'), deck, 'indicator-post', paint)

    const head = bevelBox(1.02, 0.7, 0.3, 0.024)
    head.translate(0, 2.06, 0)
    emit('deck', place(head), deck, 'indicator-head', paint)

    // A bright frame standing 190 mm off the head front, with the readout left back at that front face,
    // so the frame is the mouth of a cavity rather than a surround on a panel. At 100 mm the recess was
    // shallower than the hood's own overhang and the display photographed flat under a canopy.
    const bezel: BufferGeometry[] = []
    for (const sx of [-1, 1] as const) {
      const jamb = bevelBox(0.07, 0.7, 0.19, 0.01)
      jamb.translate(sx * 0.425, 2.06, 0.245)
      bezel.push(jamb)
    }
    for (const sy of [-1, 1] as const) {
      const lintel = bevelBox(0.78, 0.1, 0.19, 0.01)
      lintel.translate(0, 2.06 + sy * 0.29, 0.245)
      bezel.push(lintel)
    }
    emit('deck', place(mergeParts(bezel, 'indicator-bezel')), deck, 'indicator-bezel', plateSteel)

    // Matte black reveal lining that cavity, set just inboard of the frame and flush to the readout edge.
    // Bright frame walls carried light the full depth of the recess and read as a thick bright surround;
    // a black lining is what makes the same depth read as depth.
    const reveal: BufferGeometry[] = []
    for (const sx of [-1, 1] as const) {
      const wall = bevelBox(0.03, 0.54, 0.17, 0.004)
      wall.translate(sx * 0.375, 2.06, 0.235)
      reveal.push(wall)
    }
    const soffit = bevelBox(0.75, 0.03, 0.17, 0.004)
    soffit.translate(0, 2.285, 0.235)
    reveal.push(soffit)
    emit('deck', place(mergeParts(reveal, 'indicator-reveal')), deck, 'indicator-reveal', cavity)

    // The floor of the cavity is left a value above the void that lines the rest of it. Lit from above it
    // returns a shelf of light under the readout, and a shelf of light behind the frame plane is the cue
    // that states the depth from the front, where the reveal walls themselves are edge-on.
    const sill = bevelBox(0.75, 0.03, 0.17, 0.004)
    sill.translate(0, 1.835, 0.235)
    emit('deck', place(sill), deck, 'indicator-sill', paint)

    const visor: BufferGeometry[] = []
    // The hood plate overhangs the deeper bezel front by 80 mm, so it shades the mouth of the cavity
    // instead of capping the frame.
    const hood = bevelBox(1.06, 0.065, 0.48, 0.014)
    hood.rotateX(HOOD_RAKE)
    hood.translate(0, 2.52, 0.2)
    visor.push(hood)
    // Riser bridging the head crown to the raked hood, so the hood overhangs instead of floating.
    const brow = bevelBox(1.0, 0.26, 0.12, 0.012)
    brow.translate(0, 2.49, -0.02)
    visor.push(brow)
    for (const sx of [-1, 1] as const) {
      // Side fins raked with the hood and outboard of the bezel, so the frame stays legible between them.
      const fin = bevelBox(0.05, 0.34, 0.52, 0.008)
      fin.rotateX(HOOD_RAKE)
      fin.translate(sx * 0.485, 2.3, 0.19)
      visor.push(fin)
    }
    const kickplate = bevelBox(0.54, 0.12, 0.4, 0.01)
    kickplate.translate(0, 0.13, 0)
    visor.push(kickplate)
    emit('deck', place(mergeParts(visor, 'indicator-hood')), deck, 'indicator-hood', kit.ink)

    // The black panel fills the whole frame opening and the readout is smaller than it, so a matte border
    // surrounds the lit area on every side. A readout cut to the opening met the bright frame edge to edge
    // and closed the cavity back up.
    const back = bevelBox(0.79, 0.49, 0.05, 0.006)
    back.translate(0, 2.06, 0.128)
    emit('display', place(back), display, 'back', cavity)

    const face = new PlaneGeometry(0.62, 0.34)
    face.translate(0, 2.06, 0.153 + LAYER_CLEARANCE)
    place(face)
    if (ownsDisplay) {
      const tex = fasciaTexture({
        number: '798', legend: 'KG', paper: [4, 7, 10], ink: [190, 255, 24], accent: [10, 18, 15],
      })
      textures.push(tex)
      // The glow is mapped, not uniform. A flat emissive term lit the dead screen as brightly as the
      // glyphs, which erased the digits and turned the readout into a green tile at any distance — and a
      // uniformly lit panel cannot read as sunk into a cavity.
      const mat = new MeshStandardMaterial({
        name: 'f1-kit / weigh display',
        map: tex,
        color: TOKEN.INK_950,
        roughness: 0.4,
        metalness: 0.05,
        emissive: TOKEN.PAPER_000,
        emissiveMap: tex,
        emissiveIntensity: 1.1,
        toneMapped: false,
      })
      extras.push(mat)
      emit('display', face, display, 'face', mat)
    } else {
      emit('display', face, display, 'face')
    }
  }

  const rebuild = (): void => {
    releaseGenerated()
    const w = config.width
    buildPan(w)
    buildTracks(w)
    buildPlateHardware(w)
    buildRamps(w)
    buildRails(w)
    buildIndicator(w)
  }
  rebuild()

  return {
    root,
    parts: { deck, ramp, display },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.width !== undefined) config.width = Math.max(2, patch.width)
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      disposeF1Materials(bundle)
      for (const material of finishes) material.dispose()
      finishes.length = 0
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0.3, 0.5, 0],
    distance: 14.6,
    fov: 32,
    yaw: -0.85,
    pitch: 0.3,
    ground: true,
  })
}
