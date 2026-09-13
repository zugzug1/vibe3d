import { Box3, Mesh, Vector3, type Object3D } from 'three/webgpu'

/** Recover disconnected authored solids from merged geometry, independent of mesh names.
 * This supplies bounds to the existing heuristic, not an exact triangle intersection test.
 * Touching/welded solids may form one component and require visual inspection.
 */
export function collectMergedParts(root: Object3D): Array<{ box: Box3; mat: string }> {
  const parts: Array<{ box: Box3; mat: string }> = []
  root.updateMatrixWorld(true)
  root.traverse((object) => {
    if (!(object instanceof Mesh) || object.userData.excludeFromExport) return
    const position = object.geometry.getAttribute('position')
    if (!position?.count) return
    const index = object.geometry.index
    const parents: number[] = []
    const points: Vector3[] = []
    const vertices = new Map<string, number>()
    const ids: number[] = []
    function find(n: number): number {
      while (parents[n] !== n) {
        parents[n] = parents[parents[n]!]!
        n = parents[n]!
      }
      return n
    }
    for (let i = 0; i < position.count; i++) {
      const point = new Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld)
      if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error('Non-finite model vertex')
      const key = [point.x, point.y, point.z].map((v) => Math.round(v * 1e7)).join(',')
      let id = vertices.get(key)
      if (id === undefined) {
        id = points.length
        points.push(point)
        parents.push(id)
        vertices.set(key, id)
      }
      ids.push(id)
    }
    const count = index?.count ?? position.count
    if (count % 3) throw new Error('Incomplete triangle in model geometry')
    for (let i = 0; i < count; i += 3) {
      const a = ids[index ? index.getX(i) : i]!
      for (let j = 1; j < 3; j++) {
        const b = ids[index ? index.getX(i + j) : i + j]!
        parents[find(b)] = find(a)
      }
    }
    const boxes = new Map<number, Box3>()
    for (let i = 0; i < points.length; i++) {
      const component = find(i)
      const box = boxes.get(component) ?? new Box3()
      box.expandByPoint(points[i]!)
      boxes.set(component, box)
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const mat = materials.map((m) => m.name || '?').join(',')
    for (const box of boxes.values()) if (!box.isEmpty()) parts.push({ box, mat })
  })
  return parts
}

export function requirePartCoverage(parts: readonly unknown[], id: string): void {
  if (!parts.length) throw new Error(`${id}: zero inspected parts; check is inconclusive, not clean`)
}
