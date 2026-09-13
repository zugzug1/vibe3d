/** Archive production artifacts; keep appearance/device/release approval distinct. */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const reimported = process.argv[4] === '--reimported'
if (process.argv[4] && !reimported) throw new Error('Unknown archive option')
const batch = process.argv[3] === '--batch-01'
const selected = process.argv[3]?.startsWith('--ids=') ? process.argv[3].slice(6).split(',') : undefined
if (process.argv[3] && !batch && !selected) throw new Error('Unknown archive selection')
if (selected && (new Set(selected).size !== selected.length || selected.some(id => !/^kk-\d{3}-[a-z0-9-]+$/.test(id)))) {
  throw new Error('Supply distinct, valid café-kit asset IDs')
}
const destination = resolve(process.argv[2] ?? '')
if (!destination.startsWith('/Volumes/zug1/kyoto-kat-kit/pilot-review/')) {
  throw new Error('Supply a versioned destination within zug1/kyoto-kat-kit/pilot-review/')
}
mkdirSync(resolve(destination, '..'), { recursive: true })
mkdirSync(destination) // Fail if this version exists; never overwrite an earlier handoff.
const ids = selected ?? (batch
  ? ['kk-002-matcha-station', 'kk-006-feeding-station', 'kk-032-tea-caddy', 'kk-033-kyusu-teapot']
  : ['kk-001-espresso-station', 'kk-004-cedar-cat-tower', 'kk-008-shoji-folding-screen',
  'kk-011-cafe-table', 'kk-012-spindle-back-chair', 'kk-034-repaired-cup', 'kk-040-folded-apron'])
const entries: Array<{ path: string; sha256: string }> = []
const fullCollection = ids.length === 50 && new Set(ids.map(id => Number(id.slice(3, 6)))).size === 50
  && ids.every(id => Number(id.slice(3, 6)) >= 1 && Number(id.slice(3, 6)) <= 50)
