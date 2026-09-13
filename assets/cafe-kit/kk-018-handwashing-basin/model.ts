import { BufferAttribute, BufferGeometry, CylinderGeometry, Group, LatheGeometry, Mesh, TorusGeometry, TubeGeometry, CatmullRomCurve3, Vector2, Vector3, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { bevelBox, createKkPreview } from '../kk-core/index.ts'

const ID = 'kk-018-handwashing-basin'
type Slot = 'cedar' | 'cedarDark' | 'glaze' | 'glazeDeep' | 'brass' | 'tatami'
export interface KkBasinConfig { towelBar: boolean }
export interface KkBasinOptions extends Partial<KkBasinConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkBasinInstance { readonly root: Group; readonly parts: { stand: Group; bowl: Group; tap: Group; towel: Group }; readonly materials: Readonly<Record<Slot, Material>>; getConfig(): Readonly<KkBasinConfig>; configure(patch: Partial<KkBasinConfig>): void; setMaterial(slot: Slot, material: Material): void; update(deltaSeconds: number): void; dispose(): void }
/** Continuous front, crown and shorter back: the crown is supported by the bar. */
function foldedTowel(): BufferGeometry {
  const path: [number, number][] = []
  for (let i = 0; i < 7; i++) path.push([0.24 + i * 0.215 / 6, 0.216])
  for (let i = 1; i <= 8; i++) { const a = i * Math.PI / 8; path.push([0.455 + 0.013 * Math.sin(a), 0.203 + 0.013 * Math.cos(a)]) }
  for (let i = 1; i <= 6; i++) path.push([0.455 - i * 0.185 / 6, 0.190])
  const positions: number[] = []; const uv: number[] = []; const indices: number[] = []; const cols = 12
  for (let side = 0; side < 2; side++) for (let j = 0; j < path.length; j++) for (let i = 0; i <= cols; i++) {
    const u = i / cols; const [y, z] = path[j]!
    const free = Math.min(1, Math.abs(y - 0.455) / 0.12)
    positions.push((u - 0.5) * 0.26, y + 0.003 * Math.sin(u * Math.PI * 3) * free, z + 0.003 * Math.sin(u * Math.PI * 6) * free + (side ? -0.001 : 0.001))
    uv.push(u, j / (path.length - 1))
  }
  const layer = path.length * (cols + 1)
  for (let side = 0; side < 2; side++) for (let j = 0; j < path.length - 1; j++) for (let i = 0; i < cols; i++) {
    const a = side * layer + j * (cols + 1) + i; const b = a + 1; const c = b + cols + 1; const d = a + cols + 1
    indices.push(...(side ? [a, d, b, b, d, c] : [a, b, d, b, c, d]))
  }
  // Close the two hems and selvedges with real thickness.
  const edge = (a: number, b: number): void => { indices.push(a, a + layer, b, b, a + layer, b + layer) }
  for (let i = 0; i < cols; i++) { edge(i + 1, i); edge(layer - cols - 1 + i, layer - cols + i) }
  for (let j = 0; j < path.length - 1; j++) { edge(j * (cols + 1), (j + 1) * (cols + 1)); edge((j + 1) * (cols + 1) + cols, j * (cols + 1) + cols) }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3)); geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry
}
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
    for (const z of [-0.17, 0.17]) box(parts.stand, m.cedarDark, [0.54, 0.06, 0.065], [0, 0.13, z], 'lower stand rail')
    for (const x of [-0.27, 0.27]) {
      box(parts.stand, m.cedarDark, [0.065, 0.06, 0.34], [x, 0.13, 0], 'lower side rail')
      box(parts.stand, m.cedar, [0.060, 0.085, 0.34], [x, 0.51, 0], 'top side apron')
    }
    for (const z of [-0.17, 0.17]) box(parts.stand, m.cedar, [0.54, 0.085, 0.060], [0, 0.51, z], 'top apron')
    for (const z of [-0.105, 0, 0.105]) box(parts.stand, m.cedar, [0.49, 0.022, 0.078], [0, 0.156, z], 'lower shelf slat')
    emit(parts.bowl, basinGeometry(), m.glaze, [0, 0, 0], 'hollow ceramic basin')
    const drain = new CylinderGeometry(0.024, 0.024, 0.004, 16); emit(parts.bowl, drain, m.brass, [0, 0.634, 0], 'seated basin drain')
    const rim = new TorusGeometry(0.2755, 0.0028, 6, 48); rim.rotateX(Math.PI / 2); rim.scale(1, 1, 0.755)
    emit(parts.bowl, rim, m.glazeDeep, [0, 0.7865, 0], 'open glazed lip')
    cylinder(parts.tap, m.brass, 0.024, 0.275, [0.26, 0.74, -0.155], 'tap upright', 20)
    cylinder(parts.tap, m.brass, 0.033, 0.025, [0.26, 0.8875, -0.155], 'tap cap', 20)
    cylinder(parts.tap, m.brass, 0.033, 0.010, [0.26, 0.61, -0.155], 'tap mounting foot', 20)
    const lever = new CylinderGeometry(0.006, 0.006, 0.085, 10); lever.rotateZ(Math.PI / 2)
    emit(parts.tap, lever, m.brass, [0.201, 0.884, -0.155], 'tap control lever')
    const curve = new CatmullRomCurve3([new Vector3(0.26, 0.829, -0.155), new Vector3(0.18, 0.841, -0.11), new Vector3(0.10, 0.842, -0.055), new Vector3(0.075, 0.811, -0.03)])
    emit(parts.tap, new TubeGeometry(curve, 24, 0.018, 12, false), m.brass, [0, 0, 0], 'curved tap spout')
    const inner = new TubeGeometry(curve, 24, 0.013, 12, false)
    const index = inner.index!; for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b) }; inner.computeVertexNormals()
    emit(parts.tap, inner, m.brass, [0, 0, 0], 'spout inner bore')
    const outlet = new TorusGeometry(0.0155, 0.0025, 6, 24)
    const mouth = emit(parts.tap, outlet, m.brass, curve.getPoint(1).toArray() as [number, number, number], 'open spout mouth')
    mouth.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), curve.getTangent(1))
    if (config.towelBar) {
      for (const x of [-0.245, 0.245]) box(parts.towel, m.cedar, [0.043, 0.045, 0.075], [x, 0.455, 0.181], 'towel bar bracket')
      const bar = new CylinderGeometry(0.010, 0.010, 0.50, 16); bar.rotateZ(Math.PI / 2)
      emit(parts.towel, bar, m.cedar, [0, 0.455, 0.203], 'supported towel bar')
      emit(parts.towel, foldedTowel(), m.tatami, [0, 0, 0], 'towel folded over bar')
    }
  }
  rebuild(); return { root, parts, materials: m, getConfig: () => ({ ...config }), configure(patch) { if (disposed) return; if (patch.towelBar !== undefined) config.towelBar = patch.towelBar; rebuild() }, setMaterial(slot, material) { if (disposed) return; m[slot] = material; rebuild() }, update(_deltaSeconds) {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((g) => g.dispose()); bundle.dispose(); root.removeFromParent() } }
}
export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch }) }
export function createCafePreview(options: { aspect: number; time?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, framing: 'cafe' }) }
