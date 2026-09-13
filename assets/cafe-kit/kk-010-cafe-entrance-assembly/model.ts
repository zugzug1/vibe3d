import { BufferGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, Path, Shape, TubeGeometry, CatmullRomCurve3, Vector3, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { bevelBox, createKkPreview } from '../kk-core/index.ts'
import { clothZ, loopGeometry, paintedShape, panelGeometry, panelHeight } from './cloth.ts'

const ID = 'kk-010-cafe-entrance-assembly'
type Slot = 'cedar' | 'cedarDark' | 'indigo' | 'vermilion' | 'brass'
export interface KkEntranceConfig { emblem: boolean }
export interface KkEntranceOptions extends Partial<KkEntranceConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkEntranceInstance { readonly root: Group; readonly parts: { frame: Group; roof: Group; noren: Group; hardware: Group }; readonly materials: Readonly<Record<Slot, Material>>; getConfig(): Readonly<KkEntranceConfig>; configure(patch: Partial<KkEntranceConfig>): void; setMaterial(slot: Slot, material: Material): void; update(deltaSeconds: number): void; dispose(): void }
function roofSection(width: number): BufferGeometry {
  const section = new Shape()
  section.moveTo(-0.15, 2.035); section.lineTo(0, 2.185); section.lineTo(0.15, 2.035)
  section.lineTo(0.15, 2.007); section.lineTo(0, 2.157); section.lineTo(-0.15, 2.007); section.closePath()
  const geo = new ExtrudeGeometry(section, { depth: width, bevelEnabled: false, steps: 1 })
  geo.rotateY(Math.PI / 2); geo.translate(-width / 2, 0, 0); boardUVs(geo, [width, 0.178, 0.30]); return geo
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
    for (const x of [-0.59, 0.59]) {
      box(parts.frame, m.cedar, [0.14, 2.04, 0.17], [x, 1.02, 0], 'cedar portal post')
      box(parts.frame, m.cedarDark, [0.18, 0.13, 0.23], [x, 0.065, 0], 'post foot')
      box(parts.frame, m.cedarDark, [0.147, 0.15, 0.18], [x, 0.20, 0], 'post foot sleeve')
      const peg = new CylinderGeometry(0.009, 0.009, 0.012, 12); peg.rotateX(Math.PI / 2)
      emit(parts.frame, peg, m.cedarDark, [x, 1.97, 0.101], 'lintel joint peg')
    }
    box(parts.frame, m.cedar, [1.30, 0.16, 0.20], [0, 1.99, 0], 'lintel beam')
    box(parts.frame, m.cedarDark, [1.28, 0.11, 0.055], [0, 2.115, 0], 'continuous roof support')
    emit(parts.roof, roofSection(1.40), m.cedar, [0, 0, 0], 'connected pitched roof')
    for (const x of [-0.59, 0.59]) emit(parts.roof, roofSection(0.055), m.cedarDark, [x, -0.023, 0], 'seated roof rafter')
    box(parts.roof, m.cedarDark, [1.40, 0.026, 0.032], [0, 2.187, 0], 'roof ridge cap', 0.003)
    const rod = new CylinderGeometry(0.016, 0.016, 1.22, 20); rod.rotateZ(Math.PI / 2)
    emit(parts.hardware, rod, m.brass, [0, 1.768, 0.108], 'noren rod')
    for (const x of [-0.575, 0.575]) {
      box(parts.hardware, m.brass, [0.046, 0.065, 0.025], [x, 1.768, 0.09], 'rod bracket plate', 0.003)
      const bracket = new CylinderGeometry(0.026, 0.026, 0.035, 16); bracket.rotateZ(Math.PI / 2)
      emit(parts.hardware, bracket, m.brass, [x, 1.768, 0.11], 'rod bracket socket')
    }
    for (const x of [-0.27, 0.27]) {
      emit(parts.noren, panelGeometry(), m.indigo, [x, 1.21, 0.11], 'split indigo noren')
      for (const lx of [-0.19, 0, 0.19]) emit(parts.noren, loopGeometry(lx), m.indigo, [x, 1.21, 0.11], 'wrapped cloth loop')
      for (const y of [-panelHeight / 2 + 0.012, panelHeight / 2 - 0.012]) {
        const points = Array.from({ length: 25 }, (_, i) => { const px = -0.244 + i * 0.488 / 24; return new Vector3(px, y, clothZ(px, y) + 0.0005) })
        emit(parts.noren, new TubeGeometry(new CatmullRomCurve3(points), 24, 0.001, 4, false), m.indigo, [x, 1.21, 0.11], 'sewn cloth hem')
      }
    }
    if (config.emblem) {
      const cat = new Shape()
      cat.moveTo(-0.026, -0.052); cat.bezierCurveTo(-0.066, -0.034, -0.042, 0.022, -0.014, 0.032)
      cat.lineTo(-0.024, 0.069); cat.lineTo(-0.002, 0.056); cat.lineTo(0.021, 0.075); cat.lineTo(0.027, 0.038)
      cat.bezierCurveTo(0.047, 0.024, 0.022, 0.012, 0.017, 0.008)
      cat.bezierCurveTo(0.036, -0.020, 0.043, -0.055, 0.010, -0.059)
      cat.bezierCurveTo(0.062, -0.066, 0.078, -0.030, 0.060, -0.012)
      cat.bezierCurveTo(0.073, -0.060, 0.030, -0.077, -0.026, -0.052); cat.closePath()
      emit(parts.noren, paintedShape(cat, 0.035, -0.22), m.vermilion, [0.27, 1.21, 0.11], 'seated cat ink')
      const seal = new Shape(); seal.absellipse(0, 0, 0.094, 0.10, 0, Math.PI * 2, false, 0)
      const hole = new Path(); hole.absellipse(0, 0, 0.086, 0.092, 0, Math.PI * 2, true, 0); seal.holes.push(hole)
      emit(parts.noren, paintedShape(seal, 0.035, -0.22), m.vermilion, [0.27, 1.21, 0.11], 'cat seal border')
    }
  }
  rebuild(); return { root, parts, materials: m, getConfig: () => ({ ...config }), configure(patch) { if (disposed) return; if (patch.emblem !== undefined) config.emblem = patch.emblem; rebuild() }, setMaterial(slot, material) { if (disposed) return; m[slot] = material; rebuild() }, update(_deltaSeconds) {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((g) => g.dispose()); bundle.dispose(); root.removeFromParent() } }
}
export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch }) }
export function createCafePreview(options: { aspect: number; time?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, framing: 'cafe' }) }
