import { CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, TubeGeometry, CatmullRomCurve3, Vector3, type BufferGeometry, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { createKkPreview } from '../kk-core/index.ts'

const ID = 'kk-014-zabuton-cushion'
type Slot = 'indigo' | 'indigoFaded' | 'brass'
export interface KkZabutonConfig { tufted: boolean }
export interface KkZabutonOptions extends Partial<KkZabutonConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkZabutonInstance { readonly root: Group; readonly parts: { cushion: Group; seams: Group; ties: Group }; readonly materials: Readonly<Record<Slot, Material>>; getConfig(): Readonly<KkZabutonConfig>; configure(patch: Partial<KkZabutonConfig>): void; setMaterial(slot: Slot, material: Material): void; update(deltaSeconds: number): void; dispose(): void }
function cloth(width: number, depth: number, height: number): BufferGeometry { const geo = new SphereGeometry(1, 24, 12); const p = geo.getAttribute('position'); for (let i = 0; i < p.count; i++) { const x = Math.sign(p.getX(i)) * Math.pow(Math.abs(p.getX(i)), 0.32); const z = Math.sign(p.getZ(i)) * Math.pow(Math.abs(p.getZ(i)), 0.32); const y = Math.sign(p.getY(i)) * Math.pow(Math.abs(p.getY(i)), 0.65); p.setXYZ(i, x * width / 2, y * height / 2, z * depth / 2) } p.needsUpdate = true; geo.computeVertexNormals(); boardUVs(geo, [width, height, depth]); return geo }
export function createModel(options: KkZabutonOptions = {}): KkZabutonInstance {
  const config = { tufted: options.tufted ?? true }; const bundle = acquireSurfaceMaterials<Slot>({ indigo: 'fabric', indigoFaded: 'fabric', brass: 'fabric' }, options.materials); const base = bundle.materials; const m: Record<Slot, Material> = { indigo: base.indigo, indigoFaded: base.indigoFaded, brass: base.brass }; m.brass.map = null; m.brass.normalMap = null; m.brass.roughnessMap = null
  const root = new Group(); root.name = ID; const parts = { cushion: new Group(), seams: new Group(), ties: new Group() }; const content = new Map<Group, Group>(); Object.entries(parts).forEach(([key, g]) => { g.name = `${ID} / ${key}`; const generated = new Group(); generated.name = `${ID} / ${key} / generated`; g.add(generated); root.add(g); content.set(g, generated) }); const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (group: Group, geo: BufferGeometry, mat: Material, pos: [number, number, number], name: string): Mesh => { geometries.push(geo); const mesh = new Mesh(geo, mat); mesh.name = `${ID} / ${name}`; mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; content.get(group)!.add(mesh); return mesh }
  const rebuild = (): void => { content.forEach((g) => g.clear()); geometries.splice(0).forEach((g) => g.dispose()); emit(parts.cushion, cloth(0.5, 0.5, 0.10), m.indigo, [0, 0.055, 0], 'stuffed indigo cushion')
    const segment = (a: Vector3, b: Vector3, name: string): void => emit(parts.seams, new TubeGeometry(new CatmullRomCurve3([a, b]), 8, 0.0022, 4, false), m.indigoFaded, [0, 0, 0], name)
    segment(new Vector3(-0.21, 0.055, -0.21), new Vector3(0.21, 0.055, -0.21), 'closed perimeter seam front')
    segment(new Vector3(0.21, 0.055, -0.21), new Vector3(0.21, 0.055, 0.21), 'closed perimeter seam right')
    segment(new Vector3(0.21, 0.055, 0.21), new Vector3(-0.21, 0.055, 0.21), 'closed perimeter seam rear')
    segment(new Vector3(-0.21, 0.055, 0.21), new Vector3(-0.21, 0.055, -0.21), 'closed perimeter seam left')
    segment(new Vector3(-0.20, 0.057, 0), new Vector3(-0.07, 0.060, 0), 'front seam left')
    segment(new Vector3(-0.07, 0.060, 0), new Vector3(0.07, 0.060, 0), 'front seam centre')
    segment(new Vector3(0.07, 0.060, 0), new Vector3(0.20, 0.057, 0), 'front seam right')
    if (config.tufted) { const button = new CylinderGeometry(0.014, 0.014, 0.004, 12); emit(parts.seams, button, m.indigoFaded, [0, 0.097, 0], 'centre tuft button'); for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [0.18, 0.18], [-0.18, 0.18]] as const) { const knot = new TorusGeometry(0.008, 0.0025, 5, 8); knot.rotateX(Math.PI / 2); emit(parts.ties, knot, m.indigoFaded, [x, 0.082, z], 'corner knot'); const sx = x < 0 ? -1 : 1; const sz = z < 0 ? -1 : 1; const tailA = new TubeGeometry(new CatmullRomCurve3([new Vector3(x, 0.078, z), new Vector3(x + sx * 0.012, 0.045, z + sz * 0.005)]), 6, 0.0025, 4, false); const tailB = new TubeGeometry(new CatmullRomCurve3([new Vector3(x, 0.078, z), new Vector3(x + sx * 0.005, 0.043, z + sz * 0.012)]), 6, 0.0025, 4, false); emit(parts.ties, tailA, m.indigoFaded, [0, 0, 0], 'corner tie tail'); emit(parts.ties, tailB, m.indigoFaded, [0, 0, 0], 'corner tie tail') } }
  }
  rebuild(); return { root, parts, materials: m, getConfig: () => ({ ...config }), configure(patch) { if (disposed) return; if (patch.tufted !== undefined) config.tufted = patch.tufted; rebuild() }, setMaterial(slot, material) { if (disposed) return; m[slot] = material; rebuild() }, update(_deltaSeconds) {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((g) => g.dispose()); bundle.dispose(); root.removeFromParent() } }
}
export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch }) }
export function createCafePreview(options: { aspect: number; time?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, framing: 'cafe' }) }
