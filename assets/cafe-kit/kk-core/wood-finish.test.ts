import { describe, expect, test } from 'bun:test'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three/webgpu'
import { acquireKkMaterials, disposeKkMaterials, setCafeWoodFinish } from './materials.ts'
import { KIT_ROOT, listModelIds } from './catalog.ts'

test('finish applies across the discovered collection without replacing geometry or textures', async () => {
  for (const id of await listModelIds()) {
    const { createModel } = await import(`${KIT_ROOT}/${id}/model.ts`)
    const model = createModel()
    const geometryIds: string[] = []
    const maps: unknown[] = []
    const capture = () => {
      geometryIds.length = 0; maps.length = 0
      model.root.traverse((object: Mesh) => {
        if (!object.isMesh) return
        geometryIds.push(object.geometry.uuid)
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          maps.push((material as MeshStandardMaterial).map)
        }
      })
    }
    capture(); const beforeGeometry = [...geometryIds]; const beforeMaps = [...maps]
    const original = new Map<MeshStandardMaterial, { color: string; roughness: number }>()
    model.root.traverse((object: Mesh) => {
      if (!object.isMesh) return
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof MeshStandardMaterial) original.set(material, {
          color: material.color.getHexString(), roughness: material.roughness,
        })
      }
    })
    setCafeWoodFinish(model.root, { tint: '#788468', roughness: 0.65 })
    capture()
    expect(geometryIds).toEqual(beforeGeometry)
    expect(maps).toEqual(beforeMaps)
    setCafeWoodFinish(model.root, { tint: null, roughness: null })
    for (const [material, defaults] of original) {
      expect(material.color.getHexString()).toBe(defaults.color)
      expect(material.roughness).toBe(defaults.roughness)
    }
    model.dispose()
  }
})

describe('owned wood finish', () => {
  test('preserves defaults, texture identity, dark contrast and instance isolation', () => {
    const a = acquireKkMaterials(); const b = acquireKkMaterials()
    const geometry = new BoxGeometry(); const map = new Texture()
    a.materials.cedar.map = map
    const root = new Group()
    root.add(new Mesh(geometry, [a.materials.cedar, a.materials.cedarDark, a.materials.glaze]))
    const light = a.materials.cedar.color.clone(); const dark = a.materials.cedarDark.color.clone()
    const glaze = a.materials.glaze.color.clone()
    expect(setCafeWoodFinish(root, {})).toBe(2)
    expect(a.materials.cedar.color.equals(light)).toBe(true)
    setCafeWoodFinish(root, { tint: '#667c9c', roughness: 0.6 })
    expect(a.materials.cedar.color.getHexString()).toBe('667c9c')
    expect(a.materials.cedarDark.color.r / a.materials.cedar.color.r).toBeCloseTo(dark.r / light.r)
    expect(a.materials.cedar.map).toBe(map)
    expect(a.materials.glaze.color.equals(glaze)).toBe(true)
    expect(b.materials.cedar.color.equals(light)).toBe(true)
    setCafeWoodFinish(root, { tint: null, roughness: null })
    expect(a.materials.cedar.color.equals(light)).toBe(true)
    expect(a.materials.cedarDark.color.equals(dark)).toBe(true)
    expect(a.materials.cedarDark.roughness).toBe(0.82)
    disposeKkMaterials(a); disposeKkMaterials(b); geometry.dispose(); map.dispose()
  })

  test('consumer overrides remain untouched, including spoofed material names', () => {
    const override = new MeshStandardMaterial({ name: 'cafe-kit / cedar', color: '#ffffff' })
    const bundle = acquireKkMaterials({ overrides: { cedar: override } })
    const geometry = new BoxGeometry(); const mesh = new Mesh(geometry, override)
    expect(setCafeWoodFinish(mesh, { tint: '#123456' })).toBe(0)
    expect(override.color.getHexString()).toBe('ffffff')
    disposeKkMaterials(bundle); override.dispose(); geometry.dispose()
  })

  test('rejects invalid patches before any mutation', () => {
    const bundle = acquireKkMaterials(); const geometry = new BoxGeometry()
    const mesh = new Mesh(geometry, bundle.materials.cedar)
    const before = bundle.materials.cedar.color.clone()
    for (const roughness of [NaN, Infinity, -1, 1]) {
      expect(() => setCafeWoodFinish(mesh, { tint: '#123456', roughness })).toThrow()
      expect(bundle.materials.cedar.color.equals(before)).toBe(true)
    }
    expect(() => setCafeWoodFinish(mesh, { tint: 'red', roughness: 0.6 })).toThrow()
    expect(bundle.materials.cedar.roughness).toBe(0.78)
    disposeKkMaterials(bundle); geometry.dispose()
  })
})
