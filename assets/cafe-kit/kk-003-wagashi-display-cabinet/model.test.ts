import { expect, test } from 'bun:test'
import { Box3, DataTexture, Group, Mesh, MeshStandardMaterial, Vector3, type Material } from 'three/webgpu'
import { createModel as cabinet } from './model.ts'
import { createModel as pantry } from '../kk-017-sliding-door-pantry/model.ts'

for (const [id, factory, size, budget, toggle] of [
  ['003', cabinet, [1.2, 1.1, 0.5], 15000, 'trays'],
  ['017', pantry, [0.85, 1.8, 0.45], 6000, 'shelves'],
] as const) {
  test(`kk-${id} geometry is finite, nondegenerate and closed except single glass panes`, () => {
    const model = factory()
    try {
      let triangles = 0
      model.root.traverse((object) => {
        if (!(object instanceof Mesh)) return
        const geometry = object.geometry; const p = geometry.getAttribute('position'); const uv = geometry.getAttribute('uv'); const index = geometry.index
        const count = index?.count ?? p.count; triangles += count / 3
        const edges = new Map<string, { count: number; balance: number }>(); let volume = 0
        for (let i = 0; i < count; i += 3) {
          const vertices = [0, 1, 2].map((offset) => new Vector3().fromBufferAttribute(p, index ? index.getX(i + offset) : i + offset))
          const [a, b, c] = vertices as [Vector3, Vector3, Vector3]
          expect(vertices.every((v) => [v.x, v.y, v.z].every(Number.isFinite)), object.name).toBe(true)
          expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq(), object.name).toBeGreaterThan(1e-22)
          volume += a.dot(b.clone().cross(c)) / 6
          const keys = vertices.map((v) => [v.x, v.y, v.z].map((n) => Math.round(n * 1e6)).join(','))
          for (let j = 0; j < 3; j++) {
            const from = keys[j]!; const to = keys[(j + 1) % 3]!; const key = [from, to].sort().join('|')
            const edge = edges.get(key) ?? { count: 0, balance: 0 }; edge.count++; edge.balance += from < to ? 1 : -1; edges.set(key, edge)
          }
        }
        expect(Array.from(uv.array).every(Number.isFinite), object.name).toBe(true)
        if (object.userData.materialSlot === 'glass') {
          expect(count).toBe(6) // Exactly one quad, not stacked transparent shells.
        } else {
          expect(volume, object.name).toBeGreaterThan(0)
          expect([...edges.values()].every((e) => e.count === 2 && e.balance === 0), object.name).toBe(true)
        }
      })
      console.info(`kk-${id}: ${triangles}/${budget} triangles`)
      expect(triangles).toBeLessThanOrEqual(budget)
    } finally { model.dispose() }
  })

  test(`kk-${id} every configuration retains exact dimensions, anchors and attachments`, () => {
    const model = factory(); const root = model.root; const anchors = Object.values(model.parts)
    const attachments = anchors.map((anchor) => { const child = new Group(); anchor.add(child); return child })
    try {
      for (const doors of [true, false]) for (const enabled of [true, false]) {
        model.configure({ doors, [toggle]: enabled })
        expect(model.getConfig()).toEqual({ doors, [toggle]: enabled })
        expect(model.root).toBe(root)
        expect(model.root.position.toArray()).toEqual([0, 0, 0])
        anchors.forEach((anchor, i) => expect(attachments[i]!.parent).toBe(anchor))
        const bounds = new Box3().setFromObject(root)
        const dimensions = bounds.getSize(new Vector3()).toArray()
        dimensions.forEach((actual, axis) => expect(Math.abs(actual - size[axis]!)).toBeLessThan(1e-6))
        expect(Math.abs(bounds.min.y)).toBeLessThan(1e-6)
        expect(Math.abs(bounds.getCenter(new Vector3()).x)).toBeLessThan(1e-6)
        expect(Math.abs(bounds.getCenter(new Vector3()).z)).toBeLessThan(1e-6)
        let triangles = 0
        root.traverse((o) => { if (o instanceof Mesh) triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3 })
        expect(triangles).toBeLessThanOrEqual(budget)
        let doorMeshes = 0
        model.parts.doors.traverse((o) => { if (o instanceof Mesh) doorMeshes++ })
        expect(doorMeshes > 0).toBe(doors)
      }
    } finally { model.dispose() }
  })

  test(`kk-${id} all slot overrides survive rebuild and owned resources dispose exactly once`, () => {
    const model = factory()
    const resources = new Set<{ dispose(): void; addEventListener: Function }>()
    model.root.traverse((o) => {
      if (!(o instanceof Mesh)) return
      resources.add(o.geometry)
      const m = o.material as MeshStandardMaterial; resources.add(m)
      for (const texture of [m.map, m.normalMap, m.roughnessMap]) if (texture) resources.add(texture)
    })
    const counts = new Map<object, number>()
    for (const resource of resources) { counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1)) }
    const consumerTexture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    const consumer = new MeshStandardMaterial({ map: consumerTexture }); let externalDisposals = 0
    consumer.addEventListener('dispose', () => externalDisposals++); consumerTexture.addEventListener('dispose', () => externalDisposals++)
    try {
      const set = model.setMaterial as (slot: string, material: Material) => void
      for (const slot of Object.keys(model.materials)) set(slot, consumer)
      model.configure(model.getConfig())
      model.root.traverse((o) => { if (o instanceof Mesh) expect(o.material).toBe(consumer) })
      model.dispose(); model.dispose()
      expect([...counts.values()].every((n) => n === 1)).toBe(true)
      expect(externalDisposals).toBe(0)
      // Constructor aliases (ceramic/moss/trayCharcoal) must also preserve borrowed materials.
      const options = Object.fromEntries(Object.keys(model.materials).map((slot) => [slot, consumer]))
      const overridden = factory({ materials: options })
      overridden.root.traverse((o) => { if (o instanceof Mesh) expect(o.material).toBe(consumer) })
      overridden.dispose(); expect(externalDisposals).toBe(0)
    } finally { model.dispose(); consumerTexture.dispose(); consumer.dispose() }
  })
}

test('kk-003 has nine seated trays, 36 sweets and unoccluded top-tier headroom', () => {
  const model = cabinet()
  try {
    const meshes: Mesh[] = []; model.root.traverse((o) => { if (o instanceof Mesh) meshes.push(o) })
    const trays = meshes.filter((o) => o.name.endsWith('/ tray floor'))
    const sweets = meshes.filter((o) => /\/ (rounded wagashi|cut yokan sweet)$/.test(o.name))
    expect(trays.length).toBe(9); expect(sweets.length).toBe(36)
    for (const sweet of sweets) {
      const bounds = new Box3().setFromObject(sweet)
      const support = trays.find((tray) => {
        const t = new Box3().setFromObject(tray)
        return Math.abs(t.max.y - bounds.min.y) < 1e-6 && bounds.min.x >= t.min.x && bounds.max.x <= t.max.x && bounds.min.z >= t.min.z && bounds.max.z <= t.max.z
      })
      expect(support, sweet.name).toBeDefined()
      expect(bounds.max.y).toBeLessThan(1.01)
    }
    model.configure({ trays: false })
    let dressing = 0; model.parts.dressing.traverse((o) => { if (o instanceof Mesh) dressing++ })
    expect(dressing).toBe(0)
  } finally { model.dispose() }
})
