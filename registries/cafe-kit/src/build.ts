import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COMPILED_TOPOLOGY_FORMAT,
  COMPILED_TOPOLOGY_MEDIA_TYPE,
  decodeCompiledTopology,
} from '../../../packages/terrain/src/index.ts'
import { registrySchema, type RegistryArtifact, type RegistryFile, type RegistryItem } from '@vibe3djs/schema'
import { categoryFromId, tierFromId } from './categories.ts'

const registryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(registryRoot, '../..')
const prototypesRoot = join(repositoryRoot, 'assets/cafe-kit')
const outputRoot = join(registryRoot, 'dist')

const KIT_CORE = 'kk-core'
const KIT_CORE_SKIP = new Set(['topology.ts', 'compile.ts', 'catalog.ts'])
const MODEL_DIR = /^kk-\d{3}-[a-z0-9-]+$/

function titleFromId(id: string): string {
  return id
    .replace(/^kk-\d{3}-/, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function hash(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

/** Only the shipped source: model.ts and catalog.ts. Specs, reviews and work dirs stay out of the registry. */
async function collectShippedFiles(root: string, skip = new Set<string>()): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !skip.has(entry.name))
    .map((entry) => join(root, entry.name))
    .sort()
}

function modelDependency(content: string, modelId: string): string[] {
  const dependencies = new Set<string>()
  const importPattern = /from\s+['"]\.\.\/(kk-[a-z0-9-]+)\//g
  for (const match of content.matchAll(importPattern)) {
    const dependency = match[1]
    if (dependency && dependency !== modelId) dependencies.add(`@cafe-kit/${dependency}`)
  }
  return [...dependencies]
}

async function registryFile(path: string, target: string): Promise<RegistryFile> {
  const content = await readFile(path, 'utf8')
  return { path: relative(repositoryRoot, path), target, content, hash: hash(content) }
}

async function topologyArtifact(modelId: string): Promise<{ artifact: RegistryArtifact; topologyKey: string; recipeHash: string; compilerHash: string } | null> {
  const path = join(prototypesRoot, modelId, `${modelId}.vtopo`)
  try {
    const bytes = new Uint8Array(await readFile(path))
    const topology = decodeCompiledTopology(bytes)
    return {
      artifact: {
        path: relative(repositoryRoot, path),
        target: `{models}/cafe-kit/${modelId}/${modelId}.vtopo`,
        mediaType: COMPILED_TOPOLOGY_MEDIA_TYPE,
        encoding: 'base64',
        content: Buffer.from(bytes).toString('base64'),
        hash: hash(bytes),
        byteLength: bytes.byteLength,
      },
      topologyKey: topology.topologyKey,
      recipeHash: topology.recipeHash,
      compilerHash: topology.compilerHash,
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function buildSupportItem(itemId: string): Promise<RegistryItem> {
  const directory = join(prototypesRoot, itemId)
  const paths = await collectShippedFiles(directory, KIT_CORE_SKIP)
  const files = await Promise.all(paths.map((path) => registryFile(
    path,
    `{models}/cafe-kit/${itemId}/${relative(directory, path).split(sep).join('/')}`,
  )))
  return {
    name: itemId,
    type: 'vibe3d:lib',
    title: 'Cafe Kit Core',
    description: 'Shared palette, materials, procedural textures, geometry primitives, preview rig and the resource-disposal contract every café prop builds on.',
    dependencies: ['three@>=0.185.0'],
    registryDependencies: [],
    files,
    artifacts: [],
  }
}

async function buildModelItem(modelId: string): Promise<RegistryItem> {
  const directory = join(prototypesRoot, modelId)
  const paths = await collectShippedFiles(directory)
  const contents = await Promise.all(paths.map((path) => readFile(path, 'utf8')))
  const dependencies = new Set<string>([`@cafe-kit/${KIT_CORE}`])
  for (const content of contents) {
    for (const dependency of modelDependency(content, modelId)) dependencies.add(dependency)
  }
  const files = await Promise.all(paths.map((path) => registryFile(
    path,
    `{models}/cafe-kit/${modelId}/${relative(directory, path).split(sep).join('/')}`,
  )))
  const title = titleFromId(modelId)
  const category = categoryFromId(modelId)
  const tier = tierFromId(modelId)
  const compiled = await topologyArtifact(modelId)
  if (!compiled) {
    throw new Error(`${modelId}: missing ${modelId}.vtopo — run bun run kk:compile-topology --only=${modelId}`)
  }
  return {
    name: modelId,
    type: 'vibe3d:model',
    title,
    description: `A procedural ${title.toLocaleLowerCase()} from a 1990s Kyoto cat café, built for real-time Three.js scenes.`,
    dependencies: ['three@>=0.185.0'],
    registryDependencies: [...dependencies].sort(),
    files,
    artifacts: [compiled.artifact],
    representations: {
      source: {
        entry: `assets/cafe-kit/${modelId}/model.ts#createModel`,
        capabilities: ['webgpu', 'tsl'],
      },
      compiled: [{
        id: 'game',
        kind: 'compiled-topology',
        artifact: compiled.artifact.path,
        format: COMPILED_TOPOLOGY_FORMAT,
        topologyKey: compiled.topologyKey,
        recipeHash: compiled.recipeHash,
        compilerHash: compiled.compilerHash,
        profile: 'game',
        capabilities: ['webgpu', 'tsl'],
      }],
    },
    meta: {
      title,
      description: `Inspect, configure, and export the ${title.toLocaleLowerCase()} directly from your project.`,
      category,
      tags: [category.toLocaleLowerCase(), tier, 'procedural', 'threejs', 'cafe', 'kyoto'],
      preview: `assets/cafe-kit/${modelId}/model.ts#createPreview`,
      controls: {},
      materialSlots: [],
      parts: [],
      sockets: [],
    },
  }
}

async function main(): Promise<void> {
  const entries = await readdir(prototypesRoot, { withFileTypes: true })
  const modelIds: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !MODEL_DIR.test(entry.name)) continue
    try {
      await readFile(join(prototypesRoot, entry.name, 'model.ts'))
      modelIds.push(entry.name)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  modelIds.sort()
  const items = [await buildSupportItem(KIT_CORE)]
  for (const modelId of modelIds) items.push(await buildModelItem(modelId))
  items.push({
    name: 'kit',
    type: 'vibe3d:kit',
    title: 'Cafe Kit',
    description: 'Procedural 1990s Kyoto cat-café furniture and props, ready to own and adapt: counters, seating, cat furniture, ceramics and storytelling dressing.',
    dependencies: [],
    registryDependencies: modelIds.map((id) => `@cafe-kit/${id}`),
    files: [],
    artifacts: [],
  })

  const registry = registrySchema.parse({
    $schema: 'https://vibe3d.dev/schema/registry.json',
    schemaVersion: 2,
    namespace: '@cafe-kit',
    name: 'Cafe Kit',
    description: 'A procedural 1990s Kyoto machiya cat-café prop library for Three.js — cedar, washi, tatami, glazed ceramics and indigo textiles, with no branding baked in.',
    homepage: 'https://vibe3d.dev/kits/cafe-kit',
    license: 'MIT',
    defaultItem: 'kit',
    compatibility: {
      vibe3d: '^0.0.1',
      engine: 'three',
      three: '>=0.185.0',
      capabilities: ['webgpu', 'tsl'],
    },
    items,
  })
  await mkdir(outputRoot, { recursive: true })
  await writeFile(join(outputRoot, 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
  console.log(`Built ${registry.items.length} registry items from ${modelIds.length} models.`)
}

await main()
