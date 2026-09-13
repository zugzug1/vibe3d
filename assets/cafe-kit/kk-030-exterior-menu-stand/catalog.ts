import { openAssembly } from '../kk-core/catalog.ts'
const id = 'kk-030-exterior-menu-stand'
export const entry = openAssembly(id, {}, [], [
  'ornament fixing peg', 'hanging ornament ring', 'plain ceramic charm', 'retaining panel clip', 'panel clip screw', 'blank writing panel',
].map(name => `${id} / ${name}`), { allowAabbHull: false })
