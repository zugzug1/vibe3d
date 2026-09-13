import { expect, test } from 'bun:test'
import { Box3, Group, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-014 keeps a closed seam, central tuft and corner ties inside the envelope', () => {
  const model = createModel()
  const bounds = new Box3().setFromObject(model.root).getSize(new Vector3())
  expect(bounds.x).toBeCloseTo(0.5, 3); expect(bounds.y).toBeCloseTo(0.1, 3); expect(bounds.z).toBeCloseTo(0.5, 3)
  expect(model.root.getObjectByName('kk-014-zabuton-cushion / closed perimeter seam front')).toBeTruthy()
  expect(model.root.getObjectByName('kk-014-zabuton-cushion / centre tuft button')).toBeTruthy()
  let knots = 0; model.root.traverse((object) => { if (object.name.endsWith('/ corner knot')) knots++ }); expect(knots).toBe(4)
  model.dispose()
})

test('kk-014 rebuild preserves public cushion attachments', () => {
  const model = createModel()
  const attachment = new Group(); model.parts.cushion.add(attachment)
  model.configure({ tufted: false })
  expect(attachment.parent).toBe(model.parts.cushion)
  model.dispose()
})
