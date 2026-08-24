// f1-generator-cabin — a containerised trackside genset: heavy corner castings and a
// perimeter rail frame around ribbed amber skin, a deeply recessed intake louvre bank,
// a double access door under a drip hood, a radiator fan guard sunk into the cool end,
// and a lagged stack rising off a saddled roof silencer. Not a flat amber shipping box.

import { BufferGeometry, Group, Mesh, MeshStandardMaterial, Vector3, type Material } from 'three/webgpu'

import {
  acquireF1Materials,
  bevelBlade,
  bevelBox,
  bevelDisc,
  bevelRing,
  boltRun,
  createF1Preview,
  disposeF1Materials,
  member,
  mergeParts,
  shade,
  tubeSection,
  AXIS_X,
  AXIS_Y,
  FACE_CLEARANCE,
  TOKEN,
} from '../f1-kit-core/index.ts'

type Slot = 'shell' | 'skid'

export interface F1GeneratorCabinConfig {
  length: number
}

export interface F1GeneratorCabinOptions extends Partial<F1GeneratorCabinConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface F1GeneratorCabinInstance {
  readonly root: Group
  readonly parts: { shell: Group; skid: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<F1GeneratorCabinConfig>
  configure(patch: Partial<F1GeneratorCabinConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: F1GeneratorCabinConfig = { length: 3.6 }
const W = 1.55
const H = 2.05

/** Skid rail height. The body sits on top of it, so nothing touches the ground but steel. */
const SKID_H = 0.17
/**
 * How far every opening sits behind the wall skin.
 *
 * This is what makes the enclosure read as sheet metal over a frame rather than as a decal on a box:
 * the louvre bank, the door leaves and the fan guard all live inside this depth, so the skin's cut edge
 * casts across them.
 */
const RECESS = 0.11
/** Wall skin thickness. Deeper than the recess, so a plate is always embedded in the core (rule 8). */
const SKIN = 0.13
/** Corner castings. Proud of the skin by 0.02, which is what carries the frame read. */
const FRAME = 0.16
/** Perimeter rail section: 0.17 deep in Y, 0.15 through the wall. */
const RAIL_H = 0.17
const RAIL_T = 0.15
/**
 * How far the cool end is hollowed out behind the discharge opening.
 *
 * The rest of the prop sits its openings inside `RECESS`, which is enough for a louvre blade but not for
 * a radiator: at 0.11 the guard lands within a blade's width of the skin and reads as a wheel painted on
 * a dark square. Half a metre of bay is what lets the guard hang in front of a fan rather than on it.
 */
const FAN_BAY = 0.52

export function createModel(options: F1GeneratorCabinOptions = {}): F1GeneratorCabinInstance {
  const config: F1GeneratorCabinConfig = {
    length: Math.max(2, options.length ?? defaults.length),
  }

  const bundle = acquireF1Materials()
  const kit = bundle.materials

  // Finishes this prop owns outright. The kit bundle is shared across the whole wave, so retuning
  // `amber` or `slate` here would drag every other prop with it; these are authored and disposed
  // locally instead (rule 16). What they buy is separation: a genset is sprayed sheet metal bolted
  // around machinery, and one gloss across the paint, the drum and the skid flattens all three into
  // the same moulded plastic.
  const extras: Material[] = []
  const own = <T extends Material>(material: T): T => {
    extras.push(material)
    return material
  }
  const finish = {
    /** Sprayed enclosure paint: high-vis mustard with the sheen taken out of it. */
    paint: own(new MeshStandardMaterial({
      name: 'f1-kit / genset enclosure paint', color: TOKEN.AMBER_400, roughness: 0.88, metalness: 0.02,
    })),
    /** Door leaves, one value step down, so the access pair separates from the field it is cut from. */
    door: own(new MeshStandardMaterial({
      name: 'f1-kit / genset door paint', color: shade(TOKEN.AMBER_400, -0.17), roughness: 0.8, metalness: 0.05,
    })),
    /** Painted structural steel: still the frame's navy, but a coat rather than a shell. */
    steelwork: own(new MeshStandardMaterial({
      name: 'f1-kit / genset steelwork', color: TOKEN.GRAPHITE_800, roughness: 0.74, metalness: 0.35,
    })),
    /** Galvanised roof deck. */
    deck: own(new MeshStandardMaterial({
      name: 'f1-kit / genset deck', color: shade(TOKEN.SLATE_650, 0.12), roughness: 0.68, metalness: 0.7,
    })),
    /** Louvre blades: slate's value, so the intake keeps the read it already has, without the gloss. */
    blade: own(new MeshStandardMaterial({
      name: 'f1-kit / genset louvre blade', color: TOKEN.SLATE_650, roughness: 0.66, metalness: 0.6,
    })),
    /** Cooler machined metal: the silencer drum, the fan hub, the cubicle fascia. */
    mech: own(new MeshStandardMaterial({
      name: 'f1-kit / genset mech', color: shade(TOKEN.SHELL_200, -0.3), roughness: 0.36, metalness: 0.95,
    })),
    /** Fan guard wire and blades — crisp enough to catch a rim light inside an otherwise black bay. */
    guard: own(new MeshStandardMaterial({
      name: 'f1-kit / genset fan guard', color: shade(TOKEN.SLATE_650, 0.1), roughness: 0.46, metalness: 0.82,
    })),
    /** Lagged stack: soot-dulled, so it never competes with the bare drum it stands on. */
    flue: own(new MeshStandardMaterial({
      name: 'f1-kit / genset flue', color: shade(TOKEN.SLATE_650, -0.18), roughness: 0.82, metalness: 0.45,
    })),
    /** Skid steel: the one surface that lives on the ground, and the only one allowed to look it. */
    skid: own(new MeshStandardMaterial({
      name: 'f1-kit / genset skid', color: shade(TOKEN.SLATE_650, -0.12), roughness: 0.8, metalness: 0.6,
    })),
  }

  const materialSlots: Record<Slot, Material> = {
    shell: options.materials?.shell ?? finish.paint,
    skid: options.materials?.skid ?? finish.skid,
  }

  const root = new Group(); root.name = 'f1-generator-cabin'
  const shell = new Group(); shell.name = 'shell'
  const skid = new Group(); skid.name = 'skid'
  root.add(shell, skid)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { shell: [], skid: [] }

  const releaseGenerated = (): void => {
    shell.clear(); skid.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
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
    const len = config.length
    const base = SKID_H
    const bodyTop = base + H
    const cy = base + H / 2
    const roofT = 0.08
    const roofY = bodyTop + roofT

    // The band of wall between the sill rail and the head rail. Every opening is laid out inside it.
    const sill = base + RAIL_H
    const head = bodyTop - RAIL_H
    const bandH = head - sill
    const bandY = (sill + head) / 2
    const skinZ = W / 2 - SKIN / 2

    const panel: BufferGeometry[] = []     // painted skin and pressed ribs
    const doors: BufferGeometry[] = []     // door leaves, painted a value below the skin
    const frame: BufferGeometry[] = []     // castings, rails, jambs, hoods, housings
    const sheet: BufferGeometry[] = []     // galvanised roof deck and its drip upstand
    const cavity: BufferGeometry[] = []    // unlit interiors seen through an opening
    const plant: BufferGeometry[] = []     // machined kit: silencer, hub, panel fascia
    const fan: BufferGeometry[] = []       // radiator guard wire and the blades behind it
    const hardware: BufferGeometry[] = []  // hinges, levers, straps, lifting eyes
    const lamps: BufferGeometry[] = []
    const louvers: BufferGeometry[] = []
    const exhaust: BufferGeometry[] = []
    const hazard: BufferGeometry[] = []
    const skidParts: BufferGeometry[] = []

    // --- core shell and the hollow cool end -------------------------------
    // Inset on all four sides so every skin plate has something dark behind it — except at the radiator
    // end, where the core stops `FAN_BAY` short and a collar takes over: four slabs with the discharge
    // opening between them, so the front, rear and roof skin over the bay is still backed while the
    // opening itself runs half a metre deep.
    const fanR = 0.44
    const fanY = bandY + 0.1
    const halfOpen = fanR + 0.06
    const bayFace = -len / 2
    const coreFront = bayFace + FAN_BAY
    const coreBack = len / 2 - RECESS
    frame.push(bevelBox(coreBack - coreFront, H, W - RECESS * 2, 0.02)
      .translate((coreFront + coreBack) / 2, cy, 0))

    const collarLen = FAN_BAY - RECESS
    const collarX = bayFace + RECESS + collarLen / 2
    const innerZ = W / 2 - RECESS
    const topGap = bodyTop - (fanY + halfOpen)
    const botGap = fanY - halfOpen - base
    frame.push(bevelBox(collarLen, topGap, innerZ * 2, 0.016)
      .translate(collarX, fanY + halfOpen + topGap / 2, 0))
    frame.push(bevelBox(collarLen, botGap, innerZ * 2, 0.016)
      .translate(collarX, base + botGap / 2, 0))
    const collarZ = innerZ - halfOpen
    for (const sz of [-1, 1] as const) {
      frame.push(bevelBox(collarLen, halfOpen * 2, collarZ, 0.016)
        .translate(collarX, fanY, sz * (halfOpen + collarZ / 2)))
    }

    // --- corner castings and perimeter rails ------------------------------
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        frame.push(bevelBox(FRAME, H, FRAME, 0.016)
          .translate(sx * (len / 2 - FRAME / 2 + 0.02), cy, sz * (W / 2 - FRAME / 2 + 0.02)))
      }
    }
    for (const y of [base + RAIL_H / 2, bodyTop - RAIL_H / 2] as const) {
      for (const sz of [-1, 1] as const) {
        frame.push(bevelBox(len - FRAME * 2 + 0.06, RAIL_H, RAIL_T, 0.014)
          .translate(0, y, sz * (W / 2 + 0.02 - RAIL_T / 2)))
      }
      for (const sx of [-1, 1] as const) {
        frame.push(bevelBox(RAIL_T, RAIL_H, W - FRAME * 2 + 0.06, 0.014)
          .translate(sx * (len / 2 + 0.02 - RAIL_T / 2), y, 0))
      }
    }

    // --- roof deck, drip edge and upstand ---------------------------------
    // Galvanised sheet rather than more painted frame: the roof is the largest single plane
    // at any raised camera, and in the frame's own value it collapses the whole prop to one mass.
    sheet.push(bevelBox(len + 0.14, roofT, W + 0.14, 0.012).translate(0, bodyTop + roofT / 2, 0))
    const upstand = 0.07
    for (const sz of [-1, 1] as const) {
      sheet.push(bevelBox(len + 0.14, 0.09, upstand, 0.008)
        .translate(0, roofY + 0.045, sz * (W / 2 + 0.07 - upstand / 2)))
    }
    for (const sx of [-1, 1] as const) {
      sheet.push(bevelBox(upstand, 0.09, W + 0.14 - upstand * 2, 0.008)
        .translate(sx * (len / 2 + 0.07 - upstand / 2), roofY + 0.045, 0))
    }

    // --- wall bay layout --------------------------------------------------
    // The clear run between the corner castings, split into an intake bay, a door bay and a
    // plant bay. Feature widths are world dimensions capped by the available run (rule 7), so
    // a longer cabin gains blank ribbed skin rather than a stretched door.
    const clear = len - (FRAME - 0.02) * 2
    const mull = 0.1
    const louvreW = Math.min(0.92, clear * 0.28)
    const doorW = Math.min(1.24, clear * 0.4)
    const plantW = Math.max(0.3, clear - louvreW - doorW - mull * 2)
    const x0 = -clear / 2
    const louvreX = x0 + louvreW / 2
    const doorX = x0 + louvreW + mull + doorW / 2
    const plantX = x0 + louvreW + mull * 2 + doorW + plantW / 2
    const mullX = [x0 + louvreW + mull / 2, x0 + louvreW + mull + doorW + mull / 2] as const

    for (const mx of mullX) {
      frame.push(bevelBox(mull, bandH, RAIL_T, 0.012).translate(mx, bandY, W / 2 + 0.02 - RAIL_T / 2))
    }

    /** Vertical pressed ribs across a blank stretch of skin, on the face at `sz * W / 2`. */
    const ribRun = (from: number, to: number, spanY: number, sz: 1 | -1): void => {
      const width = to - from
      if (width < 0.34 || spanY < 0.3) return
      const count = Math.max(1, Math.round(width / 0.3))
      const step = width / count
      for (let i = 0; i < count; i++) {
        panel.push(bevelBox(0.1, spanY - 0.05, 0.06, 0.012)
          .translate(from + step * (i + 0.5), bandY, sz * (W / 2 + 0.018)))
      }
    }

    // --- intake louvre bank (front, radiator end) -------------------------
    const kickH = 0.36
    panel.push(bevelBox(louvreW, kickH, SKIN, 0.012).translate(louvreX, sill + kickH / 2, skinZ))
    frame.push(bevelBox(louvreW + 0.06, 0.05, 0.2, 0.01).translate(louvreX, head + 0.02, W / 2 + 0.05))

    const openTop = head - 0.06
    const openBot = sill + kickH + 0.06
    const bladeCount = Math.max(3, Math.round((openTop - openBot) / 0.14))
    const bladeStep = (openTop - openBot) / Math.max(1, bladeCount - 1)
    // Blades tilt down-and-out and stay inside the reveal: 0.08 deep at 0.6 rad spans 0.097 in Z,
    // which fits the 0.11 recess with clearance off the core face.
    for (let i = 0; i < bladeCount; i++) {
      const blade = bevelBox(louvreW - 0.05, 0.055, 0.08, 0.006)
      blade.rotateX(-0.6)
      blade.translate(louvreX, openTop - bladeStep * i, W / 2 - 0.062)
      louvers.push(blade)
    }

    // --- double access door (front, centre) -------------------------------
    // The pair has to be *cut out of* the yellow field, not painted onto it. Four things do that, and
    // none of them is enough alone: a jamb standing 0.095 proud of the leaf face on all four sides, a
    // wide meeting stile splitting the two leaves, an unlit reveal plate showing through the 0.022 gap
    // around each leaf, and leaf paint a value below the skin.
    const doorH = Math.min(1.44, bandH - 0.2)
    const doorBase = sill + 0.06
    const doorTop = doorBase + doorH
    const jambT = 0.075
    const meet = 0.09
    const gap = 0.022
    const leafW = Math.max(0.16, (doorW - jambT * 2 - meet) / 2 - gap)
    const leafH = doorH - gap * 2
    const doorY = doorBase + doorH / 2
    const jambZ = W / 2 - 0.045
    const leafZ = W / 2 - 0.105

    for (const side of [-1, 1] as const) {
      const leafX = doorX + side * (meet / 2 + leafW / 2)
      cavity.push(bevelBox(leafW + gap * 2 + 0.02, leafH + gap * 2 + 0.02, 0.03, 0.005)
        .translate(leafX, doorY, W / 2 - 0.172))
      doors.push(bevelBox(leafW, leafH, 0.07, 0.012).translate(leafX, doorY, leafZ))
      // Two shallow pressed rails, so a leaf is not one flat rectangle of paint at any distance.
      for (const t of [-1, 1] as const) {
        doors.push(bevelBox(leafW - 0.09, 0.045, 0.028, 0.008)
          .translate(leafX, doorY + t * doorH * 0.23, leafZ + 0.045))
      }
      // Hinges hang on the outer stile; the levers meet at the stile between the leaves.
      for (const t of [0.11, 0.5, 0.89] as const) {
        hardware.push(bevelBox(0.045, 0.11, 0.06, 0.006)
          .translate(doorX + side * (meet / 2 + leafW - 0.02), doorBase + doorH * t, leafZ + 0.05))
      }
      hardware.push(bevelBox(0.028, 0.24, 0.05, 0.005)
        .translate(doorX + side * (meet / 2 + 0.06), doorBase + doorH * 0.46, leafZ + 0.055))
      hardware.push(bevelBox(0.07, 0.11, 0.038, 0.005)
        .translate(doorX + side * (meet / 2 + 0.06), doorBase + doorH * 0.46, leafZ + 0.028))
    }

    for (const side of [-1, 1] as const) {
      frame.push(bevelBox(jambT, doorH + jambT * 2 + 0.02, 0.14, 0.012)
        .translate(doorX + side * (doorW / 2 - jambT / 2), doorY, jambZ))
    }
    frame.push(bevelBox(meet, doorH + 0.02, 0.13, 0.01).translate(doorX, doorY, jambZ - 0.008))
    frame.push(bevelBox(doorW, jambT, 0.14, 0.012).translate(doorX, doorTop + jambT / 2 + 0.01, jambZ))
    frame.push(bevelBox(doorW + 0.06, 0.07, 0.15, 0.012).translate(doorX, doorBase - 0.035, jambZ))
    frame.push(bevelBox(doorW + 0.16, 0.06, 0.22, 0.012).translate(doorX, doorTop + 0.16, W / 2 + 0.06))
    for (const side of [-1, 1] as const) {
      hardware.push(member(
        new Vector3(doorX + side * (doorW / 2 + 0.02), doorTop + 0.13, W / 2 + 0.15),
        new Vector3(doorX + side * (doorW / 2 + 0.02), doorTop + 0.31, W / 2 - 0.02),
        0.018, 6,
      ))
    }
    const transomBase = doorTop + jambT + 0.01
    const transomH = head - transomBase
    if (transomH > 0.07) {
      panel.push(bevelBox(doorW, transomH, SKIN, 0.012)
        .translate(doorX, transomBase + transomH / 2, skinZ))
    }

    // --- plant bay: control cubicle, cable box, blank ribbed skin ---------
    panel.push(bevelBox(plantW, bandH, SKIN, 0.012).translate(plantX, bandY, skinZ))
    const cabW = Math.max(0.3, Math.min(0.62, plantW - 0.06))
    const cabH = 0.78
    const cabX = plantX - plantW / 2 + cabW / 2 + 0.03
    const cabY = head - 0.16 - cabH / 2
    frame.push(bevelBox(cabW, cabH, 0.16, 0.014).translate(cabX, cabY, W / 2 + 0.03))
    plant.push(bevelBox(cabW - 0.09, cabH - 0.09, 0.04, 0.006).translate(cabX, cabY, W / 2 + 0.094))
    if (cabW > 0.36) {
      cavity.push(bevelBox(cabW - 0.2, 0.2, 0.03, 0.004).translate(cabX, cabY + 0.17, W / 2 + 0.103))
      for (const t of [-1, 0, 1] as const) {
        const lamp = bevelDisc(0.026, 0.03, 0.005, 12)
        lamp.translate(cabX + t * 0.085, cabY - 0.08, W / 2 + 0.105)
        lamps.push(lamp)
      }
      hardware.push(bevelBox(0.03, 0.16, 0.05, 0.005)
        .translate(cabX + cabW / 2 - 0.04, cabY - 0.02, W / 2 + 0.115))
    }
    frame.push(bevelBox(0.3, 0.26, 0.14, 0.012).translate(plantX, sill + 0.22, W / 2 + 0.04))
    cavity.push(bevelBox(0.2, 0.16, 0.04, 0.005).translate(plantX, sill + 0.22, W / 2 + 0.094))
    ribRun(cabX + cabW / 2 + 0.06, plantX + plantW / 2, bandH, 1)

    // --- rear face and exhaust end: plain skin, dense ribs ----------------
    panel.push(bevelBox(clear, bandH, SKIN, 0.014).translate(0, bandY, -skinZ))
    ribRun(-clear / 2 + 0.06, clear / 2 - 0.06, bandH, -1)
    panel.push(bevelBox(SKIN, bandH, W - (FRAME - 0.02) * 2, 0.014)
      .translate(len / 2 - SKIN / 2, bandY, 0))
    for (const t of [-1, 0, 1] as const) {
      panel.push(bevelBox(0.06, bandH - 0.05, 0.1, 0.012).translate(len / 2 + 0.018, bandY, t * 0.4))
    }

    // --- radiator discharge: square opening, sunk cowl, wire guard --------
    // The one landmark that says "machine" from any angle, so it takes the whole cool end and the
    // deepest reveal in the model. Everything is measured back from the skin's cut edge at `bayFace`:
    // mouth ring at 0.045, guard at 0.16, fan at 0.38, bulkhead at 0.50. That gradient — and the guard
    // wire crossing lit blade tips 0.22 further in — is what reads as airflow hardware.
    const endX = bayFace + SKIN / 2
    const endSpan = W - (FRAME - 0.02) * 2
    panel.push(bevelBox(SKIN, fanY - halfOpen - sill, endSpan, 0.014)
      .translate(endX, (sill + fanY - halfOpen) / 2, 0))
    panel.push(bevelBox(SKIN, head - fanY - halfOpen, endSpan, 0.014)
      .translate(endX, (head + fanY + halfOpen) / 2, 0))
    const cheek = endSpan / 2 - halfOpen
    for (const sz of [-1, 1] as const) {
      panel.push(bevelBox(SKIN, halfOpen * 2, cheek, 0.014)
        .translate(endX, fanY, sz * (halfOpen + cheek / 2)))
    }

    // A bolted mouth ring laps the square cut edge and throws the first shadow into the bay. It is
    // machined metal, not frame paint: in the frame's value it vanishes into the cowl behind it and the
    // guard loses the collar that separates it from the yellow skin.
    const mouth = bevelRing(fanR + 0.055, fanR + 0.12, 0.05, 0.01, 30)
    mouth.rotateY(Math.PI / 2)
    mouth.translate(bayFace + 0.02, fanY, 0)
    plant.push(mouth)
    hardware.push(boltRun([bayFace + 0.035, fanY, 0], fanR + 0.088, 10, 0.015, 0.03, AXIS_X, 0.15))

    // The cowl barrel runs from the mouth back past the fan plane, so the guard is the front of a duct.
    const cowl = bevelRing(fanR + 0.008, fanR + 0.062, 0.4, 0.012, 30)
    cowl.rotateY(Math.PI / 2)
    cowl.translate(bayFace + 0.22, fanY, 0)
    frame.push(cowl)

    // Wire guard: a rim, four concentric hoops and eighteen radials. The density is the point — five
    // fat spokes at this diameter read as a ship's wheel.
    const guardX = bayFace + 0.16
    const rim = bevelRing(fanR - 0.02, fanR + 0.03, 0.05, 0.008, 30)
    rim.rotateY(Math.PI / 2)
    rim.translate(guardX, fanY, 0)
    fan.push(rim)
    for (const r of [0.355, 0.275, 0.195, 0.115] as const) {
      const hoop = bevelRing(r - 0.008, r + 0.008, 0.022, 0.004, 26)
      hoop.rotateY(Math.PI / 2)
      hoop.translate(guardX, fanY, 0)
      fan.push(hoop)
    }
    const radials = 18
    for (let i = 0; i < radials; i++) {
      const wire = bevelBlade(0.06, fanR + 0.005, 0.013, 0.019, 0.018, 0.004)
      wire.rotateZ((i / radials) * Math.PI * 2)
      wire.rotateY(Math.PI / 2)
      wire.translate(guardX, fanY, 0)
      fan.push(wire)
    }
    const boss = bevelDisc(0.075, 0.05, 0.01, 18)
    boss.rotateY(Math.PI / 2)
    boss.translate(guardX + 0.005, fanY, 0)
    plant.push(boss)

    // The fan itself, 0.22 behind the guard: seven pitched blades, a hub, a motor barrel on the
    // bulkhead and three struts back to the cowl wall.
    const fanX = bayFace + 0.38
    const blades = 7
    for (let i = 0; i < blades; i++) {
      const vane = bevelBlade(0.105, fanR - 0.05, 0.1, 0.19, 0.016, 0.005)
      vane.rotateX(0.55)
      vane.rotateZ((i / blades) * Math.PI * 2 + 0.22)
      vane.rotateY(Math.PI / 2)
      vane.translate(fanX, fanY, 0)
      fan.push(vane)
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5
      fan.push(member(
        new Vector3(fanX + 0.06, fanY + Math.sin(a) * 0.085, Math.cos(a) * 0.085),
        new Vector3(fanX + 0.02, fanY + Math.sin(a) * (fanR + 0.03), Math.cos(a) * (fanR + 0.03)),
        0.016, 6,
      ))
    }
    const hub = bevelDisc(0.105, 0.11, 0.014, 18)
    hub.rotateY(Math.PI / 2)
    hub.translate(fanX - 0.02, fanY, 0)
    plant.push(hub)
    plant.push(tubeSection(0.075, 0.09, [fanX + 0.075, fanY, 0], AXIS_X, 14))
    // An unlit bulkhead closes the bay, so the blades are silhouetted against black rather than paint.
    cavity.push(bevelBox(0.05, halfOpen * 2 - 0.02, halfOpen * 2 - 0.02, 0.006)
      .translate(coreFront - 0.025 + FACE_CLEARANCE, fanY, 0))

    // --- roof plant: bolted hatch, saddled silencer, lagged stack ---------
    // The hatch stays in the frame's own value: bright machined metal is reserved for the fan
    // guard and the silencer, and a third bright plane on the roof pulls the eye off both.
    const plinthL = Math.min(1.3, len * 0.36)
    const plinthX = -len / 2 + 0.26 + plinthL / 2
    const plinthH = 0.2
    frame.push(bevelBox(plinthL, plinthH, W - 0.36, 0.012)
      .translate(plinthX, roofY + plinthH / 2, 0.02))
    const hatchX = Math.min(plinthL - 0.34, 0.72)
    const hatchZ = Math.min(W - 0.74, 0.78)
    frame.push(bevelBox(hatchX, 0.05, hatchZ, 0.008)
      .translate(plinthX, roofY + plinthH + 0.015, 0.02))
    hardware.push(boltRun(
      [plinthX, roofY + plinthH + 0.03, 0.02],
      Math.min(hatchX, hatchZ) / 2 - 0.06, 4, 0.013, 0.018, AXIS_Y, 0.125,
    ))

    // Saddles carry the drum down onto the deck, so the stack cluster is supported rather
    // than hovering, and they sit inboard of the drip upstand.
    const silR = 0.17
    const silLen = Math.min(1.5, len * 0.42)
    const silX = len / 2 - 0.3 - silLen / 2
    const silZ = -W / 2 + 0.44
    const silY = roofY + 0.2 + silR
    plant.push(tubeSection(silR, silLen, [silX, silY, silZ], AXIS_X, 18))
    for (const sx of [-1, 1] as const) {
      const dish = bevelDisc(silR * 0.98, 0.05, 0.012, 18)
      dish.rotateY(Math.PI / 2)
      dish.translate(silX + sx * (silLen / 2 - 0.012), silY, silZ)
      plant.push(dish)
    }
    for (const t of [-0.3, 0.3] as const) {
      const band = bevelRing(silR - 0.004, silR + 0.024, 0.07, 0.006, 18)
      band.rotateY(Math.PI / 2)
      band.translate(silX + t * silLen, silY, silZ)
      hardware.push(band)
      frame.push(bevelBox(0.13, 0.26, 0.34, 0.01).translate(silX + t * silLen, roofY + 0.13, silZ))
    }

    const stackR = 0.085
    const stackX = silX - silLen / 2 + 0.03
    const stackH = 0.8
    exhaust.push(tubeSection(stackR, stackH, [stackX, silY + stackH / 2, silZ], AXIS_Y, 16))
    for (const t of [0.32, 0.74] as const) {
      const lag = bevelRing(stackR - 0.004, stackR + 0.032, 0.08, 0.006, 16)
      lag.rotateX(Math.PI / 2)
      lag.translate(stackX, silY + stackH * t, silZ)
      exhaust.push(lag)
    }
    exhaust.push(tubeSection(0.018, 0.12, [stackX, silY + stackH + 0.055, silZ], AXIS_Y, 8))
    const rainCap = bevelDisc(stackR + 0.075, 0.05, 0.01, 16)
    rainCap.rotateX(Math.PI / 2 - 0.26)
    rainCap.translate(stackX, silY + stackH + 0.12, silZ)
    exhaust.push(rainCap)

    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const px = sx * (len / 2 - 0.17)
        const pz = sz * (W / 2 - 0.17)
        hardware.push(bevelBox(0.14, 0.05, 0.14, 0.008).translate(px, roofY + 0.025, pz))
        hardware.push(bevelRing(0.035, 0.062, 0.035, 0.007, 14).translate(px, roofY + 0.11, pz))
      }
    }

