import { openAssembly } from '../kk-core/catalog.ts'
const id = 'kk-026-cash-register-counter'
export const entry = openAssembly(id, {}, [], [
  'seated mechanical key stem', 'round key cap', 'blank mechanical readout', 'inset display bezel', 'drawer pull', 'crank arm', 'timber crank grip', 'seated crank axle',
].map(name => `${id} / ${name}`), { allowAabbHull: false })
