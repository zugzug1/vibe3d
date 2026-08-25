// hot-wheels-loop — an exhibition-scale vertical loop in Hot Wheels plastic typology.
//
// Scale is car-plausible rather than desk-toy: a 15 m centreline radius (30 m loop
// diameter, ~37 m to the crown over a 6.5 m plinth) carrying a 3.4 m clear lane between
// 1.15 m side walls, so a real car has the width and the headroom to thread it. The
// track section is a U-channel — flat lane, short vertical walls, structural backing —
// swept as a single loft, which is what gives the ring its ribbon read from outside and
// the bright inner wall strip from inside.
//
// The sweep is a helix, not a circle: the section drifts `offset` along the loop's
// lateral axis over one full turn, so entry and exit clear each other at the bottom and
// the two straights run parallel. Everything else is clip-on plastic language — puzzle
// tabs and peg holes on the light-blue straights, red collar clips gripping the orange
// ring, one orange pedestal carrying the whole loop.

import {
  BufferGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type Material,
} from 'three/webgpu'
import { LoftGeometry } from 'three/examples/jsm/geometries/LoftGeometry.js'

import {
  FACE_CLEARANCE,
  LAYER_CLEARANCE,
  acquireF1Materials,
  bevelBox,
  createF1Preview,
  creased,
  disposeF1Materials,
  mergeParts,
} from '../f1-kit-core/index.ts'

type Slot = 'loop' | 'straight' | 'clip' | 'stand' | 'trim'

export interface HotWheelsLoopConfig {
  /** Loop centreline radius in metres. Lane diameter is twice this. */
  radius: number
  /** Lateral spiral pitch over one turn — how far the exit sits beside the entry. */
  offset: number
  /** Clear lane width between the side walls, in metres. */
  trackWidth: number
  /** Side wall height above the lane surface, in metres. */
  wallHeight: number
  /** Length of each approach / exit straight, in metres. */
  straightLength: number
  /** Incline of the entry ramp in radians. The exit straight stays level. */
  approachTilt: number
  /** Lane height at the bottom of the loop — the pedestal's working height. */
  standHeight: number
  /** Number of red collar clips distributed around the ring. */
  clipCount: number
  loopColor: number
  straightColor: number
  clipColor: number
  standColor: number
}

export interface HotWheelsLoopOptions extends Partial<HotWheelsLoopConfig> {
  materials?: Partial<Record<Slot, Material>>
}

