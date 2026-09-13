import { expect, test } from 'bun:test'
import { Box3, Vector3 } from 'three/webgpu'
import { createCafeScene } from './review-scene.ts'

test('café mounts lantern and seats table/cushion on the tatami instead of the floor', async () => {
  const scene = await createCafeScene()
  try {
    scene.root.updateMatrixWorld(true)
    const bounds = (name: string) => {
      const object = scene.root.getObjectByName(name)
      if (!object) throw new Error(`Missing ${name}`)
      return new Box3().setFromObject(object)
    }
    const mat = bounds('kk-009-engawa-lounge-platform / inset-tatami')
    const table = bounds('kk-013-low-tea-table')
    const cushion = bounds('kk-014-zabuton-cushion')
    for (const prop of [table, cushion]) {
      expect(prop.min.y).toBeCloseTo(mat.max.y, 4)
      expect(prop.min.x).toBeGreaterThanOrEqual(mat.min.x)
      expect(prop.max.x).toBeLessThanOrEqual(mat.max.x)
      expect(prop.min.z).toBeGreaterThanOrEqual(mat.min.z)
      expect(prop.max.z).toBeLessThanOrEqual(mat.max.z)
    }
    expect(table.intersectsBox(cushion)).toBe(false)
    const lantern = bounds('kk-007-washi-pendant-lantern')
    expect(lantern.min.y).toBeCloseTo(2.3, 4)
    expect(lantern.getSize(new Vector3()).y).toBeCloseTo(0.5, 4)
  } finally { scene.dispose() }
})
