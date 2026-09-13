/**
 * kk-scene — the two composed scenes the handoff asks for.
 *
 * `createReviewScene()` lays every finished `kk-*` model out on a grid (signature row, then furnishing,
 * then storytelling) so all fifty can be looked at, and measured, at once. `createCafeScene()` is the
 * representative furnished café: a 6 × 8 m machiya ground floor with the counter run, window bench,
 * booth, cat furniture and dressing placed where they would be used. Both discover models from disk,
 * so they pick up whatever exists — coordinator-owned; workers never edit this file.
 *
 * Neither is a registry model. They are consumed by scripts/kk-scene-measure.ts and the docs app.
 */
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three/webgpu'
import { listModelIds } from '../kk-core/catalog.ts'
import { createKkPreview, type KkPreview } from '../kk-core/preview.ts'
import { tierFromId } from '../../../registries/cafe-kit/src/categories.ts'
import { batchStaticScene } from './static-batch.ts'

type Instance = { root: Group; update?(dt: number): void; dispose(): void }
type ModelModule = { createModel: (options?: Record<string, unknown>) => Instance }

async function instantiateAll(): Promise<Array<{ id: string; model: Instance }>> {
  const ids = await listModelIds()
  const models: Array<{ id: string; model: Instance }> = []
  for (const id of ids) {
    const mod = await import(`../${id}/model.ts`) as ModelModule
    models.push({ id, model: mod.createModel() })
  }
  return models
}

export interface ComposedScene {
  readonly root: Group
  readonly ids: readonly string[]
  update(deltaSeconds: number): void
  dispose(): void
}

/** Grid by tier: 2.5 m pitch for signature, 1.8 m furnishing, 1.0 m storytelling; rows along -Z. */
export async function createReviewScene(): Promise<ComposedScene> {
  const root = new Group()
  root.name = 'cafe-kit / review scene'
  const models = await instantiateAll()
  const pitch = { signature: 2.5, furnishing: 1.8, storytelling: 1.0 } as const
  const rowZ = { signature: 0, furnishing: -4, storytelling: -7 } as const
  const columns = { signature: 0, furnishing: 0, storytelling: 0 }
  const perRow = { signature: 10, furnishing: 10, storytelling: 10 } as const
  for (const { id, model } of models) {
    const tier = tierFromId(id)
    const column = columns[tier]++
    const row = Math.floor(column / perRow[tier])
    model.root.position.set(
      (column % perRow[tier]) * pitch[tier] - (perRow[tier] - 1) * pitch[tier] * 0.5,
      0,
      rowZ[tier] - row * pitch[tier],
    )
    root.add(model.root)
  }
  return {
    root,
    ids: models.map((m) => m.id),
    update: (dt) => { for (const { model } of models) model.update?.(dt) },
    dispose: () => { for (const { model } of models) model.dispose() },
  }
}

/**
 * Placements for the furnished café, by roster number. Positions are metres on a 6 × 8 m floor, origin
 * at the room centre, +Z toward the street entrance. A model that is not built yet is simply absent.
 */
const CAFE_LAYOUT: Record<number, { x: number; y?: number; z: number; yaw: number }> = {
  1: { x: -1.6, z: -3.6, yaw: 0 },        // espresso station along the back wall
  2: { x: 0.4, y: 0.72, z: -3.1, yaw: 0 }, // tray on a reused café table, not the floor
  3: { x: 2.0, z: -2.9, yaw: 0 },         // wagashi cabinet
  26: { x: -2.6, z: -2.6, yaw: 0.4 },     // register
  16: { x: -1.6, y: 1.5, z: -3.875, yaw: 0 }, // clears the station's 1.35 m riser
  18: { x: 2.8, z: -1.0, yaw: -Math.PI / 2 }, // basin on the right wall
  5: { x: -2.6, z: 2.4, yaw: Math.PI / 2 },   // window bench, left wall near the street
  9: { x: 2.0, z: 1.6, yaw: 0 },          // engawa platform, right front
  13: { x: 2.2, y: 0.165, z: 1.65, yaw: 0 }, // original engawa tatami top (not its rail height)
  14: { x: 1.38, y: 0.165, z: 1.70, yaw: 0 }, // beside table, fully supported on tatami
  11: { x: -0.6, z: 0.4, yaw: 0 },        // two-person table
  12: { x: -0.6, z: 1.0, yaw: Math.PI },  // chair
  4: { x: -2.4, z: -0.6, yaw: 0.3 },      // cat tower
  21: { x: 0.0, y: 1.4, z: -3.85, yaw: 0 }, // rear mounting boards seated on back wall
  22: { x: 1.2, z: -0.4, yaw: 0 },        // scratching column
  23: { x: -1.4, z: -1.2, yaw: 0.8 },     // sleeping basket
  6: { x: 2.6, z: -2.2, yaw: 0 },         // feeding station
  24: { x: 2.7, z: 0.6, yaw: -Math.PI / 2 }, // litter enclosure
  8: { x: 0.9, z: -1.6, yaw: 0.2 },       // shoji screen dividing the room
  7: { x: 0.0, y: 2.3, z: 0.0, yaw: 0 }, // 0.5 m lantern hangs below the 2.8 m ceiling
  10: { x: 0.0, z: 3.9, yaw: 0 },         // entrance assembly on the street face
  20: { x: -2.4, z: 3.4, yaw: Math.PI / 2 },  // shoe cubby by the door
  28: { x: 2.5, z: 3.3, yaw: -Math.PI / 2 },  // coat stand
  19: { x: 2.8, z: 3.7, yaw: 0 },         // umbrella stand
  30: { x: 1.2, z: 4.4, yaw: 0 },         // exterior menu stand
  29: { x: -1.4, z: 4.4, yaw: 0 },        // planter outside
  15: { x: -2.0, z: -1.9, yaw: 0 },       // trolley
  17: { x: 2.9, z: -2.9, yaw: -Math.PI / 2 }, // pantry, right back corner
  25: { x: -2.9, z: 1.0, yaw: Math.PI / 2 },  // adoption cabinet, left wall
  27: { x: -2.8, z: -1.6, yaw: Math.PI / 2 }, // waste cabinet, rear face at wall
  31: { x: 2.45, y: 0.515, z: 1.5, yaw: 0 },
  32: { x: 2.3, y: 0.515, z: 1.5, yaw: 0 },
  33: { x: -0.77, y: 0.72, z: 0.32, yaw: 0 },
  34: { x: -0.48, y: 0.72, z: 0.32, yaw: 0 },
  35: { x: -0.6, y: 0.72, z: 0.58, yaw: 0 },
  36: { x: -2.25, y: 0.92, z: -3.36, yaw: 0 },
  37: { x: -2.05, y: 0.92, z: -3.36, yaw: 0 },
  38: { x: -1.78, y: 0.92, z: -3.36, yaw: 0 },
  39: { x: -1.2, y: 0.72, z: -1.98, yaw: 0 },
  40: { x: -1.2, y: 0.72, z: -1.65, yaw: 0 },
  41: { x: -1.95, y: 0.72, z: 1.35, yaw: 0 },
  42: { x: -1.8, y: 0.72, z: 1.12, yaw: 0 },
  43: { x: -1.6, y: 0.72, z: 1.35, yaw: 0 },
  44: { x: 0.55, y: 1.8, z: 3.85, yaw: 0 },
  45: { x: 1.92, y: 0.515, z: 1.65, yaw: 0 },
  46: { x: -1.5, z: -0.75, yaw: 0 },
  47: { x: -0.35, y: 0.72, z: -0.65, yaw: 0 },
  48: { x: -1.95, y: 0.72, z: 1.6, yaw: 0 },
  49: { x: -2.98, y: 1.4, z: 0.25, yaw: Math.PI / 2 },
  50: { x: 0.1, y: 0.72, z: -0.65, yaw: 0 },
}