    // --- hazard run along the sill ----------------------------------------
    const stripes = Math.max(6, Math.round(clear / 0.26))
    const stripeW = clear / stripes
    for (let i = 0; i < stripes; i += 2) {
      hazard.push(bevelBox(stripeW * 0.9, RAIL_H - 0.05, 0.04, 0.004)
        .translate(x0 + stripeW * (i + 0.5), base + RAIL_H / 2, W / 2 + 0.004))
    }

    // --- skid: channel rails, cross members, towing lugs ------------------
    const skidL = len + 0.06
    for (const sz of [-1, 1] as const) {
      const z = sz * (W / 2 - 0.11)
      skidParts.push(bevelBox(skidL, SKID_H - 0.07, 0.09, 0.008).translate(0, SKID_H / 2, z))
      for (const y of [0.022, SKID_H - 0.022] as const) {
        skidParts.push(bevelBox(skidL, 0.04, 0.17, 0.006).translate(0, y, z))
      }
    }
    // The end members close the frame flush with the rails, so the towing lugs bolted outboard
    // of them read as attached to something rather than floating off the corner.
    for (const sx of [-1, 1] as const) {
      skidParts.push(bevelBox(0.16, SKID_H - 0.05, W - 0.2, 0.008)
        .translate(sx * (len / 2 - 0.05), SKID_H / 2 - 0.01, 0))
      skidParts.push(bevelBox(0.22, 0.08, 0.3, 0.008)
        .translate(sx * (len / 2 + 0.1), SKID_H * 0.6, 0))
    }
    skidParts.push(bevelBox(0.12, SKID_H - 0.07, W - 0.22, 0.008)
      .translate(0, SKID_H / 2 - 0.015, 0))

