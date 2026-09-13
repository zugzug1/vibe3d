import { expect, test } from 'bun:test'
import { Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

test('kk-002 rebuilt surfaces are closed, finite and outward wound within 15000 triangles', () => {
  const model = createModel()
  let triangles = 0
  try {
    model.root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const geometry = object.geometry
      const p = geometry.getAttribute('position')
      const index = geometry.index
      const count = index?.count ?? p.count
      triangles += count / 3
      const edges = new Map<string, { count: number; balance: number }>()
      let volume = 0
      for (let i = 0; i < count; i += 3) {
        const vertices = [0, 1, 2].map((offset) => new Vector3().fromBufferAttribute(p, index ? index.getX(i + offset) : i + offset))
        expect(vertices.every((v) => [v.x, v.y, v.z].every(Number.isFinite))).toBe(true)
        const [a, b, c] = vertices as [Vector3, Vector3, Vector3]
        expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-20)
        volume += a.dot(b.clone().cross(c)) / 6
        const keys = vertices.map((v) => [v.x, v.y, v.z].map((n) => Math.round(n * 1e7)).join(','))
        for (let j = 0; j < 3; j++) {
          const from = keys[j]!; const to = keys[(j + 1) % 3]!
          const key = [from, to].sort().join('|')
          const edge = edges.get(key) ?? { count: 0, balance: 0 }
          edge.count++; edge.balance += from < to ? 1 : -1; edges.set(key, edge)
        }
      }
      expect(volume, object.name).toBeGreaterThan(0)
      expect([...edges.values()].every((e) => e.count === 2 && e.balance === 0), object.name).toBe(true)
    })
    expect(triangles).toBeLessThanOrEqual(15000)
  } finally { model.dispose() }
})

test('kk-002 coherent ceramic retains slot overrides after rebuilding and never disposes consumer materials', () => {
  const ceramic = new MeshStandardMaterial(); const moss = new MeshStandardMaterial()
  let disposed = 0
  ceramic.addEventListener('dispose', () => disposed++)
  moss.addEventListener('dispose', () => disposed++)
  const model = createModel({ materials: { ceramic } })
  const root = model.root; const bowl = model.parts.bowl
  try {
    model.setMaterial('moss', moss)
    for (const cradle of [false, true]) for (const caddies of [false, true]) {
      model.configure({ cradle, caddies })
      expect(model.root).toBe(root); expect(model.parts.bowl).toBe(bowl)
      const shell = model.parts.bowl.children.find((o) => o.name.endsWith(' / matcha-bowl')) as Mesh
      expect(shell.material).toBe(ceramic)
      expect(shell.geometry.groups.length).toBe(0)
      for (const child of model.parts.caddies.children) expect((child as Mesh).material).toBe(ceramic)
      const tea = model.parts.bowl.children.find((o) => o.name.endsWith(' / matcha-surface')) as Mesh
      expect(tea.material).toBe(moss)
      expect(model.parts.cradle.children.length > 0).toBe(cradle)
      expect(model.parts.caddies.children.length > 0).toBe(caddies)
    }
    model.dispose(); model.dispose()
    expect(disposed).toBe(0)
  } finally { model.dispose(); ceramic.dispose(); moss.dispose() }
})
