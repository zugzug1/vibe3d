import { BufferAttribute, BufferGeometry, CylinderGeometry, Group, LatheGeometry, Mesh, TubeGeometry, CatmullRomCurve3, Vector2, Vector3, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { bevelBox, createKkPreview } from '../kk-core/index.ts'

const ID = 'kk-018-handwashing-basin'
type Slot = 'cedar' | 'cedarDark' | 'glaze' | 'glazeDeep' | 'brass' | 'tatami'
export interface KkBasinConfig { towelBar: boolean }
export interface KkBasinOptions extends Partial<KkBasinConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkBasinInstance { readonly root: Group; readonly parts: { stand: Group; bowl: Group; tap: Group; towel: Group }; readonly materials: Readonly<Record<Slot, Material>>; getConfig(): Readonly<KkBasinConfig>; configure(patch: Partial<KkBasinConfig>): void; setMaterial(slot: Slot, material: Material): void; update(deltaSeconds: number): void; dispose(): void }
function basinGeometry(): BufferGeometry { const profile: [number, number][] = [[0, 0], [0.45, 0], [0.62, 0.02], [0.78, 0.14], [0.94, 0.48], [1, 0.82], [0.99, 0.96], [0.95, 1], [0.90, 0.985], [0.84, 0.90], [0.80, 0.70], [0.68, 0.40], [0.50, 0.20], [0.18, 0.14], [0, 0.14]]; const geo = new LatheGeometry(profile.map(([r, y]) => new Vector2(r * 0.29, y * 0.18)), 32); geo.scale(1, 1, 0.755); const p = geo.getAttribute('position'); for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.6075); geo.computeVertexNormals(); return geo }
export function createModel(options: KkBasinOptions = {}): KkBasinInstance {
  const config = { towelBar: options.towelBar ?? true }; const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar', glaze: 'glaze', glazeDeep: 'glaze', brass: 'cedar', tatami: 'fabric' }, options.materials); const m = bundle.materials
  if (!options.materials?.brass) Object.assign(m.brass, { map: null, normalMap: null, roughnessMap: null })
  const root = new Group(); root.name = ID; const parts = { stand: new Group(), bowl: new Group(), tap: new Group(), towel: new Group() }; const content = new Map<Group, Group>(); Object.entries(parts).forEach(([key, g]) => { g.name = `${ID} / ${key}`; const generated = new Group(); generated.name = `${ID} / ${key} / generated`; g.add(generated); root.add(g); content.set(g, generated) }); const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (group: Group, geo: BufferGeometry, mat: Material, pos: [number, number, number], name: string): Mesh => { geometries.push(geo); const mesh = new Mesh(geo, mat); mesh.name = `${ID} / ${name}`; mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; content.get(group)!.add(mesh); return mesh }
  const box = (group: Group, mat: Material, size: [number, number, number], pos: [number, number, number], name: string): void => { const geo = bevelBox(...size, Math.min(0.005, Math.min(...size) * 0.14)); boardUVs(geo, size); emit(group, geo, mat, pos, name) }
  const cylinder = (group: Group, mat: Material, radius: number, height: number, pos: [number, number, number], name: string, radial = 12): void => { const geo = new CylinderGeometry(radius, radius, height, radial); emit(group, geo, mat, pos, name) }
  const rebuild = (): void => { content.forEach((g) => g.clear()); geometries.splice(0).forEach((g) => g.dispose())
    box(parts.stand, m.cedar, [0.65, 0.075, 0.45], [0, 0.57, 0], 'cedar basin top')
    for (const x of [-0.27, 0.27]) for (const z of [-0.17, 0.17]) box(parts.stand, m.cedarDark, [0.075, 0.54, 0.075], [x, 0.27, z], 'washstand leg')
    for (const z of [-0.17, 0.17]) box(parts.stand, m.cedarDark, [0.54, 0.06, 0.075], [0, 0.13, z], 'lower stand rail')
    emit(parts.bowl, basinGeometry(), m.glaze, [0, 0, 0], 'hollow ceramic basin')
    const drain = new CylinderGeometry(0.035, 0.035, 0.006, 16); emit(parts.bowl, drain, m.glazeDeep, [0, 0.611, 0], 'dark basin drain')
    const rim = new CylinderGeometry(0.215, 0.215, 0.006, 32); emit(parts.bowl, rim, m.glazeDeep, [0, 0.7875, 0], 'dark basin rim')
    cylinder(parts.tap, m.brass, 0.035, 0.27, [0.22, 0.7425, -0.12], 'tap upright')
    cylinder(parts.tap, m.brass, 0.045, 0.045, [0.22, 0.8775, -0.12], 'tap cap')
    const spout = new TubeGeometry(new CatmullRomCurve3([new Vector3(0.22, 0.80, -0.12), new Vector3(0.22, 0.82, 0.02), new Vector3(0.12, 0.83, 0.08), new Vector3(0.05, 0.83, 0.08)]), 8, 0.025, 10, false); emit(parts.tap, spout, m.brass, [0, 0, 0], 'curved tap spout')
    if (config.towelBar) { const bar = new TubeGeometry(new CatmullRomCurve3([new Vector3(-0.23, 0.47, 0.212), new Vector3(0, 0.47, 0.212), new Vector3(0.23, 0.47, 0.212)]), 8, 0.012, 8, false); emit(parts.towel, bar, m.cedar, [0, 0, 0], 'towel bar'); box(parts.towel, m.tatami, [0.25, 0.22, 0.012], [0, 0.40, 0.205], 'hanging towel') }
  }
  rebuild(); return { root, parts, materials: m, getConfig: () => ({ ...config }), configure(patch) { if (disposed) return; if (patch.towelBar !== undefined) config.towelBar = patch.towelBar; rebuild() }, setMaterial(slot, material) { if (disposed) return; m[slot] = material; rebuild() }, update(_deltaSeconds) {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((g) => g.dispose()); bundle.dispose(); root.removeFromParent() } }
}
export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch }) }
export function createCafePreview(options: { aspect: number; time?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, framing: 'cafe' }) }
