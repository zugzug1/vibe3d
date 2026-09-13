import { expect,test } from 'bun:test'
import { Box3,Group,Mesh,MeshStandardMaterial,Raycaster,Vector3,type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
const meshes=(root:Group):Mesh[]=>{const out:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)out.push(o)});return out}
test('kk-036-coffee-bean-jar: dimensions and finite triangles stay inside original storytelling budget',()=>{
 const m=createModel()
 try{
  const bounds=new Box3().setFromObject(m.root),size=bounds.getSize(new Vector3()).toArray(),expected=[0.14,0.24,0.14]
  for(let i=0;i<3;i++)expect(Math.abs(size[i]!-expected[i]!)).toBeLessThan(0.0001)
  expect(bounds.min.y).toBeCloseTo(0,6);expect(m.root.userData.category).toBe('storytelling')
  let count=0
  for(const mesh of meshes(m.root)){
   const g=mesh.geometry,p=g.getAttribute('position'),index=g.index,n=index?.count??p.count;count+=n/3
   for(let i=0;i<n;i+=3){
    const [a,b,c]=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j))
    const area=b!.sub(a!).cross(c!.sub(a!)).lengthSq();expect(Number.isFinite(area)).toBe(true);expect(area).toBeGreaterThan(1e-22)
   }
  }
  expect(count).toBeLessThanOrEqual(2000)
 }finally{m.dispose()}
})
test('kk-036-coffee-bean-jar: anchors and caller resources survive rebuilding; owned resources dispose once',()=>{
 const probe=new MeshStandardMaterial();let probeDisposed=0;probe.addEventListener('dispose',()=>probeDisposed++)
 const m=createModel({materials:{glass:probe}}),anchors=Object.values(m.parts),root=m.root,attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let oldDisposed=0
 old.forEach(g=>g.addEventListener('dispose',()=>oldDisposed++))
 const mats=new Set(Object.values(m.materials).filter(m=>m!==probe)),textures=new Set<Texture>();let matDisposed=0,texDisposed=0
 mats.forEach(mat=>{mat.addEventListener('dispose',()=>matDisposed++);const standard=mat as MeshStandardMaterial;for(const t of [standard.map,standard.normalMap,standard.roughnessMap])if(t)textures.add(t)})
 textures.forEach(t=>t.addEventListener('dispose',()=>texDisposed++))
 m.configure({lid:false,beans:false});expect(oldDisposed).toBe(old.size)
 expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 const copy=m.getConfig() as {lid:boolean};copy.lid=true;expect(m.getConfig().lid).toBe(false)
 m.configure({lid:true,beans:true})
 for(const slot of Object.keys(m.materials) as Array<keyof typeof m.materials>){
  m.setMaterial(slot,probe);expect(meshes(root).some(o=>o.userData.materialSlot===slot&&o.material===probe)).toBe(true)
 }
 m.configure({})
 expect(meshes(root).every(o=>o.material===probe)).toBe(true)
 const current=new Set(meshes(root).map(o=>o.geometry));let released=0
 current.forEach(g=>g.addEventListener('dispose',()=>released++))
 m.dispose();m.dispose();m.configure({})
 expect(released).toBe(current.size);expect(matDisposed).toBe(mats.size);expect(texDisposed).toBe(textures.size);expect(probeDisposed).toBe(0);probe.dispose()
})
test('036 all contents are small shared grooved beans without a cylinder; jar opens under seated lid',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try{
  const beans=meshes(m.parts.beans).filter(o=>o.name.endsWith('/ visible coffee bean')||o.name.endsWith('/ top coffee bean'))
  expect(beans.length).toBe(84)
  expect(meshes(m.parts.beans).length).toBe(84)
  expect(new Set(beans.map(o=>o.geometry)).size).toBe(1)
  const geometry=beans[0]!.geometry
  expect(geometry.index!.count/3).toBe(16)
  geometry.computeBoundingBox()
  const beanSize=geometry.boundingBox!.getSize(new Vector3())
  expect(beanSize.x).toBeCloseTo(0.020,6);expect(beanSize.z).toBeCloseTo(0.032,6)
  const sample=new Mesh(geometry,beans[0]!.material)
  const seam=new Raycaster(new Vector3(0,0.02,0),new Vector3(0,-1,0)).intersectObject(sample)[0]!
  const ridge=new Raycaster(new Vector3(0.0045,0.02,0),new Vector3(0,-1,0)).intersectObject(sample)[0]!
  expect(seam.point.y).toBeCloseTo(0.001,6)
  expect(ridge.point.y-seam.point.y).toBeGreaterThan(0.004)
  for(const bean of beans){
   const p=bean.geometry.getAttribute('position')
   for(let i=0;i<p.count;i++){
    const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(bean.matrixWorld)
    expect(Math.hypot(v.x,v.z)).toBeLessThan(0.068)
    expect(v.y).toBeGreaterThan(-1e-8);expect(v.y).toBeLessThan(0.19)
   }
  }
  for(let row=0;row<10;row++)for(let i=0;i<8;i++){
   const a=(i+(row%2)*0.28)/8*Math.PI*2,d=new Vector3(Math.sin(a),0,Math.cos(a))
   const hit=new Raycaster(d.clone().multiplyScalar(0.09).setY(0.010+row*0.0165),d.clone().negate()).intersectObject(m.parts.beans)[0]!
   expect(hit.object.name.endsWith('/ visible coffee bean')).toBe(true)
   expect(Math.hypot(hit.point.x,hit.point.z)).toBeGreaterThan(0.04)
  }
  for(const bean of beans.slice(0,8))expect(new Box3().setFromObject(bean).min.y).toBeCloseTo(0,6)
  // Gasket top and downward-facing lid shoulder overlap by 1 mm at a real shared radius.
  const gasket=meshes(m.parts.vessel).find(o=>o.name.endsWith('/ hollow fitted neck gasket'))!
  const lid=meshes(m.parts.lid).find(o=>o.name.endsWith('/ fitted ceramic lid'))!
  for(const a of [0.2,1.7,3.2,4.7]){
   const x=0.060*Math.sin(a),z=0.060*Math.cos(a)
   const top=new Raycaster(new Vector3(x,0.23,z),new Vector3(0,-1,0)).intersectObject(gasket)[0]!
   const seat=new Raycaster(new Vector3(x,0.19,z),new Vector3(0,1,0)).intersectObject(lid)[0]!
   expect(top.point.y).toBeCloseTo(0.210,6)
   expect(seat.point.y).toBeCloseTo(0.209,6)
  }
  m.configure({beans:false,lid:false});m.root.updateMatrixWorld(true)
  const bottom=new Raycaster(new Vector3(0.001,0.3,0),new Vector3(0,-1,0)).intersectObject(m.root)[0]!
  expect(bottom.point.y).toBeCloseTo(0,6)
  expect(meshes(m.parts.vessel).length).toBe(2)
 }finally{m.dispose()}
})
