import { openAssembly } from '../kk-core/catalog.ts'
const id = 'kk-024-ventilated-litter-enclosure'
// Preserve the entry, vents and pan cavity in the collision surface as well as the render meshes.
export const entry = openAssembly(id, {}, [], [`${id} / contained litter bed`, `${id} / recessed finger pull bottom`], { allowAabbHull: false })
