import { CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, TubeGeometry, CatmullRomCurve3, Vector3, type BufferGeometry, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { bevelBox, createKkPreview } from '../kk-core/index.ts'

const ID = 'kk-007-washi-pendant-lantern'
type Slot = 'cedar' | 'washi' | 'brass'
export interface KkLanternConfig { ribCount: number }
export interface KkLanternOptions extends Partial<KkLanternConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkLanternInstance { readonly root: Group; readonly parts: { mount: Group; shade: Group; ribs: Group }; readonly materials: Readonly<Record<Slot, Material>>; getConfig(): Readonly<KkLanternConfig>; configure(patch: Partial<KkLanternConfig>): void; setMaterial(slot: Slot, material: Material): void; update(deltaSeconds: number): void; dispose(): void }
const defaults = { ribCount: 12 }

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
  const box = (group: Group, material: Material, size: [number, number, number], position: [number, number, number], name: string): void => { const geo = bevelBox(...size, Math.min(0.004, Math.min(...size) * 0.15)); boardUVs(geo, size); emit(group, geo, material, position, name) }
  const rebuild = (): void => {
    content.forEach((group) => group.clear()); geometries.splice(0).forEach((geo) => geo.dispose())
    const cap = new CylinderGeometry(0.13, 0.13, 0.045, 32); emit(parts.mount, cap, m.brass, [0, 0.4775, 0], 'round ceiling cap')
    const collar = new CylinderGeometry(0.038, 0.045, 0.050, 16); emit(parts.mount, collar, m.brass, [0, 0.4325, 0], 'mount collar')
    const cord = new TubeGeometry(new CatmullRomCurve3([new Vector3(0, 0.4075, 0), new Vector3(0, 0.382, 0), new Vector3(0, 0.355, 0)]), 8, 0.009, 8, false)
    emit(parts.mount, cord, m.cedar, [0, 0, 0], 'pendant cord')
    const globe = new SphereGeometry(1, 32, 18)
    const pos = globe.getAttribute('position')
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const bulge = 1 - 0.08 * y * y; pos.setXYZ(i, pos.getX(i) * 0.3 * bulge, 0.235 + pos.getY(i) * 0.205, pos.getZ(i) * 0.3 * bulge) }
    pos.needsUpdate = true; globe.computeVertexNormals(); boardUVs(globe, [0.6, 0.41, 0.6]); emit(parts.shade, globe, m.washi, [0, 0, 0], 'broad oval washi shade')
    for (let i = 0; i < config.ribCount; i++) {
      const y = 0.065 + i * (0.34 / Math.max(1, config.ribCount - 1)); const t = (y - 0.235) / 0.205; const r = 0.29995 * (1 - 0.08 * t * t) - 0.0032
      const ring = new TorusGeometry(r, 0.0032, 4, 32); ring.rotateX(Math.PI / 2); emit(parts.ribs, ring, m.cedar, [0, y, 0], 'paper rib')
    }
    const top = new TorusGeometry(0.2804 - 0.006, 0.006, 6, 32); top.rotateX(Math.PI / 2); emit(parts.ribs, top, m.brass, [0, 0.405, 0], 'top retaining ring')
    const bottom = new TorusGeometry(0.2715 - 0.018, 0.018, 6, 32); bottom.rotateX(Math.PI / 2); bottom.computeBoundingBox(); emit(parts.ribs, bottom, m.brass, [0, -bottom.boundingBox!.min.y, 0], 'bottom retaining ring')
    const seam = new TubeGeometry(new CatmullRomCurve3([new Vector3(0.22, 0.07, 0.205), new Vector3(0.25, 0.18, 0.27), new Vector3(0.25, 0.30, 0.27), new Vector3(0.20, 0.40, 0.18)]), 8, 0.0025, 5, false)
    emit(parts.ribs, seam, m.washi, [0, 0, 0], 'repaired seam')
  }
  rebuild()
  return { root, parts, materials: m, getConfig: () => ({ ...config }), configure(patch) { if (disposed) return; if (patch.ribCount !== undefined) config.ribCount = Math.max(8, Math.min(18, Math.round(patch.ribCount))); rebuild() }, setMaterial(slot, material) { if (disposed) return; m[slot] = material; rebuild() }, update(_deltaSeconds) {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((geo) => geo.dispose()); bundle.dispose(); root.removeFromParent() } }
}
export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch }) }
export function createCafePreview(options: { aspect: number; time?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, framing: 'cafe' }) }
