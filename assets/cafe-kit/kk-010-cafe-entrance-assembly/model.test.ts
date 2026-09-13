import { expect, test } from 'bun:test'
import { Box3, Group, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-010 keeps the original envelope and seated roof support', () => {
  const model = createModel()
  const bounds = new Box3().setFromObject(model.root).getSize(new Vector3())
  expect(bounds.x).toBeCloseTo(1.4, 3); expect(bounds.y).toBeCloseTo(2.2, 3); expect(bounds.z).toBeCloseTo(0.3, 3)
  const support = new Box3().setFromObject(model.root.getObjectByName('kk-010-cafe-entrance-assembly / continuous roof support')!)
  const eave = new Box3().setFromObject(model.root.getObjectByName('kk-010-cafe-entrance-assembly / roof eave')!)
  expect(support.max.y).toBeGreaterThanOrEqual(eave.min.y)
  expect(model.root.getObjectByName('kk-010-cafe-entrance-assembly / small cat emblem')).toBeTruthy()
  expect(model.materials.brass.map).toBeNull()
  model.dispose()
})

test('kk-010 rebuild preserves public frame attachments', () => {
  const model = createModel()
  const attachment = new Group(); model.parts.frame.add(attachment)
  model.configure({ emblem: false })
  expect(attachment.parent).toBe(model.parts.frame)
  model.dispose()
})
