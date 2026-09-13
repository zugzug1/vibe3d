import { openAssembly } from '../kk-core/catalog.ts'
const id = 'kk-021-wall-cat-walkway'
// All independent landings survive compilation; never collapse the stair void into an AABB.
export const entry = openAssembly(id, {}, [], Array.from({ length: 5 }, (_, i) => [
  `${id} / step ${i} moss pad`, `${id} / step ${i} bound pad edge`, `${id} / step ${i} fixing plug`,
]).flat(), { allowAabbHull: false })
