import { CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, TubeGeometry, CatmullRomCurve3, Vector3, type BufferGeometry, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { createKkPreview } from '../kk-core/index.ts'

const ID = 'kk-007-washi-pendant-lantern'
type Slot = 'cedar' | 'washi' | 'brass'
export interface KkLanternConfig { ribCount: number }
export interface KkLanternOptions extends Partial<KkLanternConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkLanternInstance { readonly root: Group; readonly parts: { mount: Group; shade: Group; ribs: Group }; readonly materials: Readonly<Record<Slot, Material>>; getConfig(): Readonly<KkLanternConfig>; configure(patch: Partial<KkLanternConfig>): void; setMaterial(slot: Slot, material: Material): void; update(deltaSeconds: number): void; dispose(): void }
const defaults = { ribCount: 12 }
// The paper and every applied part share this truncated ellipsoid profile.
function shadeRadius(y: number): number {
  const t = (y - 0.1775) / 0.175
  return 0.3 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.08 * t * t)
}

export function createModel(options: KkLanternOptions = {}): KkLanternInstance {
  const config = { ribCount: Math.max(8, Math.min(18, Math.round(options.ribCount ?? defaults.ribCount))) }
  const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', washi: 'paper', brass: 'cedar' }, options.materials)
  const m = bundle.materials
  if (!options.materials?.brass) Object.assign(m.brass, { map: null, normalMap: null, roughnessMap: null })
  const root = new Group(); root.name = ID; root.userData.attachment = 'mount'
  const parts = { mount: new Group(), shade: new Group(), ribs: new Group() }
  const content = new Map<Group, Group>()
  Object.entries(parts).forEach(([key, group]) => { group.name = `${ID} / ${key}`; const generated = new Group(); generated.name = `${ID} / ${key} / generated`; group.add(generated); root.add(group); content.set(group, generated) })
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (group: Group, geometry: BufferGeometry, material: Material, position: [number, number, number], name: string): Mesh => {
    geometries.push(geometry); const mesh = new Mesh(geometry, material); mesh.name = `${ID} / ${name}`; mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; content.get(group)!.add(mesh); return mesh
  }
  const rebuild = (): void => {
    content.forEach((group) => group.clear()); geometries.splice(0).forEach((geo) => geo.dispose())
    const cap = new CylinderGeometry(0.065, 0.065, 0.035, 32); emit(parts.mount, cap, m.brass, [0, 0.4825, 0], 'round ceiling cap')
    const collar = new CylinderGeometry(0.012, 0.014, 0.018, 16); emit(parts.mount, collar, m.brass, [0, 0.458, 0], 'mount collar')
    const cord = new TubeGeometry(new CatmullRomCurve3([new Vector3(0, 0.456, 0), new Vector3(0.002, 0.400, 0), new Vector3(0, 0.341, 0)]), 12, 0.004, 8, false)
    emit(parts.mount, cord, m.cedar, [0, 0, 0], 'pendant cord')
    const cut = Math.acos(0.9)
    const globe = new SphereGeometry(1, 64, 24, 0, Math.PI * 2, cut, Math.PI - cut * 2)
    const pos = globe.getAttribute('position')
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const bulge = 1 - 0.08 * y * y; pos.setXYZ(i, pos.getX(i) * 0.3 * bulge, 0.1775 + y * 0.175, pos.getZ(i) * 0.3 * bulge) }
    pos.needsUpdate = true; globe.computeVertexNormals(); boardUVs(globe, [0.6, 0.41, 0.6]); emit(parts.shade, globe, m.washi, [0, 0, 0], 'broad oval washi shade')
    for (let i = 0; i < config.ribCount; i++) {
      const half = Math.ceil(config.ribCount / 2)
      const t = i < half ? -0.85 + i * 0.72 / Math.max(1, half - 1) : 0.13 + (i - half) * 0.72 / Math.max(1, config.ribCount - half - 1)
      const y = 0.1775 + t * 0.175
      const ring = new TorusGeometry(shadeRadius(y) - 0.0005, 0.0016, 4, 48); ring.rotateX(Math.PI / 2); emit(parts.ribs, ring, m.cedar, [0, y, 0], 'paper rib')
    }
    // Open-ended collars lap the paper cut edges; the lower aperture stays open.
    const top = new CylinderGeometry(0.125, 0.135, 0.022, 64, 1, true)
    emit(parts.ribs, top, m.brass, [0, 0.335, 0], 'top retaining ring')
    const bottom = new CylinderGeometry(0.135, 0.125, 0.026, 64, 1, true)
    emit(parts.ribs, bottom, m.brass, [0, 0.013, 0], 'bottom retaining ring')
    for (const y of [0.003, 0.024, 0.326, 0.344]) {
      const ring = new TorusGeometry(y < 0.01 || y > 0.34 ? 0.126 : 0.134, 0.002, 6, 64); ring.rotateX(Math.PI / 2)
      emit(parts.ribs, ring, m.brass, [0, y, 0], 'collar rolled edge')
    }
    emit(parts.mount, new CylinderGeometry(0.014, 0.03, 0.020, 16), m.brass, [0, 0.343, 0], 'shade cord socket')
    const bridge = new CylinderGeometry(0.004, 0.004, 0.25, 8); bridge.rotateZ(Math.PI / 2)
    emit(parts.mount, bridge, m.brass, [0, 0.335, 0], 'socket support bridge')
    const points = Array.from({ length: 33 }, (_, i) => { const y = 0.03 + i * 0.294 / 32; const r = shadeRadius(y) + 0.0003; return new Vector3(r * Math.sin(0.55), y, r * Math.cos(0.55)) })
    emit(parts.ribs, new TubeGeometry(new CatmullRomCurve3(points), 48, 0.0016, 5, false), m.cedar, [0, 0, 0], 'repaired seam')
  }
  rebuild()
  return { root, parts, materials: m, getConfig: () => ({ ...config }), configure(patch) { if (disposed) return; if (patch.ribCount !== undefined) config.ribCount = Math.max(8, Math.min(18, Math.round(patch.ribCount))); rebuild() }, setMaterial(slot, material) { if (disposed) return; m[slot] = material; rebuild() }, update(_deltaSeconds) {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((geo) => geo.dispose()); bundle.dispose(); root.removeFromParent() } }
}
export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch }) }
export function createCafePreview(options: { aspect: number; time?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, framing: 'cafe' }) }
