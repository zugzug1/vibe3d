// 0.55 W × 0.50 D × 1.00 H m. Roofed cedar notice frame, front +Z, ground at Y=0.
// The writing panel is blank and physically clipped into a rebate; no painted text or baked shading.
import { Group, Mesh, Shape, ExtrudeGeometry, CylinderGeometry, TorusGeometry, SphereGeometry, type BufferGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID = 'kk-030-exterior-menu-stand'
type Slot = 'cedar' | 'cedarDark' | 'washi' | 'ink' | 'brass' | 'glaze'
export interface KkMenuStandConfig { panelWidth: number; panelHeight: number; footDepth: number }
export interface KkMenuStandOptions extends Partial<KkMenuStandConfig> { materials?: Partial<Record<Slot, Material>> }
export const structureControls = {
  panelWidth: { min: 0.32, max: 0.44, default: 0.40, step: 0.01, label: 'Writing panel width (m)' },
  panelHeight: { min: 0.50, max: 0.68, default: 0.60, step: 0.01, label: 'Writing panel height (m)' },
  footDepth: { min: 0.36, max: 0.60, default: 0.50, step: 0.01, label: 'Weighted foot depth (m)' },
} as const
function configuration(patch: Partial<KkMenuStandConfig>, base: KkMenuStandConfig = { panelWidth: 0.4, panelHeight: 0.6, footDepth: 0.5 }): KkMenuStandConfig {
  const next = { ...base }
  for (const key of ['panelWidth', 'panelHeight', 'footDepth'] as const) {
    const value = patch[key] === undefined ? base[key] : patch[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${key} must be finite`)
    next[key] = Math.max(structureControls[key].min, Math.min(structureControls[key].max, value))
  }
  return next
}
function roofSection(width: number): BufferGeometry {
  const shape = new Shape(); shape.moveTo(-0.14, 0.075); shape.lineTo(0, 0.16); shape.lineTo(0.14, 0.075)
  shape.lineTo(0.14, 0.057); shape.lineTo(0, 0.142); shape.lineTo(-0.14, 0.057); shape.closePath()
  const geo = new ExtrudeGeometry(shape, { depth: width, steps: 1, bevelEnabled: false })
  geo.translate(0, 0, -width / 2); geo.rotateY(-Math.PI / 2); boardUVs(geo, [width, 0.103, 0.28]); return geo
}
/** Pentagonal bearing fits 6 mm into the roof underside without breaking through the weather face. */
function ridgeBearing(width: number): BufferGeometry {
  const shape = new Shape(); shape.moveTo(-0.028, 0.103); shape.lineTo(0.028, 0.103)
  shape.lineTo(0.028, 0.131); shape.lineTo(0, 0.148); shape.lineTo(-0.028, 0.131); shape.closePath()
  const geo = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, steps: 1 })
  geo.translate(0, 0, -width / 2); geo.rotateY(-Math.PI / 2); boardUVs(geo, [width, 0.045, 0.056]); return geo
}
export function createModel(options: KkMenuStandOptions = {}) {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<'cedar' | 'cedarDark' | 'washi' | 'glaze'>({ cedar: 'cedar', cedarDark: 'cedar', washi: 'paper', glaze: 'glaze' }, options.materials)
  const materials = { ...bundle.materials, ...options.materials } as Record<Slot, Material>
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { feet: new Group(), frame: new Group(), roof: new Group(), panel: new Group(), hardware: new Group() }
  const content = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) { anchor.name = `${ID} / ${name}`; root.add(anchor); const generated = new Group(); generated.name = `${anchor.name} / generated`; anchor.add(generated); content.set(anchor, generated) }
  const writing = socket('writing-surface', [0, 0.52, 0.010]); root.add(writing)
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (part: Group, geo: BufferGeometry, slot: Slot, pos: [number, number, number], name: string): void => {
    geometries.push(geo); const mesh = new Mesh(geo, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.position.set(...pos)
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.materialSlot = slot; content.get(part)!.add(mesh)
  }
  const box = (part: Group, slot: Slot, size: [number, number, number], pos: [number, number, number], name: string): void => {
    const geo = bevelBox(...size, Math.min(0.003, Math.min(...size) * 0.15)); boardUVs(geo, size); emit(part, geo, slot, pos, name)
  }
  const rebuild = (): void => {
    content.forEach(group => group.clear()); geometries.splice(0).forEach(geo => geo.dispose())
    const w = config.panelWidth; const h = config.panelHeight; const top = 0.22 + h; const postX = w / 2 + 0.021
    writing.position.set(0, 0.22 + h / 2, 0.010)
    for (const x of [-postX, postX]) {
      box(parts.feet, 'cedar', [0.065, 0.065, config.footDepth - 0.020], [x, 0.0325, 0], 'weighted long foot')
      for (const sign of [-1, 1]) box(parts.feet, 'ink', [0.069, 0.067, 0.018], [x, 0.0335, sign * (config.footDepth / 2 - 0.009)], 'fitted iron foot end')
      box(parts.frame, 'cedar', [0.042, top + 0.085, 0.059], [x, (top + 0.085) / 2 + 0.055, 0], 'continuous upright')
      box(parts.roof, 'cedar', [0.068, 0.028, 0.046], [x, top + 0.116, 0], 'housed post capital')
      for (const z of [-0.044, 0.044]) box(parts.feet, 'cedarDark', [0.041, 0.115, 0.029], [x, 0.091, z], 'post mortise cheek')
      const peg = new CylinderGeometry(0.008, 0.008, 0.043, 10); peg.rotateZ(Math.PI / 2)
      emit(parts.hardware, peg, 'cedarDark', [x + Math.sign(x) * 0.019, top - 0.085, 0.027], 'ornament fixing peg')
      emit(parts.hardware, new TorusGeometry(0.012, 0.002, 5, 12), 'brass', [x + Math.sign(x) * 0.031, top - 0.106, 0.027], 'hanging ornament ring')
      const charm = new SphereGeometry(0.018, 12, 8); charm.scale(1, 1.3, 1)
      emit(parts.hardware, charm, 'glaze', [x + Math.sign(x) * 0.031, top - 0.143, 0.027], 'plain ceramic charm')
    }
    box(parts.frame, 'cedar', [w + 0.018, 0.044, 0.047], [0, 0.201, 0], 'panel sill rail')
    box(parts.frame, 'cedar', [w + 0.018, 0.044, 0.047], [0, top + 0.022, 0], 'panel head rail')
    box(parts.frame, 'cedar', [w + 0.022, 0.052, 0.047], [0, 0.096, 0], 'low structural stretcher')
    emit(parts.frame, ridgeBearing(w + 0.044), 'cedarDark', [0, top, 0], 'housed roof ridge bearing')
    box(parts.roof, 'cedarDark', [w + 0.105, 0.026, 0.035], [0, top + 0.167, 0], 'continuous seated ridge cap')
    emit(parts.roof, roofSection(w + 0.15), 'cedarDark', [0, top, 0], 'pitched weather roof')
    for (const x of [-postX, postX]) emit(parts.roof, roofSection(0.035), 'cedar', [x, top - 0.017, 0], 'seated roof rafter')
    box(parts.panel, 'cedarDark', [w + 0.012, h + 0.010, 0.022], [0, 0.22 + h / 2, -0.004], 'replaceable panel backing')
    box(parts.panel, 'washi', [w, h, 0.003], [0, 0.22 + h / 2, 0.0083], 'blank writing panel')
    for (const x of [-w * 0.34, w * 0.34]) {
      box(parts.hardware, 'ink', [0.016, 0.041, 0.006], [x, top + 0.006, 0.012], 'retaining panel clip')
      const screw = new CylinderGeometry(0.003, 0.003, 0.003, 8); screw.rotateX(Math.PI / 2)
      emit(parts.hardware, screw, 'brass', [x, top + 0.009, 0.016], 'panel clip screw')
    }
  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }),
    configure(patch: Partial<KkMenuStandConfig>) { if (disposed) return; Object.assign(config, configuration(patch, config)); rebuild() },
    setMaterial(slot: Slot, material: Material) { if (disposed) return; materials[slot] = material; root.traverse(o => { if (o instanceof Mesh && o.userData.materialSlot === slot) o.material = material }) },
    update(_deltaSeconds: number) {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach(geo => geo.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
