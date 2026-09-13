/**
 * Renders the 50-item review scene and the furnished café once each through the headless Dawn session
 * and reports what the renderer actually did: draw calls and triangles per frame. This is the
 * "budgets alone are not performance proof" measurement the handoff asks for on the desktop side; the
 * phone measurement is a device run recorded in docs/kyoto-kat/PERF.md.
 *
 *   node --import tsx scripts/kk-scene-measure.ts [--max-draws 120] [--max-tris 250000] [--json]
 *
 * Exit 1 when either scene exceeds the caps. Defaults are the handoff's implied whole-scene ceilings
 * for a midrange phone: the review scene holds every model at once, so its cap is the sum of tier
 * budgets (10×15k + 20×6k + 20×2k = 310k) — pass --max-tris to tighten as models land.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DawnCaptureSession } from './asset-forge/capture/dawn-session.ts'
import { writePng } from './asset-forge/image.ts'
import { createCafePreview, createReviewPreview } from '../assets/cafe-kit/kk-scene/review-scene.ts'

const argv = process.argv.slice(2)
const option = (name: string, fallback: number): number => {
  const index = argv.indexOf(name)
  return index >= 0 ? Number(argv[index + 1]) : fallback
}
const maxDraws = option('--max-draws', 120)
const maxTris = option('--max-tris', 310_000)
const json = argv.includes('--json')

const results: Array<{ scene: string; models: number; drawCalls: number; triangles: number; png: string }> = []
let failed = false
const outDir = resolve('.asset-forge/previews/kk-scene')
mkdirSync(outDir, { recursive: true })

for (const [name, factory] of [['review', createReviewPreview], ['cafe', createCafePreview]] as const) {
  const preview = await factory({ aspect: 16 / 9 })
  preview.scene.updateMatrixWorld(true)
  const session = await DawnCaptureSession.create({ width: 1280, height: 720 })
  try {
    const capture = await session.capture(preview.scene, preview.camera)
    await session.settle()
    const png = resolve(outDir, `${name}.png`)
    await writePng(png, capture.image)
    const models = Number(preview.root.userData.modelCount ?? preview.root.children.length)
    results.push({ scene: name, models, drawCalls: capture.drawCalls, triangles: capture.triangles, png })
    if (capture.drawCalls > maxDraws || capture.triangles > maxTris) failed = true
  } finally {
    session.close()
    preview.dispose()
  }
}

if (json) console.log(JSON.stringify(results, null, 2))
else for (const r of results) console.log(`${r.scene}: ${r.models} models · ${r.drawCalls} draw calls · ${r.triangles} triangles · ${r.png}`)
writeFileSync(resolve(outDir, 'measure.json'), `${JSON.stringify({ maxDraws, maxTris, results }, null, 2)}\n`)
if (failed) {
  console.error(`scene exceeds caps (draws ≤ ${maxDraws}, tris ≤ ${maxTris})`)
  process.exit(1)
}
