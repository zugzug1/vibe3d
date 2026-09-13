/** Static review-scene snapshot only. Editable models and their anchors stay untouched. */
import { BufferGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Texture, Material, type Object3D } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export function batchStaticScene(source: Group) {
  source.updateMatrixWorld(true)
  const root = new Group()
  root.name = source.name
  root.userData = { ...source.userData, staticSnapshot: true }
  const owned = new Set<BufferGeometry>()
  const inverse = new Matrix4().copy(source.matrixWorld).invert()
  const signatures = new Map<Material, string>()
  const shared = new Map<string, Material>()
  const buckets = new Map<string, { mesh: Mesh; geometries: BufferGeometry[] }>()
  const canonical = (material: Material): Material => {
    // Only stock PBR and CPU-backed textures. Unknown/custom shaders remain isolated.
    if (!(material instanceof MeshStandardMaterial) || material.onBeforeCompile !== Material.prototype.onBeforeCompile) return material
    let signature = signatures.get(material)
    if (!signature) {
      const textureData: Record<string, unknown> = {}
      for (const [slot, value] of Object.entries(material)) if (value instanceof Texture) {
        const image = value.image as { data?: ArrayBufferView; width?: number; height?: number } | undefined
        if (!image?.data || !ArrayBuffer.isView(image.data)) return material
        textureData[slot] = {
          pixels: Array.from(new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength)),
          width: image.width, height: image.height, type: value.type, format: value.format,
          colorSpace: value.colorSpace, flipY: value.flipY, wrapS: value.wrapS, wrapT: value.wrapT,
          magFilter: value.magFilter, minFilter: value.minFilter, anisotropy: value.anisotropy,
          matrix: value.matrix.toArray(), matrixAutoUpdate: value.matrixAutoUpdate,
          offset: value.offset.toArray(), repeat: value.repeat.toArray(), center: value.center.toArray(), rotation: value.rotation,
          channel: value.channel, generateMipmaps: value.generateMipmaps, premultiplyAlpha: value.premultiplyAlpha,
        }
      }
      const data: Record<string, unknown> = { ...material.toJSON() }
      for (const key of ['uuid', 'name', 'metadata', 'textures', 'images']) delete data[key]
      for (const key of Object.keys(textureData)) delete data[key]
      signature = JSON.stringify({ data, textureData })
      signatures.set(material, signature)
    }
    const existing = shared.get(signature)
    if (existing) return existing
    shared.set(signature, material); return material
  }
  try {
    for (const model of source.children) {
      const group = new Group(); group.name = model.name; root.add(group)
      model.traverseVisible((object: Object3D) => {
        if (!(object instanceof Mesh)) return
        const matrix = new Matrix4().multiplyMatrices(inverse, object.matrixWorld)
        const material = object.material
        // Leave sorting-sensitive and specialized draws independent; don't guess their semantics.
        if (Array.isArray(material) || material.transparent || object.type !== 'Mesh'
          || Object.keys(object.geometry.morphAttributes).length || matrix.determinant() < 0
          || object.geometry.drawRange.start !== 0 || object.geometry.drawRange.count !== Infinity) {
          const copy = object.clone(false)
          copy.matrix.copy(matrix); copy.matrixAutoUpdate = false; group.add(copy)
          return
        }
        const geometry: BufferGeometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
        owned.add(geometry)
        geometry.applyMatrix4(matrix)
        geometry.clearGroups()
        const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b))
          .map(([name, attr]) => `${name}:${attr.itemSize}:${attr.normalized}:${attr.array.constructor.name}`).join('|')
        const equivalent = canonical(material)
        const key = `${equivalent.uuid}/${attributes}/${object.castShadow}/${object.receiveShadow}/${object.renderOrder}/${object.layers.mask}`
        const bucket: { mesh: Mesh; geometries: BufferGeometry[] } = buckets.get(key) ?? { mesh: object, geometries: [] }
        bucket.geometries.push(geometry); buckets.set(key, bucket)
      })
    }
      for (const { mesh, geometries } of buckets.values()) {
        const geometry = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries, false)
        if (!geometry) throw new Error(`Static batch failed: ${mesh.name}`)
        owned.add(geometry)
        if (geometries.length > 1) for (const part of geometries) { part.dispose(); owned.delete(part) }
        geometry.computeBoundingBox(); geometry.computeBoundingSphere()
        const combined = new Mesh(geometry, mesh.material)
        combined.name = 'cafe-kit / static material batch'
        combined.castShadow = mesh.castShadow; combined.receiveShadow = mesh.receiveShadow
        combined.renderOrder = mesh.renderOrder; combined.layers.mask = mesh.layers.mask
        root.add(combined)
      }
    root.userData.modelCount = source.userData.modelCount ?? source.children.length
  } catch (error) {
    for (const geometry of owned) geometry.dispose()
    throw error
  }
  let disposed = false
  return { root, dispose() {
    if (disposed) return
    disposed = true
    for (const geometry of owned) geometry.dispose()
  } }
}
