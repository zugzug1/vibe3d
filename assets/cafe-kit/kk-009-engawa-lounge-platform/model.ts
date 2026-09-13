// kk-009-engawa-lounge-platform — raised cedar engawa deck, inset tatami and rounded front step.
// DATUM: exact 2.00 W × 1.50 D × 0.30 H m, Y-up, front = +Z.

import { BufferGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, type Material } from 'three/webgpu'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
import { bevelBox, createKkPreview, mergeParts } from '../kk-core/index.ts'

const ID = 'kk-009-engawa-lounge-platform'
type Slot = 'cedar' | 'cedarDark' | 'tatami' | 'indigo'
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
  const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar', tatami: 'fabric', indigo: 'fabric' }, options.materials)
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
      // Recessed substrate carries the mats; perimeter boards finish flush above it.
      block([1.80, 0.018, 1.05], [0, 0.130, -0.115], 0.002),
      block([2.00, 0.038, 0.115], [0, 0.148, -0.6925], 0.003),
      block([2.00, 0.038, 0.115], [0, 0.148, 0.4625], 0.003),
      block([0.10, 0.038, 1.040], [-0.95, 0.148, -0.115], 0.003),
      block([0.10, 0.038, 1.040], [0.95, 0.148, -0.115], 0.003),
      block([1.85, 0.065, 0.045], [0, 0.1075, -0.665], 0.003),
      block([1.85, 0.065, 0.045], [0, 0.1075, 0.435], 0.003),
      block([0.045, 0.065, 1.10], [-0.925, 0.1075, -0.115], 0.003),
      block([0.045, 0.065, 1.10], [0.925, 0.1075, -0.115], 0.003),
    ]
    for (const x of [-0.90, 0.90]) for (const z of [-0.635, 0.405]) cedar.push(block([0.085, 0.14, 0.085], [x, 0.070, z], 0.003))
    emit(parts.platform, 'raised-cedar-deck', 'cedar', cedar)
    if (config.mats) {
      const tatami: BufferGeometry[] = []; const binding: BufferGeometry[] = []
      for (const x of [-0.450, 0.450]) for (const z of [-0.375, 0.145]) {
        tatami.push(block([0.891, 0.027, 0.511], [x, 0.1515, z], 0.0015))
        // Thin textile strips seated into the mat, not thick wooden picture frames.
        binding.push(block([0.891, 0.004, 0.018], [x, 0.164, z - 0.247], 0.0005), block([0.891, 0.004, 0.018], [x, 0.164, z + 0.247], 0.0005))
      }
      emit(parts.mats, 'inset-tatami', 'tatami', tatami)
      emit(parts.mats, 'tatami-edge-binding', 'indigo', binding)
    }
    if (config.step) {
      const shape = new Shape(); shape.moveTo(-0.52, 0); shape.lineTo(0.52, 0)
      shape.quadraticCurveTo(0.52, -0.283, 0, -0.283)
      shape.quadraticCurveTo(-0.52, -0.283, -0.52, 0); shape.closePath()
      const stepGeometry = new ExtrudeGeometry(shape, { depth: 0.026, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, steps: 1, curveSegments: 12 })
      stepGeometry.rotateX(-Math.PI / 2); stepGeometry.translate(0, 0.048, 0.465); boardUVs(stepGeometry, [1.044, 0.030, 0.287])
      const step: BufferGeometry[] = [stepGeometry]
      for (const x of [-0.35, 0.35]) step.push(block([0.075, 0.053, 0.075], [x, 0.0265, 0.615], 0.003))
      // A real riser laps the front apron and step back; the step isn't a loose shelf.
      step.push(block([0.93, 0.060, 0.045], [0, 0.083, 0.466], 0.002))
      emit(parts.step, 'rounded-front-step', 'cedar', step)
    }
    const rail: BufferGeometry[] = [block([1.88, 0.028, 0.040], [0, 0.283, -0.691], 0.003), block([1.80, 0.021, 0.025], [0, 0.208, -0.691], 0.002)]
    for (const x of [-0.90, 0, 0.90]) rail.push(block([0.046, 0.15, 0.046], [x, 0.225, -0.691], 0.002))
    for (const x of [-0.50, 0.50]) rail.push(block([0.026, 0.083, 0.023], [x, 0.2435, -0.691], 0.0015))
    rail.push(block([0.035, 0.026, 0.46], [0.90, 0.263, -0.474], 0.002), block([0.042, 0.123, 0.042], [0.90, 0.2115, -0.265], 0.002))
    emit(parts.rail, 'low-engawa-rail', 'cedar', rail)
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
