import { BufferAttribute, BufferGeometry, Shape, ShapeGeometry, Vector3 } from 'three/webgpu'

export const panelWidth = 0.50
export const panelHeight = 1.04
const cols = 20; const rows = 24
function fold(u: number, v: number): number { return 0.009 * Math.sin(u * Math.PI * 5 + v * 0.7) * (0.4 + 0.6 * (1 - v)) }
/** Piecewise planar evaluator for the actual panel triangles, also used by the ink. */
export function clothZ(x: number, y: number): number {
  const gx = Math.max(0, Math.min(cols - 1e-8, (x / panelWidth + 0.5) * cols))
  const gy = Math.max(0, Math.min(rows - 1e-8, (y / panelHeight + 0.5) * rows))
  const i = Math.floor(gx); const j = Math.floor(gy); const u = gx - i; const v = gy - j
  const a = fold(i / cols, j / rows); const b = fold((i + 1) / cols, j / rows)
  const d = fold(i / cols, (j + 1) / rows); const c = fold((i + 1) / cols, (j + 1) / rows)
  return u + v <= 1 ? a + (b - a) * u + (d - a) * v : c + (d - c) * (1 - u) + (b - c) * (1 - v)
}
export function panelGeometry(): BufferGeometry {
  const p: number[] = []; const uv: number[] = []; const index: number[] = []
  for (let side = 0; side < 2; side++) for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    const u = x / cols; const v = y / rows
    p.push((u - 0.5) * panelWidth, (v - 0.5) * panelHeight, fold(u, v) + (side ? -0.001 : 0))
    uv.push(u, v)
  }
  const layer = (cols + 1) * (rows + 1)
  for (let side = 0; side < 2; side++) for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const a = side * layer + y * (cols + 1) + x; const b = a + 1; const d = a + cols + 1; const c = d + 1
    index.push(...(side ? [a, d, b, b, d, c] : [a, b, d, b, c, d]))
  }
  const geo = new BufferGeometry(); geo.setAttribute('position', new BufferAttribute(new Float32Array(p), 3)); geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2)); geo.setIndex(index); geo.computeVertexNormals(); return geo
}
/** A fabric strap with a visible opening around the rod, returned in panel-local coordinates. */
export function loopGeometry(x: number): BufferGeometry {
  const yz: [number, number][] = [[0.485, clothZ(x, 0.485) + 0.001], [0.545, 0.022]]
  for (let i = 0; i <= 12; i++) { const a = i * Math.PI / 12; yz.push([0.558 + Math.sin(a) * 0.0175, -0.002 + Math.cos(a) * 0.0175]) }
  yz.push([0.51, -0.025], [0.49, clothZ(x, 0.49) - 0.002])
  const positions: number[] = []; const uv: number[] = []; const indices: number[] = []
  for (let side = 0; side < 2; side++) for (let j = 0; j < yz.length; j++) for (const sign of [-1, 1]) {
    positions.push(x + sign * 0.023, yz[j]![0], yz[j]![1] + (side ? -0.001 : 0.001)); uv.push(sign * 0.5 + 0.5, j / yz.length)
  }
  const layer = yz.length * 2
  for (let side = 0; side < 2; side++) for (let j = 0; j < yz.length - 1; j++) {
    const a = side * layer + j * 2
    indices.push(...(side ? [a, a + 2, a + 1, a + 1, a + 2, a + 3] : [a, a + 1, a + 2, a + 1, a + 3, a + 2]))
  }
  const geo = new BufferGeometry(); geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3)); geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2)); geo.setIndex(indices); geo.computeVertexNormals(); return geo
}
/** Tessellated ink follows cloth instead of bridging folds as a flat badge. */
export function paintedShape(shape: Shape, x: number, y: number): BufferGeometry {
  const source = new ShapeGeometry(shape, 10)
  const positions: number[] = []; const a = source.getAttribute('position'); const idx = source.index!
  const split = (p: Vector3, q: Vector3, r: Vector3, level: number): void => {
    if (level) {
      const pq = p.clone().lerp(q, 0.5); const qr = q.clone().lerp(r, 0.5); const rp = r.clone().lerp(p, 0.5)
      split(p, pq, rp, level - 1); split(pq, q, qr, level - 1); split(rp, qr, r, level - 1); split(pq, qr, rp, level - 1)
    } else for (const v of [p, q, r]) positions.push(v.x + x, v.y + y, clothZ(v.x + x, v.y + y) + 0.0007)
  }
  for (let i = 0; i < idx.count; i += 3) split(new Vector3().fromBufferAttribute(a, idx.getX(i)), new Vector3().fromBufferAttribute(a, idx.getX(i + 1)), new Vector3().fromBufferAttribute(a, idx.getX(i + 2)), 2)
  source.dispose()
  const geo = new BufferGeometry(); geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(positions.flatMap((_, i) => i % 3 === 0 ? [positions[i]! / panelWidth + 0.5, positions[i + 1]! / panelHeight + 0.5] : [])), 2)); geo.computeVertexNormals(); return geo
}
