import { BufferAttribute, BufferGeometry, Group, Mesh, Shape, ShapeGeometry, TubeGeometry, CatmullRomCurve3, Vector3, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { bevelBox, createKkPreview } from '../kk-core/index.ts'

const ID = 'kk-010-cafe-entrance-assembly'
type Slot = 'cedar' | 'cedarDark' | 'indigo' | 'vermilion' | 'brass'
export interface KkEntranceConfig { emblem: boolean }
export interface KkEntranceOptions extends Partial<KkEntranceConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkEntranceInstance { readonly root: Group; readonly parts: { frame: Group; roof: Group; noren: Group; hardware: Group }; readonly materials: Readonly<Record<Slot, Material>>; getConfig(): Readonly<KkEntranceConfig>; configure(patch: Partial<KkEntranceConfig>): void; setMaterial(slot: Slot, material: Material): void; update(deltaSeconds: number): void; dispose(): void }
function panelGeometry(width: number, height: number): BufferGeometry {
  const cols = 8; const rows = 10; const positions: number[] = []; const indices: number[] = []
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) { const u = x / cols; const v = y / rows; const fold = 0.012 * Math.sin(u * Math.PI * 3 + v * 2) + 0.006 * Math.sin(v * Math.PI * 5); positions.push((u - 0.5) * width, (v - 0.5) * height, fold) }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const a = y * (cols + 1) + x; const b = a + 1; const c = a + cols + 2; const d = a + cols + 1; indices.push(a, b, d, b, c, d) }
  const geo = new BufferGeometry(); geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3)); geo.setIndex(indices); geo.computeVertexNormals(); return geo
}
export function createModel(options: KkEntranceOptions = {}): KkEntranceInstance {
  const config = { emblem: options.emblem ?? true }; const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar', indigo: 'fabric', vermilion: 'fabric', brass: 'cedar' }, options.materials); const m = bundle.materials
  if (!options.materials?.brass) Object.assign(m.brass, { map: null, normalMap: null, roughnessMap: null })
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { frame: new Group(), roof: new Group(), noren: new Group(), hardware: new Group() }; const content = new Map<Group, Group>(); Object.entries(parts).forEach(([key, group]) => { group.name = `${ID} / ${key}`; const generated = new Group(); generated.name = `${ID} / ${key} / generated`; group.add(generated); root.add(group); content.set(group, generated) })
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (group: Group, geo: BufferGeometry, material: Material, pos: [number, number, number], name: string): Mesh => { geometries.push(geo); const mesh = new Mesh(geo, material); mesh.name = `${ID} / ${name}`; mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; content.get(group)!.add(mesh); return mesh }
  const box = (group: Group, mat: Material, size: [number, number, number], pos: [number, number, number], name: string, bevel = 0.006): void => { const geo = bevelBox(...size, bevel); boardUVs(geo, size); emit(group, geo, mat, pos, name) }
  const rebuild = (): void => {
    content.forEach((g) => g.clear()); geometries.splice(0).forEach((g) => g.dispose())
    for (const x of [-0.62, 0.62]) { box(parts.frame, m.cedar, [0.16, 1.86, 0.18], [x, 0.93, 0], 'cedar portal post'); box(parts.frame, m.cedarDark, [0.14, 0.36, 0.22], [x, 0.18, 0], 'post foot') }
    box(parts.frame, m.cedar, [1.40, 0.15, 0.20], [0, 1.88, 0], 'lintel beam')
    box(parts.frame, m.cedarDark, [1.24, 0.10, 0.18], [0, 2.00, 0], 'continuous roof support')
    for (const x of [-0.42, 0.42]) box(parts.roof, m.cedarDark, [0.56, 0.08, 0.26], [x, 2.06, 0], 'roof eave')
    const roof = bevelBox(1.34, 0.10, 0.30, 0.006); roof.rotateZ(-0.025); roof.computeBoundingBox(); boardUVs(roof, [1.34, 0.10, 0.30]); emit(parts.roof, roof, m.cedar, [0, 2.2 - roof.boundingBox!.max.y, 0], 'shallow sloped roof cap')
    const rod = new TubeGeometry(new CatmullRomCurve3([new Vector3(-0.50, 1.62, 0.07), new Vector3(0, 1.62, 0.07), new Vector3(0.50, 1.62, 0.07)]), 8, 0.018, 10, false); emit(parts.hardware, rod, m.brass, [0, 0, 0], 'noren rod')
    for (const x of [-0.31, 0.31]) { const panel = panelGeometry(0.54, 0.88); boardUVs(panel, [0.54, 0.88, 0.02]); emit(parts.noren, panel, m.indigo, [x, 1.18, 0.09], 'split indigo noren'); box(parts.noren, m.indigo, [0.07, 0.10, 0.035], [x, 1.64, 0.09], 'noren hanging loop') }
    if (config.emblem) { const cat = new Shape(); cat.moveTo(-0.055, -0.045); cat.lineTo(-0.055, 0.035); cat.lineTo(-0.025, 0.060); cat.lineTo(0, 0.040); cat.lineTo(0.025, 0.060); cat.lineTo(0.055, 0.035); cat.lineTo(0.055, -0.045); cat.closePath(); const emblem = new ShapeGeometry(cat); emit(parts.noren, emblem, m.vermilion, [0.29, 1.15, 0.101], 'small cat emblem') }
  }
  rebuild(); return { root, parts, materials: m, getConfig: () => ({ ...config }), configure(patch) { if (disposed) return; if (patch.emblem !== undefined) config.emblem = patch.emblem; rebuild() }, setMaterial(slot, material) { if (disposed) return; m[slot] = material; rebuild() }, update(_deltaSeconds) {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((g) => g.dispose()); bundle.dispose(); root.removeFromParent() } }
}
export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch }) }
export function createCafePreview(options: { aspect: number; time?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, framing: 'cafe' }) }
