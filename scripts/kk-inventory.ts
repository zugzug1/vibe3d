/**
 * Kyoto Kat inventory + budget gate.
 *
 * Instantiates every `kk-0NN-<slug>/model.ts` under assets/cafe-kit, measures what the brief asks to be reported —
 * metric bounds, triangles, mesh primitives, distinct materials, texture slots and sizes, GLB byte size
 * when one has been exported — and FAILS on a tier breach. Budgets are not enforced anywhere else in
 * the repository, so this is the gate.
 *
 *   node --import tsx scripts/kk-inventory.ts                       # print table
 *   node --import tsx scripts/kk-inventory.ts --check               # exit 1 on any breach
 *   node --import tsx scripts/kk-inventory.ts --write docs/kyoto-kat/inventory.md   # + inventory.json
 *   node --import tsx scripts/kk-inventory.ts --only kk-004-cedar-cat-tower
 *
 * Exceptions (a justified 2K hero texture) are listed by id in docs/kyoto-kat/exceptions.md as a line
 * beginning with the id; the gate reads that file and downgrades the breach to a warning.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Box3, Mesh, Vector3, type BufferGeometry, type Material, type Texture } from 'three/webgpu'
import { TIER_BUDGET, tierFromId } from '../registries/cafe-kit/src/categories.ts'

const KIT_ROOT = resolve('assets/cafe-kit')
const GLB_ROOT = resolve('dist/cafe-kit-glb')
const EXCEPTIONS = resolve('docs/kyoto-kat/exceptions.md')

const argv = process.argv.slice(2)
const check = argv.includes('--check')
const complete = argv.includes('--complete')
const writeIdx = argv.indexOf('--write')
const writeTo = writeIdx >= 0 ? argv[writeIdx + 1] : undefined
const onlyIdx = argv.indexOf('--only')
const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : undefined

interface Row {
  id: string
  tier: string
  width: number
  depth: number
  height: number
  triangles: number
  meshes: number
  materials: number
  textures: string[]
  glbBytes: number | null
  movable: string[]
  breaches: string[]
  warnings: string[]
  artifacts: Record<string, string | null>
  appearance: 'approved' | 'pending'
  intendedDimensions: { width: number; depth: number; height: number } | null
}

// Explicit user approvals only; source existence and critic scores are not approval.
const approved = new Set([1, 2, 3, 4, 5, 6, 8, 11, 12, 16, 17, 32, 33, 34, 40])
const brief = JSON.parse(readFileSync(resolve('docs/kyoto-kat/manifest.json'), 'utf8')) as {
  items: Array<{ id: string; name: string; reference: string; sha256: string; generator: string; dimensions_m: { width: number; depth: number; height: number } }>
}

const exceptions = new Set<string>(
  existsSync(EXCEPTIONS)
    ? readFileSync(EXCEPTIONS, 'utf8').split('\n').map((line) => line.trim().split(/\s+/)[0] ?? '').filter((id) => id.startsWith('kk-'))
    : [],
)

const ids = readdirSync(KIT_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^kk-\d{3}-[a-z0-9-]+$/.test(d.name) && existsSync(join(KIT_ROOT, d.name, 'model.ts')))
  .map((d) => d.name)
  .filter((id) => !only || id === only)
  .sort()

if (!ids.length) throw new Error('No matching café model sources; inventory cannot pass empty coverage')

const rows: Row[] = []
for (const id of ids) {
  const mod = await import(join(KIT_ROOT, id, 'model.ts')) as {
    createModel: (options?: Record<string, unknown>) => {
      root: import('three/webgpu').Group
      parts: Record<string, { userData?: Record<string, unknown> }>
      dispose: () => void
    }
  }
  const model = mod.createModel()
  model.root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(model.root as never)
  const size = box.getSize(new Vector3())

  let triangles = 0
  let meshes = 0
  const materials = new Set<Material>()
  const textures = new Map<Texture, string>()
  model.root.traverse((object) => {
    const mesh = object as Mesh & { isInstancedMesh?: boolean; count?: number }
    if (!mesh.isMesh) return
    meshes += 1
    const geometry = mesh.geometry as BufferGeometry
    const per = geometry.index ? geometry.index.count / 3 : (geometry.getAttribute('position')?.count ?? 0) / 3
    triangles += per * (mesh.isInstancedMesh ? (mesh.count ?? 1) : 1)
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material as Material)
      const m = material as Material & Record<string, unknown>
      for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap']) {
        const texture = m[slot] as Texture | null | undefined
        if (texture && !textures.has(texture)) {
          const image = texture.image as { width?: number; height?: number } | undefined
          textures.set(texture, `${slot} ${image?.width ?? '?'}×${image?.height ?? '?'}`)
        }
      }
    }
  })
  const movable = Object.entries(model.parts)
    .filter(([, part]) => part.userData?.movable === true)
    .map(([name]) => name)

  const tier = tierFromId(id)
  const budget = TIER_BUDGET[tier]
  const breaches: string[] = []
  const warnings: string[] = []
  const target = brief.items.find(item => item.id === id.slice(0, 6))?.dimensions_m
  if (!target) breaches.push('missing original modeling target')
  else for (const [axis, measured] of [['width', size.x], ['depth', size.z], ['height', size.y]] as const) {
    if (Math.abs(measured - target[axis]) > Math.max(0.005, target[axis] * 0.05)) {
      warnings.push(`${axis} ${round(measured)} differs from original ${target[axis]} m; verify pose or approved exception`)
    }
  }
  if (!meshes || !Number.isFinite(triangles) || triangles <= 0) breaches.push('empty or invalid geometry')
  if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 0)) breaches.push('invalid dimensions')
  if (triangles > budget.triangles) breaches.push(`triangles ${Math.round(triangles)} > ${budget.triangles}`)
  else if (triangles > budget.triangles * 0.85) warnings.push(`triangles ${Math.round(triangles)} within 15 % of ${budget.triangles}`)
  const materialCap = tier === 'storytelling' ? 2 : 3
  if (materials.size > materialCap) warnings.push(`${materials.size} materials (kit guideline ≤ ${materialCap}); each costs a draw call`)
  for (const [texture, label] of textures) {
    const image = texture.image as { width?: number; height?: number } | undefined
    const maxSide = Math.max(image?.width ?? 0, image?.height ?? 0)
    if (maxSide > budget.textureMax) {
      const message = `texture ${label} > ${budget.textureMax}`
      if (exceptions.has(id)) warnings.push(`${message} (listed in exceptions.md)`)
      else breaches.push(message)
    }
  }

  const glbPath = join(GLB_ROOT, `${id}.glb`)
  const glbBytes = existsSync(glbPath) ? statSync(glbPath).size : null
  const candidates = {
    source: `assets/cafe-kit/${id}/model.ts`,
    topology: `assets/cafe-kit/${id}/${id}.vtopo`,
    glb: `dist/cafe-kit-glb/${id}.glb`,
    preview: `.asset-forge/previews/${id}/latest.png`,
    gameplay: `.asset-forge/previews/${id}-gameplay/latest.png`,
    reimport: `.asset-forge/previews/${id}-glb/latest.png`,
    reimportGameplay: `.asset-forge/previews/${id}-glb-gameplay/latest.png`,
    review: `assets/cafe-kit/${id}/review/REVIEW.md`,
  }
  const artifacts = Object.fromEntries(Object.entries(candidates).map(([key, path]) =>
    [key, existsSync(resolve(path)) ? path : null]))
  if (complete) for (const [key, path] of Object.entries(artifacts)) {
    if (!path) breaches.push(`missing ${key}`)
  }

  rows.push({
    id,
    tier,
    width: round(size.x),
    depth: round(size.z),
    height: round(size.y),
    triangles: Math.round(triangles),
    meshes,
    materials: materials.size,
    textures: [...textures.values()],
    glbBytes,
    movable,
    breaches,
    warnings,
    artifacts,
    appearance: approved.has(Number(id.slice(3, 6))) ? 'approved' : 'pending',
    intendedDimensions: target ? { width: target.width, depth: target.depth, height: target.height } : null,
  })
  model.dispose()
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

const header = '| id | tier | W×D×H (m) | tris | meshes | mats | textures | GLB | movable | status |'
const lines = [header, '|---|---|---|---:|---:|---:|---|---:|---|---|']
for (const row of rows) {
  const status = row.breaches.length ? `FAIL: ${row.breaches.join('; ')}` : row.warnings.length ? `warn: ${row.warnings.join('; ')}` : 'ok'
  const glb = row.glbBytes === null ? '—' : (row.glbBytes / 1024).toFixed(0) + ' KB'
  lines.push([
    '', row.id, row.tier, row.width + '×' + row.depth + '×' + row.height, String(row.triangles), String(row.meshes),
    String(row.materials), row.textures.join(', ') || '—', glb, row.movable.join(', ') || '—', status, '',
  ].join(' | ').trim())
}
const totalTris = rows.reduce((sum, row) => sum + row.triangles, 0)
lines.push('', `Models: ${rows.length} · total triangles: ${totalTris}`)
const table = lines.join('\n')
console.log(table)

if (writeTo) {
  const intro = '# Kyoto Kat inventory\n\nGenerated by scripts/kk-inventory.ts. Dimensions are measured bounds; tier budgets: signature <= 15 000, furnishing <= 6 000, storytelling <= 2 000 triangles.\n\n'
  writeFileSync(resolve(writeTo), intro + table + '\n')
  writeFileSync(resolve(writeTo).replace(/\.md$/, '.json'), JSON.stringify(rows, null, 2) + '\n')
  writeFileSync(join(dirname(resolve(writeTo)), 'delivery-manifest.json'), JSON.stringify({
    version: 1, repository: 'zugzug1/vibe3d', branch: 'feat/kyoto-kat-kit',
    pathBase: 'repository root; referenceImage paths require the mounted local zug1 drive',
    mobileAcceptance: 'pending physical-device measurement', redistribution: 'pending licensing confirmation',
    assets: Object.fromEntries(brief.items.map(item => {
      const row = rows.find(row => row.id.slice(0, 6) === item.id)
      return [item.id, {
        name: item.name, modelId: row?.id ?? null,
        referenceImage: { path: `/Volumes/zug1/kyoto-kat-kit/v1/${item.reference}`, sha256: item.sha256, generator: item.generator },
        intendedDimensions: item.dimensions_m,
        measuredDimensions: row ? { width: row.width, depth: row.depth, height: row.height } : null,
        triangles: row?.triangles ?? null, artifacts: row?.artifacts ?? null,
        appearance: row?.appearance ?? 'not-produced', warnings: row?.warnings ?? [], breaches: row?.breaches ?? [],
      }]
    })),
  }, null, 2) + '\n')
}

const failed = rows.filter((row) => row.breaches.length)
if (complete && (only || rows.length !== 50 || new Set(rows.map(row => row.id.slice(0, 6))).size !== 50
  || rows.some(row => Number(row.id.slice(3, 6)) < 1 || Number(row.id.slice(3, 6)) > 50))) {
  console.error('Complete inventory requires all 50 distinct asset IDs; do not use --only.')
  process.exitCode = 1
}
if ((check || complete) && failed.length) {
  console.error(`\n${failed.length} model(s) breach their tier budget: ${failed.map((row) => row.id).join(', ')}`)
  process.exit(1)
}
