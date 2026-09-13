import { CylinderGeometry, Group, Mesh, type BufferGeometry, type Material } from 'three/webgpu'

import { acquireKkMaterials, bevelBox, bevelRing, createKkPreview, finishModel } from '../kk-core/index.ts'

const ID = 'kk-016-cup-shelving-unit'
const W = 1
const D = 0.25
const H = 1.2
type Slot = 'cedar' | 'cedarDark' | 'glaze' | 'glazeMoss' | 'glazeDeep'
export interface KkCupShelfConfig { tiers: number }
export interface KkCupShelfOptions extends Partial<KkCupShelfConfig> { materials?: Partial<Record<Slot, Material>> }
export interface KkCupShelfInstance {
  readonly root: Group
  readonly parts: { frame: Group; shelves: Group; dividers: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkCupShelfConfig>
  configure(patch: Partial<KkCupShelfConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}
const defaults: KkCupShelfConfig = { tiers: 4 }
const emitBox = (generated: BufferGeometry[], group: Group, material: Material,
  size: [number, number, number], position: [number, number, number], name: string): void => {
  const geo = bevelBox(size[0], size[1], size[2], Math.min(0.006, size[0] * 0.08, size[1] * 0.08, size[2] * 0.08))
  generated.push(geo)
  const mesh = new Mesh(geo, material); mesh.name = name; mesh.position.set(...position); group.add(mesh)
}

export function createModel(options: KkCupShelfOptions = {}): KkCupShelfInstance {
  const config = { ...defaults, ...options }
  const bundle = acquireKkMaterials({ overrides: options.materials }); const m = bundle.materials
  const root = new Group(); root.name = ID
  const parts = { frame: new Group(), shelves: new Group(), dividers: new Group() }
  Object.entries(parts).forEach(([key, group]) => { group.name = `${ID} / ${key}`; root.add(group) })
  const generated: BufferGeometry[] = []
  const rebuild = (): void => {
    for (const group of Object.values(parts)) for (const child of [...group.children]) group.remove(child)
    generated.splice(0).forEach((geo) => geo.dispose())
    // Three joined crate columns: left three cells, middle two, right one, plus the shared bottom row.
    const cellW = 0.29
    const gap = 0.025
    const xCols = [-0.345, 0, 0.345]
    const heights = [3, 2, 1]
    const cellH = 0.35
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < heights[col]!; row++) {
        const x = xCols[col]!
        const y = 0.10 + row * (cellH + gap)
        const depth = D - 0.025
        emitBox(generated, parts.shelves, m.cedar, [cellW, 0.045, depth], [x, y, 0.01], `crate shelf ${col}/${row}`)
        emitBox(generated, parts.dividers, m.cedarDark, [cellW, cellH - 0.03, 0.028], [x, y + cellH / 2, -D / 2 + 0.018], `solid crate back ${col}/${row}`)
        for (const side of [-1, 1]) emitBox(generated, parts.dividers, m.cedarDark, [0.035, cellH, depth], [x + side * (cellW / 2 - 0.018), y + cellH / 2, 0.01], `crate side ${col}/${row}`)
      }
    }
    emitBox(generated, parts.frame, m.cedarDark, [W - 0.08, 0.07, D], [0, 0.035, 0], 'bottom plinth')
    for (const x of xCols) emitBox(generated, parts.frame, m.cedarDark, [0.07, 0.12, 0.18], [x, 0.06, 0.02], 'short foot')

    const cup = (x: number, y: number, radius: number, material: Material, name: string): void => {
      const body = new CylinderGeometry(radius * 0.88, radius * 0.72, 0.12, 12, 1, true)
      body.translate(x, y + 0.06, 0.04); generated.push(body)
      const mesh = new Mesh(body, material); mesh.name = name; parts.shelves.add(mesh)
      const rim = bevelRing(radius * 0.78, radius, 0.012, 0.002, 12); rim.rotateX(Math.PI / 2); rim.translate(x, y + 0.12, 0.04); generated.push(rim)
      const rimMesh = new Mesh(rim, material); rimMesh.name = `${name} rim`; parts.shelves.add(rimMesh)
    }
    cup(-0.345, 0.16, 0.07, m.glaze, 'ivory cup')
    cup(0, 0.16, 0.065, m.glazeMoss, 'moss cup')
    cup(0, 0.50, 0.07, m.glazeDeep, 'deep glaze cup')
  }
  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated })
  return {
    root, parts, materials: m, getConfig: () => ({ ...config }),
    configure(patch) { Object.assign(config, patch); rebuild() },
    setMaterial(slot, material) { m[slot] = material; rebuild() },
    update(_deltaSeconds) {}, dispose() { finished.dispose() },
  }
}
export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) {
  return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch })
}
export function createCafePreview(options: { aspect: number; time?: number }) {
  return createKkPreview(createModel(), { aspect: options.aspect, framing: 'cafe' })
}