export interface HotWheelsLoopInstance {
  readonly root: Group
  readonly parts: {
    loop: Group
    straights: Group
    clips: Group
    stand: Group
    trim: Group
    anchors: Group
  }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<HotWheelsLoopConfig>
  configure(patch: Partial<HotWheelsLoopConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: HotWheelsLoopConfig = {
  radius: 15,
  offset: 4.6,
  trackWidth: 3.4,
  wallHeight: 1.15,
  straightLength: 18,
  approachTilt: 0.34,
  standHeight: 6.5,
  clipCount: 3,
  loopColor: 0xf9752b,
  straightColor: 0x4fa3e3,
  clipColor: 0xf03b2e,
  standColor: 0xf7862c,
}

/** Wall and backing thickness are physical plastic dimensions, not fractions of the span (rule 7). */
const WALL_THICKNESS = 0.22
const FLOOR_THICKNESS = 0.26
const CLIP_THICKNESS = 0.085

type Profile = ReadonlyArray<readonly [number, number]>

interface Station {
  readonly p: Vector3
  /** Unit vector along the track width. */
  readonly lateral: Vector3
  /** Unit vector from the lane surface towards the side the car rides on. */
  readonly up: Vector3
}

/**
 * Skin a run of sections, fixing winding from the geometry rather than trusting the author.
 *
 * `LoftGeometry` wants each section counterclockwise as seen from the end looking back, which means
 * the section's right-hand normal must point along the sweep. A U-channel run reverses that relation
 * depending on which way the frame turns, so the normal is measured and the sections flipped when it
 * disagrees (rule 5).
 */
function loftRun(sections: Vector3[][], label: string): BufferGeometry {
  const first = sections[0]!
  const advance = new Vector3().subVectors(sections[1]![0]!, first[0]!)
  const normal = new Vector3()
  for (let i = 0; i < first.length; i++) {
    const a = first[i]!
    const b = first[(i + 1) % first.length]!
    normal.x += (a.y - b.y) * (a.z + b.z)
    normal.y += (a.z - b.z) * (a.x + b.x)
    normal.z += (a.x - b.x) * (a.y + b.y)
  }
  const wound = normal.dot(advance) < 0 ? sections.map((section) => [...section].reverse()) : sections
  const geometry = new LoftGeometry(wound, { closed: true, capStart: true, capEnd: true })
  geometry.name = label
  return geometry
}

function sweep(profile: Profile, stations: Station[], label: string): BufferGeometry {
  return loftRun(
    stations.map(({ p, lateral, up }) =>
      profile.map(([u, v]) => p.clone().addScaledVector(lateral, u).addScaledVector(up, v)),
    ),
    label,
  )
}

/** The track section: flat lane at v = 0, structural backing below it, short vertical walls above. */
function channelProfile(width: number, wallHeight: number): Profile {
  const outer = width / 2 + WALL_THICKNESS
  const inner = width / 2
  return [
    [-outer, wallHeight],
    [-outer, -FLOOR_THICKNESS],
    [outer, -FLOOR_THICKNESS],
    [outer, wallHeight],
    [inner, wallHeight],
    [inner, 0],
    [-inner, 0],
    [-inner, wallHeight],
  ]
}

/** A collar that grips the channel from outside. Sunk into the host by a face clearance so no pair
 *  of coplanar faces ends up fighting for the same depth (rule 8). */
function collarProfile(
  width: number, wallHeight: number, thickness: number, reach: number,
): Profile {
  const grip = width / 2 + WALL_THICKNESS - FACE_CLEARANCE
  const outer = grip + thickness
  const top = wallHeight * reach
  return [
    [-outer, top],
    [-outer, -FLOOR_THICKNESS - thickness + FACE_CLEARANCE],
    [outer, -FLOOR_THICKNESS - thickness + FACE_CLEARANCE],
    [outer, top],
    [grip, top],
    [grip, -FLOOR_THICKNESS],
    [-grip, -FLOOR_THICKNESS],
    [-grip, top],
  ]
}

/** A rectangular frustum: `top` and `bottom` are [x, z] extents, splaying between two heights. */
function taperBlock(
  top: readonly [number, number],
  bottom: readonly [number, number],
  yTop: number,
  yBottom: number,
  centre: readonly [number, number],
  label: string,
): BufferGeometry {
  const ring = (w: number, d: number, y: number): Vector3[] => [
    new Vector3(centre[0] - w / 2, y, centre[1] - d / 2),
    new Vector3(centre[0] + w / 2, y, centre[1] - d / 2),
    new Vector3(centre[0] + w / 2, y, centre[1] + d / 2),
    new Vector3(centre[0] - w / 2, y, centre[1] + d / 2),
  ]
  return loftRun([ring(bottom[0], bottom[1], yBottom), ring(top[0], top[1], yTop)], label)
}

export function createModel(options: HotWheelsLoopOptions = {}): HotWheelsLoopInstance {
  const config = normalise({ ...defaults, ...options })

  const bundle = acquireF1Materials()
  const owned: MeshStandardMaterial[] = []
  const plastic = (slot: Slot, color: number): MeshStandardMaterial => {
    const material = new MeshStandardMaterial({
      name: `hot-wheels-loop / ${slot}`,
      color,
      roughness: 0.42,
      metalness: 0,
    })
    owned.push(material)
    return material
  }
  const colored = (slot: Slot, color: number): Material => options.materials?.[slot] ?? plastic(slot, color)

  const materialSlots: Record<Slot, Material> = {
    loop: colored('loop', config.loopColor),
    straight: colored('straight', config.straightColor),
    clip: colored('clip', config.clipColor),
    stand: colored('stand', config.standColor),
    trim: options.materials?.trim ?? bundle.materials.ink,
  }
  const colorKeys: Record<'loopColor' | 'straightColor' | 'clipColor' | 'standColor', Slot> = {
    loopColor: 'loop',
    straightColor: 'straight',
    clipColor: 'clip',
    standColor: 'stand',
  }

  const root = new Group()
  root.name = 'hot-wheels-loop'
  const loop = new Group(); loop.name = 'loop'
  const straights = new Group(); straights.name = 'straights'
  const clips = new Group(); clips.name = 'clips'
  const stand = new Group(); stand.name = 'stand'
  const trim = new Group(); trim.name = 'trim'
  // Anchors live outside the generated groups so a rebuild never invalidates a consumer's
  // attachment (rule 10).
  const anchors = new Group(); anchors.name = 'anchors'
  const entryAnchor = new Object3D(); entryAnchor.name = 'entry'
  const exitAnchor = new Object3D(); exitAnchor.name = 'exit'
  const crownAnchor = new Object3D(); crownAnchor.name = 'crown'
  anchors.add(entryAnchor, exitAnchor, crownAnchor)
  root.add(loop, straights, clips, stand, trim, anchors)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { loop: [], straight: [], clip: [], stand: [], trim: [] }

  const releaseGenerated = (): void => {
    loop.clear(); straights.clear(); clips.clear(); stand.clear(); trim.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    const crisp = creased(geometry, 24)
    generated.push(crisp)
    const mesh = new Mesh(crisp, materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const loopStations = (): Station[] => {
    const { radius, standHeight, offset } = config
    const start = -0.09
    const end = Math.PI * 2 + 0.09
    const count = 168
    const stations: Station[] = []
    for (let i = 0; i <= count; i++) {
      const a = start + (i / count) * (end - start)
      stations.push({
        p: new Vector3(
          -radius * Math.sin(a),
          standHeight + radius * (1 - Math.cos(a)),
          offset * (a / (Math.PI * 2)) - offset / 2,
        ),
        lateral: new Vector3(0, 0, 1),
        up: new Vector3(Math.sin(a), Math.cos(a), 0),
      })
    }
    return stations
  }

  const runStations = (from: Vector3, to: Vector3, up: Vector3, count = 6): Station[] => {
    const lateral = new Vector3(0, 0, 1)
    const stations: Station[] = []
    for (let i = 0; i <= count; i++) {
      stations.push({
        p: from.clone().lerp(to, i / count),
        lateral,
        up: up.clone(),
      })
    }
    return stations
  }

  /** A puzzle tab: a plate tongue capped by a round lobe, in the run's own frame. */
  const puzzleTab = (at: Vector3, outward: Vector3, up: Vector3): BufferGeometry[] => {
    const reach = config.trackWidth * 0.34
    const lobe = config.trackWidth * 0.24
    const tongue = bevelBox(config.trackWidth * 0.44, FLOOR_THICKNESS, reach, 0.03)
    tongue.translate(0, -FLOOR_THICKNESS / 2, reach / 2)
    const head = new CylinderGeometry(lobe, lobe, FLOOR_THICKNESS, 24)
    head.translate(0, -FLOOR_THICKNESS / 2, reach)
    const lateral = new Vector3().crossVectors(up, outward).normalize()
    const frame = new Matrix4().makeBasis(lateral, up, outward).setPosition(at)
    const parts = [tongue, head]
    for (const part of parts) part.applyMatrix4(frame)
    return parts
  }

  /** Peg holes read as dark inset discs standing one layer clearance off the lane (rule 8). */
  const pegHoles = (from: Vector3, to: Vector3, up: Vector3): BufferGeometry[] => {
    const lateral = new Vector3(0, 0, 1)
    const radius = config.trackWidth * 0.075
    const parts: BufferGeometry[] = []
    for (let i = 0; i < 4; i++) {
      const t = 0.16 + i * 0.22
      const side = i % 2 === 0 ? 0.3 : -0.28
      const centre = from
        .clone()
        .lerp(to, t)
        .addScaledVector(lateral, config.trackWidth * side)
        .addScaledVector(up, LAYER_CLEARANCE * 2)
      const disc = new CylinderGeometry(radius, radius, 0.05, 18)
      const frame = new Matrix4()
        .makeBasis(lateral, up, new Vector3().crossVectors(lateral, up).negate())
        .setPosition(centre)
      disc.applyMatrix4(frame)
      parts.push(disc)
    }
    return parts
  }

  const ringBand = (centre: number, halfArc: number, profile: Profile, label: string): BufferGeometry => {
    const { radius, standHeight, offset } = config
    const band: Station[] = []
    for (let k = 0; k <= 8; k++) {
      const a = centre - halfArc + (k / 8) * halfArc * 2
      band.push({
        p: new Vector3(
          -radius * Math.sin(a),
          standHeight + radius * (1 - Math.cos(a)),
          offset * (a / (Math.PI * 2)) - offset / 2,
        ),
        lateral: new Vector3(0, 0, 1),
        up: new Vector3(Math.sin(a), Math.cos(a), 0),
      })
    }
    return sweep(profile, band, label)
  }

  const rebuild = (): void => {
    releaseGenerated()
    const { radius, trackWidth, wallHeight, standHeight, offset, straightLength, approachTilt } = config
    const section = channelProfile(trackWidth, wallHeight)
    const outerHalf = trackWidth / 2 + WALL_THICKNESS

    const ring = loopStations()
    emit('loop', sweep(section, ring, 'loop-channel'), loop, 'loop-channel')

    // Straights. The entry ramp is gravity-fed into the bottom of the loop and the exit leaves
    // level, one lateral offset across, so both runs lie on the same line seen from above.
    const entryJoin = ring[0]!.p
    const exitJoin = ring[ring.length - 1]!.p
    const rampDir = new Vector3(-Math.cos(approachTilt), -Math.sin(approachTilt), 0)
    const rampUp = new Vector3(-Math.sin(approachTilt), Math.cos(approachTilt), 0)
    const rampEnd = entryJoin.clone().addScaledVector(rampDir, 0.6)
    const rampStart = rampEnd.clone().addScaledVector(rampDir, -(straightLength + 0.6))
    // The exit run drops at whatever angle lands its far end just clear of the ground, so the
    // pair reads as one gravity circuit: climb the approach, thread the loop, run out to grade.
    const drop = Math.min(approachTilt, Math.asin(Math.min(1, Math.max(0, standHeight - 1.1) / straightLength)))
    const exitDir = new Vector3(-Math.cos(drop), -Math.sin(drop), 0)
    const exitUp = new Vector3(-Math.sin(drop), Math.cos(drop), 0)
    const exitStart = exitJoin.clone().addScaledVector(exitDir, -0.6)
    const exitEnd = exitStart.clone().addScaledVector(exitDir, straightLength + 0.6)

    const runs: BufferGeometry[] = [
      sweep(section, runStations(rampStart, rampEnd, rampUp), 'approach'),
      sweep(section, runStations(exitStart, exitEnd, exitUp), 'exit'),
      ...puzzleTab(rampStart, rampDir.clone().negate(), rampUp),
      ...puzzleTab(exitEnd, exitDir, exitUp),
    ]
    emit('straight', mergeParts(runs, 'straights'), straights, 'straights')

    const holes = [
      ...pegHoles(rampStart, rampEnd, rampUp),
      ...pegHoles(exitStart, exitEnd, exitUp),
    ]
    emit('trim', mergeParts(holes, 'peg-holes'), trim, 'peg-holes')

    // Collar clips, evenly spaced but phased so the wide clamp lands low on the near side, next to
    // where the plinth takes the load.
    const collar = collarProfile(trackWidth, wallHeight, CLIP_THICKNESS, 0.2)
    const collars: BufferGeometry[] = []
    for (let i = 0; i < config.clipCount; i++) {
      const centre = (1.8 + (2 * i) / config.clipCount) * Math.PI
      collars.push(ringBand(centre, (i === 0 ? 3.2 : 2.1) / radius, collar, `clip-${i}`))
    }
    if (collars.length > 0) emit('clip', mergeParts(collars, 'clips'), clips, 'clips')

    // Pedestal. Wide enough in Z to carry both the entry and the offset exit run, splaying to a
    // ground plate — the whole ring's load path.
    const padSpan = offset + outerHalf * 2
    const plateHeight = 0.55
    const block = taperBlock(
      [outerHalf * 1.7, padSpan + 0.2],
      [outerHalf * 2.6, padSpan + 1.1],
      standHeight - FLOOR_THICKNESS + 0.02,
      plateHeight,
      [0, 0],
      'pedestal',
    )
    const plate = bevelBox(outerHalf * 3.1, plateHeight, padSpan + 1.9, 0.1)
    plate.translate(0, plateHeight / 2, 0)
    // Saddles where each ring end enters the plinth: without them the ribbon looks balanced on the
    // wedge rather than clamped into it.
    const saddle = collarProfile(trackWidth, wallHeight, CLIP_THICKNESS * 1.8, 0.5)
    const saddleArc = 2.9 / radius
    emit(
      'stand',
      mergeParts(
        [
          block,
          plate,
          ringBand(saddleArc * 0.9, saddleArc, saddle, 'saddle-entry'),
          ringBand(Math.PI * 2 - saddleArc * 0.9, saddleArc, saddle, 'saddle-exit'),
        ],
        'stand',
      ),
      stand,
      'stand',
    )

    entryAnchor.position.copy(rampStart)
    exitAnchor.position.copy(exitEnd)
    crownAnchor.position.set(0, standHeight + radius * 2, 0)
  }
  rebuild()

  return {
    root,
    parts: { loop, straights, clips, stand, trim, anchors },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      let geometryDirty = false
      for (const key of Object.keys(patch) as Array<keyof HotWheelsLoopConfig>) {
        const value = patch[key]
        if (value === undefined) continue
        if (key in colorKeys) {
          const slot = colorKeys[key as keyof typeof colorKeys]
          config[key] = value
          const material = materialSlots[slot]
          // Only recolour a material this model made; a consumer's material is theirs (rule 16).
          if (material instanceof MeshStandardMaterial && owned.includes(material)) {
            material.color.setHex(value)
          }
          continue
        }
        config[key] = value
        geometryDirty = true
      }
      if (geometryDirty) {
        Object.assign(config, normalise(config))
        rebuild()
      }
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      for (const material of owned) material.dispose()
      owned.length = 0
      disposeF1Materials(bundle)
      root.removeFromParent()
    },
  }
}

/** Clamp the configuration to values that still build a threadable loop. */
function normalise(config: HotWheelsLoopConfig): HotWheelsLoopConfig {
  const trackWidth = Math.max(1.6, config.trackWidth)
  const outer = trackWidth + WALL_THICKNESS * 2
  return {
    ...config,
    radius: Math.max(outer * 1.5, config.radius),
    trackWidth,
    // The exit has to clear the entry, so the spiral pitch can never be narrower than the section.
    offset: Math.max(outer + 0.4, config.offset),
    wallHeight: Math.max(0.25, config.wallHeight),
    straightLength: Math.max(trackWidth, config.straightLength),
    approachTilt: Math.min(0.6, Math.max(0, config.approachTilt)),
    standHeight: Math.max(FLOOR_THICKNESS + 0.6, config.standHeight),
    clipCount: Math.max(0, Math.round(config.clipCount)),
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [0, 18, 0],
    distance: 98,
    fov: 30,
    yaw: -0.62,
    pitch: 0.24,
  })
}
