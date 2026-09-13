import { expect, test } from 'bun:test'
import { Box3, BufferGeometry, Group, Material, Mesh, MeshStandardMaterial, Raycaster, Texture, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'
import { createModel as createEnclosure } from '../kk-024-ventilated-litter-enclosure/model.ts'

const allMeshes = (root: Group): Mesh[] => { const result: Mesh[] = []; root.traverse(o => { if (o instanceof Mesh) result.push(o) }); return result }
for (const [name, create, patches, size] of [
  ['kk-021', createModel, [{ stepCount: 3, ascending: false }, { stepCount: 5, ascending: true }, { stepCount: 4, ascending: false }], [1.4, 1, 0.3]],
  ['kk-024', createEnclosure, [{ entranceLeft: true, serviceOpen: 1, trayExtension: 0 }, { entranceLeft: false, serviceOpen: 0.5, trayExtension: 0 }, { entranceLeft: false, serviceOpen: 0, trayExtension: 0 }], [0.7, 0.5, 0.5]],
] as const) {
  test(`${name} bounds, finite nondegenerate outward geometry and 6000 triangle budget across configurations`, () => {
    const model = create()
    for (const config of patches) {
      model.configure(config); model.root.updateMatrixWorld(true)
      const bounds = new Box3().setFromObject(model.root); const extent = bounds.getSize(new Vector3())
      expect(bounds.min.y).toBeCloseTo(0, 6)
      expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0, 6)
      extent.toArray().forEach((value, axis) => expect(value).toBeCloseTo(size[axis]!, 5))
      let triangles = 0
      for (const mesh of allMeshes(model.root)) {
        expect(mesh.scale.toArray()).toEqual([1, 1, 1])
        const p = mesh.geometry.getAttribute('position'); const normal = mesh.geometry.getAttribute('normal'); const uv = mesh.geometry.getAttribute('uv'); const idx = mesh.geometry.index
        for (const attribute of [p, normal, uv]) for (const value of attribute.array) expect(Number.isFinite(value)).toBe(true)
        const count = idx?.count ?? p.count; triangles += count / 3; let volume = 0
        for (let i = 0; i < count; i += 3) {
          const a = new Vector3().fromBufferAttribute(p, idx ? idx.getX(i) : i)
          const b = new Vector3().fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1)
          const c = new Vector3().fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2)
          expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-22)
          volume += a.dot(b.clone().cross(c)) / 6
        }
        expect(volume).toBeGreaterThan(0)
      }
      expect(triangles).toBeLessThanOrEqual(6000)
    }
    model.dispose()
  })

  test(`${name} root placement, anchors, override maps and all resource ownership survive rebuilds`, () => {
    const suppliedMap = new Texture(); const supplied = new MeshStandardMaterial({ map: suppliedMap })
    const replacements = new MeshStandardMaterial({ normalMap: suppliedMap })
    const counts = new Map<object, number>()
    const originals = [BufferGeometry.prototype.dispose, Material.prototype.dispose, Texture.prototype.dispose]
    BufferGeometry.prototype.dispose = function () { counts.set(this, (counts.get(this) ?? 0) + 1); originals[0]!.call(this) }
    Material.prototype.dispose = function () { counts.set(this, (counts.get(this) ?? 0) + 1); originals[1]!.call(this) }
    Texture.prototype.dispose = function () { counts.set(this, (counts.get(this) ?? 0) + 1); originals[2]!.call(this) }
    try {
      const model = create({ materials: { cedar: supplied } })
      model.root.position.set(2, 0.7, -1); model.root.rotation.set(0.1, 0.6, 0.2); model.root.scale.set(1.1, 0.8, 1.2)
      model.root.updateMatrixWorld(true); const world = model.root.matrixWorld.clone()
      const anchors = Object.values(model.parts); const children = anchors.map(anchor => { const child = new Group(); anchor.add(child); return child })
      const observed = new Set<object>()
      const collect = (): void => {
        allMeshes(model.root).forEach(mesh => {
          observed.add(mesh.geometry)
          const material = mesh.material as MeshStandardMaterial
          if (material !== supplied && material !== replacements) {
            observed.add(material)
            for (const map of [material.map, material.normalMap, material.roughnessMap]) if (map) observed.add(map)
          }
        })
      }
      collect()
      for (const patch of patches) {
        model.configure(patch); collect(); model.root.updateMatrixWorld(true)
        expect(model.root.matrixWorld.equals(world)).toBe(true)
        anchors.forEach((anchor, index) => expect(children[index]!.parent).toBe(anchor))
        expect(supplied.map).toBe(suppliedMap)
      }
      model.setMaterial('cedar', replacements)
      model.configure(patches[0]); collect()
      for (const mesh of allMeshes(model.root).filter(mesh => mesh.userData.materialSlot === 'cedar')) expect(mesh.material).toBe(replacements)
      model.dispose(); model.dispose()
      observed.forEach(resource => expect(counts.get(resource)).toBe(1))
      for (const resource of [supplied, suppliedMap, replacements]) expect(counts.has(resource)).toBe(false)
      const before = model.getConfig(); model.configure(patches[2]); expect(model.getConfig()).toEqual(before)
      for (const count of counts.values()) expect(count).toBe(1)
    } finally {
      BufferGeometry.prototype.dispose = originals[0]!
      Material.prototype.dispose = originals[1]!
      Texture.prototype.dispose = originals[2]!
      supplied.dispose(); suppliedMap.dispose(); replacements.dispose()
    }
  })
}

