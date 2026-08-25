// hot-wheels-banked-turned — a Hot Wheels-typology 180 degree banked U-turn, rebuilt at 1:1
// car-plausible scale for exhibition use rather than at toy scale.
//
// Scale contract. `trackWidth` is the clear lane between the inside faces of the two side walls and
// defaults to 4 m, which is a single car lane plus working clearance. `radius` is the CENTRE-LINE
// radius of the 180 degree turn and defaults to 8 m — an exhibition-plausible hairpin rather than the
// 0.2 m of the moulded toy, and chosen so the band-to-hole ratio matches the reference part.
// `straightLength` is the length of each orange run-in measured from its seam.
// Every other dimension (wall thickness, floor thickness, chamfer, skirt thickness) is a world-unit
// moulding size, per modeling rule 7, and is not re-scaled as a percentage of the host.
//
// Angle contract. `bankAngle` is in DEGREES. It is the PEAK bank reached across the middle of the curve;
// the bank ramps from flat at each seam through a smoothstep and holds flat-topped across the apex, so
// the orange straights and the red curve always meet coplanar.
//
// Construction. One U-channel cross-section is lofted along a straight-arc-straight centre line. At each
// station the section is rotated about its INNER bottom corner by the local bank, which keeps the inside
// edge of the turn pinned to the ground and lifts the outer rail — the way the moulded part sits on a
// floor. The red curve additionally carries a swept outer skirt dropped from the raised outer edge down
// to the ground, which is what gives the piece its solid quarter-pipe silhouette in the reference photo.

import {
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Quaternion,
  Vector3,
  type Material,
} from 'three/webgpu'
import { LoftGeometry } from 'three/examples/jsm/geometries/LoftGeometry.js'

import { bevelBox, createF1Preview, creased, mergeParts } from '../f1-kit-core/index.ts'

type Slot = 'curve' | 'straight' | 'connector'

export interface HotWheelsBankedTurnedConfig {
  /** Centre-line radius of the 180 degree turn, in metres. */
  radius: number
  /** Clear lane width between the inside faces of the side walls, in metres. */
  trackWidth: number
  /** PEAK bank of the curve at its apex, in DEGREES. 0 is flat; the seams are always flat. */
  bankAngle: number
  /** Length of each orange straight run-in measured from its seam, in metres. */
  straightLength: number
  /** Height of the side walls above the ground plane, in metres. */
  wallHeight: number
  /** Banked curve shell colour, hex. */
  curveColor: number
  /** Straight run-in colour, hex. */
  straightColor: number
  /** Connector tab and pin colour, hex. */
  connectorColor: number
}

export interface HotWheelsBankedTurnedOptions extends Partial<HotWheelsBankedTurnedConfig> {
  /** Consumer-supplied materials. A supplied material is never disposed or recoloured here. */
  materials?: Partial<Record<Slot, Material>>
}

