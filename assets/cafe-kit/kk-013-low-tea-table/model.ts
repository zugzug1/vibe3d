// kk-013-low-tea-table — broad cedar top on a low trestle base.
// DATUM: exact 0.90 W × 0.60 D × 0.35 H m, Y-up, front = +Z.

import { BufferGeometry, Group, Mesh, MeshStandardMaterial, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { bevelBox, createKkPreview, mergeParts } from '../kk-core/index.ts'

const ID = 'kk-013-low-tea-table'
type Slot = 'cedar' | 'cedarDark'
export interface KkTeaTableConfig { planks: boolean }
export interface KkTeaTableOptions extends Partial<KkTeaTableConfig> { materials?: Partial<Record<Slot, MeshStandardMaterial>> }
export interface KkTeaTableInstance { readonly root: Group; readonly parts: { top: Group; trestle: Group; stretcher: Group }; readonly materials: Readonly<Record<Slot, Material>>; getConfig(): Readonly<KkTeaTableConfig>; configure(patch: Partial<KkTeaTableConfig>): void; setMaterial(slot: Slot, material: Material): void; update(deltaSeconds: number): void; dispose(): void }

function block(size: [number, number, number], position: [number, number, number], bevel = 0.005): BufferGeometry { const geometry = bevelBox(...size, Math.min(bevel, Math.min(...size) * 0.16)); boardUVs(geometry, size); geometry.translate(...position); return geometry }

export function createModel(options: KkTeaTableOptions = {}): KkTeaTableInstance {
  const config: KkTeaTableConfig = { planks: options.planks ?? true }
  const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar' }, options.materials); const materials = bundle.materials
  const root = new Group(); root.name = ID; const parts = { top: new Group(), trestle: new Group(), stretcher: new Group() }
  const content = new Map<Group, Group>()
  Object.entries(parts).forEach(([name, group]) => { group.name = `${ID} / ${name}`; const generated = new Group(); generated.name = `${ID} / ${name} / generated`; group.add(generated); content.set(group, generated); root.add(group) })
  const generated: BufferGeometry[] = []; let disposed = false
  const emit = (group: Group, name: string, slot: Slot, pieces: BufferGeometry[]): void => { if (!pieces.length) return; const geometry = mergeParts(pieces, `${ID}: ${name}`); generated.push(geometry); const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.castShadow = true; mesh.receiveShadow = true; content.get(group)!.add(mesh) }
  const rebuild = (): void => {
    content.forEach((group) => group.clear()); generated.splice(0).forEach((geometry) => geometry.dispose())
    const top: BufferGeometry[] = []
    if (config.planks) for (let i = -2; i <= 2; i++) top.push(block([0.90, 0.07, 0.12], [0, 0.315, i * 0.12], 0.006))
    else top.push(block([0.90, 0.07, 0.56], [0, 0.315, 0], 0.008))
    emit(parts.top, 'planked-tabletop', 'cedar', top)
    const trestle: BufferGeometry[] = []; const pegs: BufferGeometry[] = []
    for (const x of [-0.30, 0.30]) {
      trestle.push(block([0.09, 0.23, 0.42], [x, 0.115, 0], 0.005))
      trestle.push(block([0.15, 0.045, 0.42], [x + (x < 0 ? -0.025 : 0.025), 0.0225, 0], 0.004))
      pegs.push(block([0.025, 0.035, 0.055], [x + (x < 0 ? -0.055 : 0.055), 0.14, -0.15], 0.002), block([0.025, 0.035, 0.055], [x + (x < 0 ? -0.055 : 0.055), 0.14, 0.15], 0.002))
      trestle.push(block([0.13, 0.06, 0.50], [x, 0.245, 0], 0.004))
    }
    emit(parts.trestle, 'short-trestle-ends', 'cedarDark', trestle)
    emit(parts.trestle, 'trestle-joinery-pegs', 'cedar', pegs)
    emit(parts.stretcher, 'low-long-stretcher', 'cedarDark', [block([0.62, 0.06, 0.07], [0, 0.10, 0], 0.004)])
  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }), configure(patch) { if (disposed) return; if (patch.planks !== undefined) config.planks = Boolean(patch.planks); rebuild() }, setMaterial(slot, material) { if (disposed) return; materials[slot] = material; rebuild() }, update: () => {}, dispose() { if (disposed) return; disposed = true; generated.splice(0).forEach((geometry) => geometry.dispose()); bundle.dispose(); root.removeFromParent() } }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
