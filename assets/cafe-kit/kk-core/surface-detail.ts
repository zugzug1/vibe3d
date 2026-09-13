/** Opt-in portable surface detail. No shader hooks, baked light, or shared mutable resources. */
import { BufferAttribute, DataTexture, MeshStandardMaterial, NoColorSpace, SRGBColorSpace, type BufferGeometry, type Material } from 'three/webgpu'
import { acquireKkMaterials, disposeKkMaterials, type KkMaterials } from './materials.ts'
import { cedarGrainTexture, glazePoolingTexture, washiFibreTexture } from './textures.ts'

export type SurfaceDetail = 'cedar' | 'fabric' | 'paper' | 'glaze'

/** Small deterministic maps; color is a neutral multiplier so the kit tint stays authoritative. */
export function createSurfaceMaps(kind: SurfaceDetail): { map: DataTexture; roughnessMap: DataTexture; normalMap: DataTexture } {
  const n = 128
  const map = kind === 'cedar' ? cedarGrainTexture(n) : kind === 'paper' ? washiFibreTexture(n) : glazePoolingTexture(0xffffff, n)
  const source = map.image.data as Uint8Array
  const heights = new Float32Array(n * n)
  let low = Infinity; let high = -Infinity
  for (let i = 0; i < heights.length; i++) {
    const x = i % n; const y = Math.floor(i / n)
    const value = kind === 'fabric'
      ? 0.5 + 0.23 * Math.sin(x * Math.PI / 2) + 0.19 * Math.sin(y * Math.PI / 2 + (Math.floor(x / 2) % 2) * Math.PI)
      : (source[i * 4]! + source[i * 4 + 1]! + source[i * 4 + 2]!) / 765
    heights[i] = value; low = Math.min(low, value); high = Math.max(high, value)
  }
  const rough = new Uint8Array(n * n * 4); const normal = new Uint8Array(n * n * 4)
  const contrast = { cedar: 0.075, fabric: 0.075, paper: 0.045, glaze: 0.085 }[kind]
  for (let i = 0; i < heights.length; i++) {
    const h = (heights[i]! - low) / Math.max(1e-6, high - low)
    const color = Math.round(255 * (1 - contrast + contrast * h))
    source.set([color, color, color, 255], i * 4)
    const r = Math.round(255 * (0.88 + 0.12 * h))
    rough.set([r, r, r, 255], i * 4)
    const x = i % n; const y = Math.floor(i / n)
    const sample = (xx: number, yy: number): number => heights[((yy + n) % n) * n + ((xx + n) % n)]!
    const strength = kind === 'fabric' ? 0.16 : kind === 'cedar' ? 0.05 : 0.2
    const dx = (sample(x - 1, y) - sample(x + 1, y)) * strength
    const dy = (sample(x, y - 1) - sample(x, y + 1)) * strength
    const length = Math.hypot(dx, dy, 1)
    normal.set([Math.round((dx / length * 0.5 + 0.5) * 255), Math.round((dy / length * 0.5 + 0.5) * 255), Math.round((1 / length * 0.5 + 0.5) * 255), 255], i * 4)
  }
  const makeLinear = (data: Uint8Array): DataTexture => {
    const texture = new DataTexture(data, n, n)
    texture.colorSpace = NoColorSpace
    texture.wrapS = map.wrapS; texture.wrapT = map.wrapT
    texture.minFilter = map.minFilter; texture.magFilter = map.magFilter; texture.generateMipmaps = true
    return texture
  }
  const roughnessMap = makeLinear(rough)
  const normalMap = makeLinear(normal)
  map.colorSpace = SRGBColorSpace
  for (const texture of [map, roughnessMap, normalMap]) { texture.name = `cafe-kit / ${kind} surface`; texture.needsUpdate = true }
  return { map, roughnessMap, normalMap }
}

/** Acquires instance-owned defaults, but never decorates or frees consumer overrides. */
export function acquireSurfaceMaterials<S extends keyof KkMaterials>(details: Record<S, SurfaceDetail>, overrides: Partial<Record<S, Material>> = {}) {
  const base = acquireKkMaterials()
  const materials = { ...base.materials, ...overrides } as Record<S, Material>
  const textures: DataTexture[] = []
  const maps = new Map<SurfaceDetail, ReturnType<typeof createSurfaceMaps>>()
  for (const slot of Object.keys(details) as S[]) {
    if (overrides[slot]) continue
    const material = materials[slot] as MeshStandardMaterial
    const kind = details[slot]
    let detail = maps.get(kind)
    if (!detail) { detail = createSurfaceMaps(kind); maps.set(kind, detail); textures.push(...Object.values(detail)) }
    Object.assign(material, detail)
  }
  let disposed = false
  return { materials, dispose() {
    if (disposed) return
    disposed = true
    textures.forEach((texture) => texture.dispose())
    disposeKkMaterials(base)
  } }
}

/** Face-local metric UVs for extruded boards. U follows their longest grain axis. */
export function boardUVs(geometry: BufferGeometry, size: readonly [number, number, number]): void {
  const p = geometry.getAttribute('position'); const normal = geometry.getAttribute('normal')
  const uv = new Float32Array(p.count * 2)
  const grain = size.indexOf(Math.max(...size))
  for (let i = 0; i < p.count; i++) {
    const coordinates = [p.getX(i), p.getY(i), p.getZ(i)]
    const ns = [Math.abs(normal.getX(i)), Math.abs(normal.getY(i)), Math.abs(normal.getZ(i))]
    const face = ns.indexOf(Math.max(...ns))
    const axes = [0, 1, 2].filter((axis) => axis !== face)
    const u = face === grain ? axes[0]! : grain
    const v = axes.find((axis) => axis !== u)!
    uv[i * 2] = coordinates[u]! / 0.45 + 0.5
    uv[i * 2 + 1] = coordinates[v]! / 0.18 + 0.5
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
}
