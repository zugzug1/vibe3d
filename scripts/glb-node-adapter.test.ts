import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { BoxGeometry, DataTexture, Mesh, MeshStandardMaterial, RGBAFormat } from 'three/webgpu'
import { exportStaticGlb } from '../src/asset-forge/generator/glb.ts'
import { installGlbNodeAdapters } from './glb-node-adapter.ts'
import { createModel as createBench } from '../assets/cafe-kit/kk-005-machiya-window-bench/model.ts'
import { createModel as createShelf } from '../assets/cafe-kit/kk-016-cup-shelving-unit/model.ts'

interface GlbJson {
  meshes: Array<{ primitives: Array<{ attributes: Record<string, number> }> }>
  materials: Array<{ name: string; pbrMetallicRoughness: { baseColorTexture: { index: number }; metallicRoughnessTexture: { index: number } }; normalTexture: { index: number } }>
  textures: Array<{ source: number }>
  images: Array<{ bufferView: number }>
  bufferViews: Array<{ byteOffset?: number; byteLength: number }>
}

function embeddedImages(buffer: Buffer) {
  const jsonLength = buffer.readUInt32LE(12)
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString()) as GlbJson
  return { json, async pixels(index: number): Promise<Buffer> {
    const image = json.images[json.textures[index]!.source]!
    const view = json.bufferViews[image.bufferView]!
    const start = 20 + jsonLength + 8 + (view.byteOffset ?? 0)
    return sharp(buffer.subarray(start, start + view.byteLength)).ensureAlpha().raw().toBuffer()
  } }
}

test('Node export embeds the actual RGBA texture as a decodable PNG', async () => {
  installGlbNodeAdapters()
  const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255])
  const texture = new DataTexture(pixels, 2, 1, RGBAFormat)
  const material = new MeshStandardMaterial({ map: texture })
  const geometry = new BoxGeometry()
  try {
    const buffer = Buffer.from(await (await exportStaticGlb(new Mesh(geometry, material))).arrayBuffer())
    assert.equal(buffer.readUInt32LE(0), 0x46546c67)
    assert.equal(buffer.readUInt32LE(4), 2)
    assert.equal(buffer.readUInt32LE(8), buffer.length)
    const jsonLength = buffer.readUInt32LE(12)
    const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString())
    assert.equal(json.images.length, 1)
    assert.equal(json.materials[0].pbrMetallicRoughness.baseColorTexture.index, 0)
    const view = json.bufferViews[json.images[0].bufferView]
    const start = 20 + jsonLength + 8 + (view.byteOffset ?? 0)
    const decoded = await sharp(buffer.subarray(start, start + view.byteLength)).raw().toBuffer()
    assert.deepEqual(decoded, Buffer.from(pixels))
  } finally {
    texture.dispose(); material.dispose(); geometry.dispose()
  }
})

for (const [name, createModel] of [['bench005', createBench], ['shelf016', createShelf]] as const) {
  test(`exportStaticGlb validates real textured ${name} with tangents and exact PBR pixels`, async () => {
    installGlbNodeAdapters()
    const model = createModel()
    try {
      const originalGeometries = new Map<Mesh, Mesh['geometry']>()
      model.root.traverse((object) => {
        if (object instanceof Mesh) originalGeometries.set(object, object.geometry)
      })
      const buffer = Buffer.from(await (await exportStaticGlb(model.root)).arrayBuffer())
      const { json, pixels } = embeddedImages(buffer)
      for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
        assert.equal(typeof primitive.attributes.TANGENT, 'number')
      }
      for (const [mesh, geometry] of originalGeometries) {
        assert.equal(mesh.geometry, geometry)
        assert.equal(geometry.getAttribute('tangent'), undefined, 'export must not add tangents to the live model')
      }
      assert.equal(json.materials.length, 5)
      for (const exported of json.materials) {
        const material = Object.values(model.materials).find((m) => m.name === exported.name) as MeshStandardMaterial
        assert.ok(material)
        const color = material.map as DataTexture
        const rough = material.roughnessMap as DataTexture
        const normal = material.normalMap as DataTexture
        assert.ok(color && rough && normal)
        assert.deepEqual(await pixels(exported.pbrMetallicRoughness.baseColorTexture.index), Buffer.from(color.image.data as Uint8Array))
        const expectedRough = Buffer.from(rough.image.data as Uint8Array)
        for (let i = 0; i < expectedRough.length; i += 4) {
          expectedRough[i] = 0; expectedRough[i + 2] = 255; expectedRough[i + 3] = 255
        }
        assert.deepEqual(await pixels(exported.pbrMetallicRoughness.metallicRoughnessTexture.index), expectedRough)
        // Explicit tangents preserve the authored OpenGL normal-map channels.
        const expectedNormal = Buffer.from(normal.image.data as Uint8Array)
        assert.deepEqual(await pixels(exported.normalTexture.index), expectedNormal)
      }
    } finally { model.dispose() }
  })
}

test('Node packs distinct metalness B and roughness G, preserving snapshots and canvas flipY', async () => {
  installGlbNodeAdapters()
  const metal = new DataTexture(new Uint8Array([11, 22, 33, 255, 44, 55, 66, 255]), 1, 2, RGBAFormat)
  const rough = new DataTexture(new Uint8Array([77, 88, 99, 255, 111, 122, 133, 255]), 1, 2, RGBAFormat)
  metal.flipY = true
  const material = new MeshStandardMaterial({ metalnessMap: metal, roughnessMap: rough })
  const geometry = new BoxGeometry()
  try {
    const buffer = Buffer.from(await (await exportStaticGlb(new Mesh(geometry, material))).arrayBuffer())
    const { json, pixels } = embeddedImages(buffer)
    assert.deepEqual(await pixels(json.materials[0]!.pbrMetallicRoughness.metallicRoughnessTexture.index), Buffer.from([0, 122, 66, 255, 0, 88, 33, 255]))
    assert.deepEqual(Array.from(metal.image.data as Uint8Array), [11, 22, 33, 255, 44, 55, 66, 255])
  } finally { metal.dispose(); rough.dispose(); material.dispose(); geometry.dispose() }
})
