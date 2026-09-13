// kk-015-service-trolley — two timber trays, modest casters and a curved push handle.
// DATUM: exact 0.70 W × 0.45 D × 0.85 H m, Y-up, front = +Z.

import { BufferGeometry, CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry, TubeGeometry, Vector3, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { bevelBox, createKkPreview, mergeParts } from '../kk-core/index.ts'

const ID = 'kk-015-service-trolley'
type Slot = 'cedar' | 'cedarDark' | 'indigo' | 'ink'
export interface KkTrolleyConfig { dressing: boolean }
export interface KkTrolleyOptions extends Partial<KkTrolleyConfig> { materials?: Partial<Record<Slot, MeshStandardMaterial>> }
export interface KkTrolleyInstance { readonly root: Group; readonly parts: { frame: Group; trays: Group; wheels: Group; handle: Group }; readonly materials: Readonly<Record<Slot, Material>>; getConfig(): Readonly<KkTrolleyConfig>; configure(patch: Partial<KkTrolleyConfig>): void; setMaterial(slot: Slot, material: Material): void; update(deltaSeconds: number): void; dispose(): void }

function block(size: [number, number, number], position: [number, number, number], bevel = 0.004): BufferGeometry { const geometry = bevelBox(...size, Math.min(bevel, Math.min(...size) * 0.16)); boardUVs(geometry, size); geometry.translate(...position); return geometry }

export function createModel(options: KkTrolleyOptions = {}): KkTrolleyInstance {
  const config: KkTrolleyConfig = { dressing: options.dressing ?? true }
  const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar', indigo: 'fabric' }, options.materials); const materials = bundle.materials
  const root = new Group(); root.name = ID; const parts = { frame: new Group(), trays: new Group(), wheels: new Group(), handle: new Group() }
  const content = new Map<Group, Group>()
  Object.entries(parts).forEach(([name, group]) => { group.name = `${ID} / ${name}`; const generated = new Group(); generated.name = `${ID} / ${name} / generated`; group.add(generated); content.set(group, generated); root.add(group) })
  const generated: BufferGeometry[] = []; let disposed = false
  const emit = (group: Group, name: string, slot: Slot, pieces: BufferGeometry[]): void => { if (!pieces.length) return; const geometry = mergeParts(pieces, `${ID}: ${name}`); generated.push(geometry); const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.castShadow = true; mesh.receiveShadow = true; content.get(group)!.add(mesh) }
  const rebuild = (): void => {
    content.forEach((group) => group.clear()); generated.splice(0).forEach((geometry) => geometry.dispose())
    const frame: BufferGeometry[] = []
    for (const x of [-0.32, 0.32]) for (const z of [-0.145, 0.145]) {
      frame.push(block([0.055, 0.22, 0.055], [x, 0.14, z], 0.004))
      frame.push(block([0.055, 0.28, 0.055], [x, 0.43, z], 0.004))
    }
    emit(parts.frame, 'cedar-uprights', 'cedarDark', frame)
    const trayParts: BufferGeometry[] = []
    for (const y of [0.29, 0.59]) {
      trayParts.push(block([0.64, 0.035, 0.45], [0, y, 0], 0.005))
      trayParts.push(block([0.66, 0.07, 0.035], [0, y + 0.045, -0.2075], 0.004), block([0.66, 0.07, 0.035], [0, y + 0.045, 0.2075], 0.004))
      trayParts.push(block([0.035, 0.07, 0.385], [-0.31, y + 0.045, 0], 0.004), block([0.035, 0.07, 0.385], [0.31, y + 0.045, 0], 0.004))
    }
    emit(parts.trays, 'two-raised-service-trays', 'cedar', trayParts)
    const wheels: BufferGeometry[] = []
    for (const x of [-0.332, 0.332]) for (const z of [-0.149, 0.149]) {
      const wheel = new CylinderGeometry(0.058, 0.058, 0.036, 16); wheel.rotateZ(Math.PI / 2); wheel.translate(x, 0.058, z); wheels.push(wheel)
      const tread = new TorusGeometry(0.052, 0.006, 8, 16); tread.rotateY(Math.PI / 2); tread.translate(x, 0.058, z); wheels.push(tread)
      wheels.push(block([0.018, 0.13, 0.028], [x, 0.14, z], 0.002), block([0.035, 0.018, 0.035], [x, 0.075, z], 0.002))
    }
    emit(parts.wheels, 'rubber-wheels-and-axle-forks', 'ink', wheels)
    const curve = new CatmullRomCurve3([new Vector3(-0.30, 0.64, -0.17), new Vector3(-0.30, 0.783, -0.18), new Vector3(0, 0.828, -0.18), new Vector3(0.30, 0.783, -0.18), new Vector3(0.30, 0.64, -0.17)])
    emit(parts.handle, 'curved-push-handle', 'cedar', [new TubeGeometry(curve, 16, 0.022, 8, false)])
    // The old floating blue block is intentionally removed; draped cloth awaits a reviewed soft-shell pass.
  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }), configure(patch) { if (disposed) return; if (patch.dressing !== undefined) config.dressing = Boolean(patch.dressing); rebuild() }, setMaterial(slot, material) { if (disposed) return; materials[slot] = material; rebuild() }, update: () => {}, dispose() { if (disposed) return; disposed = true; generated.splice(0).forEach((geometry) => geometry.dispose()); bundle.dispose(); root.removeFromParent() } }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
