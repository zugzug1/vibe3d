/** Reimport exported GLBs with Three's loader; only image decoding is adapted for Node.
 * KK_GLB_ID=<id> bun run vibe:model preview --module scripts/cafe-glb-preview.ts
 * --export createPreview --asset <id>-glb
 * This validates the Three viewer path, not another engine or phone performance.
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import {
  DataTexture, RGBAFormat, Texture, Mesh, Material, BufferGeometry,
  LinearFilter, NearestFilter, LinearMipmapLinearFilter, LinearMipmapNearestFilter,
  NearestMipmapLinearFilter, NearestMipmapNearestFilter,
  RepeatWrapping, ClampToEdgeWrapping, MirroredRepeatWrapping,
} from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createKkPreview } from '../assets/cafe-kit/kk-core/preview.ts'

const filters = { 9728: NearestFilter, 9729: LinearFilter, 9984: NearestMipmapNearestFilter,
  9985: LinearMipmapNearestFilter, 9986: NearestMipmapLinearFilter, 9987: LinearMipmapLinearFilter }
const wraps = { 33071: ClampToEdgeWrapping, 33648: MirroredRepeatWrapping, 10497: RepeatWrapping }

export async function reimportCafeGlb(bytes: Uint8Array) {
  const textures = new Set<Texture>()
  const loader = new GLTFLoader()
  loader.register(parser => {
    if (parser.json.buffers?.some((buffer: { uri?: string }) => buffer.uri)) {
      throw new Error('Reimport requires embedded GLB buffers; no external requests')
    }
    return {
      name: 'CAFE_NODE_IMAGE_DECODE',
      async loadTexture(index: number) {
        const def = parser.json.textures[index]
        const source = parser.json.images[def.source]
        if (source?.bufferView === undefined || source.uri) throw new Error('Reimport requires embedded images')
        const encoded = await parser.getDependency('bufferView', source.bufferView) as ArrayBuffer
        const { data, info } = await sharp(Buffer.from(encoded), { limitInputPixels: 2048 * 2048 })
          .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
        const texture = new DataTexture(new Uint8Array(data), info.width, info.height, RGBAFormat)
        textures.add(texture)
        texture.name = def.name ?? source.name ?? `embedded-image-${index}`
        texture.flipY = false
        const sampler = parser.json.samplers?.[def.sampler] ?? {}
        texture.magFilter = sampler.magFilter === 9728 ? NearestFilter : LinearFilter
        texture.minFilter = filters[sampler.minFilter as keyof typeof filters] ?? LinearMipmapLinearFilter
        texture.wrapS = wraps[sampler.wrapS as keyof typeof wraps] ?? RepeatWrapping
        texture.wrapT = wraps[sampler.wrapT as keyof typeof wraps] ?? RepeatWrapping
        texture.generateMipmaps = texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter
        texture.needsUpdate = true
        parser.associations.set(texture, { textures: index })
        return texture
      },
    }
  })
  try {
    const gltf = await loader.parseAsync(Uint8Array.from(bytes).buffer, '')
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    gltf.scene.traverse(object => {
      if (!(object instanceof Mesh)) return
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material)
        for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
      }
    })
    let disposed = false
    return { root: gltf.scene, textureCount: textures.size, dispose() {
      if (disposed) return
      disposed = true
      for (const item of [...geometries, ...materials, ...textures]) item.dispose()
    } }
  } catch (error) {
    for (const texture of textures) texture.dispose()
    throw error
  }
}

async function preview(aspect: number, framing: 'close' | 'cafe') {
  const id = process.env.KK_GLB_ID ?? ''
  if (!/^kk-\d{3}-[a-z0-9-]+$/.test(id)) throw new Error('Set KK_GLB_ID to a café-kit asset ID')
  const model = await reimportCafeGlb(await readFile(resolve('dist/cafe-kit-glb', `${id}.glb`)))
  console.log(`Reimported ${id}: ${model.textureCount} texture objects`)
  return createKkPreview(model, { aspect, framing })
}
export const createPreview = ({ aspect }: { aspect: number }) => preview(aspect, 'close')
export const createCafePreview = ({ aspect }: { aspect: number }) => preview(aspect, 'cafe')
