/**
 * Catalog / registry category for Kyoto Kat (`kk-0NN-*`) models.
 *
 * The tier is fixed by the handoff roster (issue #6): kk-001–010 signature, kk-011–030 furnishing,
 * kk-031–050 storytelling. It drives the triangle budget too — see `TIER_BUDGET`.
 */

export type KkTier = 'signature' | 'furnishing' | 'storytelling'

export const TIER_BUDGET: Record<KkTier, { triangles: number; textureMax: number }> = {
  signature: { triangles: 15_000, textureMax: 1024 },
  furnishing: { triangles: 6_000, textureMax: 1024 },
  storytelling: { triangles: 2_000, textureMax: 512 },
}

export function numberFromId(id: string): number {
  const match = id.match(/^kk-(\d{3})(?:-|$)/)
  if (!match) throw new Error(`not a Kyoto Kat model id: ${id}`)
  return Number(match[1])
}

export function tierFromId(id: string): KkTier {
  const n = numberFromId(id)
  if (n >= 1 && n <= 10) return 'signature'
  if (n >= 11 && n <= 30) return 'furnishing'
  if (n >= 31 && n <= 50) return 'storytelling'
  throw new Error(`Kyoto Kat id out of roster range: ${id}`)
}

export function categoryFromId(id: string): string {
  switch (tierFromId(id)) {
    case 'signature': return 'Signature'
    case 'furnishing': return 'Furnishing'
    case 'storytelling': return 'Storytelling'
  }
}
