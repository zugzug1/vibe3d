import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, DataTexture, Mesh, MeshStandardMaterial, RGBAFormat, SRGBColorSpace } from 'three/webgpu'
import { exportStaticGlb } from '../src/asset-forge/generator/glb.ts'
import { installGlbNodeAdapters } from './glb-node-adapter.ts'
import { reimportCafeGlb } from './cafe-glb-preview.ts'

test('exported geometry and actual embedded texture pixels survive Three reimport', async () => {
  installGlbNodeAdapters()
  const pixels = new Uint8Array([255, 30, 20, 255, 10, 200, 40, 255])
  const texture = new DataTexture(pixels, 2, 1, RGBAFormat)
  texture.colorSpace = SRGBColorSpace
  const material = new MeshStandardMaterial({ map: texture })
  const geometry = new BoxGeometry(1, 2, 3)
  try {
    const blob = await exportStaticGlb(new Mesh(geometry, material))
    const imported = await reimportCafeGlb(new Uint8Array(await blob.arrayBuffer()))
    try {
      let meshes = 0
      imported.root.traverse(object => {
        if (!(object instanceof Mesh)) return
        meshes++
        const map = (object.material as MeshStandardMaterial).map as DataTexture
        assert.ok(map?.isDataTexture)
        assert.ok(map.image.data)
        assert.deepEqual(new Uint8Array(map.image.data), pixels)
        assert.equal(map.colorSpace, SRGBColorSpace)
        object.geometry.computeBoundingBox()
        assert.equal(object.geometry.boundingBox!.max.y, 1)
      })
      assert.equal(meshes, 1)
      assert.equal(imported.textureCount, 1)
    } finally { imported.dispose(); imported.dispose() }
  } finally { geometry.dispose(); material.dispose(); texture.dispose() }
})

test('malformed GLB fails instead of creating a blank preview', async () => {
  await assert.rejects(reimportCafeGlb(new Uint8Array([0, 1, 2, 3])))
})
