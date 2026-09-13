import { Mesh } from 'three/webgpu'
const { createModel } = await import('./assets/cafe-kit/kk-040-folded-apron/model.ts')
const m = createModel()
m.root.traverse((o: any) => {
  if (!o.isMesh) return
  const mesh = o as Mesh
  const mat: any = mesh.material
  const col: any = (mesh.geometry as any).getAttribute('color')
  let lo = 9, hi = -9
  if (col) for (let i = 0; i < col.count * 3; i++) { const v = col.array[i]; if (v < lo) lo = v; if (v > hi) hi = v }
  console.log(mesh.name, '| mat', mat.name, 'vertexColors=', mat.vertexColors, 'color=#' + mat.color.getHexString(),
    '| colorAttr', col ? `${col.count} verts range ${lo.toFixed(3)}..${hi.toFixed(3)}` : 'NONE')
})
m.dispose()
