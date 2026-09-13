// Furnishing; 0.70 × 0.40 × 0.75 m, bottom-centre, front +Z. 6000 triangle ceiling.
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Shape, Path, ExtrudeGeometry, type Material, type MeshStandardMaterial } from 'three/webgpu'
import { bevelBox, createKkPreview, socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'

const ID = 'kk-027-waste-sorting-cabinet'
export type WasteMaterialSlot = 'cedar' | 'cedarDark' | 'glazeMoss' | 'indigo'
export interface WasteConfig { leftBin: boolean; rightBin: boolean }
export interface WasteOptions extends Partial<WasteConfig> { materials?: Partial<Record<WasteMaterialSlot, Material>> }
export interface WasteInstance {
  readonly root: Group
  readonly parts: { carcass: Group; crest: Group; leftBin: Group; rightBin: Group }
  readonly materials: Readonly<Record<WasteMaterialSlot, Material>>
  getConfig(): Readonly<WasteConfig>
  configure(patch: Partial<WasteConfig>): void
  setMaterial(slot: WasteMaterialSlot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

function extrude(s: Shape, depth: number): BufferGeometry {
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 }); g.translate(0, 0, -depth / 2); return g
}
/** Curved side cheeks are structural silhouettes, with open paw perforations. */
function cheek(): BufferGeometry {
  const s = new Shape(); s.moveTo(-0.2, 0); s.lineTo(0.2, 0); s.lineTo(0.2, 0.62)
  s.bezierCurveTo(0.2, 0.68, 0.14, 0.672, 0.055, 0.69)
  s.bezierCurveTo(-0.12, 0.71, -0.11, 0.75, -0.16, 0.75)
  s.lineTo(-0.2, 0.75); s.closePath()
  for (const [x, y, rx, ry] of [[0.072, 0.662, 0.011, 0.010], [0.048, 0.678, 0.004, 0.007], [0.063, 0.687, 0.004, 0.007], [0.078, 0.687, 0.004, 0.007], [0.092, 0.678, 0.004, 0.007]]) {
    // Rearward placement keeps every toe inside the taller cheek, with a solid
    // wood margin above it. Holes crossing the descending edge invalidate caps.
    const h = new Path(); h.absellipse(x! - 0.11, y!, rx!, ry!, 0, Math.PI * 2, true, 0); s.holes.push(h)
  }
  const g = extrude(s, 0.028); g.rotateY(-Math.PI / 2); boardUVs(g, [0.028, 0.75, 0.4]); return g
}
function crest(): BufferGeometry {
  const s = new Shape(); s.moveTo(-0.322, 0.633); s.lineTo(0.322, 0.633); s.lineTo(0.322, 0.713)
  s.bezierCurveTo(0.17, 0.724, 0.13, 0.75, 0, 0.75); s.bezierCurveTo(-0.13, 0.75, -0.17, 0.724, -0.322, 0.713); s.closePath()
  const h = new Path(); h.moveTo(-0.027, 0.714); h.lineTo(-0.028, 0.735); h.lineTo(-0.012, 0.725)
  h.quadraticCurveTo(0, 0.73, 0.012, 0.725); h.lineTo(0.028, 0.735); h.lineTo(0.027, 0.714)
  h.bezierCurveTo(0.043, 0.67, -0.043, 0.67, -0.027, 0.714); h.closePath(); s.holes.push(h)
  const g = extrude(s, 0.019); boardUVs(g, [0.644, 0.117, 0.019]); return g
}

/** Closed three-wall tapered shell with floor and open mouth; front is a separate perforated wall. */
function binShell(): BufferGeometry {
  const v: number[] = []; type P = [number, number, number]
  const quad = (a: P, b: P, c: P, d: P): void => { v.push(...a, ...c, ...b, ...a, ...d, ...c) }
  const ring = (x: number, y: number, z: number): P[] => [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]
  const bottom = ring(0.103, 0, 0.119), top = ring(0.125, 0.435, 0.145)
  const innerBottom = ring(0.0975, 0.008, 0.1135), innerTop = ring(0.119, 0.435, 0.139)
  for (let i = 1; i < 4; i++) {
    const j = (i + 1) % 4
    quad(bottom[i]!, top[i]!, top[j]!, bottom[j]!)
    quad(innerBottom[j]!, innerTop[j]!, innerTop[i]!, innerBottom[i]!)
    quad(top[i]!, innerTop[i]!, innerTop[j]!, top[j]!)
  }
  quad(...bottom as [P, P, P, P]); quad(innerBottom[3]!, innerBottom[2]!, innerBottom[1]!, innerBottom[0]!)
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(v, 3)); g.computeVertexNormals(); boardUVs(g, [0.25, 0.435, 0.29]); return g
}
function binFront(): BufferGeometry {
  const s = new Shape(); s.moveTo(-0.103, 0); s.lineTo(0.103, 0); s.lineTo(0.125, 0.435); s.lineTo(-0.125, 0.435); s.closePath()
  const h = new Path(); h.moveTo(-0.047, 0.414); h.lineTo(0.047, 0.414); h.lineTo(0.047, 0.39)
  h.quadraticCurveTo(0.047, 0.383, 0.039, 0.383); h.lineTo(-0.039, 0.383); h.quadraticCurveTo(-0.047, 0.383, -0.047, 0.39); h.closePath(); s.holes.push(h)
  const g = extrude(s, 0.006); const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const inset = 0.003 - p.getZ(i)
    // Miter the back edge into the sidewall: a square extrusion end would overlay
    // the shell's outward side face. Only the perimeter vertices move, not the handle.
    const halfWidth = 0.103 + p.getY(i) * 0.022 / 0.435
    if (Math.abs(p.getX(i)) > halfWidth - 0.00001) p.setX(i, p.getX(i) - Math.sign(p.getX(i)) * inset)
    p.setZ(i, p.getZ(i) - 0.003 + 0.119 + p.getY(i) * 0.026 / 0.435)
  }
  g.computeVertexNormals(); boardUVs(g, [0.25, 0.435, 0.032]); return g
}
function rim(): BufferGeometry {
  const s = new Shape(); s.moveTo(-0.132, -0.152); s.lineTo(0.132, -0.152); s.lineTo(0.132, 0.152); s.lineTo(-0.132, 0.152); s.closePath()
  const h = new Path(); h.moveTo(-0.118, -0.138); h.lineTo(-0.118, 0.138); h.lineTo(0.118, 0.138); h.lineTo(0.118, -0.138); h.closePath(); s.holes.push(h)
  const g = extrude(s, 0.017); g.rotateX(-Math.PI / 2); boardUVs(g, [0.264, 0.017, 0.304]); return g
}

