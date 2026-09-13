import { expect, test } from 'bun:test'
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu'
import { createModel as bench } from './model.ts'
import { createModel as shelf } from '../kk-016-cup-shelving-unit/model.ts'

for (const [id, factory, budget] of [['005', bench, 15000], ['016', shelf, 6000]] as const) {
  test(`kk-${id} closed finite geometry, positive volume, metric envelope and budget`, () => {
    const model = factory()
    let triangles = 0
    model.root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const p = object.geometry.getAttribute('position'); const uv = object.geometry.getAttribute('uv'); const index = object.geometry.index
      const count = index?.count ?? p.count; triangles += count / 3
      const edges = new Map<string, { count: number; balance: number }>()
      let volume = 0
      for (let i = 0; i < count; i += 3) {
        const vertices = [0, 1, 2].map((offset) => new Vector3().fromBufferAttribute(p, index ? index.getX(i + offset) : i + offset))
        const [a, b, c] = vertices as [Vector3, Vector3, Vector3]
        expect(vertices.every((v) => [v.x, v.y, v.z].every(Number.isFinite)), object.name).toBe(true)
        expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq(), object.name).toBeGreaterThan(1e-22)
        volume += a.dot(b.clone().cross(c)) / 6
        const keys = vertices.map((v) => [v.x, v.y, v.z].map((n) => Math.round(n * 1e6)).join(','))
        for (let j = 0; j < 3; j++) {
          const from = keys[j]!; const to = keys[(j + 1) % 3]!
          const key = [from, to].sort().join('|'); const edge = edges.get(key) ?? { count: 0, balance: 0 }
          edge.count++; edge.balance += from < to ? 1 : -1; edges.set(key, edge)
        }
      }
      expect(volume, object.name).toBeGreaterThan(0)
      expect([...edges.values()].every((e) => e.count === 2 && e.balance === 0), object.name).toBe(true)
      expect(Array.from(uv.array).every(Number.isFinite), object.name).toBe(true)
    })
    expect(triangles).toBeLessThanOrEqual(budget)
    console.info(`kk-${id}: ${triangles}/${budget} triangles`)
    const bounds = new Box3().setFromObject(model.root)
    expect(Math.abs(bounds.min.y)).toBeLessThan(0.001)
    model.dispose()
  })

  test(`kk-${id} rebuild keeps attachments, overrides and exactly-once disposal`, () => {
    const material = new MeshStandardMaterial()
    const model = factory({ materials: { cedar: material } })
    const anchor = model.parts.frame; const attachment = new Group(); anchor.add(attachment)
    let externalDisposals = 0; material.addEventListener('dispose', () => externalDisposals++)
    const old = new Map<object, number>()
    model.root.traverse((object) => { if (object instanceof Mesh) {
      const geometry = object.geometry; old.set(geometry, 0)
      geometry.addEventListener('dispose', () => old.set(geometry, old.get(geometry)! + 1))
    } })
    model.configure(model.getConfig()); model.setMaterial('cedarDark', material)
    expect(attachment.parent).toBe(anchor)
    expect([...old.values()].every((n) => n === 1)).toBe(true)
    model.dispose(); model.dispose()
    expect(externalDisposals).toBe(0); material.dispose()
  })
}

test('kk-005 all cushion counts remain seated and within budget; front lattice clears paper', () => {
  const model = bench()
  for (const cushionCount of [2, 3, 4, NaN]) {
    model.configure({ cushionCount })
    let triangles = 0; let cushions = 0
    const paper = model.root.getObjectByName('kk-005-machiya-window-bench / rear paper')!
    const paperBox = new Box3().setFromObject(paper)
    model.root.traverse((object) => { if (object instanceof Mesh) {
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3
      if (object.name.endsWith('/ stuffed seat cushion')) {
        cushions++
        expect(new Box3().setFromObject(object).min.y).toBeCloseTo(0.598, 4)
      }
      if (object.name.endsWith('/ front vertical lattice')) expect(new Box3().setFromObject(object).min.z).toBeGreaterThan(paperBox.max.z)
    } })
    expect(cushions).toBe(model.getConfig().cushionCount)
    expect(triangles).toBeLessThanOrEqual(15000)
  }
  model.dispose()
})
