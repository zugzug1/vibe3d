/** Explicit standalone variants: never touches the approved preview's latest record. */
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { DawnCaptureSession } from './asset-forge/capture/dawn-session.ts'
import { writePng } from './asset-forge/image.ts'
import { createKkPreview } from '../assets/cafe-kit/kk-core/index.ts'
import * as entrance from '../assets/cafe-kit/kk-010-cafe-entrance-assembly/model.ts'
import * as chair from '../assets/cafe-kit/kk-012-spindle-back-chair/model.ts'
import * as trolley from '../assets/cafe-kit/kk-015-service-trolley/model.ts'

const session = await DawnCaptureSession.create({ width: 768, height: 768, backend: 'metal' })
try {
  for (const [id, module] of [['kk-010-cafe-entrance-assembly', entrance], ['kk-012-spindle-back-chair', chair], ['kk-015-service-trolley', trolley]] as const) {
    const directory = new URL(`../.asset-forge/previews/${id}-controls/`, import.meta.url)
    await mkdir(directory, { recursive: true })
    for (const variant of ['default', 'min', 'max'] as const) {
      const config = Object.fromEntries(Object.entries(module.cafeShapeControls).map(([key, control]) => [key, control[variant]]))
      const preview = createKkPreview(module.createModel(config), { aspect: 1 })
      try {
        preview.scene.updateMatrixWorld(true)
        const result = await session.capture(preview.scene, preview.camera)
        await session.settle()
        const output = fileURLToPath(new URL(`${variant}.png`, directory))
        await writePng(output, result.image)
        console.log(JSON.stringify({ id, variant, output, triangles: result.triangles, drawCalls: result.drawCalls }))
      } finally { preview.dispose() }
    }
  }
} finally { session.close() }
