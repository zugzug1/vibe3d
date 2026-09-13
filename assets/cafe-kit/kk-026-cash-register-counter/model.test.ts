import { expect, test } from 'bun:test'
import { Box3, BufferGeometry, Group, Material, Mesh, MeshStandardMaterial, Raycaster, Texture, Vector3 } from 'three/webgpu'
import * as register from './model.ts'
import * as coat from '../kk-028-coat-and-bag-stand/model.ts'
import * as menu from '../kk-030-exterior-menu-stand/model.ts'
import { setCafeWoodFinish } from '../kk-core/materials.ts'
const meshes = (root: Group): Mesh[] => { const list: Mesh[] = []; root.traverse(o => { if (o instanceof Mesh) list.push(o) }); return list }

for (const [id, module, dimensions] of [
  ['kk-026', register, [0.6, 1.05, 0.5]], ['kk-028', coat, [0.5, 1.6, 0.5]], ['kk-030', menu, [0.55, 1, 0.5]],
] as const) {
  test(`${id} default datum and all structural corners: finite, outward, nondegenerate, under 6000 triangles`, () => {
    const model = module.createModel(); model.root.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model.root)
    bounds.getSize(new Vector3()).toArray().forEach((size, axis) => expect(size).toBeCloseTo(dimensions[axis]!, 5))
    expect(bounds.min.y).toBeCloseTo(0, 6)
    const controls = Object.entries(module.structureControls)
    for (let corner = 0; corner < 2 ** controls.length; corner++) {
      const patch = Object.fromEntries(controls.map(([key, value], i) => [key, value[corner & (1 << i) ? 'max' : 'min']]))
      model.configure(patch); model.root.updateMatrixWorld(true)
      expect(model.getConfig()).toMatchObject(patch)
      expect(new Box3().setFromObject(model.root).min.y).toBeCloseTo(0, 6)
      expect(model.root.scale.toArray()).toEqual([1, 1, 1])
      let triangles = 0
      for (const mesh of meshes(model.root)) {
        expect(mesh.scale.toArray()).toEqual([1, 1, 1])
        const geometry = mesh.geometry; const p = geometry.getAttribute('position'); const idx = geometry.index
        for (const name of ['position', 'normal', 'uv']) for (const value of geometry.getAttribute(name).array) expect(Number.isFinite(value)).toBe(true)
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

  test(`${id} atomic finite validation and clamped dimensions`, () => {
    const model = module.createModel(); const before = model.getConfig(); const first = meshes(model.root)[0]
    const controls = Object.entries(module.structureControls)
    for (const [key] of controls) for (const invalid of [NaN, Infinity, -Infinity]) {
      const patch = { [controls[0]![0]]: controls[0]![1].min, [key]: invalid }
      expect(() => model.configure(patch)).toThrow(); expect(() => module.createModel(patch)).toThrow()
      expect(model.getConfig()).toEqual(before); expect(meshes(model.root)[0]).toBe(first)
    }
    const minimums = Object.fromEntries(controls.map(([key]) => [key, -999]))
    model.configure(minimums)
    for (const [key, control] of controls) expect((model.getConfig() as Record<string, number>)[key]).toBe(control.min)
    model.configure(Object.fromEntries(controls.map(([key]) => [key, undefined])))
    for (const [key, control] of controls) expect((model.getConfig() as Record<string, number>)[key]).toBe(control.min)
    model.dispose()
  })

  test(`${id} stable roots and attachments, owned cedar finish, overrides and exactly-once disposal`, () => {
    const texture = new Texture(); const supplied = new MeshStandardMaterial({ map: texture }); const replacement = new MeshStandardMaterial({ normalMap: texture })
    const counts = new Map<object, number>()
    const geoDispose = BufferGeometry.prototype.dispose; const matDispose = Material.prototype.dispose; const texDispose = Texture.prototype.dispose
    BufferGeometry.prototype.dispose = function () { counts.set(this, (counts.get(this) ?? 0) + 1); geoDispose.call(this) }
    Material.prototype.dispose = function () { counts.set(this, (counts.get(this) ?? 0) + 1); matDispose.call(this) }
    Texture.prototype.dispose = function () { counts.set(this, (counts.get(this) ?? 0) + 1); texDispose.call(this) }
    try {
      const model = module.createModel({ materials: { cedar: supplied } }); const root = model.root
      root.position.set(1, 2, -3); root.rotation.set(0.1, 0.4, 0.2); root.scale.set(1.2, 0.9, 1.1); root.updateMatrixWorld(true)
      const world = root.matrixWorld.clone(); const anchors = Object.values(model.parts)
      const attachments = anchors.map(anchor => { const child = new Group(); anchor.add(child); return child })
      const observed = new Set<object>()
      const collect = (): void => { for (const mesh of meshes(root)) {
        observed.add(mesh.geometry); const mat = mesh.material as MeshStandardMaterial
        if (mat !== supplied && mat !== replacement) { observed.add(mat); for (const map of [mat.map, mat.roughnessMap, mat.normalMap]) if (map) observed.add(map) }
      } }
      collect()
      const color = supplied.color.clone(); const dark = model.materials.cedarDark as MeshStandardMaterial
      const darkColor = dark.color.clone(); const darkMap = dark.map
      expect(setCafeWoodFinish(root, { tint: '#b4754d', roughness: 0.62 })).toBeGreaterThan(0)
      expect(supplied.color.equals(color)).toBe(true); expect(supplied.map).toBe(texture)
      expect(dark.color.equals(darkColor)).toBe(false); expect(dark.map).toBe(darkMap)
      for (const variant of ['min', 'max', 'default'] as const) {
        model.configure(Object.fromEntries(Object.entries(module.structureControls).map(([key, value]) => [key, value[variant]])))
        collect(); root.updateMatrixWorld(true); expect(root.matrixWorld.equals(world)).toBe(true)
        anchors.forEach((anchor, i) => expect(attachments[i]!.parent).toBe(anchor))
        expect(dark.roughness).toBe(0.62)
      }
      model.setMaterial('cedar', replacement); model.configure({}); collect()
      for (const mesh of meshes(root).filter(mesh => mesh.userData.materialSlot === 'cedar')) expect(mesh.material).toBe(replacement)
      model.dispose(); model.dispose()
      for (const object of observed) expect(counts.get(object)).toBe(1)
      for (const object of [supplied, replacement, texture]) expect(counts.has(object)).toBe(false)
      for (const count of counts.values()) expect(count).toBe(1)
      const stopped = model.getConfig(); model.configure(Object.fromEntries(Object.entries(module.structureControls).map(([key, value]) => [key, value.max]))); expect(model.getConfig()).toEqual(stopped)
    } finally {
      BufferGeometry.prototype.dispose = geoDispose; Material.prototype.dispose = matDispose; Texture.prototype.dispose = texDispose
      supplied.dispose(); replacement.dispose(); texture.dispose()
    }
  })
}

test('kk-026 keys enter the sloped deck, register seats on counter, and storage stays open', () => {
  const model = register.createModel(); const ray = new Raycaster()
  for (const counterHeight of [0.60, 0.68, 0.78]) {
    model.configure({ counterHeight }); model.root.updateMatrixWorld(true)
    const list = meshes(model.root); const named = (name: string) => list.find(mesh => mesh.name.endsWith('/ ' + name))!
    const normal = new Vector3(0, 1, 0.17 / 0.26).normalize()
    for (const stem of list.filter(mesh => mesh.name.endsWith('/ seated mechanical key stem'))) {
      ray.set(stem.position.clone(), normal.clone().negate())
      const hit = ray.intersectObject(named('sloped mechanical register housing'))[0]
      expect(hit).toBeDefined(); expect(hit!.distance).toBeLessThan(0.012)
    }
    const top = new Box3().setFromObject(named('overhanging counter top'))
    const base = new Box3().setFromObject(named('register sole plate'))
    expect(base.min.y).toBeCloseTo(top.max.y, 5)
    const housing = new Box3().setFromObject(named('sloped mechanical register housing'))
    expect(housing.intersectsBox(new Box3().setFromObject(named('raised display hood')))).toBe(true)
    const boss = named('cast crank mounting boss'); const bearing = named('crank bearing flange'); const axle = named('seated crank axle')
    expect(new Box3().setFromObject(boss).intersectsBox(housing)).toBe(true)
    expect(new Box3().setFromObject(bearing).intersectsBox(new Box3().setFromObject(boss))).toBe(true)
    expect(new Box3().setFromObject(bearing).intersectsBox(new Box3().setFromObject(axle))).toBe(true)
    ray.set(new Vector3(0.3, counterHeight + 0.132, -0.055), new Vector3(-1, 0, 0))
    for (const part of [boss, bearing, axle, named('sloped mechanical register housing')]) expect(ray.intersectObject(part).length).toBeGreaterThan(0)
    const pull = new Box3().setFromObject(named('drawer pull')); const washer = new Box3().setFromObject(named('seated drawer pull escutcheon'))
    expect(pull.intersectsBox(washer)).toBe(true)
    expect(washer.intersectsBox(new Box3().setFromObject(named('cedar cash drawer face')))).toBe(true)
    ray.set(new Vector3(0, 0.32, 0.5), new Vector3(0, 0, -1))
    expect(ray.intersectObject(model.parts.pedestal, true)[0]!.point.z).toBeLessThan(-0.17)
  }
  model.configure({ drawerOpen: 1 }); model.root.updateMatrixWorld(true)
  expect(model.parts.drawer.position.z).toBe(0.12)
  const bottom = model.root.getObjectByName('kk-026-cash-register-counter / cash drawer bottom') as Mesh
  const housingSide = model.root.getObjectByName('kk-026-cash-register-counter / drawer housing side') as Mesh
  expect(new Box3().setFromObject(bottom).min.z).toBeLessThan(new Box3().setFromObject(housingSide).max.z)
  model.dispose()
})
