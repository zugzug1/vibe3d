/**
 * Compile catalog for every Kyoto Kat model.ts — DISCOVERED, not hand-listed.
 *
 * The F1 kit keeps one central array that every new model has to be added to. This kit is built by
 * several workers in parallel who each own exactly one `kk-0NN-<slug>/` directory and never touch
 * `kk-core/`, so the catalog is assembled at load time instead: every `kk-0NN-<slug>` directory with a
 * model.ts is a model, and a directory may ship an optional `catalog.ts` exporting `entry` to pick its
 * compile strategy and hull names. Without one it compiles as a deformable shell with an AABB hull
 * allowed — the right default for furniture, and the worker-owned override for anything better.
 *
 * Hull names are applied at compile time; visual recipes stay unchanged.
 */
import { readdir, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { PropCompileStrategy } from './topology.ts'

export type CatalogEntry = {
  id: string
  strategy: PropCompileStrategy
  topologyKey: string
  config: Record<string, unknown>
  hull: readonly string[]
  detail: readonly string[]
  scatter: readonly string[]
  keepOpenings?: boolean
  pruneToLargest?: boolean
  allowAabbHull?: boolean
  forceAabbHull?: boolean
}

export const swept = (
  id: string,
  key: string,
  config: Record<string, unknown>,
  hull: readonly string[],
  detail: readonly string[] = [],
  extra: Partial<CatalogEntry> = {},
): CatalogEntry => ({
  id,
  strategy: 'swept-volume',
  topologyKey: key,
  config,
  hull,
  detail,
  scatter: [],
  pruneToLargest: false,
  forceAabbHull: extra.forceAabbHull,
  ...extra,
})

export const shell = (
  id: string,
  hull: readonly string[] = [],
  detail: readonly string[] = [],
  extra: Partial<CatalogEntry> = {},
): CatalogEntry => ({
  id,
  strategy: 'deformable-shell',
  topologyKey: `${id}-canonical`,
  config: extra.config ?? {},
  hull,
  detail,
  scatter: extra.scatter ?? [],
  pruneToLargest: extra.pruneToLargest ?? true,
  allowAabbHull: extra.allowAabbHull,
  keepOpenings: extra.keepOpenings,
  forceAabbHull: extra.forceAabbHull,
})

export const scatter = (
  id: string,
  config: Record<string, unknown>,
  hull: readonly string[],
  scatterNames: readonly string[],
  extra: Partial<CatalogEntry> = {},
): CatalogEntry => ({
  id,
  strategy: 'instanced-scatter',
  topologyKey: `${id}-canonical`,
  config,
  hull,
  detail: extra.detail ?? [],
  scatter: scatterNames,
  keepOpenings: true,
  pruneToLargest: false,
  allowAabbHull: extra.allowAabbHull,
  forceAabbHull: extra.forceAabbHull,
})

export const openAssembly = (
  id: string,
  config: Record<string, unknown>,
  hull: readonly string[],
  detail: readonly string[] = [],
  extra: Partial<CatalogEntry> = {},
): CatalogEntry => ({
  id,
  strategy: 'swept-volume',
  topologyKey: extra.topologyKey ?? `${id}-canonical`,
  config,
  hull,
  detail,
  scatter: extra.scatter ?? [],
  keepOpenings: true,
  pruneToLargest: false,
  allowAabbHull: extra.allowAabbHull,
  forceAabbHull: extra.forceAabbHull,
})

/** Furniture / prop default: shell, largest island, AABB hull allowed, openings kept. */
export const furnishing = (id: string, config: Record<string, unknown> = {}): CatalogEntry =>
  shell(id, [], [], { config, allowAabbHull: true, pruneToLargest: true, keepOpenings: true })

export const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Every worker-owned model directory (`kk-0NN-<slug>`), sorted. Never `kk-core` or `kk-scene`. */
export async function listModelIds(root = KIT_ROOT): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const ids: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (!/^kk-\d{3}-[a-z0-9-]+$/.test(entry.name)) continue
    const source = join(root, entry.name, 'model.ts')
    if (!await fileExists(source)) continue // Directory has not received its source yet.
    await import(pathToFileURL(source).href) // Broken source must fail validation, not disappear.
    ids.push(entry.name)
  }
  return ids.sort()
}

async function fileExists(path: string): Promise<boolean> {
  try { return (await stat(path)).isFile() }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/** The catalog: a worker's `catalog.ts#entry` when present, else the furnishing default. */
export async function loadCatalog(): Promise<CatalogEntry[]> {
  const ids = await listModelIds()
  const catalog: CatalogEntry[] = []
  for (const id of ids) {
    let entry: CatalogEntry | undefined
    const source = join(KIT_ROOT, id, 'catalog.ts')
    if (await fileExists(source)) {
      const mod = await import(pathToFileURL(source).href) as { entry?: CatalogEntry }
      entry = mod.entry
      if (!entry) throw new Error(`${id}/catalog.ts must export entry`)
    }
    if (entry && entry.id !== id) {
      throw new Error(`${id}/catalog.ts exports entry.id "${entry.id}" — it must equal the directory name`)
    }
    catalog.push(entry ?? furnishing(id))
  }
  return catalog
}

/** Path of a model's compiled sidecar. */
export function vtopoPath(id: string): string {
  return join(KIT_ROOT, id, `${id}.vtopo`)
}
