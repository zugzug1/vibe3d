/**
 * Kit-wide compiled-topology gate. Every Kyoto Kat model.ts compiles a measured CompiledTopology
 * sidecar; claims are probed, not declared. Discovered from disk like the ownership tests.
 */
import { describe, expect, test } from 'bun:test'
import { Box3, Object3D, Vector3 } from 'three/webgpu'
import { validateCompiledTopology } from '../../packages/terrain/src/index.ts'
import { measureIntegrity } from '../../assets/terrain/shared/diagnose.ts'
import { loadCatalog } from './kk-core/catalog.ts'
import { compileCatalogEntry, recipeHashOf } from './kk-core/compile.ts'
import { KK_TOPOLOGY_COMPILER_HASH, worldAabbFromTopologyKey } from './kk-core/topology.ts'

const CATALOG = await loadCatalog()

const sizeOf = (root: Object3D) => {
  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root as never)
  return { box, size: box.getSize(new Vector3()) }
}

describe('kyoto-kat compiled topology', () => {
  test('catalog covers every model.ts', async () => {
    const disk = new Bun.Glob('kk-*/model.ts').scan({ cwd: import.meta.dir })
    const ids: string[] = []
    for await (const path of disk) {
      const id = path.split('/')[0]!
      if (id !== 'kk-core' && id !== 'kk-scene') ids.push(id)
    }
    ids.sort()
    expect(CATALOG.map((entry) => entry.id).sort()).toEqual(ids)
  })

  for (const entry of CATALOG) {
    test(`${entry.id} compiles a game-ready hull contained by its visual AABB`, async () => {
      const compiled = await compileCatalogEntry(entry)
      try {
        const result = validateCompiledTopology(compiled.topology)
        expect(result.valid).toBe(true)
        if (!result.valid) expect(result.errors).toEqual([])
        const integrity = measureIntegrity(
          compiled.topology.indices,
          compiled.topology.domainCoordinates.length / 3,
        )
        expect(integrity.manifold).toBe(true)
        expect(integrity.nonManifoldEdges).toBe(0)
        expect(compiled.topology.claims.manifold).toBe(true)
        expect(compiled.topology.lods.length).toBeGreaterThanOrEqual(1)
        expect(compiled.topology.collisionIndices.length).toBeGreaterThanOrEqual(3)
        expect(compiled.topology.compilerHash).toBe(KK_TOPOLOGY_COMPILER_HASH)
        expect(compiled.topology.recipeHash).toBe(recipeHashOf(entry))
        const hull = worldAabbFromTopologyKey(compiled.topology.topologyKey)
        expect(hull).not.toBeNull()

        const { createModel } = await import(`./${entry.id}/model.ts`) as {
          createModel: (options?: Record<string, unknown>) => { root: Object3D; dispose: () => void }
        }
        const visual = createModel(entry.config)
        try {
          const { box } = sizeOf(visual.root)
          const pad = 0.08
          expect(hull!.min.x).toBeGreaterThanOrEqual(box.min.x - pad)
          expect(hull!.min.y).toBeGreaterThanOrEqual(box.min.y - pad)
          expect(hull!.min.z).toBeGreaterThanOrEqual(box.min.z - pad)
          expect(hull!.max.x).toBeLessThanOrEqual(box.max.x + pad)
          expect(hull!.max.y).toBeLessThanOrEqual(box.max.y + pad)
          expect(hull!.max.z).toBeLessThanOrEqual(box.max.z + pad)
        } finally {
          visual.dispose()
        }
      } finally {
        compiled.dispose()
      }
    }, 120_000)
  }
})
