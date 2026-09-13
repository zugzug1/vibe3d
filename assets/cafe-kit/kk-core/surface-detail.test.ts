import { expect, test } from 'bun:test'
import { DataTexture, MeshStandardMaterial, NoColorSpace, SRGBColorSpace } from 'three/webgpu'
import { acquireSurfaceMaterials, createSurfaceMaps, type SurfaceDetail } from './surface-detail.ts'

test('portable surface maps are deterministic, distinct color/roughness/normal data', () => {
  for (const kind of ['cedar', 'fabric', 'paper', 'glaze'] as SurfaceDetail[]) {
    const a = createSurfaceMaps(kind); const b = createSurfaceMaps(kind)
    expect(a.map.colorSpace).toBe(SRGBColorSpace)
    expect(a.normalMap.colorSpace).toBe(NoColorSpace)
    expect(a.roughnessMap.colorSpace).toBe(NoColorSpace)
    expect(a.map.source).not.toBe(a.normalMap.source)
    for (const key of ['map', 'roughnessMap', 'normalMap'] as const) {
      expect(a[key].image.width).toBe(128)
      expect(a[key].image.data).toEqual(b[key].image.data)
      expect(new Set(a[key].image.data).size).toBeGreaterThan(2)
      a[key].dispose(); b[key].dispose()
    }
  }
})

test('surface ownership preserves overrides, shares maps only within one instance, disposes once', () => {
  const supplied = new MeshStandardMaterial({ map: new DataTexture(new Uint8Array(4), 1, 1) })
  let consumerDisposals = 0
  supplied.addEventListener('dispose', () => consumerDisposals++)
  supplied.map!.addEventListener('dispose', () => consumerDisposals++)
  const a = acquireSurfaceMaterials({ cedar: 'cedar', cedarDark: 'cedar', washi: 'paper' }, { washi: supplied })
  const b = acquireSurfaceMaterials({ cedar: 'cedar' })
  const cedar = a.materials.cedar as MeshStandardMaterial
  const dark = a.materials.cedarDark as MeshStandardMaterial
  expect(a.materials.washi).toBe(supplied)
  expect(supplied.normalMap).toBeNull()
  expect(cedar.map).toBe(dark.map)
  expect(cedar.map).not.toBe((b.materials.cedar as MeshStandardMaterial).map)
  const owned = [cedar, dark, cedar.map!, cedar.normalMap!, cedar.roughnessMap!]
  const counts = owned.map(() => 0)
  owned.forEach((resource, i) => resource.addEventListener('dispose', () => counts[i]++))
  a.dispose(); a.dispose()
  expect(counts).toEqual([1, 1, 1, 1, 1]); expect(consumerDisposals).toBe(0)
  b.dispose(); supplied.map!.dispose(); supplied.dispose()
})
