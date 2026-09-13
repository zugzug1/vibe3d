/**
 * Standalone GLB export through the shared portable path (`exportStaticGlb`), which until now was only
 * reachable from the docs and recorder UI buttons.
 *
 *   node --import tsx scripts/export-glb.ts --id kk-004-cedar-cat-tower
 *   node --import tsx scripts/export-glb.ts --all                      # every kyoto-kat model
 *   node --import tsx scripts/export-glb.ts --all --root assets/f1-prototypes --out dist/f1-glb
 *   options: --out <dir> (default dist/cafe-kit-glb) · --texture-size <px> (default 512)
 *
 * Writes <out>/<id>.glb and prints bytes. Exit 1 if any export throws.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { exportStaticGlb } from '../src/asset-forge/generator/glb.ts'

const argv = process.argv.slice(2)
const option = (name: string, fallback: string): string => {
  const index = argv.indexOf(name)
  return index >= 0 && argv[index + 1] ? argv[index + 1]! : fallback
}
const root = resolve(option('--root', 'assets/cafe-kit'))
const out = resolve(option('--out', 'dist/cafe-kit-glb'))
const textureSize = Number(option('--texture-size', '512'))
const idIndex = argv.indexOf('--id')
const ids = argv.includes('--all')
  ? readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^kk-\d{3}-|^f1-|^[a-z]/.test(d.name) && !['kk-core', 'kk-scene', 'f1-kit-core', 'f1-kit-scene'].includes(d.name) && existsSync(join(root, d.name, 'model.ts')))
    .map((d) => d.name)
    .sort()
  : idIndex >= 0 ? [argv[idIndex + 1]!] : []

if (!ids.length) {
  console.error('usage: export-glb.ts --id <model-id> | --all [--root <dir>] [--out <dir>] [--texture-size 512]')
  process.exit(2)
}

mkdirSync(out, { recursive: true })
let failed = false
for (const id of ids) {
  try {
    const mod = await import(join(root, id, 'model.ts')) as {
      createModel: (options?: Record<string, unknown>) => { root: import('three/webgpu').Object3D; dispose: () => void }
    }
    const model = mod.createModel()
    model.root.updateMatrixWorld(true)
    const blob = await exportStaticGlb(model.root, { textureSize })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const path = join(out, `${id}.glb`)
    writeFileSync(path, bytes)
    model.dispose()
    console.log(`${id}: ${bytes.byteLength} bytes -> ${path}`)
  } catch (error) {
    failed = true
    console.error(`${id}: EXPORT FAILED — ${(error as Error).message}`)
  }
}
process.exit(failed ? 1 : 0)