test('kk-021 every pad, corbel and plug is seated, with open negative space below the brackets', () => {
  const model = createModel()
  const identities = [...model.landings]
  for (const stepCount of [3, 4, 5]) for (const ascending of [false, true]) {
    model.configure({ stepCount, ascending }); model.root.updateMatrixWorld(true)
    const list = allMeshes(model.root); const bounds = (mesh: Mesh) => new Box3().setFromObject(mesh)
    for (let i = 0; i < stepCount; i++) {
      const named = (suffix: string) => list.filter(mesh => mesh.name.endsWith(`step ${i} ${suffix}`))
      const platform = named('platform')[0]!; const pb = bounds(platform)
      expect(bounds(named('moss pad')[0]!).intersectsBox(pb)).toBe(true)
      const corbels = named('carved corbel'); const mounts = named('mounting board')
      for (let j = 0; j < 2; j++) {
        const corbel = corbels[j]!
        expect(bounds(corbel).intersectsBox(pb)).toBe(true)
        expect(bounds(corbel).intersectsBox(bounds(mounts[j]!))).toBe(true)
        const ray = new Raycaster(new Vector3(corbel.position.x + 0.08, pb.max.y - 0.15, 0.10), new Vector3(-1, 0, 0))
        expect(ray.intersectObject(corbel)).toHaveLength(0)
        ray.set(new Vector3(corbel.position.x + 0.08, pb.max.y - 0.15, -0.1), new Vector3(-1, 0, 0))
        expect(ray.intersectObject(corbel).length).toBeGreaterThan(0)
      }
      for (const peg of named('fixing plug')) expect(mounts.some(mount => bounds(mount).intersectsBox(bounds(peg)))).toBe(true)
      const ray = new Raycaster(model.landings[i]!.position.clone().add(new Vector3(0, 0.1, 0)), new Vector3(0, -1, 0))
      expect(ray.intersectObject(named('moss pad')[0]!)[0]!.distance).toBeCloseTo(0.1, 5)
      expect(model.landings[i]).toBe(identities[i])
    }
    expect(model.landings.filter(anchor => anchor.userData.active).length).toBe(stepCount)
  }
  const before = model.getConfig(); const mesh = allMeshes(model.root)[0]
  expect(() => model.configure({ ascending: true, stepCount: NaN })).toThrow()
  expect(model.getConfig()).toEqual(before); expect(allMeshes(model.root)[0]).toBe(mesh)
  expect(() => createModel({ stepCount: Infinity })).toThrow()
  model.dispose()
})