    emit('shell', mergeParts(panel, 'enclosure'), shell, 'enclosure')
    emit('shell', mergeParts(doors, 'doors'), shell, 'doors', finish.door)
    emit('shell', mergeParts(frame, 'frame'), shell, 'frame', finish.steelwork)
    emit('shell', mergeParts(sheet, 'roof'), shell, 'roof', finish.deck)
    emit('shell', mergeParts(cavity, 'cavities'), shell, 'cavities', kit.ink)
    emit('shell', mergeParts(louvers, 'louvers'), shell, 'louvers', finish.blade)
    emit('shell', mergeParts(plant, 'plant'), shell, 'plant', finish.mech)
    emit('shell', mergeParts(fan, 'fan'), shell, 'fan', finish.guard)
    emit('shell', mergeParts(exhaust, 'exhaust'), shell, 'exhaust', finish.flue)
    emit('shell', mergeParts(hardware, 'hardware'), shell, 'hardware', kit.steel)
    emit('shell', mergeParts(lamps, 'lamps'), shell, 'lamps', kit.cyan)
    emit('shell', mergeParts(hazard, 'hazard'), shell, 'hazard', kit.ink)
    emit('skid', mergeParts(skidParts, 'skids'), skid, 'skids')
  }
  rebuild()

  return {
    root,
    parts: { shell, skid },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.length !== undefined) config.length = Math.max(2, patch.length)
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
      for (const material of extras) material.dispose()
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel({ length: 3 }), {
    aspect,
    // The stack takes the model to 3.6 m, so the frame is set by height, not by the 3 m body.
    target: [0, 1.58, 0],
    distance: 10,
    fov: 26,
    yaw: -0.72,
    pitch: 0.24,
  })
}
