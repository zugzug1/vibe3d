// kk-032-tea-caddy — a squat patinated tea tin with a stepped lid and a blank paper label.
//
// Datum: 0.12 W × 0.12 D × 0.16 H m, bottom-centre origin, Y-up, front = +Z.
// The square body, raised round lid and proud blank label are the identifying construction cues; the
// moss glaze token stands in for the painted green metal patina across the tin and its edge trim.

import { BufferGeometry, Group, Mesh, type Material } from 'three/webgpu'

import {
  acquireKkMaterials,
  bevelBox,
  bevelDisc,
  bevelRing,
  createKkPreview,
  finishModel,
} from '../kk-core/index.ts'

const ID = 'kk-032-tea-caddy'

type Slot = 'tin' | 'trim' | 'label'

export interface KkTeaCaddyConfig {
  lid: boolean
  label: boolean
}

export interface KkTeaCaddyOptions extends Partial<KkTeaCaddyConfig> {}

export interface KkTeaCaddyInstance {
  readonly root: Group
  readonly parts: { body: Group; lid: Group; label: Group }
  readonly materials: Readonly<Record<Slot, Material>>
  getConfig(): Readonly<KkTeaCaddyConfig>
  configure(patch: Partial<KkTeaCaddyConfig>): void
  setMaterial(slot: Slot, material: Material): void
  update(deltaSeconds: number): void
  dispose(): void
}

const DEFAULTS: KkTeaCaddyConfig = { lid: true, label: true }

export function createModel(options: KkTeaCaddyOptions = {}): KkTeaCaddyInstance {
  const config: KkTeaCaddyConfig = {
    lid: options.lid ?? DEFAULTS.lid,
    label: options.label ?? DEFAULTS.label,
  }
  const bundle = acquireKkMaterials()
  const slots: Record<Slot, Material> = {
    tin: bundle.materials.glazeMoss,
    trim: bundle.materials.glazeMoss,
    label: bundle.materials.washi,
  }

  const root = new Group(); root.name = ID
  const body = new Group(); body.name = 'body'
  const lid = new Group(); lid.name = 'lid'
  const label = new Group(); label.name = 'label'
  root.add(body, lid, label)

  const generated: BufferGeometry[] = []
  const meshesBySlot: Record<Slot, Mesh[]> = { tin: [], trim: [], label: [] }
  const emit = (slot: Slot, geometry: BufferGeometry, group: Group, name: string): void => {
    generated.push(geometry)
    const mesh = new Mesh(geometry, slots[slot])
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshesBySlot[slot].push(mesh)
    group.add(mesh)
  }

  const rebuild = (): void => {
    for (const group of [body, lid, label]) group.clear()
    for (const geometry of generated) geometry.dispose()
    generated.length = 0
    for (const slot of Object.keys(meshesBySlot) as Slot[]) meshesBySlot[slot].length = 0

    emit('tin', bevelBox(0.112, 0.128, 0.112, 0.006), body, 'tin-body')
    const baseTrim = bevelBox(0.116, 0.004, 0.116, 0.0015)
    baseTrim.translate(0, 0.006, 0)
    emit('trim', baseTrim, body, 'base-trim')
    const topTrim = bevelBox(0.116, 0.004, 0.116, 0.0015)
    topTrim.translate(0, 0.128, 0)
    emit('trim', topTrim, body, 'top-trim')
    body.children[0]!.position.y = 0.068

    if (config.lid) {
      const lidBase = bevelBox(0.118, 0.012, 0.118, 0.005)
      lidBase.translate(0, 0.134, 0)
      emit('tin', lidBase, lid, 'lid-shoulder')
      const crown = bevelDisc(0.046, 0.014, 0.004, 24)
      crown.rotateX(Math.PI / 2)
      crown.translate(0, 0.146, 0)
      emit('tin', crown, lid, 'lid-crown')
      const trim = bevelRing(0.048, 0.055, 0.003, 0.0008, 24)
      trim.rotateX(Math.PI / 2)
      trim.translate(0, 0.135, 0)
      emit('trim', trim, lid, 'lid-trim')
    }

    if (config.label) {
      const paper = bevelBox(0.078, 0.056, 0.002, 0.0015)
      paper.translate(0, 0.067, 0.057)
      emit('label', paper, label, 'blank-paper-label')
    }
  }

  rebuild()
  const finished = finishModel(root, bundle, { name: ID, geometries: generated })
  return {
    root,
    parts: { body, lid, label },
    materials: slots,
    getConfig: () => ({ ...config }),
    configure(patch) {
      if (patch.lid !== undefined) config.lid = Boolean(patch.lid)
      if (patch.label !== undefined) config.label = Boolean(patch.label)
      rebuild()
    },
    setMaterial(slot, material) {
      slots[slot] = material
      for (const mesh of meshesBySlot[slot]) mesh.material = material
    },
    update: () => {},
    dispose: () => finished.dispose(),
  }
}

export function createPreview(options: { aspect: number; time?: number; yaw?: number; pitch?: number }) {
  return createKkPreview(createModel(), { aspect: options.aspect, yaw: options.yaw, pitch: options.pitch })
}

export function createCafePreview({ aspect }: { aspect: number; time?: number }) {
  return createKkPreview(createModel(), { aspect, framing: 'cafe' })
}
