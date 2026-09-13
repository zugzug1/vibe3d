// kk-015-service-trolley — two timber trays, modest casters and a curved push handle.
// DATUM: exact 0.70 W × 0.45 D × 0.85 H m, Y-up, front = +Z.

import { BufferGeometry, CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry, TubeGeometry, Vector3, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { bevelBox, createKkPreview, mergeParts } from '../kk-core/index.ts'

const ID = 'kk-015-service-trolley'
import { shapeConfig, type CafeShapeConfig, type ShapeControls } from '../kk-core/shape-controls.ts'
export const cafeShapeControls = {
  archSpan: { min: 0.52, max: 0.62, default: 0.60, step: 0.005, label: 'Handle centreline span (m)' },
  archRise: { min: 0.13, max: 0.25, default: 0.172, step: 0.002, label: 'Handle centreline rise (m)' },
  archThickness: { min: 0.028, max: 0.044, default: 0.036, step: 0.001, label: 'Handle diameter (m)' },
} as const satisfies ShapeControls
type Slot = 'cedar' | 'cedarDark' | 'indigo' | 'ink'
export interface KkTrolleyConfig extends CafeShapeConfig { dressing: boolean }
export interface KkTrolleyOptions extends Partial<KkTrolleyConfig> { materials?: Partial<Record<Slot, MeshStandardMaterial>> }
export interface KkTrolleyInstance { readonly root: Group; readonly parts: { frame: Group; trays: Group; wheels: Group; handle: Group }; readonly materials: Readonly<Record<Slot, Material>>; getConfig(): Readonly<KkTrolleyConfig>; configure(patch: Partial<KkTrolleyConfig>): void; setMaterial(slot: Slot, material: Material): void; update(deltaSeconds: number): void; dispose(): void }

function block(size: [number, number, number], position: [number, number, number], bevel = 0.004): BufferGeometry { const geometry = bevelBox(...size, Math.min(bevel, Math.min(...size) * 0.16)); boardUVs(geometry, size); geometry.translate(...position); return geometry }

export function createModel(options: KkTrolleyOptions = {}): KkTrolleyInstance {
  const config: KkTrolleyConfig = { ...shapeConfig(cafeShapeControls, options), dressing: options.dressing ?? true }
  const bundle = acquireSurfaceMaterials<'cedar' | 'cedarDark' | 'indigo'>({ cedar: 'cedar', cedarDark: 'cedar', indigo: 'fabric' }, options.materials)
  const materials = bundle.materials as Record<Slot, Material>
  const root = new Group(); root.name = ID; const parts = { frame: new Group(), trays: new Group(), wheels: new Group(), handle: new Group() }
  const content = new Map<Group, Group>()
  Object.entries(parts).forEach(([name, group]) => { group.name = `${ID} / ${name}`; const generated = new Group(); generated.name = `${ID} / ${name} / generated`; group.add(generated); content.set(group, generated); root.add(group) })
  const generated: BufferGeometry[] = []; let disposed = false
  const emit = (group: Group, name: string, slot: Slot, pieces: BufferGeometry[]): void => { if (!pieces.length) return; const geometry = mergeParts(pieces, `${ID}: ${name}`); generated.push(geometry); const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.castShadow = true; mesh.receiveShadow = true; content.get(group)!.add(mesh) }
  const rebuild = (): void => {
    content.forEach((group) => group.clear()); generated.splice(0).forEach((geometry) => geometry.dispose())
    const frame: BufferGeometry[] = []
    for (const x of [-config.archSpan / 2, config.archSpan / 2]) for (const z of [-0.174, 0.174]) {
      // One continuous timber from the caster mounting plate into the upper tray.
      frame.push(block([0.052, 0.535, 0.052], [x, 0.4125, z], 0.004))
    }
    emit(parts.frame, 'cedar-uprights', 'cedarDark', frame)
    const trayParts: BufferGeometry[] = []
    for (const y of [0.225, 0.625]) {
      trayParts.push(block([0.68, 0.028, 0.43], [0, y, 0], 0.003))
      trayParts.push(block([0.70, 0.065, 0.03], [0, y + 0.028, -0.21], 0.003), block([0.70, 0.065, 0.03], [0, y + 0.028, 0.21], 0.003))
      trayParts.push(block([0.03, 0.065, 0.395], [-0.335, y + 0.028, 0], 0.003), block([0.03, 0.065, 0.395], [0.335, y + 0.028, 0], 0.003))
    }
    emit(parts.trays, 'two-raised-service-trays', 'cedar', trayParts)
    const wheels: BufferGeometry[] = []; const forks: BufferGeometry[] = []
    for (const x of [-config.archSpan / 2, config.archSpan / 2]) for (const z of [-0.174, 0.174]) {
      const wheel = new CylinderGeometry(0.047, 0.047, 0.025, 24); wheel.rotateZ(Math.PI / 2); wheel.translate(x, 0.05, z); wheels.push(wheel)
      const tread = new TorusGeometry(0.043, 0.007, 8, 24); tread.rotateY(Math.PI / 2); tread.translate(x, 0.05, z); wheels.push(tread)
      // Two cheeks straddle the tire with clearance; an axle passes through their bottoms.
      for (const side of [-1, 1]) forks.push(block([0.009, 0.077, 0.020], [x + side * 0.021, 0.0865, z], 0.002))
      forks.push(block([0.052, 0.022, 0.044], [x, 0.135, z], 0.003))
      const axle = new CylinderGeometry(0.010, 0.010, 0.059, 12); axle.rotateZ(Math.PI / 2); axle.translate(x, 0.05, z); forks.push(axle)
    }
    emit(parts.wheels, 'vertical rubber tires', 'ink', wheels)
    emit(parts.wheels, 'fitted caster forks and axles', 'cedarDark', forks)
    const curve = new CatmullRomCurve3([new Vector3(-0.30, 0.66, -0.174), new Vector3(-0.30, 0.765, -0.174), new Vector3(-0.25, 0.815, -0.174), new Vector3(0, 0.832, -0.174), new Vector3(0.25, 0.815, -0.174), new Vector3(0.30, 0.765, -0.174), new Vector3(0.30, 0.66, -0.174)])
    // Keep the original default seating correction; changing tube diameter must not lift its feet.
    const datum = new TubeGeometry(curve, 32, 0.018, 8, false)
    datum.computeBoundingBox(); const seating = 0.85 - datum.boundingBox!.max.y; datum.dispose()
    for (const point of curve.points) {
      point.x *= config.archSpan / 0.60
      point.y = 0.66 + (point.y - 0.66) * (config.archRise / 0.172)
    }
    const handle = new TubeGeometry(curve, 32, config.archThickness / 2, 8, false)
    handle.translate(0, seating, 0)
    emit(parts.handle, 'curved-push-handle', 'cedar', [handle])
    const pegs: BufferGeometry[] = []
    for (const y of [0.25, 0.65]) for (const x of [-config.archSpan / 2, config.archSpan / 2]) {
      const peg = new CylinderGeometry(0.006, 0.006, 0.009, 8); peg.rotateX(Math.PI / 2); peg.translate(x, y, 0.224); pegs.push(peg)
    }
    // Peg ends stop at the original depth datum, with their shanks seated in the rails.
    pegs.forEach((g) => g.translate(0, 0, -0.0045))
    emit(parts.trays, 'pegged tray joints', 'cedarDark', pegs)
    // The old floating blue block is intentionally removed; draped cloth awaits a reviewed soft-shell pass.
  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }), configure(patch) { if (disposed) return; const next = shapeConfig(cafeShapeControls, patch, config); Object.assign(config, next); if (patch.dressing !== undefined) config.dressing = Boolean(patch.dressing); rebuild() }, setMaterial(slot, material) { if (disposed) return; materials[slot] = material; rebuild() }, update: () => {}, dispose() { if (disposed) return; disposed = true; generated.splice(0).forEach((geometry) => geometry.dispose()); bundle.dispose(); root.removeFromParent() } }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