/** Creates paired open bays and removable, hollow moulded bins. */
export function createModel(options: WasteOptions = {}): WasteInstance {
  const config: WasteConfig = { leftBin: options.leftBin ?? true, rightBin: options.rightBin ?? true }
  const bundle = acquireSurfaceMaterials<WasteMaterialSlot>({ cedar: 'cedar', cedarDark: 'cedar', glazeMoss: 'glaze', indigo: 'glaze' }, options.materials)
  const materials = bundle.materials
  for (const slot of ['glazeMoss', 'indigo'] as const) if (!options.materials?.[slot]) (materials[slot] as MeshStandardMaterial).roughness = 0.68
  const root = new Group(); root.name = ID; root.userData.category = 'furnishing'; root.userData.triangleBudget = 6000
  const parts = { carcass: new Group(), crest: new Group(), leftBin: new Group(), rightBin: new Group() }
  const generated = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) { anchor.name = `${ID} / ${name}`; root.add(anchor); const content = new Group(); anchor.add(content); generated.set(anchor, content) }
  parts.leftBin.position.set(-0.169, 0.105, 0.008); parts.rightBin.position.set(0.169, 0.105, 0.008)
  root.add(socket('anchor-waste-cabinet', [0, 0, 0]))
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (part: Group, g: BufferGeometry, slot: WasteMaterialSlot, p: [number, number, number], name: string): Mesh => {
    geometries.push(g); const mesh = new Mesh(g, materials[slot]); mesh.position.set(...p); mesh.name = `${ID} / ${name}`
    mesh.userData.materialSlot = slot; mesh.castShadow = true; mesh.receiveShadow = true; generated.get(part)!.add(mesh); return mesh
  }
  const box = (part: Group, slot: WasteMaterialSlot, s: [number, number, number], p: [number, number, number], name: string): void => {
    const g = bevelBox(...s, Math.min(0.0025, Math.min(...s) * 0.15)); boardUVs(g, s); emit(part, g, slot, p, name)
  }
  const rebuild = (): void => {
    generated.forEach((g) => g.clear()); geometries.splice(0).forEach((g) => g.dispose())
    for (const x of [-0.336, 0.336]) emit(parts.carcass, cheek(), 'cedar', [x, 0, 0], 'swept paw-cut side cheek')
    box(parts.carcass, 'cedar', [0.646, 0.04, 0.365], [0, 0.085, 0], 'bin support shelf')
    box(parts.carcass, 'cedarDark', [0.644, 0.046, 0.025], [0, 0.061, 0.168], 'low front apron')
    box(parts.carcass, 'cedarDark', [0.644, 0.521, 0.019], [0, 0.3545, -0.178], 'cabinet back')
    box(parts.carcass, 'cedar', [0.022, 0.502, 0.343], [0, 0.354, -0.002], 'central structural divider')
    box(parts.carcass, 'cedar', [0.646, 0.029, 0.369], [0, 0.6195, 0.0005], 'sorting counter')
    emit(parts.crest, crest(), 'cedar', [0, 0, -0.182], 'cat-cut curved crest')
    for (const [part, slot, enabled] of [[parts.leftBin, 'glazeMoss', config.leftBin], [parts.rightBin, 'indigo', config.rightBin]] as const) {
      if (!enabled) continue
      emit(part, binShell(), slot, [0, 0, 0], 'hollow tapered bin shell')
      emit(part, binFront(), slot, [0, 0, 0], 'perforated bin front')
      emit(part, rim(), slot, [0, 0.435, 0], 'continuous open bin rim')
    }
  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }),
    configure(patch) { if (disposed) return; if (patch.leftBin !== undefined) config.leftBin = Boolean(patch.leftBin); if (patch.rightBin !== undefined) config.rightBin = Boolean(patch.rightBin); rebuild() },
    setMaterial(slot, material) { if (disposed) return; materials[slot] = material; root.traverse((o) => { if (o instanceof Mesh && o.userData.materialSlot === slot) o.material = material }) },
    update() {}, dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((g) => g.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview(options: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), options) }
export function createCafePreview(options: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { ...options, framing: 'cafe' }) }
