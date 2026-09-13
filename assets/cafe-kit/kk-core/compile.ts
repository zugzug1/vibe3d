/**
 * Write CompiledTopology sidecars for every Kyoto Kat catalog model.
 *
 *   bun assets/cafe-kit/kk-core/compile.ts                 # every model
 *   bun assets/cafe-kit/kk-core/compile.ts --only=<id>     # one worker's model
 *   bun assets/cafe-kit/kk-core/compile.ts --meshes        # list meshes + topology roles
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Box3, Object3D } from 'three'
import { encodeCompiledTopology, type CompiledTopology } from '../../../packages/terrain/src/index.ts'
import { loadCatalog, vtopoPath, type CatalogEntry } from './catalog.ts'
import {
  applyTopologyRoles,
  compilePropTopology,
  KK_TOPOLOGY_COMPILER_HASH,
  worldAabbFromTopologyKey,
} from './topology.ts'

export function recipeHashOf(entry: CatalogEntry): string {
  return createHash('sha256')
    .update(JSON.stringify({
      id: entry.id,
      config: entry.config,
      compiler: KK_TOPOLOGY_COMPILER_HASH,
    }))
    .digest('hex')
}

export async function instantiateModel(entry: CatalogEntry): Promise<{
  root: Object3D
  dispose: () => void
}> {
  const mod = await import(`../${entry.id}/model.ts`) as {
    createModel: (options?: Record<string, unknown>) => {
      root: Object3D
      dispose: () => void
    }
  }
  const model = mod.createModel(entry.config)
  applyTopologyRoles(model.root, {
    hull: entry.hull,
    detail: entry.detail,
    scatter: entry.scatter,
  })
  return model
}

export async function compileCatalogEntry(entry: CatalogEntry): Promise<{
  topology: CompiledTopology
  worldBox: Box3 | null
  dispose: () => void
}> {
  const model = await instantiateModel(entry)
  try {
    const topology = compilePropTopology(model.root, {
      assetId: entry.id,
      topologyKey: entry.topologyKey,
      recipeHash: recipeHashOf(entry),
      strategy: entry.strategy,
      hullNames: entry.hull,
      keepOpenings: entry.keepOpenings,
      pruneToLargest: entry.pruneToLargest,
      allowAabbHull: entry.allowAabbHull,
      forceAabbHull: entry.forceAabbHull,
    })
    return {
      topology,
      worldBox: worldAabbFromTopologyKey(topology.topologyKey),
      dispose: () => model.dispose(),
    }
  } catch (error) {
    model.dispose()
    throw error
  }
}

function meshReport(root: Object3D): string[] {
  const lines: string[] = []
  root.traverse((child) => {
    const mesh = child as { isMesh?: boolean; isInstancedMesh?: boolean; name: string; userData: Record<string, unknown> }
    if (!mesh.isMesh) return
    const role = mesh.userData.topologyRole ?? '-'
    const kind = mesh.isInstancedMesh ? 'instanced' : 'mesh'
    lines.push(`${mesh.name || '(unnamed)'}\t${kind}\t${role}`)
  })
  return lines
}

async function main(): Promise<void> {
  const meshesOnly = process.argv.includes('--meshes')
  const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length)
  const catalog = await loadCatalog()
  const entries = only ? catalog.filter((entry) => entry.id === only) : catalog
  if (only && !entries.length) throw new Error(`unknown catalog id: ${only}`)
  if (!entries.length) {
    console.log('no kk-* models on disk yet')
    return
  }

  if (meshesOnly) {
    for (const entry of entries) {
      const model = await instantiateModel(entry)
      console.log(`## ${entry.id}`)
      console.log(meshReport(model.root).join('\n'))
      model.dispose()
    }
    return
  }

  for (const entry of entries) {
    const compiled = await compileCatalogEntry(entry)
    const bytes = encodeCompiledTopology(compiled.topology)
    const out = vtopoPath(entry.id)
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, bytes)
    compiled.dispose()
    const claims = compiled.topology.claims
    console.log(JSON.stringify({
      id: entry.id,
      bytes: bytes.byteLength,
      triangles: compiled.topology.indices.length / 3,
      lods: compiled.topology.lods.length,
      collision: compiled.topology.collisionIndices.length / 3,
      manifold: claims.manifold,
      boundaryMode: claims.boundaryMode,
      aabbHull: compiled.topology.topologyKey.includes('|aabb-hull'),
    }))
  }
}

const launched = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (launched) {
  await main()
}