export interface HotWheelsBankedTurnedInstance {
  readonly root: Group
  readonly parts: { curve: Group; straights: Group; connectors: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<HotWheelsBankedTurnedConfig>
  configure(patch: Partial<HotWheelsBankedTurnedConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const defaults: HotWheelsBankedTurnedConfig = {
  radius: 8,
  trackWidth: 4,
  bankAngle: 52,
  straightLength: 24,
  wallHeight: 1.05,
  curveColor: 0xea3502,
  straightColor: 0xf05a00,
  connectorColor: 0x2f74d8,
}

/** Moulding sizes in metres — physical dimensions, not fractions of the lane. */
const WALL_THICKNESS = 0.26
const FLOOR_THICKNESS = 0.18
const RAIL_CHAMFER = 0.06
const SKIRT_THICKNESS = 0.26
/** How far the bottom of the outer skirt kicks out past the raised outer rail at full bank. */
const SKIRT_FLARE = 0.45
/** Shortest skirt worth building; below this the ring collapses into degenerate triangles (rule 6). */
const MIN_SKIRT_HEIGHT = 0.05
const ARC_SEGMENTS = 72
/** Fraction of the arc spent ramping into, and out of, the flat-topped peak bank. */
const BANK_RAMP = 0.3
/** Dielectric reflectance of moulded ABS, well below the 0.5 default. */
const SPECULAR_INTENSITY = 0.3
const SPECULAR_TINT = 0xffd9c2
/** Height fraction of the outer skirt at which the moulding step runs, and how far it stands proud. */
const SKIRT_STEP_AT = 0.5
const SKIRT_STEP_DEPTH = 0.14
const PIN_RADIUS = 0.13
const PIN_HEIGHT = 0.09

interface Station {
  /** Centre-line point on the ground plane. */
  readonly p: Vector3
  /** Unit lateral, pointing OUTWARD from the turn centre. Continuous across both seams. */
  readonly lat: Vector3
  /** Local bank in radians. */
  readonly bank: number
}

const smoothstep = (x: number): number => x * x * (3 - 2 * x)

/** Flat at both seams, flat-topped across the apex, smooth in between. */
function bankProfile(t: number): number {
  if (t < BANK_RAMP) return smoothstep(t / BANK_RAMP)
  if (t > 1 - BANK_RAMP) return smoothstep((1 - t) / BANK_RAMP)
  return 1
}

/**
 * Place a section-space point on a station.
 *
 * `u` is lateral (negative inboard, positive outboard) and `v` is height above the ground plane, both
 * measured BEFORE banking. The section is rotated about `(-halfWidth, 0)`, its inner bottom corner, so
 * that corner stays on the floor at every bank angle.
 */
function place(st: Station, u: number, v: number, halfWidth: number): Vector3 {
  const du = u + halfWidth
  const c = Math.cos(st.bank)
  const s = Math.sin(st.bank)
  const ru = -halfWidth + du * c - v * s
  const rv = du * s + v * c
  return new Vector3(st.p.x + st.lat.x * ru, st.p.y + rv, st.p.z + st.lat.z * ru)
}

/** Banked "up" at a station — the section's own +v axis in world space. */
function bankedUp(st: Station): Vector3 {
  return new Vector3(-st.lat.x, 0, -st.lat.z)
    .multiplyScalar(Math.sin(st.bank))
    .setY(Math.cos(st.bank))
}

/**
 * The moulded U-channel section, as `[u, v]` pairs.
 *
 * Wound counterclockwise as seen from the end of the loft looking back, which is what `LoftGeometry`
 * needs for outward normals: up the inner wall's outer face, over its chamfered top, down the inside,
 * across the lane, then back up and over the outer wall.
 */
function channelSection(
  halfWidth: number,
  wallHeight: number,
): ReadonlyArray<readonly [number, number]> {
  const hw = halfWidth
  const wt = WALL_THICKNESS
  const ch = Math.min(RAIL_CHAMFER, wt * 0.45)
  const top = wallHeight
  const lane = FLOOR_THICKNESS
  return [
    [-hw, 0],
    [-hw, top - ch],
    [-hw + ch, top],
    [-hw + wt - ch, top],
    [-hw + wt, top - ch],
    [-hw + wt, lane],
    [hw - wt, lane],
    [hw - wt, top - ch],
    [hw - wt + ch, top],
    [hw - ch, top],
    [hw, top - ch],
    [hw, 0],
  ]
}

function channelLoft(
  stations: readonly Station[],
  section: ReadonlyArray<readonly [number, number]>,
  halfWidth: number,
): BufferGeometry {
  const rings = stations.map((st) => section.map(([u, v]) => place(st, u, v, halfWidth)))
  return creased(new LoftGeometry(rings, { closed: true, capStart: true, capEnd: true }), 35)
}

/**
 * The outer skirt: a swept wall dropped from the raised outer bottom edge to the floor, kicked out at
 * its base so it reads as a moulded flare rather than a card standing on edge. The kick is scaled by
 * skirt height so the near-flat seam ends do not grow a horizontal shelf.
 *
 * The outer face carries a moulding step half way down, which is the one landmark the reference skirt
 * has that a plain swept wall does not: it breaks the largest surface on the part with a shadow line
 * and gives the bank a sense of scale. Its depth is scaled by skirt height alongside the base kick, so
 * it fades out rather than pinching where the piece flattens into each seam.
 *
 * Ring order runs down the outer face (top, step top, step bottom, bottom) and back up the inner face,
 * which is the counterclockwise winding this section needs viewed back down the loft.
 */
function skirtLoft(stations: readonly Station[], halfWidth: number): BufferGeometry | null {
  if (stations.length < 2) return null
  const rings: Vector3[][] = []
  for (const st of stations) {
    const outerTop = place(st, halfWidth, 0, halfWidth)
    outerTop.y = Math.max(MIN_SKIRT_HEIGHT, outerTop.y)
    const kick = SKIRT_FLARE * Math.min(1, outerTop.y)
    const inward = new Vector3(-st.lat.x, 0, -st.lat.z).multiplyScalar(SKIRT_THICKNESS)
    const outerBottom = new Vector3(outerTop.x + st.lat.x * kick, 0, outerTop.z + st.lat.z * kick)
    const step = SKIRT_STEP_DEPTH * Math.min(1, outerTop.y)
    const onFace = (f: number, proud: number): Vector3 =>
      outerTop
        .clone()
        .lerp(outerBottom, f)
        .add(new Vector3(st.lat.x * proud, 0, st.lat.z * proud))
    rings.push([
      outerTop,
      onFace(SKIRT_STEP_AT, 0),
      onFace(SKIRT_STEP_AT, step),
      outerBottom.clone().add(new Vector3(st.lat.x * step, 0, st.lat.z * step)),
      outerBottom.clone().add(new Vector3(st.lat.x * step, 0, st.lat.z * step)).add(inward),
      outerTop.clone().add(inward),
    ])
  }
  return creased(new LoftGeometry(rings, { closed: true, capStart: true, capEnd: true }), 35)
}

function pin(at: Vector3, up: Vector3): BufferGeometry {
  const geo = new CylinderGeometry(PIN_RADIUS, PIN_RADIUS * 0.94, PIN_HEIGHT, 14)
  geo.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), up.clone().normalize()))
  geo.translate(at.x, at.y, at.z)
  return geo
}

