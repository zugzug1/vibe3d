import { expect, test } from 'bun:test'
import { Box3, Mesh, Raycaster, Vector3, type MeshStandardMaterial } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-017 pull openings have a recessed floor and a real annular charcoal lip', () => {
  const model = createModel(); model.root.updateMatrixWorld(true)
  try {
    const rims: Mesh[] = []; model.parts.hardware.traverse((o) => { if (o instanceof Mesh && o.name.endsWith('/ charcoal pocket rim')) rims.push(o) })
    expect(rims.length).toBe(2)
    for (const rim of rims) {
      const position = rim.getWorldPosition(new Vector3())
      const hits = new Raycaster(new Vector3(position.x, position.y, 0.4), new Vector3(0, 0, -1)).intersectObject(model.root)
      expect(hits[0]!.object.name).toEndWith('/ recessed pull bottom')
      const front = new Box3().setFromObject(rim).max.z
      expect(front - hits[0]!.point.z).toBeCloseTo(0.011, 5)
      const lip = new Raycaster(new Vector3(position.x + 0.011, position.y, 0.4), new Vector3(0, 0, -1)).intersectObject(model.root)
      expect(lip[0]!.object).toBe(rim)
      expect((rim.material as MeshStandardMaterial).color.getHex()).toBe((model.materials.ink as MeshStandardMaterial).color.getHex())
    }
  } finally { model.dispose() }
})

test('kk-017 slat gaps expose recessed storage; cups are hollow and use restrained slot variants', () => {
  const model = createModel(); model.root.updateMatrixWorld(true)
  try {
    const hits = new Raycaster(new Vector3(-0.295, 1.58, 0.4), new Vector3(0, 0, -1)).intersectObject(model.root)
    expect(hits[0]!.object.name).toEndWith('/ recessed dark back')
    expect(hits[0]!.point.z).toBeLessThan(-0.18)
    const cups: Mesh[] = []; model.parts.shelves.traverse((o) => { if (o instanceof Mesh && o.name.endsWith('/ stocked hollow cup')) cups.push(o) })
    expect(cups.length).toBe(12)
    expect(new Set(cups.map((cup) => (cup.material as MeshStandardMaterial).color.getHex())).size).toBe(3)
    for (const cup of cups) {
      const p = cup.getWorldPosition(new Vector3())
      const floor = new Raycaster(new Vector3(p.x + 0.001, p.y + 0.25, p.z + 0.001), new Vector3(0, -1, 0)).intersectObject(cup)
      expect(floor[0]!.point.y - p.y).toBeCloseTo(0.016, 5)
    }
    model.configure({ shelves: false })
    let stock = 0; model.parts.shelves.traverse((o) => { if (o instanceof Mesh) stock++ })
    expect(stock).toBe(0)
  } finally { model.dispose() }
})
