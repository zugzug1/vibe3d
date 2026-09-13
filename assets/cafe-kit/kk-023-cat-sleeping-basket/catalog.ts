import { shell } from '../kk-core/catalog.ts'
// Keep every disconnected component; largest-island pruning drops furniture anatomy.
export const entry = shell('kk-023-cat-sleeping-basket', [], [], { pruneToLargest: false, keepOpenings: true, allowAabbHull: true })
