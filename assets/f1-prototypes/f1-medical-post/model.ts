// f1-medical-post — a trackside medical centre: a 4.3 x 2.7 m clinic cabin on a
// transport chassis, clad in proud white panels that leave the door and the
// treatment-room window standing in real 85 mm reveals, a deep canopied entry
// bay over a stretcher ramp, a rooftop condenser and flue deck riding clear of
// the parapet, and a backlit cross sign breaking the roofline that every other
// red mark here is sized to defer to. Not a flat white cabinet.

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
  LAYER_CLEARANCE,
  TOKEN,
  acquireF1Materials,
  bevelBox,
  bevelDisc,
  bevelPrism,
  bevelRing,
  createF1Preview,
  disposeF1Materials,
  groundPad,
  marshalPlateTexture,
  member,
  mergeParts,
  shade,
  tubeSection,
} from '../f1-kit-core/index.ts'

type Slot = 'hut' | 'cross' | 'plate'

export interface F1MedicalPostConfig {
  number: string
}

export interface F1MedicalPostOptions extends Partial<F1MedicalPostConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1MedicalPostInstance {
  readonly root: Group
  readonly parts: { hut: Group; cross: Group; plate: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1MedicalPostConfig>
  configure(patch: Partial<F1MedicalPostConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1MedicalPostConfig = { number: 'M1' }

const W = 4.3
const D = 2.7
const H = 2.85
const HW = W / 2
const HD = D / 2

const PAD_H = 0.08
const CHASSIS_H = 0.13
/** Deck level: the cabin floor, one chassis and one foot pad above the tarmac. */
const BASE = PAD_H + CHASSIS_H
const TOP = BASE + H

/** Cladding thickness. This, less the embed, is the depth every opening reveals. */
const CLAD = 0.1
const CLAD_EMBED = 0.015
/** Outer face of the front cladding. Applied detail measures from here. */
const FRONT = HD + CLAD - CLAD_EMBED
/** Outer face of a flank cladding sheet. */
const FLANK = HW + CLAD - CLAD_EMBED

const DOOR_X0 = -1.95
const DOOR_X1 = -0.75
const DOOR_TOP = BASE + 2.1
const DOOR_MID = (DOOR_X0 + DOOR_X1) / 2

const WIN_X0 = 0.15
const WIN_X1 = 1.95
const WIN_Y0 = BASE + 1.15
const WIN_Y1 = BASE + 2.0
const WIN_MID = (WIN_X0 + WIN_X1) / 2
const WIN_MIDY = (WIN_Y0 + WIN_Y1) / 2

/** Top of the roof slab, where the plant deck sits. */
const ROOF = TOP + 0.185
/** Top of the parapet coping. Plant has to clear this to be seen at all. */
const COPING = ROOF + 0.2
/** Panel joint width between cladding sheets on the blind faces. */
const JOINT = 0.05

/**
 * The entry bay. A stretcher trolley has to stand clear of the weather with a
 * crew working both sides of it, so the canopy is sized off that footprint
 * rather than off the door leaf — a shallow visor over a doorstep reads as a
 * porch on a site cabin, not as an ambulance arrival.
 */
const CANOPY_W = 1.9
const CANOPY_D = 1.52
const CANOPY_T = 0.22
const CANOPY_Y = 2.62
/**
 * Nudged off the door centreline so the outer edge lands over the corner post
 * instead of cantilevering past the building line.
 */
const CANOPY_X = DOOR_MID + 0.1
const CANOPY_Z0 = HD + 0.02
const CANOPY_Z1 = CANOPY_Z0 + CANOPY_D

/** Ramp track, wide enough for a trolley and its handler either side. */
const RAMP_W = 1.66
const RAMP_RUN = 1.24
const LANDING_D = 0.78
const RAMP_Z0 = HD + LANDING_D

function sanitizeNumber(value: string): string {
  const next = value.replace(/[^0-9A-Za-z]/g, '').slice(0, 3).toUpperCase()
  return next || 'M1'
}

/** A cross authored in XY about the origin, measured across its full span. */
function crossBars(span: number, thickness: number, depth: number): BufferGeometry[] {
  return [
    bevelBox(thickness, span, depth, 0.006),
    bevelBox(span, thickness, depth, 0.006),
  ]
}

/**
 * The ramp's side profile: a wedge falling `rise` over {@link RAMP_RUN}, high
 * end first. Extruded across the ramp for the deck and again, narrow, for the
 * kerb that stands proud of it.
 */
function rampWedge(rise: number): ReadonlyArray<readonly [number, number]> {
  return [
    [-RAMP_RUN / 2, -BASE / 2],
    [RAMP_RUN / 2, -BASE / 2],
    [-RAMP_RUN / 2, -BASE / 2 + rise],
  ]
}

export function createModel(options: F1MedicalPostOptions = {}): F1MedicalPostInstance {
  const config: F1MedicalPostConfig = {
    number: sanitizeNumber(options.number ?? defaults.number),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials
  const textures: DataTexture[] = []
  // The core box is only ever seen down the door and window reveals, so it is a
  // shadowed value of the same coat rather than more bright shell. That step is
  // what makes an opening read as depth instead of as a decal.
  const revealMat = new MeshStandardMaterial({
    name: 'f1-kit / medical reveal',
    color: shade(TOKEN.SHELL_200, -0.36),
    roughness: 0.82,
    metalness: 0.0,
  })
  const glassMat = new MeshStandardMaterial({
    name: 'f1-kit / medical glazing',
    color: 0x0a1219,
    roughness: 0.14,
    metalness: 0.5,
  })
  // The roof sign is a backlit box, and these two materials split that job to
  // suit how the capture rig blooms: only the emissive buffer feeds the bloom
  // pyramid, and it is thresholded on *luminance* before a strength of 2 lands.
  //
  // The two intensities therefore sit on opposite sides of that threshold, and
  // are not comparable numbers. Near-white emission carries almost all of its
  // value into luminance, so the face is held low to stay under it: it lifts off
  // the cladding as a panel lit from within but sheds no halo, because a white
  // face over the threshold floods the whole roofline and — since that glow
  // wraps the cross from every side — leaves the cross reading as a dark hole
  // punched in a lamp. Red carries under half its value into luminance, so the
  // cross needs a far larger number to clear the same threshold, and what
  // escapes the sign is then the colour of the thing it announces.
  const signBoxMat = new MeshStandardMaterial({
    name: 'f1-kit / medical sign lightbox',
    color: TOKEN.SHELL_050,
    emissive: TOKEN.SHELL_050,
    emissiveIntensity: 0.09,
    roughness: 0.34,
    metalness: 0.0,
  })
  const signCrossMat = new MeshStandardMaterial({
    name: 'f1-kit / medical sign cross',
    color: TOKEN.RED_500,
    emissive: TOKEN.RED_500,
    emissiveIntensity: 0.5,
    roughness: 0.38,
    metalness: 0.0,
  })
  /** Lives as long as the model does; freed once, in `dispose`. */
  const persistent: Material[] = [revealMat, glassMat, signBoxMat, signCrossMat]
  /** Re-derived on every rebuild, because the plate carries configuration. */
  const perRebuild: Material[] = []
  let disposed = false

  const ownsPlate = options.materials?.plate === undefined
  const materialSlots: Record<Slot, Material> = {
    hut: options.materials?.hut ?? kit.shell,
    cross: options.materials?.cross ?? kit.red,
    plate: options.materials?.plate ?? kit.shell,
  }

  const root = new Group(); root.name = 'f1-medical-post'
  const hut = new Group(); hut.name = 'hut'
  const cross = new Group(); cross.name = 'cross'
  const plate = new Group(); plate.name = 'plate'
  root.add(hut, cross, plate)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { hut: [], cross: [], plate: [] }

  const releaseGenerated = (): void => {
    hut.clear(); cross.clear(); plate.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
    for (const texture of textures) texture.dispose()
    textures.length = 0
    for (const material of perRebuild) material.dispose()
    perRebuild.length = 0
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

    const shell: BufferGeometry[] = []      // cladding, parapet, canopy slab
    const core: BufferGeometry[] = []       // the box behind the cladding
    const structure: BufferGeometry[] = []  // chassis, posts, eave, sills, ramp
    const trim: BufferGeometry[] = []       // opening frames, plant housings
    const metal: BufferGeometry[] = []      // pipework, braces, rails, ironmongery
    const dark: BufferGeometry[] = []       // roof deck, grilles, canopy soffit
    const glass: BufferGeometry[] = []
    const leaves: BufferGeometry[] = []
    const badge: BufferGeometry[] = []      // the secondary painted crosses
    const lightbox: BufferGeometry[] = []   // the backlit face of the roof sign
    const signCross: BufferGeometry[] = []  // the lit cross carried on that face

    // --- chassis and deck --------------------------------------------------
    const pads: BufferGeometry[] = []
    for (const x of [-HW + 0.42, 0, HW - 0.42]) {
      for (const z of [-(HD - 0.36), HD - 0.36]) {
        pads.push(groundPad([0.38, 0.38], [x, 0, z], PAD_H))
      }
    }
    structure.push(mergeParts(pads, 'f1-medical-post: pads'))
    structure.push(bevelBox(W - 0.06, CHASSIS_H, D - 0.06, 0.012)
      .translate(0, PAD_H + CHASSIS_H / 2, 0))
    core.push(bevelBox(W, H, D, 0.016).translate(0, BASE + H / 2, 0))

    // --- front cladding: every sheet except the two openings ---------------
    // What these sheets leave out is the model's only source of real opening
    // depth, so both openings are cut here rather than faked later with a dark
    // plate laid on a flush wall.
    const frontSheet = (x0: number, x1: number, y0: number, y1: number): void => {
      shell.push(bevelBox(x1 - x0, y1 - y0, CLAD, 0.012)
        .translate((x0 + x1) / 2, (y0 + y1) / 2, HD + CLAD / 2 - CLAD_EMBED))
    }
    frontSheet(-HW, DOOR_X0, BASE, TOP)
    frontSheet(DOOR_X1, WIN_X0, BASE, TOP)
    frontSheet(WIN_X1, HW, BASE, TOP)
    frontSheet(DOOR_X0, DOOR_X1, DOOR_TOP, TOP)
    frontSheet(WIN_X0, WIN_X1, WIN_Y1, TOP)
    frontSheet(WIN_X0, WIN_X1, BASE, WIN_Y0)

    // --- blind faces: jointed cladding sheets ------------------------------
    const backCount = 5
    const backW = (W - JOINT * (backCount - 1)) / backCount
    for (let i = 0; i < backCount; i++) {
      shell.push(bevelBox(backW, H, CLAD, 0.012)
        .translate(-HW + backW / 2 + i * (backW + JOINT), BASE + H / 2, -(HD + CLAD / 2 - CLAD_EMBED)))
    }
    const flankCount = 3
    const flankD = (D - JOINT * (flankCount - 1)) / flankCount
    for (const sx of [-1, 1] as const) {
      for (let i = 0; i < flankCount; i++) {
        shell.push(bevelBox(CLAD, H, flankD, 0.012)
          .translate(sx * (HW + CLAD / 2 - CLAD_EMBED), BASE + H / 2,
            -HD + flankD / 2 + i * (flankD + JOINT)))
      }
    }

    // --- corner posts, eave, parapet ---------------------------------------
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        structure.push(bevelBox(0.2, H + 0.02, 0.2, 0.012)
          .translate(sx * (HW + 0.02), BASE + H / 2, sz * (HD + 0.02)))
      }
    }
    structure.push(bevelBox(W + 0.44, 0.16, D + 0.44, 0.018).translate(0, TOP + 0.08, 0))
    dark.push(bevelBox(W + 0.06, 0.05, D + 0.06, 0.008).translate(0, ROOF - 0.025, 0))
    for (const sz of [-1, 1] as const) {
      shell.push(bevelBox(W + 0.3, 0.2, 0.11, 0.01).translate(0, ROOF + 0.1, sz * (HD + 0.145)))
    }
    for (const sx of [-1, 1] as const) {
      shell.push(bevelBox(0.11, 0.2, D + 0.3, 0.01).translate(sx * (HW + 0.145), ROOF + 0.1, 0))
    }

    // --- roof plant. The condenser sits on +X and the flues on -X so the
    // --- roofline is asymmetric from any approach, and everything rides a stub
    // --- plinth because the coping swallows anything sat flat on the deck.
    //
    // Every housing here is held under the sign's shoulder. A condenser that
    // reaches sign height turns the roofline into two competing blocks, and
    // near-black louvres on a white cabin pull harder than the sign does — so
    // the blades are graphite against a slate housing rather than ink, and
    // there are fewer of them spread over less area.
    const acX = 1.2
    const acZ = -0.42
    const acBot = COPING - 0.04
    const acH = 0.44
    const acTop = acBot + acH
    trim.push(bevelBox(0.92, acH, 0.7, 0.016).translate(acX, acBot + acH / 2, acZ))
    for (const dz of [-0.26, 0.26] as const) {
      structure.push(bevelBox(0.84, acBot - ROOF, 0.12, 0.008)
        .translate(acX, (ROOF + acBot) / 2, acZ + dz))
    }
    for (let i = 0; i < 3; i++) {
      structure.push(bevelBox(0.74, 0.06, 0.04, 0.005)
        .translate(acX, acBot + 0.12 + i * 0.12, acZ + 0.37))
    }
    dark.push(bevelDisc(0.17, 0.03, 0.004).rotateX(-Math.PI / 2).translate(acX, acTop - 0.01, acZ))
    dark.push(bevelRing(0.16, 0.27, 0.05, 0.008).rotateX(-Math.PI / 2)
      .translate(acX, acTop + 0.015, acZ))
    metal.push(bevelDisc(0.075, 0.05, 0.006).rotateX(-Math.PI / 2).translate(acX, acTop + 0.03, acZ))

    trim.push(bevelBox(0.46, 0.36, 0.46, 0.012).translate(-0.5, COPING + 0.13, -0.34))
    for (let i = 0; i < 3; i++) {
      structure.push(bevelBox(0.32, 0.055, 0.04, 0.005)
        .translate(-0.5, COPING + 0.02 + i * 0.105, -0.09))
    }
    metal.push(tubeSection(0.085, 0.6, [-1.62, ROOF + 0.3, -0.72], AXIS_Y, 14))
    structure.push(bevelBox(0.26, 0.05, 0.26, 0.008).translate(-1.62, ROOF + 0.625, -0.72))
    metal.push(tubeSection(0.055, 0.46, [-1.28, ROOF + 0.23, -1.0], AXIS_Y, 12))
    structure.push(bevelBox(2.3, 0.08, 0.16, 0.008).translate(-0.2, ROOF + 0.06, -0.95))

    // --- entry: reveal frame, double leaves ---------------------------------
    const jambZ = HD + 0.045
    for (const x of [DOOR_X0 + 0.035, DOOR_X1 - 0.035]) {
      trim.push(bevelBox(0.07, 2.1, 0.09, 0.006).translate(x, BASE + 1.05, jambZ))
    }
    trim.push(bevelBox(DOOR_X1 - DOOR_X0, 0.08, 0.09, 0.006)
      .translate(DOOR_MID, DOOR_TOP - 0.04, jambZ))
    for (const dx of [-0.27, 0.27] as const) {
      leaves.push(bevelBox(0.52, 2.02, 0.06, 0.008).translate(DOOR_MID + dx, BASE + 1.02, HD - 0.01))
      glass.push(bevelBox(0.34, 0.6, 0.03, 0.004)
        .translate(DOOR_MID + dx, 1.85, HD + 0.035 - LAYER_CLEARANCE))
    }
    for (const dx of [-0.17, 0.17] as const) {
      metal.push(bevelBox(0.4, 0.05, 0.06, 0.006).translate(DOOR_MID + dx, 1.05, HD + 0.05))
    }

    // --- the canopy: a 1.5 m deep bay, boxed out rather than a flat plate ---
    // A thicker slab on its own is still a plate at distance. The mass comes
    // instead from a downstand beam turned along three sides, an upstand on the
    // front edge, and a soffit recessed inside all of it: the shadowed void that
    // leaves is what makes the entry read as sheltered depth.
    const canopyMidZ = CANOPY_Z0 + CANOPY_D / 2
    shell.push(bevelBox(CANOPY_W, CANOPY_T, CANOPY_D, 0.016)
      .translate(CANOPY_X, CANOPY_Y, canopyMidZ))
    dark.push(bevelBox(CANOPY_W - 0.3, 0.04, CANOPY_D - 0.22, 0.008)
      .translate(CANOPY_X, CANOPY_Y - CANOPY_T / 2 - 0.02, canopyMidZ - 0.03))
    structure.push(bevelBox(CANOPY_W, 0.34, 0.16, 0.012)
      .translate(CANOPY_X, CANOPY_Y - 0.09, CANOPY_Z1 - 0.06))
    shell.push(bevelBox(CANOPY_W, 0.08, 0.12, 0.01)
      .translate(CANOPY_X, CANOPY_Y + CANOPY_T / 2 + 0.03, CANOPY_Z1 - 0.06))
    for (const sx of [-1, 1] as const) {
      structure.push(bevelBox(0.14, 0.28, CANOPY_D - 0.14, 0.012)
        .translate(CANOPY_X + sx * (CANOPY_W / 2 - 0.07), CANOPY_Y - 0.06, canopyMidZ - 0.07))
    }
    // Knee braces under the slab, not stays over it. On the piers either side of
    // the door they stay inside the soffit shadow instead of crossing the sign,
    // which is the one part of this elevation that has to stay clear.
    for (const sx of [-1, 1] as const) {
      const braceX = CANOPY_X + sx * 0.78
      metal.push(member(
        new Vector3(braceX, 2.04, FRONT - 0.01),
        new Vector3(braceX, CANOPY_Y - CANOPY_T / 2 - 0.03, CANOPY_Z0 + 0.56),
        0.042, 8,
      ))
      structure.push(bevelBox(0.15, 0.13, 0.1, 0.008).translate(braceX, 2.02, FRONT + 0.04))
    }
    structure.push(bevelBox(0.3, 0.11, 0.14, 0.008).translate(DOOR_MID, 2.38, FRONT + 0.055))
    metal.push(bevelBox(0.24, 0.02, 0.11, 0.004).translate(DOOR_MID, 2.315, FRONT + 0.055))

    // --- stretcher approach: landing, ramp, kerbs, handrails ----------------
    // Widened to the trolley track and lengthened to a gradient a crew can
    // actually push a loaded stretcher up, with a kerb down each edge. The
    // landing runs the full width of the bay so the approach and the canopy
    // above it read as one piece of arrival infrastructure.
    structure.push(bevelBox(1.72, BASE, LANDING_D, 0.012)
      .translate(DOOR_MID, BASE / 2, HD + LANDING_D / 2))
    structure.push(bevelPrism(rampWedge(BASE), RAMP_W, 0.01)
      .rotateY(-Math.PI / 2).translate(DOOR_MID, BASE / 2, RAMP_Z0 + RAMP_RUN / 2))
    for (const sx of [-1, 1] as const) {
      structure.push(bevelPrism(rampWedge(BASE + 0.07), 0.1, 0.008)
        .rotateY(-Math.PI / 2)
        .translate(DOOR_MID + sx * (RAMP_W / 2 - 0.05), BASE / 2, RAMP_Z0 + RAMP_RUN / 2))
    }
    for (const sx of [-1, 1] as const) {
      const rx = DOOR_MID + sx * (RAMP_W / 2 - 0.04)
      metal.push(member(new Vector3(rx, 0.1, 2.26), new Vector3(rx, 1.18, 2.26), 0.028, 8))
      metal.push(member(new Vector3(rx, 0.01, 3.28), new Vector3(rx, 0.94, 3.28), 0.028, 8))
      metal.push(member(new Vector3(rx, 1.18, 2.26), new Vector3(rx, 0.94, 3.28), 0.032, 8))
      metal.push(member(new Vector3(rx, 0.92, 2.26), new Vector3(rx, 0.68, 3.28), 0.026, 8))
      metal.push(member(new Vector3(rx, 1.18, 2.26), new Vector3(rx, 1.18, 1.43), 0.032, 8))
    }

    // --- treatment-room window ---------------------------------------------
    const winH = WIN_Y1 - WIN_Y0
    const winW = WIN_X1 - WIN_X0
    for (const x of [WIN_X0 + 0.03, WIN_X1 - 0.03]) {
      trim.push(bevelBox(0.06, winH, 0.09, 0.006).translate(x, WIN_MIDY, jambZ))
    }
    for (const y of [WIN_Y0 + 0.03, WIN_Y1 - 0.03]) {
      trim.push(bevelBox(winW, 0.06, 0.09, 0.006).translate(WIN_MID, y, jambZ))
    }
    glass.push(bevelBox(winW - 0.1, winH - 0.1, 0.05, 0.006)
      .translate(WIN_MID, WIN_MIDY, HD + 0.03))
    shell.push(bevelBox(0.08, winH - 0.12, 0.1, 0.008).translate(WIN_MID, WIN_MIDY, HD + 0.05))
    structure.push(bevelBox(winW + 0.14, 0.09, 0.24, 0.012)
      .translate(WIN_MID, WIN_Y0 - 0.045, HD + 0.1))

    // --- spandrel intake grille under the window ---------------------------
    const grilleY = 0.82
    for (const dy of [-0.38, 0.38] as const) {
      structure.push(bevelBox(1.26, 0.06, 0.05, 0.005)
        .translate(WIN_MID, grilleY + dy, FRONT + 0.019))
    }
    for (const dx of [-0.6, 0.6] as const) {
      structure.push(bevelBox(0.06, 0.82, 0.05, 0.005)
        .translate(WIN_MID + dx, grilleY, FRONT + 0.019))
    }
    for (let i = 0; i < 5; i++) {
      dark.push(bevelBox(1.1, 0.07, 0.035, 0.005)
        .translate(WIN_MID, grilleY - 0.3 + i * 0.15, FRONT + 0.012))
    }

    // --- first-aid cabinet on the pier between the openings ----------------
    // A dark box here reads as switchgear; a white door with its own cross
    // reads as medical kit at the height a marshal reaches for it.
    structure.push(bevelBox(0.56, 0.66, 0.14, 0.012).translate(-0.3, 1.02, FRONT + 0.055))
    shell.push(bevelBox(0.46, 0.56, 0.05, 0.008).translate(-0.3, 1.02, FRONT + 0.144))
    for (const bar of crossBars(0.22, 0.07, 0.028)) {
      badge.push(bar.translate(-0.3, 1.02, FRONT + 0.181))
    }
    metal.push(bevelBox(0.04, 0.12, 0.05, 0.004).translate(-0.11, 1.02, FRONT + 0.19))

    // --- rainwater downpipe, run on the -X flank clear of the canopy --------
    metal.push(tubeSection(0.055, 2.95, [-(FLANK + 0.055), 1.525, -0.95], AXIS_Y, 12))
    structure.push(bevelBox(0.2, 0.14, 0.2, 0.008).translate(-(FLANK + 0.055), 2.98, -0.95))
    for (const y of [1.1, 2.4] as const) {
      structure.push(bevelBox(0.16, 0.06, 0.1, 0.005).translate(-(FLANK + 0.025), y, -0.95))
    }

    // --- the landmark: a backlit cross sign breaking the roofline -----------
    // This is the only cross on the model that is lit, the only one standing
    // proud of its ground, and at roughly twice the span of the next largest it
    // is the only one that survives at silhouette distance.
    const signX = DOOR_MID + 0.05
    const signY = 3.55
    structure.push(bevelBox(1.54, 1.4, 0.1, 0.012).translate(signX, signY, FRONT + 0.11))
    lightbox.push(bevelBox(1.36, 1.22, 0.12, 0.012).translate(signX, signY, FRONT + 0.17))
    // The legs bridge the canopy slab to the sign base, so the sign is carried
    // by the entry bay rather than floating above it.
    for (const dx of [-0.57, 0.57] as const) {
      metal.push(bevelBox(0.11, 0.22, 0.13, 0.008).translate(signX + dx, 2.8, FRONT + 0.045))
    }
    for (const bar of crossBars(0.96, 0.3, 0.07)) {
      signCross.push(bar.translate(signX, signY, FRONT + 0.26))
    }

    // --- secondary crosses: front wall over the window, and the -X flank ----
    // Painted flat and held to about half the sign's span. At their previous
    // size these read as three roughly equal marks, which flattened the
    // hierarchy the roof sign is supposed to lead.
    for (const bar of crossBars(0.42, 0.13, 0.028)) {
      badge.push(bar.translate(WIN_MID, 2.6, FRONT + 0.011))
    }
    for (const bar of crossBars(0.46, 0.14, 0.028)) {
      badge.push(bar.rotateY(Math.PI / 2).translate(-(FLANK + 0.011), 1.95, 0))
    }

    // --- post identification plate -----------------------------------------
    structure.push(bevelBox(0.6, 0.4, 0.05, 0.006).translate(-0.3, 1.9, FRONT + 0.019))
    const face = new PlaneGeometry(0.54, 0.34)
    face.translate(-0.3, 1.9, FRONT + 0.044 + LAYER_CLEARANCE)

    emit('hut', mergeParts(shell, 'f1-medical-post: cladding'), hut, 'cladding')
    emit('hut', mergeParts(core, 'f1-medical-post: core'), hut, 'core', revealMat)
    emit('hut', mergeParts(structure, 'f1-medical-post: structure'), hut, 'structure', kit.graphite)
    emit('hut', mergeParts(trim, 'f1-medical-post: trim'), hut, 'trim', kit.slate)
    emit('hut', mergeParts(metal, 'f1-medical-post: metalwork'), hut, 'metalwork', kit.steel)
    emit('hut', mergeParts(dark, 'f1-medical-post: louvres'), hut, 'louvres', kit.ink)
    emit('hut', mergeParts(glass, 'f1-medical-post: glazing'), hut, 'glazing', glassMat)
    emit('hut', mergeParts(lightbox, 'f1-medical-post: sign lightbox'), hut, 'sign-lightbox', signBoxMat)
    emit('hut', mergeParts(leaves, 'f1-medical-post: door'), hut, 'door')
    emit('cross', mergeParts(badge, 'f1-medical-post: crosses'), cross, 'cross')
    emit('cross', mergeParts(signCross, 'f1-medical-post: sign cross'), cross, 'sign-cross', signCrossMat)

    if (ownsPlate) {
      const texture = marshalPlateTexture(config.number)
      textures.push(texture)
      const material = new MeshStandardMaterial({
        name: 'f1-kit / medical plate',
        map: texture,
        roughness: 0.55,
        metalness: 0.05,
      })
      perRebuild.push(material)
      emit('plate', face, plate, 'face', material)
    } else {
      emit('plate', face, plate, 'face')
    }
  }
  rebuild()

  return {
    root,
    parts: { hut, cross, plate },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.number !== undefined) config.number = sanitizeNumber(patch.number)
      rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      if (disposed) return
      disposed = true
      releaseGenerated()
      for (const material of persistent) material.dispose()
      persistent.length = 0
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel({ number: 'M1' }), {
    aspect,
    target: [0, 1.85, 0.1],
    distance: 14.5,
    fov: 28,
    yaw: -0.68,
    pitch: 0.17,
    ground: true,
    bloom: true,
  })
}