export function createModel(
  options: HotWheelsBankedTurnedOptions = {},
): HotWheelsBankedTurnedInstance {
  const config: HotWheelsBankedTurnedConfig = {
    radius: Math.max(4, options.radius ?? defaults.radius),
    trackWidth: Math.max(1.2, options.trackWidth ?? defaults.trackWidth),
    bankAngle: Math.min(75, Math.max(0, options.bankAngle ?? defaults.bankAngle)),
    straightLength: Math.max(2, options.straightLength ?? defaults.straightLength),
    wallHeight: Math.max(FLOOR_THICKNESS + 0.12, options.wallHeight ?? defaults.wallHeight),
    curveColor: options.curveColor ?? defaults.curveColor,
    straightColor: options.straightColor ?? defaults.straightColor,
    connectorColor: options.connectorColor ?? defaults.connectorColor,
  }

  const owned: MeshPhysicalMaterial[] = []
  // Injection-moulded ABS reflects far less than a MeshStandardMaterial dielectric assumes. At the
  // default reflectance the kit's key light washed the apex of the bank out to pale grey and took the
  // red's chroma with it; raising roughness only traded that for a dull part. Dropping
  // `specularIntensity` instead removes the broad highlight and leaves the diffuse albedo untouched,
  // so the curve can stay glossy enough for the tight plastic streak the reference photo shows.
  const makeSlot = (slot: Slot, color: number, roughness: number): Material => {
    const supplied = options.materials?.[slot]
    if (supplied) return supplied
    const material = new MeshPhysicalMaterial({
      name: `hot-wheels-banked-turned / ${slot}`,
      color,
      roughness,
      metalness: 0.0,
      specularIntensity: SPECULAR_INTENSITY,
      specularColor: SPECULAR_TINT,
    })
    owned.push(material)
    return material
  }

  const materialSlots: Record<Slot, Material> = {
    curve: makeSlot('curve', config.curveColor, 0.42),
    straight: makeSlot('straight', config.straightColor, 0.5),
    connector: makeSlot('connector', config.connectorColor, 0.5),
  }
  const ownsSlot: Record<Slot, boolean> = {
    curve: !options.materials?.curve,
    straight: !options.materials?.straight,
    connector: !options.materials?.connector,
  }

  const root = new Group()
  root.name = 'hot-wheels-banked-turned'
  const curve = new Group()
  curve.name = 'curve'
  const straights = new Group()
  straights.name = 'straights'
  const connectors = new Group()
  connectors.name = 'connectors'
  root.add(curve, straights, connectors)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { curve: [], straight: [], connector: [] }

  const releaseGenerated = (): void => {
    curve.clear()
    straights.clear()
    connectors.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0
  }

  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, materialSlots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const rebuild = (): void => {
    releaseGenerated()

    const R = config.radius
    const halfWidth = config.trackWidth / 2 + WALL_THICKNESS
    const wallHeight = config.wallHeight
    const peak = (config.bankAngle * Math.PI) / 180
    const L = config.straightLength
    const section = channelSection(halfWidth, wallHeight)

    // The turn sits on -X: the run-in travels -X along z = +R, the arc sweeps the left half, and the
    // run-out travels +X along z = -R. `lat` is Y x tangent throughout, which is the outward radial on
    // the arc and stays continuous through both seams.
    const arc: Station[] = []
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      const t = i / ARC_SEGMENTS
      const theta = Math.PI / 2 + t * Math.PI
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      arc.push({
        p: new Vector3(R * cos, 0, R * sin),
        lat: new Vector3(cos, 0, sin),
        bank: peak * bankProfile(t),
      })
    }

    const runIn: Station[] = [
      { p: new Vector3(L, 0, R), lat: new Vector3(0, 0, 1), bank: 0 },
      { p: new Vector3(0, 0, R), lat: new Vector3(0, 0, 1), bank: 0 },
    ]
    const runOut: Station[] = [
      { p: new Vector3(0, 0, -R), lat: new Vector3(0, 0, -1), bank: 0 },
      { p: new Vector3(L, 0, -R), lat: new Vector3(0, 0, -1), bank: 0 },
    ]

    const curveParts: BufferGeometry[] = [channelLoft(arc, section, halfWidth)]
    const skirt = skirtLoft(arc, halfWidth)
    if (skirt) curveParts.push(skirt)
    emit('curve', mergeParts(curveParts, 'hot-wheels-banked-turned: curve'), curve, 'banked-curve')

    emit(
      'straight',
      mergeParts(
        [channelLoft(runIn, section, halfWidth), channelLoft(runOut, section, halfWidth)],
        'hot-wheels-banked-turned: straights',
      ),
      straights,
      'run-ins',
    )

    // Both seams are flat by construction, so the connector tabs are axis-aligned boxes, not lofts.
    const tabParts: BufferGeometry[] = []
    const tabThickness = 0.07
    const tabHalfWidth = config.trackWidth * 0.24
    const railU = halfWidth - WALL_THICKNESS / 2
    for (const z of [R, -R] as const) {
      const tab = bevelBox(1.2, tabThickness, tabHalfWidth * 2, 0.02)
      tab.translate(0, FLOOR_THICKNESS + tabThickness * 0.34, z)
      tabParts.push(tab)
      for (const side of [1, -1] as const) {
        tabParts.push(pin(new Vector3(0, wallHeight + 0.02, z + side * railU), new Vector3(0, 1, 0)))
      }
    }
    // Fastener heads on the curve's inner rail, where the reference shows moulding pins.
    for (const t of [0.13, 0.87] as const) {
      const st = arc[Math.round(t * ARC_SEGMENTS)]!
      tabParts.push(pin(place(st, -halfWidth + WALL_THICKNESS / 2, wallHeight + 0.02, halfWidth), bankedUp(st)))
    }
    emit(
      'connector',
      mergeParts(tabParts, 'hot-wheels-banked-turned: connectors'),
      connectors,
      'connector-tabs',
    )
  }

  rebuild()

  return {
    root,
    parts: { curve, straights, connectors },
    materials: materialSlots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      let rebuildGeometry = false
      if (patch.radius !== undefined) {
        config.radius = Math.max(4, patch.radius)
        rebuildGeometry = true
      }
      if (patch.trackWidth !== undefined) {
        config.trackWidth = Math.max(1.2, patch.trackWidth)
        rebuildGeometry = true
      }
      if (patch.bankAngle !== undefined) {
        config.bankAngle = Math.min(75, Math.max(0, patch.bankAngle))
        rebuildGeometry = true
      }
      if (patch.straightLength !== undefined) {
        config.straightLength = Math.max(2, patch.straightLength)
        rebuildGeometry = true
      }
      if (patch.wallHeight !== undefined) {
        config.wallHeight = Math.max(FLOOR_THICKNESS + 0.12, patch.wallHeight)
        rebuildGeometry = true
      }
      if (patch.curveColor !== undefined) config.curveColor = patch.curveColor
      if (patch.straightColor !== undefined) config.straightColor = patch.straightColor
      if (patch.connectorColor !== undefined) config.connectorColor = patch.connectorColor
      const recolour: ReadonlyArray<readonly [Slot, number | undefined]> = [
        ['curve', patch.curveColor],
        ['straight', patch.straightColor],
        ['connector', patch.connectorColor],
      ]
      for (const [slot, value] of recolour) {
        // Rule 16: a consumer-supplied material is theirs, so its colour is not ours to change.
        if (value === undefined || !ownsSlot[slot]) continue
        ;(materialSlots[slot] as MeshPhysicalMaterial).color.setHex(value)
      }
      if (rebuildGeometry) rebuild()
    },
    setMaterial(slot, material) {
      materialSlots[slot] = material
      ownsSlot[slot] = false
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose() {
      releaseGenerated()
      for (const material of owned) material.dispose()
      owned.length = 0
      root.removeFromParent()
    },
  }
}

export function createPreview({ aspect }: { aspect: number; time?: number }) {
  return createF1Preview(createModel(), {
    aspect,
    target: [1.5, 0.6, 0.5],
    distance: 41,
    fov: 40,
    yaw: 0.62,
    pitch: 0.5,
  })
}
