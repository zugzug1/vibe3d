/** Archive the approved-plan pilot gate; never label it as the finished 50-asset kit. */
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
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
function copy(source: string, relative: string): void {
  const target = join(destination, relative)
  mkdirSync(resolve(target, '..'), { recursive: true })
  copyFileSync(source, target)
  const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
  if (sha(source) !== sha(target)) throw new Error(`Copy mismatch: ${relative}`)
  entries.push({ path: relative, sha256: sha(target) })
}
for (const id of ids) {
  for (const [suffix, name] of [['', 'close.png'], ['-gameplay', 'gameplay.png']]) {
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
  copy(join(root, 'assets/cafe-kit', id, `${id}.vtopo`), `${id}/${id}.vtopo`)
  copy(join(root, 'assets/cafe-kit', id, 'review/REVIEW.md'), `${id}/REVIEW.md`)
}
copy(join(root, 'docs/kyoto-kat/CALIBRATION.md'), 'CALIBRATION.md')
if (batch) copy(join(root, 'docs/kyoto-kat/BATCH-01.md'), 'BATCH-01.md')
if (selected) copy(join(root, 'docs/kyoto-kat/NEXT-11.md'), 'NEXT-11.md')
writeFileSync(join(destination, 'manifest.json'), JSON.stringify({
  status: batch || selected ? 'batch-review-pending' : 'pilot-approval-pending', assetCount: ids.length, collectionTarget: 50,
  sourceCheckout: root, sourceBranch: 'feat/kyoto-kat-kit',
  note: 'Model source imports shared kit modules from the checkout; this is not a standalone source distribution. GLB headers and preview pixels checked; target-viewer reimport and mobile testing pending.',
  files: entries,
}, null, 2) + '\n')
writeFileSync(join(destination, 'SHA256SUMS'), entries.map((e) => `${e.sha256}  ${e.path}`).join('\n') + '\n')
writeFileSync(join(destination, 'README.md'), `# Café-kit: ${selected ? 'production batch review' : batch ? 'batch 01 repair review' : 'seven-pilot approval gate'}\n\nNot the completed 50-asset collection. Visual approval is pending.\n\n`
  + ids.map((id) => `## ${id}\n\n![Close view](${id}/close.png)\n\n[Gameplay view](${id}/gameplay.png) · [GLB](${id}/${id}.glb) · [Review](${id}/REVIEW.md)\n`).join('\n'))
console.log(`Archived ${ids.length} assets, ${entries.length} checksum-verified files: ${destination}`)
