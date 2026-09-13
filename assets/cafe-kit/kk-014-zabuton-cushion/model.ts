import { Group, Mesh, Raycaster, TorusGeometry, TubeGeometry, CatmullRomCurve3, Vector3, type BufferGeometry, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials } from '../kk-core/surface-detail.ts'
import { createKkPreview } from '../kk-core/index.ts'
import { cushionGeometry, cushionSurface } from './cloth.ts'

const ID = 'kk-014-zabuton-cushion'
type Slot = 'indigo' | 'indigoFaded' | 'brass'
export interface KkZabutonConfig { tufted: boolean }
export interface KkZabutonOptions extends Partial<KkZabutonConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkZabutonInstance { readonly root: Group; readonly parts: { cushion: Group; seams: Group; ties: Group }; readonly materials: Readonly<Record<Slot, Material>>; getConfig(): Readonly<KkZabutonConfig>; configure(patch: Partial<KkZabutonConfig>): void; setMaterial(slot: Slot, material: Material): void; update(deltaSeconds: number): void; dispose(): void }

export function createModel(options: KkZabutonOptions = {}): KkZabutonInstance {
  const config = { tufted: options.tufted ?? true }
  const bundle = acquireSurfaceMaterials<Slot>({ indigo: 'fabric', indigoFaded: 'fabric', brass: 'fabric' }, options.materials)
  const m: Record<Slot, Material> = { indigo: bundle.materials.indigo, indigoFaded: bundle.materials.indigoFaded, brass: bundle.materials.brass }
  const root = new Group(); root.name = ID
  const parts = { cushion: new Group(), seams: new Group(), ties: new Group() }
  const content = new Map<Group, Group>()
  for (const [key, anchor] of Object.entries(parts)) { anchor.name = `${ID} / ${key}`; const generated = new Group(); anchor.add(generated); root.add(anchor); content.set(anchor, generated) }
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (group: Group, geo: BufferGeometry, mat: Material, name: string): Mesh => {
    geometries.push(geo); const mesh = new Mesh(geo, mat); mesh.name = `${ID} / ${name}`; mesh.castShadow = true; mesh.receiveShadow = true; content.get(group)!.add(mesh); return mesh
  }
  const thread = (group: Group, points: Vector3[], name: string, radius = 0.0018): void => {
    emit(group, new TubeGeometry(new CatmullRomCurve3(points, false, 'centripetal'), 12, radius, 5, false), m.indigoFaded, name)
  }
  const rebuild = (): void => {
    content.forEach((g) => g.clear()); geometries.splice(0).forEach((g) => g.dispose())
    const shell = emit(parts.cushion, cushionGeometry(config.tufted), m.indigo, 'gathered cloth shell')
    // Detached query mesh shares the geometry but always has an identity transform.
    // A consumer may have already updated the root's world matrix before configure().
    const localShell = new Mesh(shell.geometry, shell.material)
    // Query the actual triangulated shell, including its depression, in model-local space.
    const ray = new Raycaster()
    const onTop = (x: number, z: number): Vector3 => {
      ray.set(new Vector3(x, 0.2, z), new Vector3(0, -1, 0))
      const hit = ray.intersectObject(localShell)[0]
      if (!hit) throw new Error('Cushion thread is outside its supporting shell')
      return new Vector3(x, hit.point.y + 0.001, z)
    }
    const perimeter = Array.from({ length: 48 }, (_, i) => new Vector3(...cushionSurface(1, i * Math.PI * 2 / 48, config.tufted)))
    const welt = new TubeGeometry(new CatmullRomCurve3(perimeter, true), 64, 0.0025, 8, true)
    welt.computeBoundingBox()
    // Remove the spline's 0.03 mm overshoot without moving the shell or runtime root.
    welt.scale(0.25 / welt.boundingBox!.max.x, 1, 0.25 / welt.boundingBox!.max.z)
    emit(parts.seams, welt, m.indigoFaded, 'closed perimeter welt')
    if (config.tufted) {
      const center = onTop(0, 0)
      const knot = new TorusGeometry(0.006, 0.002, 6, 12); knot.rotateX(Math.PI / 2); knot.translate(center.x, center.y, center.z)
      emit(parts.seams, knot, m.indigoFaded, 'centre tuft knot')
      for (const sign of [-1, 1]) thread(parts.seams, Array.from({ length: 9 }, (_, i) => onTop(sign * (0.003 + i * 0.0013), i * 0.004)), 'centre tuft thread')
    }
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + i * Math.PI / 2
      const [x, y, z] = cushionSurface(1, angle, config.tufted)
      const sx = Math.sign(x); const sz = Math.sign(z)
      const knot = new TorusGeometry(0.0055, 0.0022, 6, 10); knot.rotateX(Math.PI / 2); knot.translate(x, y + 0.002, z)
      emit(parts.ties, knot, m.indigoFaded, 'corner knot')
      for (const spread of [-1, 1]) thread(parts.ties, [
        new Vector3(x, y + 0.002, z),
        new Vector3(x + sx * 0.013, y - 0.001, z + sz * 0.010),
        new Vector3(x + sx * (0.022 + spread * 0.003), 0.013, z + sz * (0.022 - spread * 0.003)),
      ], 'corner tie tail', 0.002)
    }
  }
  rebuild()
  return { root, parts, materials: m, getConfig: () => ({ ...config }), configure(patch) { if (disposed) return; if (patch.tufted !== undefined) config.tufted = patch.tufted; rebuild() }, setMaterial(slot, material) { if (disposed) return; m[slot] = material; rebuild() }, update(_deltaSeconds) {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((g) => g.dispose()); bundle.dispose(); root.removeFromParent() } }
}
export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch }) }
export function createCafePreview(options: { aspect: number; time?: number }) { return createKkPreview(createModel(), { aspect: options.aspect, framing: 'cafe' }) }
