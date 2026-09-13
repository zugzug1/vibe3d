// Four independent wall-mounted landings, 1.40 W × 0.30 D × 1.00 H metres.
// Wall plane Z=-0.15; origin is the bottom-centre of the mounting envelope, not a floor foot.
// Reference: carved concave corbels, paired fixing boards and thin moss pads. Hidden fixings are timber plugs.
import { Group, Mesh, Shape, ExtrudeGeometry, CylinderGeometry, SphereGeometry, TubeGeometry, CatmullRomCurve3, Vector3, type BufferGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'

const ID = 'kk-021-wall-cat-walkway'
type Slot = 'cedar' | 'cedarDark' | 'tatami'
export interface KkWalkwayConfig { stepCount: number; ascending: boolean }
export interface KkWalkwayOptions extends Partial<KkWalkwayConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkWalkwayInstance {
  readonly root: Group
  readonly parts: { mounts: Group; brackets: Group; platforms: Group; pads: Group }
  readonly landings: readonly Group[]
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkWalkwayConfig>
  configure(patch: Partial<KkWalkwayConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}
function configuration(patch: Partial<KkWalkwayConfig>, base: KkWalkwayConfig = { stepCount: 4, ascending: false }): KkWalkwayConfig {
  const stepCount = patch.stepCount === undefined ? base.stepCount : patch.stepCount
  const ascending = patch.ascending === undefined ? base.ascending : patch.ascending
  if (typeof stepCount !== 'number' || !Number.isFinite(stepCount)) throw new TypeError('stepCount must be finite')
  if (typeof ascending !== 'boolean') throw new TypeError('ascending must be boolean')
  return { stepCount: Math.max(3, Math.min(5, Math.round(stepCount))), ascending }
}
/** Concave support leaves an honest open void beneath each landing, rather than a triangular block. */
function corbel(): BufferGeometry {
  const shape = new Shape()
  shape.moveTo(-0.132, 0.006); shape.lineTo(0.125, 0.006); shape.lineTo(0.120, -0.024)
  shape.bezierCurveTo(0.060, -0.033, -0.037, -0.074, -0.052, -0.145)
  shape.quadraticCurveTo(-0.056, -0.155, -0.070, -0.155)
  shape.lineTo(-0.132, -0.155); shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: 0.031, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, curveSegments: 7, steps: 1 })
  geometry.translate(0, 0, -0.0155); geometry.rotateY(-Math.PI / 2)
  boardUVs(geometry, [0.035, 0.165, 0.261]); return geometry
}
const signedPower = (value: number, exponent: number): number => Math.abs(value) < 1e-7 ? 0 : Math.sign(value) * Math.abs(value) ** exponent
function pad(): BufferGeometry {
  const geometry = new SphereGeometry(1, 20, 10); const p = geometry.getAttribute('position')
  for (let i = 0; i < p.count; i++) p.setXYZ(i, signedPower(p.getX(i), 0.25) * 0.221, signedPower(p.getY(i), 0.7) * 0.009, signedPower(p.getZ(i), 0.25) * 0.129)
  geometry.computeVertexNormals(); boardUVs(geometry, [0.442, 0.018, 0.258]); return geometry
}
export function createModel(options: KkWalkwayOptions = {}): KkWalkwayInstance {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar', tatami: 'fabric' }, options.materials)
  const materials = bundle.materials
  const root = new Group(); root.name = ID; root.userData.attachment = 'wall'; root.userData.wallPlaneZ = -0.15
  const parts = { mounts: new Group(), brackets: new Group(), platforms: new Group(), pads: new Group() }
  const content = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) {
    anchor.name = `${ID} / ${name}`; root.add(anchor)
    const generated = new Group(); generated.name = `${anchor.name} / generated`; anchor.add(generated); content.set(anchor, generated)
  }
  root.add(socket('anchor-wall', [0, 0.5, -0.15]))
  const landings = Array.from({ length: 5 }, (_, i) => { const anchor = new Group(); anchor.name = `${ID} / landing ${i}`; root.add(anchor); return anchor })
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (part: Group, geometry: BufferGeometry, slot: Slot, position: [number, number, number], name: string): void => {
    geometries.push(geometry); const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.position.set(...position)
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.materialSlot = slot; content.get(part)!.add(mesh)
  }
  const box = (part: Group, slot: Slot, size: [number, number, number], position: [number, number, number], name: string): void => {
    const geometry = bevelBox(...size, Math.min(0.003, Math.min(...size) * 0.15)); boardUVs(geometry, size); emit(part, geometry, slot, position, name)
  }
  const rebuild = (): void => {
    content.forEach(group => group.clear()); geometries.splice(0).forEach(geometry => geometry.dispose())
    landings.forEach((anchor, i) => { anchor.visible = i < config.stepCount; anchor.userData.active = anchor.visible })
    for (let i = 0; i < config.stepCount; i++) {
      const t = i / (config.stepCount - 1)
      const x = -0.465 + t * 0.93; const top = 0.22 + (config.ascending ? t : 1 - t) * 0.72
      landings[i]!.position.set(x, top + 0.016, 0.01)
      box(parts.platforms, 'cedar', [0.47, 0.044, 0.28], [x, top - 0.022, 0.01], `step ${i} platform`)
      for (const dx of [-0.157, 0.157]) {
        box(parts.mounts, 'cedar', [0.059, 0.28, 0.026], [x + dx, top - 0.08, -0.137], `step ${i} mounting board`)
        emit(parts.brackets, corbel(), 'cedarDark', [x + dx, top - 0.044, 0], `step ${i} carved corbel`)
        for (const dy of [-0.182, 0.035]) {
          const peg = new CylinderGeometry(0.008, 0.008, 0.007, 10); peg.rotateX(Math.PI / 2)
          emit(parts.mounts, peg, 'cedarDark', [x + dx, top + dy, -0.123], `step ${i} fixing plug`)
        }
      }
      emit(parts.pads, pad(), 'tatami', [x, top + 0.007, 0.01], `step ${i} moss pad`)
      const points = Array.from({ length: 32 }, (_, j) => { const a = j / 32 * Math.PI * 2; return new Vector3(signedPower(Math.cos(a), 0.25) * 0.220, 0, signedPower(Math.sin(a), 0.25) * 0.128) })
      emit(parts.pads, new TubeGeometry(new CatmullRomCurve3(points, true), 32, 0.0012, 4, true), 'tatami', [x, top + 0.007, 0.01], `step ${i} bound pad edge`)
    }
  }
  rebuild()
  return { root, parts, landings, materials, getConfig: () => ({ ...config }),
    configure(patch) { if (disposed) return; const next = configuration(patch, config); Object.assign(config, next); rebuild() },
    setMaterial(slot, material) { if (disposed) return; materials[slot] = material; root.traverse(o => { if (o instanceof Mesh && o.userData.materialSlot === slot) o.material = material }) },
    update() {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach(geometry => geometry.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
