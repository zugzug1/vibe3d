import { expect, test } from 'bun:test'
import { LatheGeometry, Mesh } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-037 hopper-only shadow opt-out survives rebuilds without changing other casters', () => {
  const model = createModel()
  for (const crankAngle of [-180, 0, 180]) {
    model.configure({ crankAngle }); model.root.updateMatrixWorld(true)
    let exceptions = 0
    model.root.traverse(object => {
      if (!(object instanceof Mesh)) return
      expect(object.receiveShadow).toBe(true)
      if (object.name.endsWith('/ open flared hopper')) {
        exceptions++
        expect(object.castShadow).toBe(false)
        expect(object.userData.cafeCastShadow).toBe(false)
      } else expect(object.castShadow).toBe(true)
    })
    expect(exceptions).toBe(1)
  }
  model.dispose()
})

test('kk-037 hopper meridian has no nonadjacent crossing or overlapping cap segment', () => {
  const model = createModel()
  const mesh = model.root.getObjectByName('kk-037-manual-coffee-grinder / open flared hopper') as Mesh
  const points = (mesh.geometry as LatheGeometry).parameters.points
  const cross = (a: typeof points[number], b: typeof a, c: typeof a) =>
    (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
  const on = (a: typeof points[number], b: typeof a, c: typeof a) =>
    Math.abs(cross(a,b,c)) < 1e-12 && c.x >= Math.min(a.x,b.x)-1e-12 &&
    c.x <= Math.max(a.x,b.x)+1e-12 && c.y >= Math.min(a.y,b.y)-1e-12 && c.y <= Math.max(a.y,b.y)+1e-12
  expect(points[0]!.equals(points.at(-1)!)).toBe(true)
  for (let i=0;i<points.length-1;i++) for (let j=i+2;j<points.length-1;j++) {
    if (i===0 && j===points.length-2) continue
    const a=points[i]!,b=points[i+1]!,c=points[j]!,d=points[j+1]!
    const intersects = (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) ||
      on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)
    expect(intersects).toBe(false)
  }
  model.dispose()
})
