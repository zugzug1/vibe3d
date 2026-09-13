import { expect, test } from 'bun:test'
import { Box3, Group, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-007 keeps its mount envelope and ribs seated on the paper profile', () => {
  const model = createModel()
  const bounds = new Box3().setFromObject(model.root).getSize(new Vector3())
  expect(bounds.x).toBeCloseTo(0.6, 3); expect(bounds.y).toBeCloseTo(0.5, 3); expect(bounds.z).toBeCloseTo(0.6, 3)
  expect(model.root.getObjectByName('kk-007-washi-pendant-lantern / round ceiling cap')).toBeTruthy()
  expect(model.root.getObjectByName('kk-007-washi-pendant-lantern / bottom retaining ring')).toBeTruthy()
  expect(model.materials.brass.map).toBeNull()
  model.dispose()
})

test('kk-007 rebuild preserves public mount attachments', () => {
  const model = createModel()
  const attachment = new Group(); model.parts.mount.add(attachment)
  model.configure({ ribCount: 14 })
  expect(attachment.parent).toBe(model.parts.mount)
  model.dispose()
})
