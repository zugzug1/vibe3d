import { Group, Mesh, type BufferGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'

const ID = 'kk-020-shoe-cubby-rack'
type Slot = 'cedar' | 'cedarDark'
export interface ShoeCubbyConfig { columns: number }
export interface ShoeCubbyOptions extends Partial<ShoeCubbyConfig> { materials?: Partial<Record<Slot, Material>> }
const columnsOf = (value: number): number => {
  if (!Number.isFinite(value)) throw new TypeError('columns must be finite')
  return Math.max(2, Math.min(4, Math.round(value)))
}

/** Six ventilated compartments; shoes in the concept are optional consumer dressing. */
export function createModel(options: ShoeCubbyOptions = {}) {
  const config = { columns: columnsOf(options.columns ?? 3) }
  const bundle = acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar' }, options.materials)
  const materials = bundle.materials
  const root = new Group(); root.name = ID
  const parts = { frame: new Group(), shelves: new Group(), dividers: new Group() }
  const generated = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) {
    anchor.name = `${ID} / ${name}`; root.add(anchor)
    const content = new Group(); anchor.add(content); generated.set(anchor, content)
  }
  const geometries: BufferGeometry[] = []
  let disposed = false
  const board = (anchor: Group, slot: Slot, size: [number, number, number], position: [number, number, number], name: string) => {
    const geometry = bevelBox(...size, Math.min(0.0025, Math.min(...size) * 0.12))
    boardUVs(geometry, size); geometries.push(geometry)
    const mesh = new Mesh(geometry, materials[slot]); mesh.name = `${ID} / ${name}`
    mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true
    generated.get(anchor)!.add(mesh)
  }
  const rebuild = () => {
    for (const content of generated.values()) content.clear()
    geometries.splice(0).forEach((geometry) => geometry.dispose())
    // Four posts bear the top; shelves enter their inner faces, not a floating overlay.
    for (const x of [-0.43, 0.43]) for (const z of [-0.1275, 0.1275]) {
      board(parts.frame, 'cedar', [0.04, 0.57, 0.045], [x, 0.285, z], 'load-bearing corner post')
    }
    for (let plank = 0; plank < 3; plank++) {
      board(parts.frame, 'cedar', [0.9, 0.032, 0.098], [0, 0.584, -0.101 + plank * 0.101], `top plank ${plank}`)
    }
    for (const y of [0.066, 0.317]) {
      board(parts.shelves, 'cedar', [0.836, 0.027, 0.27], [0, y, 0], 'seated full-width shelf')
    }
    const innerWidth = 0.82; const cell = innerWidth / config.columns
    for (let col = 1; col < config.columns; col++) {
      const x = -innerWidth / 2 + col * cell
      for (const [bottom, top] of [[0.079, 0.3035], [0.3305, 0.568]] as const) {
        board(parts.dividers, 'cedarDark', [0.024, top - bottom + 0.006, 0.265], [x, (bottom + top) / 2, 0], 'fitted cubby divider')
      }
    }
    // Open slats keep the small rack light and ventilate damp shoes.
    for (let i = 0; i < 18; i++) {
      board(parts.frame, 'cedarDark', [0.031, 0.491, 0.016], [-0.393 + i * 0.0462, 0.3235, -0.135], 'ventilated back slat')
    }
    for (const x of [-0.429, 0.429]) for (let i = 0; i < 4; i++) {
      board(parts.frame, 'cedar', [0.019, 0.491, 0.031], [x, 0.3235, -0.0735 + i * 0.049], 'ventilated side slat')
    }
  }
  rebuild()
  return {
    root, parts, materials,
    getConfig: () => ({ ...config }),
    configure(patch: Partial<ShoeCubbyConfig>) {
      if (disposed) return
      const columns = columnsOf(patch.columns ?? config.columns)
      if (columns === config.columns) return
      config.columns = columns; rebuild()
    },
    setMaterial(slot: Slot, material: Material) { if (!disposed) { materials[slot] = material; rebuild() } },
    update(_deltaSeconds: number) {},
    dispose() {
      if (disposed) return
      disposed = true; geometries.splice(0).forEach((geometry) => geometry.dispose())
      bundle.dispose(); root.removeFromParent()
    },
  }
}
export function createPreview(options: { aspect: number; yaw?: number; pitch?: number }) {
  return createKkPreview(createModel(), options)
}
export function createCafePreview(options: { aspect: number }) {
  return createKkPreview(createModel(), { ...options, framing: 'cafe' })
}
