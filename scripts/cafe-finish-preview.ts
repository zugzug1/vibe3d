/** Deterministic QA capture for the public finish helper; no model defaults are changed. */
import { listModelIds, KIT_ROOT } from '../assets/cafe-kit/kk-core/catalog.ts'
import { createKkPreview, setCafeWoodFinish } from '../assets/cafe-kit/kk-core/index.ts'

export async function createPreview({ aspect }: { aspect: number }) {
  const id = process.env.KK_FINISH_ID ?? 'kk-020-shoe-cubby-rack'
  if (!(await listModelIds()).includes(id)) throw new Error(`Unknown café model: ${id}`)
  const { createModel } = await import(`${KIT_ROOT}/${id}/model.ts`)
  const model = createModel()
  try {
    setCafeWoodFinish(model.root, {
      tint: process.env.KK_WOOD_TINT ?? '#788468',
      roughness: Number(process.env.KK_WOOD_ROUGHNESS ?? 0.65),
    })
    return createKkPreview(model, { aspect })
  } catch (error) {
    model.dispose()
    throw error
  }
}