export async function createCafeScene(): Promise<ComposedScene> {
  const root = new Group()
  root.name = 'cafe-kit / cafe scene'
  const models = await instantiateAll()
  for (const { id, model } of models) {
    const n = Number(id.slice(3, 6))
    const placed = CAFE_LAYOUT[n]
    if (placed) {
      model.root.position.set(placed.x, placed.y ?? 0, placed.z)
      model.root.rotation.y = placed.yaw
    } else {
      for (const item of models) item.model.dispose()
      throw new Error(`Missing authored café placement for ${id}`)
    }
    root.add(model.root)
  }
  // Reuse installed furniture for real support; these are instances, not extra kit assets.
  const supportModule = '../kk-011-cafe-table/model.ts'
  const { createModel: createTable } = await import(supportModule) as ModelModule
  const supports = [
    ['matcha-support', 0.4, -3.1], ['service-support', -1.2, -1.8],
    ['adoption-desk', -1.8, 1.4], ['care-support', -0.15, -0.65],
  ] as const
  const extras = supports.map(([name, x, z]) => {
    const table = createTable(); table.root.name = `cafe-scene / ${name}`
    table.root.position.set(x, 0, z); root.add(table.root); return table
  })
  const room = new Group(); room.name = 'cafe-scene / room'; root.add(room)
  const plaster = new MeshStandardMaterial({ color: '#efe4cc', roughness: 0.95 })
  const roomGeometry = [new BoxGeometry(6, 0.06, 8), new BoxGeometry(6, 2.8, 0.06), new BoxGeometry(0.06, 2.8, 8)]
  const positions = [[0, -0.03, 0], [0, 1.4, -4.03], [-3.03, 1.4, 0]] as const
  roomGeometry.forEach((geometry, i) => {
    const mesh = new Mesh(geometry, plaster), position = positions[i]!
    mesh.position.set(position[0], position[1], position[2]); room.add(mesh)
  })
  root.userData.modelCount = models.length
  return {
    root,
    ids: models.map((m) => m.id),
    update: (dt) => { for (const { model } of models) model.update?.(dt) },
    dispose: () => {
      for (const { model } of models) model.dispose()
      for (const extra of extras) extra.dispose()
      for (const geometry of roomGeometry) geometry.dispose()
      plaster.dispose()
    },
  }
}

/** Preview factories for the docs app / capture CLI: `--export createReviewPreview | createCafePreview`. */
export async function createReviewPreview({ aspect }: { aspect: number; time?: number }): Promise<KkPreview> {
  const scene = await createReviewScene()
  const snapshot = batchStaticScene(scene.root)
  return createKkPreview({ root: snapshot.root, dispose() { snapshot.dispose(); scene.dispose() } }, { aspect, framing: 'cafe', distance: 16, pitch: 0.7, fov: 40, ground: true })
}

export async function createCafePreview({ aspect }: { aspect: number; time?: number }): Promise<KkPreview> {
  const scene = await createCafeScene()
  const snapshot = batchStaticScene(scene.root)
  return createKkPreview({ root: snapshot.root, dispose() { snapshot.dispose(); scene.dispose() } }, { aspect, framing: 'cafe', target: [0, 0.6, 0.3], distance: 12, pitch: 0.55, fov: 45, ground: true })
}
