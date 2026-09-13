import { expect, test } from 'bun:test'
import { Box3, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3, type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
import { setCafeWoodFinish } from '../kk-core/index.ts'
const meshes=(root:Group):Mesh[]=>{const out:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)out.push(o)});return out}
test('kk-023-cat-sleeping-basket: canonical dimensions, finite nondegenerate triangles and 6000 budget',()=>{
 const m=createModel()
 try {
  const box=new Box3().setFromObject(m.root),actual=box.getSize(new Vector3()).toArray(),expected=[0.5,0.2,0.4]
  for(let i=0;i<3;i++)expect(Math.abs(actual[i]!-expected[i]!)).toBeLessThan(0.001)
  expect(box.min.y).toBeCloseTo(0,6);expect(m.root.userData.category).toBe('furnishing')
  let count=0
  for(const mesh of meshes(m.root)){
   const g=mesh.geometry,p=g.getAttribute('position'),index=g.index,n=index?.count??p.count;count+=n/3
   for(let i=0;i<n;i+=3){
    const [a,b,c]=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j))
    const area=b!.sub(a!).cross(c!.sub(a!)).lengthSq()
    expect(Number.isFinite(area)).toBe(true);expect(area).toBeGreaterThan(1e-20)
   }
  }
  expect(count).toBeLessThanOrEqual(6000)
 }finally{m.dispose()}
})
test('kk-023-cat-sleeping-basket: stable anchors, configuration, consumer ownership and exact-once disposal',()=>{
 const external=new MeshStandardMaterial(),slot='tatami' as const
 let externalDisposed=0;external.addEventListener('dispose',()=>externalDisposed++)
 const m=createModel({materials:{[slot]:external}}),root=m.root,anchors=Object.values(m.parts),attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let oldDisposed=0
 old.forEach(g=>g.addEventListener('dispose',()=>oldDisposed++))
 const mats=new Set(Object.values(m.materials).filter(v=>v!==external)),textures=new Set<Texture>()
 let matDisposed=0,texDisposed=0
 mats.forEach(mat=>{mat.addEventListener('dispose',()=>matDisposed++);const p=mat as MeshStandardMaterial;for(const t of [p.map,p.normalMap,p.roughnessMap])if(t)textures.add(t)})
 textures.forEach(t=>t.addEventListener('dispose',()=>texDisposed++))
 m.configure({cushion:false})
 expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 expect(oldDisposed).toBe(old.size)
 const copy=m.getConfig() as {cushion:boolean};copy.cushion=true;expect(m.getConfig().cushion).toBe(false)
 m.setMaterial(slot,external);m.configure({cushion:true})
 expect(meshes(root).filter(o=>o.userData.materialSlot===slot).every(o=>o.material===external)).toBe(true)
 const color=external.color.getHex();setCafeWoodFinish(root,{tint:'#956441'});expect(external.color.getHex()).toBe(color)
 const current=new Set(meshes(root).map(o=>o.geometry));let disposed=0
 current.forEach(g=>g.addEventListener('dispose',()=>disposed++))
 m.dispose();m.dispose();m.configure({cushion:false})
 expect(disposed).toBe(current.size);expect(matDisposed).toBe(mats.size);expect(texDisposed).toBe(textures.size);expect(externalDisposed).toBe(0);external.dispose()
})
test('023 removable cushion is seated; open weave and lowered entrance remain actual geometry',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try {
  const floor=new Box3().setFromObject(m.parts.floor),cushion=new Box3().setFromObject(m.parts.cushion)
  expect(cushion.min.y).toBeCloseTo(floor.max.y,6)
  const rim=meshes(m.parts.rim)[0]!,p=rim.geometry.getAttribute('position')
  let front=0,back=0
  for(let i=0;i<p.count;i++){if(Math.abs(p.getX(i))>0.015)continue;if(p.getZ(i)>0.18)front=Math.max(front,p.getY(i));if(p.getZ(i)<-0.18)back=Math.max(back,p.getY(i))}
  expect(back-front).toBeGreaterThan(0.025)
  const bindings=meshes(m.parts.weave).filter(o=>o.name.endsWith('/ seated flat basket binding'))
  expect(bindings.length).toBe(20)
  for(const binding of bindings){
   const p=binding.geometry.getAttribute('position')
   for(let i=0;i<p.count;i++){
    const a=Math.atan2(p.getX(i)/0.241,p.getZ(i)/0.191)
    const crown=0.192-0.038*Math.max(0,Math.cos(a))**8
    expect(p.getY(i)).toBeLessThan(crown+0.001)
    expect(p.getY(i)).toBeGreaterThanOrEqual(0.0119)
   }
  }
  // Centre sits substantially below the stuffed shoulder, not a flat cushion slab.
  const centre=new Raycaster(new Vector3(0.001,0.25,0.001),new Vector3(0,-1,0)).intersectObject(m.parts.cushion)[0]!
  const shoulder=new Raycaster(new Vector3(0.17,0.25,0),new Vector3(0,-1,0)).intersectObject(m.parts.cushion)[0]!
  expect(shoulder.point.y-centre.point.y).toBeGreaterThan(0.045)
  // Dense ribbon courses leave sub-millimetre slots at a non-binding azimuth.
  const angle=Math.PI/20,rays=Array.from({length:60},(_,i)=>{
   const y=0.03+i*0.002
   const hits=new Raycaster(new Vector3(0.3*Math.sin(angle),y,0.3*Math.cos(angle)),new Vector3(-Math.sin(angle),0,-Math.cos(angle))).intersectObject(m.parts.weave)
   return hits.length>0 && hits[0]!.distance<0.15
  })
  expect(rays.filter(Boolean).length).toBeGreaterThan(55)
  m.configure({cushion:false});m.root.updateMatrixWorld(true);expect(meshes(m.parts.cushion).length).toBe(0)
  const bottom=new Raycaster(new Vector3(0,0.3,0),new Vector3(0,-1,0)).intersectObject(m.root)[0]!
  expect(bottom.point.y).toBeCloseTo(0.012,6)
  // Between the first two horizontal strips and halfway between vertical stakes.
  const a=Math.PI/20,t=1/7,y=0.012+t*(0.177-0.038*Math.cos(a)**8)
  const hits=new Raycaster(new Vector3(0.3*Math.sin(a),y,0.3*Math.cos(a)),new Vector3(-Math.sin(a),0,-Math.cos(a))).intersectObject(m.parts.weave)
  expect(hits.length===0 || hits[0]!.distance>0.15).toBe(true)
 }finally{m.dispose()}
})

test('023 cushion remains inside the tapered basket at every vertex height',()=>{
 const m=createModel()
 try {
  for(const mesh of meshes(m.parts.cushion)) {
   const p=mesh.geometry.getAttribute('position')
   for(let i=0;i<p.count;i++) {
    // Use the lowest front wall as a conservative containment envelope around the full oval.
    const t=Math.max(0,Math.min(1,(p.getY(i)-0.012)/0.177))
    const rx=0.199+0.042*t-0.0035,rz=0.149+0.042*t-0.0035
    expect((p.getX(i)/rx)**2+(p.getZ(i)/rz)**2).toBeLessThanOrEqual(1)
   }
  }
 }finally{m.dispose()}
})
