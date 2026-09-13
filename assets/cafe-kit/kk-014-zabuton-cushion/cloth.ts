import { BufferAttribute, BufferGeometry } from 'three/webgpu'

const segments = 48
const rings = 16
/** A gathered shell with a pinched perimeter, a real central depression and a flat resting point. */
export function cushionSurface(r: number, angle: number, tufted: boolean): [number, number, number] {
  const c = Math.cos(angle); const s = Math.sin(angle)
  const x = 0.2475 * r * Math.sign(c) * Math.abs(c) ** 0.35
  const z = 0.2475 * r * Math.sign(s) * Math.abs(s) ** 0.35
  const dome = 0.067 * Math.sin((1 - r) * Math.PI / 2) ** 0.7
  const gather = tufted ? 0.030 * Math.exp(-r * r / 0.06) : 0
  const crease = 0.005 * Math.cos(angle * 8) * Math.sin(r * Math.PI) * Math.exp(-r * 2)
  return [x, 0.032 + dome - gather + crease, z]
}

export function cushionGeometry(tufted: boolean): BufferGeometry {
  const positions: number[] = []; const indices: number[] = []
  let highest = 0
  for (let side = 0; side < 2; side++) {
    const base = positions.length / 3
    const center = cushionSurface(0, 0, tufted)
    positions.push(0, side ? 0 : center[1], 0)
    highest = Math.max(highest, center[1])
    for (let j = 1; j <= rings; j++) for (let i = 0; i < segments; i++) {
      const r = j / rings
      const [x, top, z] = cushionSurface(r, i * Math.PI * 2 / segments, tufted)
      const y = side ? 0.032 * (1 - Math.sqrt(1 - r * r)) : top
      positions.push(x, y, z); highest = Math.max(highest, y)
    }
    const face = (a: number, b: number, c: number): void => { indices.push(...(side ? [a, b, c] : [a, c, b])) }
    for (let i = 0; i < segments; i++) face(base, base + 1 + i, base + 1 + (i + 1) % segments)
    for (let j = 1; j < rings; j++) for (let i = 0; i < segments; i++) {
      const a = base + 1 + (j - 1) * segments + i
      const b = base + 1 + (j - 1) * segments + (i + 1) % segments
      face(a, a + segments, b); face(b, a + segments, b + segments)
    }
  }
  // Normalize only the authored cloth loft, before adding surface-seated threads.
  for (let i = 1; i < positions.length; i += 3) if (positions[i]! > 0.032) positions[i] = 0.032 + (positions[i]! - 0.032) * 0.068 / (highest - 0.032)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(positions.flatMap((_, i) => i % 3 === 0 ? [positions[i]! * 2 + 0.5, positions[i + 2]! * 2 + 0.5] : [])), 2))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  return geometry
}
