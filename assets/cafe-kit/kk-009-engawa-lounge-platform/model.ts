// kk-009-engawa-lounge-platform — raised cedar engawa deck, inset tatami and rounded front step.
// DATUM: exact 2.00 W × 1.50 D × 0.30 H m, Y-up, front = +Z.

import { BufferGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, Vector3, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { bevelBox, createKkPreview, mergeParts } from '../kk-core/index.ts'

const ID = 'kk-009-engawa-lounge-platform'
type Slot = 'cedar' | 'cedarDark' | 'tatami'
export interface KkEngawaConfig { step: boolean; mats: boolean }
export interface KkEngawaOptions extends Partial<KkEngawaConfig> { materials?: Partial<Record<Slot, MeshStandardMaterial>> }
export interface KkEngawaInstance {
  readonly root: Group
  readonly parts: { platform: Group; mats: Group; step: Group; rail: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkEngawaConfig>
  configure(patch: Partial<KkEngawaConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

function block(size: [number, number, number], position: [number, number, number], bevel = 0.006): BufferGeometry {
  const geometry = bevelBox(...size, Math.min(bevel, Math.min(...size) * 0.16)); boardUVs(geometry, size); geometry.translate(...position); return geometry
}

export function createModel(options: KkEngawaOptions = {}): KkEngawaInstance {
  const config: KkEngawaConfig = { step: options.step ?? true, mats: options.mats ?? true }
  const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar', tatami: 'fabric' }, options.materials)
  const materials = bundle.materials
  const root = new Group(); root.name = ID
  const parts = { platform: new Group(), mats: new Group(), step: new Group(), rail: new Group() }
  const content = new Map<Group, Group>()
  Object.entries(parts).forEach(([name, group]) => { group.name = `${ID} / ${name}`; const generated = new Group(); generated.name = `${ID} / ${name} / generated`; group.add(generated); content.set(group, generated); root.add(group) })
  const generated: BufferGeometry[] = []; let disposed = false
  const emit = (group: Group, name: string, slot: Slot, pieces: BufferGeometry[]): void => {
    if (!pieces.length) return; const geometry = mergeParts(pieces, `${ID}: ${name}`); generated.push(geometry)
    const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.castShadow = true; mesh.receiveShadow = true; content.get(group)!.add(mesh)
  }
  const rebuild = (): void => {
    for (const group of content.values()) group.clear(); generated.splice(0).forEach((geometry) => geometry.dispose())
    const cedar: BufferGeometry[] = [
      block([1.96, 0.12, 1.18], [0, 0.18, -0.03], 0.008),
      block([2.00, 0.08, 0.08], [0, 0.24, -0.63], 0.006), block([2.00, 0.08, 0.08], [0, 0.24, 0.57], 0.006),
      block([0.08, 0.08, 1.18], [-0.96, 0.24, -0.03], 0.006), block([0.08, 0.08, 1.18], [0.96, 0.24, -0.03], 0.006),
      block([1.76, 0.10, 0.06], [0, 0.07, -0.57], 0.004),
      block([1.82, 0.16, 0.07], [0, 0.08, 0.63], 0.006),
    ]
    for (const x of [-0.86, 0.86]) for (const z of [-0.50, 0.44]) cedar.push(block([0.10, 0.18, 0.10], [x, 0.09, z], 0.005))
    emit(parts.platform, 'raised-cedar-deck', 'cedar', cedar)
    if (config.mats) {
      const tatami: BufferGeometry[] = []; const binding: BufferGeometry[] = []
      for (const x of [-0.47, 0.47]) for (const z of [-0.28, 0.31]) {
        tatami.push(block([0.86, 0.025, 0.54], [x, 0.252, z], 0.008))
        binding.push(block([0.86, 0.018, 0.018], [x, 0.272, z - 0.261], 0.002), block([0.86, 0.018, 0.018], [x, 0.272, z + 0.261], 0.002), block([0.018, 0.018, 0.50], [x - 0.421, 0.272, z], 0.002), block([0.018, 0.018, 0.50], [x + 0.421, 0.272, z], 0.002))
      }
      emit(parts.mats, 'inset-tatami', 'tatami', tatami)
      emit(parts.mats, 'tatami-edge-binding', 'cedarDark', binding)
    }
    if (config.step) {
      const shape = new Shape(); shape.moveTo(-0.43, 0.15); shape.lineTo(0.43, 0.15); shape.lineTo(0.43, 0); shape.quadraticCurveTo(0, -0.15, -0.43, 0); shape.closePath()
      const stepGeometry = new ExtrudeGeometry(shape, { depth: 0.10, bevelEnabled: false, steps: 1, curveSegments: 16 }); stepGeometry.rotateX(-Math.PI / 2); stepGeometry.translate(0, 0, 0.755)
      const step: BufferGeometry[] = [stepGeometry]
      emit(parts.step, 'rounded-front-step', 'cedar', step)
    }
    emit(parts.rail, 'low-engawa-rail', 'cedarDark', [block([1.82, 0.04, 0.05], [0, 0.28, -0.59], 0.004), block([0.05, 0.07, 0.05], [-0.86, 0.255, -0.59], 0.003), block([0.05, 0.07, 0.05], [0.86, 0.255, -0.59], 0.003)])
  }
  rebuild()
  return {
    root, parts, materials, getConfig: () => ({ ...config }),
    configure(patch) { if (disposed) return; if (patch.step !== undefined) config.step = Boolean(patch.step); if (patch.mats !== undefined) config.mats = Boolean(patch.mats); rebuild() },
    setMaterial(slot, material) { if (disposed) return; materials[slot] = material; rebuild() }, update: () => {},
    dispose() { if (disposed) return; disposed = true; generated.splice(0).forEach((geometry) => geometry.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
