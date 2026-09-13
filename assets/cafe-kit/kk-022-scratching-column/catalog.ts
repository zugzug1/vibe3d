import { shell } from '../kk-core/catalog.ts'
// Keep every disconnected component; largest-island pruning drops furniture anatomy.
export const entry = shell('kk-022-scratching-column', [], [], { pruneToLargest: false, keepOpenings: true, allowAabbHull: true })
