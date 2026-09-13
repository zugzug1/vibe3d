import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { BoxGeometry, DataTexture, Mesh, MeshStandardMaterial, RGBAFormat } from 'three/webgpu'
import { exportStaticGlb } from '../src/asset-forge/generator/glb.ts'
import { installGlbNodeAdapters } from './glb-node-adapter.ts'

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
