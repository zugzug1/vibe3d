// throwaway probe — is any spindle tip outside the bow tube? deleted after use.
import { Box3, Mesh, Vector3 } from 'three/webgpu'
import { createModel } from './model.ts'

const CROWN = new Vector3(0, 0.668, 0)
const CROWN_R = 0.168
const BOW_R = 0.014
const RAKE = 0.25
const SEAT_TOP = 0.445

const model = createModel()
const back = model.parts.back
back.updateMatrixWorld(true)

// Every vertex of the back batch, projected into the bow's raked plane, and its radius from the crown.
let outside = 0
let worst = 0
let worstPt = new Vector3()
back.traverse((o) => {
  const mesh = o as Mesh
  if (!mesh.isMesh) return
  const pos = mesh.geometry.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    if (y < 0.66) continue // only the crown region, where a spindle could break out
    // distance out of the bow's plane
    const planeZ = -0.145 + RAKE * (SEAT_TOP - y)
    const outOfPlane = Math.abs(z - planeZ)
    const r = Math.hypot(x - CROWN.x, y - CROWN.y)
    // radial excursion beyond the tube's outer surface, in the plane
    const radial = Math.abs(r - CROWN_R)
    const d = Math.hypot(radial, outOfPlane)
    if (d > BOW_R + 1e-4) {
      outside++
      if (d > worst) { worst = d; worstPt = new Vector3(x, y, z) }
    }
  }
})
console.log(JSON.stringify({
  note: 'vertices above y=0.66 lying further than BOW_R from the bow centreline torus',
  outside, worstDistance: Number(worst.toFixed(5)), bowR: BOW_R,
  worstPoint: [worstPt.x, worstPt.y, worstPt.z].map((n) => Number(n.toFixed(4))),
}))

// And the five spindle tips explicitly.
const box = new Box3().setFromObject(model.root as never)
console.log(JSON.stringify({ bbox: box.getSize(new Vector3()).toArray().map((n) => Number(n.toFixed(4))) }))
// The real test: over the CROWN ARC only (|x| < CROWN_R, y > CROWN_Y), how far does the outermost
// vertex sit from the crown centre? Nothing in the back may exceed CROWN_R + BOW_R = 0.182.
let maxR = 0
let maxAt = new Vector3()
back.traverse((o) => {
  const mesh = o as Mesh
  if (!mesh.isMesh) return
  const pos = mesh.geometry.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    if (y <= CROWN.y || Math.abs(x) >= CROWN_R) continue
    const r = Math.hypot(x, y - CROWN.y)
    if (r > maxR) { maxR = r; maxAt = new Vector3(x, y, pos.getZ(i)) }
  }
})
console.log(JSON.stringify({
  crownArc: 'max radius from crown centre over the arc region',
  maxR: Number(maxR.toFixed(5)),
  allowed: Number((CROWN_R + BOW_R).toFixed(5)),
  breach: Number((maxR - (CROWN_R + BOW_R)).toFixed(5)),
  at: [maxAt.x, maxAt.y, maxAt.z].map((n) => Number(n.toFixed(4))),
}))
model.dispose()