function copy(source: string, relative: string): void {
  const target = join(destination, relative)
  mkdirSync(resolve(target, '..'), { recursive: true })
  copyFileSync(source, target)
  const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
  if (sha(source) !== sha(target)) throw new Error(`Copy mismatch: ${relative}`)
  entries.push({ path: relative, sha256: sha(target) })
}
for (const id of ids) {
  const captures = [['', 'close.png'], ['-gameplay', 'gameplay.png']]
  if (reimported) captures.push(['-glb', 'glb-close.png'], ['-glb-gameplay', 'glb-gameplay.png'])
  if (reimported && existsSync(join(root, '.asset-forge/previews', id + '-glb-inspection', 'latest.png'))) {
    captures.push(['-glb-inspection', 'glb-inspection.png'])
  }
  for (const [suffix, name] of [['-contrast', 'contrast.png'], ['-glb-contrast', 'glb-contrast.png']]) {
    if (existsSync(join(root, '.asset-forge/previews', id + suffix, 'latest.png'))) captures.push([suffix!, name!])
  }
  for (const [suffix, name] of captures) {
    const image = join(root, '.asset-forge/previews', id + suffix, 'latest.png')
    const { info } = await sharp(image).raw().toBuffer({ resolveWithObject: true })
    if (info.width !== 1024 || info.height !== 1024) throw new Error(`Invalid capture: ${image}`)
    copy(image, `${id}/${name}`)
  }
  const glb = join(root, 'dist/cafe-kit-glb', `${id}.glb`)
  const bytes = readFileSync(glb)
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error(`Malformed GLB header: ${id}`)
  }
  copy(glb, `${id}/${id}.glb`)
  copy(join(root, 'assets/cafe-kit', id, 'model.ts'), `${id}/model.ts`)
  // Keep local runtime helpers (e.g. cloth.ts) with their editable model source.
  for (const entry of readdirSync(join(root, 'assets/cafe-kit', id), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'model.ts'
      && entry.name !== 'compile.ts' && !/\.(test|spec)\.ts$/.test(entry.name)) {
      copy(join(root, 'assets/cafe-kit', id, entry.name), `${id}/${entry.name}`)
    }
  }
  copy(join(root, 'assets/cafe-kit', id, `${id}.vtopo`), `${id}/${id}.vtopo`)
  copy(join(root, 'assets/cafe-kit', id, 'review/REVIEW.md'), `${id}/REVIEW.md`)
  const constructionReview = join(root, 'assets/cafe-kit', id, 'REVIEW.md')
  if (existsSync(constructionReview)) copy(constructionReview, `${id}/CONSTRUCTION.md`)
  for (const variant of ['default', 'min', 'max']) {
    const candidates = [
      join(root, '.asset-forge/previews', `${id}-controls`, `${variant}.png`),
      join(root, 'assets/cafe-kit', id, 'controls-renders', `${variant}.png`),
    ]
    const source = candidates.find(existsSync)
    if (!source) continue
    const { info } = await sharp(source).raw().toBuffer({ resolveWithObject: true })
    if (info.width < 768 || info.height < 768) throw new Error(`Invalid controls capture: ${source}`)
    copy(source, `${id}/controls-${variant}.png`)
  }
}
copy(join(root, 'docs/kyoto-kat/CALIBRATION.md'), 'CALIBRATION.md')
for (const document of ['CONTROLS.md', 'PRODUCTION.md', 'PERF.md', 'REVIEW-INDEX.md', 'COMPLETION.md', 'delivery-manifest.json', 'inventory.json']) {
  const source = join(root, 'docs/kyoto-kat', document)
  if (existsSync(source)) copy(source, document)
}
if (batch) copy(join(root, 'docs/kyoto-kat/BATCH-01.md'), 'BATCH-01.md')
if (selected && !fullCollection) copy(join(root, 'docs/kyoto-kat/NEXT-11.md'), 'NEXT-11.md')
if (fullCollection) {
  const scenePath = join(root, '.asset-forge/previews/kk-scene')
  const measurement = JSON.parse(readFileSync(join(scenePath, 'measure.json'), 'utf8'))
  for (const name of ['review', 'cafe']) {
    if (!measurement.results?.some((result: { scene: string; models: number }) => result.scene === name && result.models === 50)) {
      throw new Error(`Full archive requires a measured 50-model ${name} scene`)
    }
    const source = join(scenePath, `${name}.png`)
    const { info } = await sharp(source).raw().toBuffer({ resolveWithObject: true })
    if (info.width !== 1280 || info.height !== 720) throw new Error(`Invalid scene capture: ${name}`)
    copy(source, `scenes/${name}.png`)
  }
  copy(join(scenePath, 'measure.json'), 'scenes/measure.json')
}
writeFileSync(join(destination, 'manifest.json'), JSON.stringify({
  status: batch || selected ? 'batch-review-pending' : 'pilot-approval-pending', assetCount: ids.length, collectionTarget: 50,
  sourceCheckout: root, sourceBranch: 'feat/kyoto-kat-kit',
  reimported,
  note: 'Model source imports shared kit modules from the checkout; this is not a standalone source distribution. GLB headers and preview pixels checked. ' + (reimported ? 'Includes Three GLTFLoader reimport renders with Node image decoding; other engines and mobile performance remain unverified.' : 'Target-viewer reimport and mobile testing pending.'),
  files: entries,
}, null, 2) + '\n')
writeFileSync(join(destination, 'SHA256SUMS'), entries.map((e) => `${e.sha256}  ${e.path}`).join('\n') + '\n')
writeFileSync(join(destination, 'README.md'), `# Café-kit: ${fullCollection ? '50-asset production review' : selected ? 'production batch review' : batch ? 'batch 01 repair review' : 'seven-pilot approval gate'}\n\n${fullCollection ? 'All 50 source/export sets are included. Visual approval, physical-phone performance and release clearance remain pending.\n\n[Review scene](scenes/review.png) · [Furnished café](scenes/cafe.png) · [Desktop counters—not phone fps](scenes/measure.json)' : 'Not the completed 50-asset collection. Visual approval is pending.'}\n\n`
  + ids.map((id) => `## ${id}\n\n![Close view](${id}/${reimported ? 'glb-close.png' : 'close.png'})\n\n[Gameplay view](${id}/${reimported ? 'glb-gameplay.png' : 'gameplay.png'}) · [GLB](${id}/${id}.glb) · [Review](${id}/REVIEW.md)`
    + (entries.some(e => e.path === `${id}/glb-inspection.png`) ? ` · [Cavity inspection](${id}/glb-inspection.png)` : '')
    + (entries.some(e => e.path === `${id}/contrast.png`) ? ` · [Contrast lighting](${id}/contrast.png)` : '')
    + (entries.some(e => e.path === `${id}/glb-contrast.png`) ? ` · [GLB contrast lighting](${id}/glb-contrast.png)` : '')
    + ['default', 'min', 'max'].filter(variant => entries.some(e => e.path === `${id}/controls-${variant}.png`)).map(variant => ` · [Shape ${variant}](${id}/controls-${variant}.png)`).join('') + '\n').join('\n'))
console.log(`Archived ${ids.length} assets, ${entries.length} checksum-verified files: ${destination}`)
