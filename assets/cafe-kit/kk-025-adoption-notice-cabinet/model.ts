// Furnishing; 0.65 × 0.20 × 1.00 m, bottom-centre, front +Z. 6000 triangle ceiling.
import { Group, Mesh, Shape, ExtrudeGeometry, PlaneGeometry, type BufferGeometry, type Material } from 'three/webgpu'
import { bevelBox, bevelDisc, createKkPreview, socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'

const ID = 'kk-025-adoption-notice-cabinet'
export type NoticeMaterialSlot = 'cedar' | 'cedarDark' | 'washi' | 'glazeMoss' | 'brass' | 'ink' | 'glass'
export interface NoticeConfig { drawerOpen: number; cards: boolean; glazing: boolean }
export interface NoticeOptions extends Partial<NoticeConfig> { materials?: Partial<Record<NoticeMaterialSlot, Material>> }
export interface NoticeInstance {
  readonly root: Group
  readonly parts: { carcass: Group; noticeboard: Group; cards: Group; glazing: Group; drawer: Group; documents: Group; hardware: Group }
  readonly materials: Readonly<Record<NoticeMaterialSlot, Material>>
  getConfig(): Readonly<NoticeConfig>
  configure(patch: Partial<NoticeConfig>): void
  setMaterial(slot: NoticeMaterialSlot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}
const opening = (n: number): number => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1

/** Small curved bracket, extruded across its width under the overhanging cornice. */
function bracket(): BufferGeometry {
  const s = new Shape(); s.moveTo(-0.024, 0.055); s.lineTo(0.024, 0.055); s.lineTo(0.024, 0.018)
  s.bezierCurveTo(0.024, -0.016, -0.013, -0.010, -0.013, -0.055)
  s.lineTo(-0.024, -0.055); s.closePath()
  const g = new ExtrudeGeometry(s, { depth: 0.019, bevelEnabled: false, curveSegments: 5 }); g.translate(0, 0, -0.0095)
  boardUVs(g, [0.048, 0.11, 0.019]); return g
}

/** Creates a glazed case and a real open, three-channel document drawer. */
export function createModel(options: NoticeOptions = {}): NoticeInstance {
  const config: NoticeConfig = { drawerOpen: opening(options.drawerOpen ?? 1), cards: options.cards ?? true, glazing: options.glazing ?? true }
  const bundle = acquireSurfaceMaterials<'cedar' | 'cedarDark' | 'washi' | 'glazeMoss'>({ cedar: 'cedar', cedarDark: 'cedar', washi: 'paper', glazeMoss: 'paper' }, options.materials)
  const materials = bundle.materials as Record<NoticeMaterialSlot, Material>
  const root = new Group(); root.name = ID
  root.userData.category = 'furnishing'; root.userData.triangleBudget = 6000
  const parts = { carcass: new Group(), noticeboard: new Group(), cards: new Group(), glazing: new Group(), drawer: new Group(), documents: new Group(), hardware: new Group() }
  const generated = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) {
    anchor.name = `${ID} / ${name}`; root.add(anchor)
    const content = new Group(); anchor.add(content); generated.set(anchor, content)
  }
  root.add(socket('anchor-notice-cabinet', [0, 0, 0]))
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (part: Group, g: BufferGeometry, slot: NoticeMaterialSlot, p: [number, number, number], name: string): Mesh => {
    geometries.push(g); const mesh = new Mesh(g, materials[slot]); mesh.position.set(...p); mesh.name = `${ID} / ${name}`
    mesh.userData.materialSlot = slot; mesh.castShadow = slot !== 'glass'; mesh.receiveShadow = true
    generated.get(part)!.add(mesh); return mesh
  }
  const box = (part: Group, slot: NoticeMaterialSlot, s: [number, number, number], p: [number, number, number], name: string): Mesh => {
    const g = bevelBox(...s, Math.min(0.002, Math.min(...s) * 0.15)); boardUVs(g, s); return emit(part, g, slot, p, name)
  }
  const rebuild = (): void => {
    generated.forEach((g) => g.clear()); geometries.splice(0).forEach((g) => g.dispose())
    // The shallow authored target takes precedence over the concept's exaggerated drawer depth.
    for (const x of [-0.279, 0.279]) for (const z of [-0.068, 0.038]) box(parts.carcass, 'cedar', [0.037, 0.31, 0.037], [x, 0.155, z], 'continuous lower leg')
    box(parts.carcass, 'cedarDark', [0.525, 0.028, 0.125], [0, 0.066, -0.016], 'lower drawer sill')
    for (const x of [-0.20, 0.20]) box(parts.carcass, 'cedarDark', [0.024, 0.008, 0.113], [x, 0.082, -0.016], 'drawer support runner')
    for (const x of [-0.276, 0.276]) box(parts.carcass, 'cedar', [0.025, 0.204, 0.113], [x, 0.192, -0.018], 'lower side panel')
    box(parts.carcass, 'cedarDark', [0.53, 0.22, 0.014], [0, 0.19, -0.075], 'lower back panel')
    box(parts.carcass, 'cedar', [0.638, 0.027, 0.185], [0, 0.3125, -0.0075], 'projecting display sill')
    box(parts.carcass, 'cedar', [0.65, 0.03, 0.2], [0, 0.985, 0], 'broad cornice')
    for (const x of [-0.278, 0.278]) {
      box(parts.carcass, 'cedar', [0.039, 0.644, 0.139], [x, 0.648, -0.0235], 'display upright')
      const b = emit(parts.carcass, bracket(), 'cedar', [x, 0.915, 0.044], 'cornice scroll bracket'); b.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2
    }
    box(parts.noticeboard, 'cedarDark', [0.52, 0.644, 0.016], [0, 0.648, -0.085], 'notice case back')
    box(parts.noticeboard, 'glazeMoss', [0.517, 0.59, 0.007], [0, 0.65, -0.0735], 'moss notice backing')
    for (const y of [0.343, 0.953]) box(parts.noticeboard, 'cedar', [0.521, 0.034, 0.07], [0, y, 0.006], 'glazed frame cross rail')
    for (const x of [-0.252, 0.252]) box(parts.noticeboard, 'ink', [0.008, 0.578, 0.009], [x, 0.648, 0.025], 'glazing side rebate')
    for (const y of [0.362, 0.934]) box(parts.noticeboard, 'ink', [0.496, 0.008, 0.009], [0, y, 0.025], 'glazing cross rebate')
    if (config.glazing) emit(parts.glazing, new PlaneGeometry(0.498, 0.574), 'glass', [0, 0.648, 0.025], 'single glass sheet')
    if (config.cards) for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
      const x = -0.1845 + col * 0.123; const y = 0.502 + row * 0.277
      box(parts.cards, 'washi', [0.104, 0.225, 0.002], [x, y, -0.069], 'blank profile card')
      emit(parts.cards, bevelDisc(0.0055, 0.004, 0.0006, 6), 'brass', [x, y + 0.100, -0.067], 'card retaining pin')
    }
    // Drawer anchors move without replacing consumer attachments. All generated contents are local.
    const travel = config.drawerOpen * 0.044
    parts.drawer.position.z = travel; parts.documents.position.z = travel; parts.hardware.position.z = travel
    box(parts.drawer, 'cedarDark', [0.509, 0.012, 0.107], [0, 0.09, -0.0235], 'drawer floor')
    for (const x of [-0.249, 0.249]) box(parts.drawer, 'cedar', [0.014, 0.153, 0.107], [x, 0.1695, -0.0235], 'drawer side')
    box(parts.drawer, 'cedarDark', [0.485, 0.153, 0.012], [0, 0.1695, -0.071], 'drawer back')
    box(parts.drawer, 'cedar', [0.538, 0.165, 0.021], [0, 0.1695, 0.0265], 'drawer front')
    for (const x of [-0.081, 0.081]) box(parts.drawer, 'cedarDark', [0.008, 0.13, 0.086], [x, 0.159, -0.021], 'file channel divider')
    for (const x of [-0.165, 0, 0.165]) for (let i = 0; i < 3; i++) {
      box(parts.documents, 'washi', [0.141, 0.17 + i * 0.005, 0.003], [x, 0.181 + i * 0.0025, 0.005 - i * 0.023], 'standing file folder')
    }
    // Cup pull: a backed pocket with a projecting hood, open underneath.
    box(parts.hardware, 'brass', [0.105, 0.038, 0.004], [0, 0.176, 0.038], 'pull mounting plate')
    box(parts.hardware, 'brass', [0.082, 0.008, 0.019], [0, 0.186, 0.046], 'pull hood')
    for (const x of [-0.037, 0.037]) box(parts.hardware, 'brass', [0.008, 0.02, 0.016], [x, 0.174, 0.045], 'pull end cheek')
  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }),
    configure(patch) { if (disposed) return; if (patch.drawerOpen !== undefined) config.drawerOpen = opening(patch.drawerOpen); if (patch.cards !== undefined) config.cards = Boolean(patch.cards); if (patch.glazing !== undefined) config.glazing = Boolean(patch.glazing); rebuild() },
    setMaterial(slot, material) { if (disposed) return; materials[slot] = material; root.traverse((o) => { if (o instanceof Mesh && o.userData.materialSlot === slot) o.material = material }) },
    update() {},
    dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach((g) => g.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview(options: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), options) }
export function createCafePreview(options: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { ...options, framing: 'cafe' }) }
