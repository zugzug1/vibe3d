/** Compare review illumination without changing any model's material or geometry defaults. */
import { KIT_ROOT, listModelIds } from '../assets/cafe-kit/kk-core/catalog.ts'
import { createKkPreview } from '../assets/cafe-kit/kk-core/preview.ts'
async function preview(aspect: number, framing: 'close' | 'cafe') {
  const id = process.env.KK_REVIEW_ID ?? 'kk-025-adoption-notice-cabinet'
  if (!(await listModelIds()).includes(id)) throw new Error(`Unknown café model: ${id}`)
  const { createModel } = await import(`${KIT_ROOT}/${id}/model.ts`)
  return createKkPreview(createModel(), { aspect, framing, lighting: 'contrast' })
}
export const createPreview = ({ aspect }: { aspect: number }) => preview(aspect, 'close')
export const createCafePreview = ({ aspect }: { aspect: number }) => preview(aspect, 'cafe')
