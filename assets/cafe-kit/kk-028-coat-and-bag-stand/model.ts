// 0.50 W × 0.50 D × 1.60 H m. Bare branch stand; garments remain consumer attachments.
// Four independent radial foot tenons seat in an octagonal hub. No stacked cross-board coplanar faces.
import { Group, Mesh, Shape, Path, ExtrudeGeometry, CylinderGeometry, Quaternion, Vector3, type BufferGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID = 'kk-028-coat-and-bag-stand'
type Slot = 'cedar' | 'cedarDark'
export interface KkCoatStandConfig { pegReach: number; pegRise: number }
export interface KkCoatStandOptions extends Partial<KkCoatStandConfig> { materials?: Partial<Record<Slot, Material>> }
export const structureControls = {
  pegReach: { min: 0.13, max: 0.215, default: 0.19, step: 0.005, label: 'Peg reach (m)' },
  pegRise: { min: 0.06, max: 0.15, default: 0.11, step: 0.005, label: 'Peg rise (m)' },
} as const
function configuration(patch: Partial<KkCoatStandConfig>, base: KkCoatStandConfig = { pegReach: 0.19, pegRise: 0.11 }): KkCoatStandConfig {
  const next = { ...base }
  for (const key of ['pegReach', 'pegRise'] as const) {
    const value = patch[key] === undefined ? base[key] : patch[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${key} must be finite`)
    next[key] = Math.max(structureControls[key].min, Math.min(structureControls[key].max, value))
  }
  return next
}
function branch(from: Vector3, to: Vector3): BufferGeometry {
  const direction = to.clone().sub(from); const length = direction.length()
  const geometry = new CylinderGeometry(0.014, 0.026, length, 10, 5)
  const p = geometry.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / length + 0.5
    p.setZ(i, p.getZ(i) + 0.005 * Math.sin(t * Math.PI))
  }
  geometry.computeVertexNormals(); boardUVs(geometry, [0.052, length, 0.052])
  geometry.translate(0, length / 2, 0)
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()))
  geometry.translate(from.x, from.y, from.z); return geometry
}
/** Octagonal socket receives four short foot tenons and the trunk; its central bore remains real. */
function footSocket(): BufferGeometry {
  const shape = new Shape()
  for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; const x = Math.cos(angle) * 0.069; const y = Math.sin(angle) * 0.069; if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y) }
  shape.closePath(); const bore = new Path(); bore.absarc(0, 0, 0.044, 0, Math.PI * 2, true); shape.holes.push(bore)
  const geometry = new ExtrudeGeometry(shape, { depth: 0.083, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 8, steps: 1 })
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0.020, 0); boardUVs(geometry, [0.142, 0.087, 0.142]); return geometry
}
export function createModel(options: KkCoatStandOptions = {}) {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar' }, options.materials); const materials = bundle.materials
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { foot: new Group(), trunk: new Group(), pegs: new Group() }
  const content = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) { anchor.name = `${ID} / ${name}`; root.add(anchor); const generated = new Group(); generated.name = `${anchor.name} / generated`; anchor.add(generated); content.set(anchor, generated) }
  root.add(socket('anchor-coat-stand', [0, 0, 0]))
  const hooks = Array.from({ length: 4 }, (_, i) => { const hook = new Group(); hook.name = `${ID} / hook ${i}`; root.add(hook); return hook })
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (part: Group, geo: BufferGeometry, slot: Slot, pos: [number, number, number], name: string): void => {
    geometries.push(geo); const mesh = new Mesh(geo, materials[slot]); mesh.position.set(...pos); mesh.name = `${ID} / ${name}`
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.materialSlot = slot; content.get(part)!.add(mesh)
  }
  const rebuild = (): void => {
    content.forEach(group => group.clear()); geometries.splice(0).forEach(geo => geo.dispose())
    for (const sign of [-1, 1]) {
      for (const alongX of [false, true]) {
        const height = alongX ? 0.066 : 0.061
        const size: [number, number, number] = alongX ? [0.195, height, 0.08] : [0.08, height, 0.195]
        const geo = bevelBox(...size, 0.006); boardUVs(geo, size)
        emit(parts.foot, geo, 'cedarDark', [alongX ? sign * 0.1525 : 0, height / 2, alongX ? 0 : sign * 0.1525], 'splayed cross foot arm')
      }
    }
    emit(parts.foot, footSocket(), 'cedarDark', [0, 0, 0], 'octagonal mortised foot socket')
    const trunk = new CylinderGeometry(0.034, 0.048, 1.58, 12, 12); const p = trunk.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + 0.79) / 1.58
      p.setX(i, p.getX(i) + 0.006 * Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI))
      p.setZ(i, p.getZ(i) + 0.004 * Math.sin(t * Math.PI))
    }
    trunk.computeVertexNormals(); boardUVs(trunk, [0.096, 1.58, 0.096]); emit(parts.trunk, trunk, 'cedar', [0, 0.81, 0], 'tapered timber trunk')
    const stations = [[1.32, 0.05], [1.29, Math.PI + 0.20], [1.03, -0.18], [0.77, Math.PI - 0.35]] as const
    stations.forEach(([y, angle], i) => {
      const from = new Vector3(Math.cos(angle) * 0.014, y, Math.sin(angle) * 0.014)
      const to = new Vector3(Math.cos(angle) * config.pegReach, y + config.pegRise, Math.sin(angle) * config.pegReach)
      emit(parts.pegs, branch(from, to), 'cedar', [0, 0, 0], `upturned branch peg ${i}`)
      // Hook datum sits slightly behind the cut end so a hanger cannot slide off the peg.
      hooks[i]!.position.copy(to).lerp(from, 0.10)
    })
  }
  rebuild()
  return { root, parts, hooks, materials, getConfig: () => ({ ...config }),
    configure(patch: Partial<KkCoatStandConfig>) { if (disposed) return; Object.assign(config, configuration(patch, config)); rebuild() },
    setMaterial(slot: Slot, material: Material) { if (disposed) return; materials[slot] = material; root.traverse(o => { if (o instanceof Mesh && o.userData.materialSlot === slot) o.material = material }) },
    update(_deltaSeconds: number) {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach(geo => geo.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
