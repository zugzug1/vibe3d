import { expect, test } from 'bun:test'
import { Box3, Vector3 } from 'three/webgpu'
import { createCafeScene } from './review-scene.ts'

test('storytelling props sit on their assigned table surfaces', async () => {
  const scene = await createCafeScene()
  try {
    scene.root.updateMatrixWorld(true)
    const supports: Array<[string, number[]]> = [
      ['kk-011-cafe-table', [33, 34, 35]],
      ['kk-013-low-tea-table', [31, 32, 45]],
      ['cafe-scene / service-support', [39, 40]],
      ['cafe-scene / adoption-desk', [41, 42, 43, 48]],
      ['cafe-scene / care-support', [47, 50]],
    ]
    for (const [supportName, numbers] of supports) {
      const support = scene.root.getObjectByName(supportName)
      expect(support).toBeDefined()
      const surface = new Box3().setFromObject(support!)
      for (const n of numbers) {
        const id = scene.ids.find(id => Number(id.slice(3, 6)) === n)
        if (!id) continue // Partial production scenes remain usable; inventory enforces all 50.
        const object = scene.root.getObjectByName(id)
        expect(object).toBeDefined()
        const prop = new Box3().setFromObject(object!)
        expect(prop.min.y, id).toBeCloseTo(surface.max.y, 3)
        expect(prop.min.x).toBeGreaterThanOrEqual(surface.min.x - 0.001)
        expect(prop.max.x).toBeLessThanOrEqual(surface.max.x + 0.001)
        expect(prop.min.z).toBeGreaterThanOrEqual(surface.min.z - 0.001)
        expect(prop.max.z).toBeLessThanOrEqual(surface.max.z + 0.001)
      }
    }
  } finally { scene.dispose() }
})

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
    const matcha = bounds('kk-002-matcha-station')
    const support = bounds('cafe-scene / matcha-support')
    expect(matcha.min.y).toBeCloseTo(support.max.y, 4)
    expect(matcha.min.x).toBeGreaterThanOrEqual(support.min.x)
    expect(matcha.max.x).toBeLessThanOrEqual(support.max.x)
    expect(matcha.min.z).toBeGreaterThanOrEqual(support.min.z)
    expect(matcha.max.z).toBeLessThanOrEqual(support.max.z)
    const shelf = bounds('kk-016-cup-shelving-unit')
    expect(shelf.min.y).toBeGreaterThan(bounds('kk-001-espresso-station').max.y)
    expect(shelf.min.z).toBeCloseTo(-4, 3)
    const walkway = bounds('kk-021-wall-cat-walkway')
    expect(walkway.min.z).toBeCloseTo(-4, 3)
    expect(scene.root.userData.modelCount).toBe(scene.ids.length)
  } finally { scene.dispose() }
})
