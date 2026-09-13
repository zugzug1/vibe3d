import { expect, test } from 'bun:test'
import { Box3, Group, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-018 seats the hollow bowl, connects tap hardware and wraps towel over bar', () => {
  const model = createModel()
  const bounds = new Box3().setFromObject(model.root).getSize(new Vector3())
  expect(bounds.x).toBeCloseTo(0.65, 3); expect(bounds.y).toBeCloseTo(0.9, 3); expect(bounds.z).toBeCloseTo(0.45, 3)
  const standTop = new Box3().setFromObject(model.root.getObjectByName('kk-018-handwashing-basin / cedar basin top')!)
  const bowl = new Box3().setFromObject(model.root.getObjectByName('kk-018-handwashing-basin / hollow ceramic basin')!)
  const upright = new Box3().setFromObject(model.root.getObjectByName('kk-018-handwashing-basin / tap upright')!)
  const cap = new Box3().setFromObject(model.root.getObjectByName('kk-018-handwashing-basin / tap cap')!)
  const spout = new Box3().setFromObject(model.root.getObjectByName('kk-018-handwashing-basin / curved tap spout')!)
  expect(bowl.min.y).toBeCloseTo(standTop.max.y, 4)
  expect(cap.min.y).toBeLessThanOrEqual(upright.max.y)
  expect(spout.max.y).toBeGreaterThan(bowl.max.y)
  expect(model.root.getObjectByName('kk-018-handwashing-basin / dark basin drain')).toBeTruthy()
  expect(model.root.getObjectByName('kk-018-handwashing-basin / dark basin rim')).toBeTruthy()
  expect(model.materials.brass.map).toBeNull()
  model.dispose()
})

test('kk-018 rebuild preserves public bowl attachments', () => {
  const model = createModel()
  const attachment = new Group(); model.parts.bowl.add(attachment)
  model.configure({ towelBar: false })
  expect(attachment.parent).toBe(model.parts.bowl)
  model.dispose()
})
