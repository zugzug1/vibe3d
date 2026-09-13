import { expect,test } from 'bun:test'
import { Box3,Group,Mesh,MeshStandardMaterial,Raycaster,Vector3,type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
const meshes=(root:Group):Mesh[]=>{const out:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)out.push(o)});return out}
test('038 mapped materials always have finite UV coordinates, including the custom spout',()=>{
 const m=createModel()
 try{for(const mesh of meshes(m.root)){
  const mat=mesh.material as MeshStandardMaterial
  if(!mat.map&&!mat.normalMap&&!mat.roughnessMap)continue
  const uv=mesh.geometry.getAttribute('uv')
  expect(uv).toBeDefined();expect(uv.count).toBe(mesh.geometry.getAttribute('position').count)
  for(let i=0;i<uv.count;i++){expect(Number.isFinite(uv.getX(i))).toBe(true);expect(Number.isFinite(uv.getY(i))).toBe(true)}
  if(mesh.name.endsWith('/ open continuous gooseneck spout'))for(let i=0;i<uv.count;i+=3){
   const area=(uv.getX(i+1)-uv.getX(i))*(uv.getY(i+2)-uv.getY(i))-(uv.getY(i+1)-uv.getY(i))*(uv.getX(i+2)-uv.getX(i))
   expect(Math.abs(area)).toBeGreaterThan(1e-10)
  }
 }}finally{m.dispose()}
})
test('kk-038-gooseneck-kettle: dimensions and finite triangles stay inside original storytelling budget',()=>{
 const m=createModel()
 try{
  const bounds=new Box3().setFromObject(m.root),size=bounds.getSize(new Vector3()).toArray(),expected=[0.26,0.22,0.15]
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
test('kk-038-gooseneck-kettle: anchors and caller resources survive rebuilding; owned resources dispose once',()=>{
 const probe=new MeshStandardMaterial();let probeDisposed=0;probe.addEventListener('dispose',()=>probeDisposed++)
 const m=createModel({materials:{ink:probe}}),anchors=Object.values(m.parts),root=m.root,attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let oldDisposed=0
 old.forEach(g=>g.addEventListener('dispose',()=>oldDisposed++))
 const mats=new Set(Object.values(m.materials).filter(m=>m!==probe)),textures=new Set<Texture>();let matDisposed=0,texDisposed=0
 mats.forEach(mat=>{mat.addEventListener('dispose',()=>matDisposed++);const standard=mat as MeshStandardMaterial;for(const t of [standard.map,standard.normalMap,standard.roughnessMap])if(t)textures.add(t)})
 textures.forEach(t=>t.addEventListener('dispose',()=>texDisposed++))
 m.configure({lid:false});expect(oldDisposed).toBe(old.size)
 expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 const copy=m.getConfig() as {lid:boolean};copy.lid=true;expect(m.getConfig().lid).toBe(false)
 m.configure({lid:true})
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
test('038 mouth and body socket are open through actual metal; handle has clearance and seated mounts',()=>{
 const m=createModel({lid:false});m.root.updateMatrixWorld(true)
 try{
  const floor=new Raycaster(new Vector3(0.001,0.3,0),new Vector3(0,-1,0)).intersectObject(m.root)[0]!
  expect(floor.point.y).toBeCloseTo(0.01,6)
  const mouth=new Raycaster(new Vector3(-0.17,0.175,0),new Vector3(1,0,0)).intersectObject(m.root)[0]!
  expect(mouth.object.name).toEndWith('/ open continuous gooseneck spout')
  expect(mouth.point.x).toBeGreaterThan(-0.13)
  const socket=new Raycaster(new Vector3(0,0.040,0),new Vector3(-1,0,0)).intersectObject(m.root)[0]!
  expect(socket.object.name).toEndWith('/ open continuous gooseneck spout');expect(socket.point.x).toBeLessThan(-0.08)
  const clearance=new Raycaster(new Vector3(0.092,0.13,0.04),new Vector3(0,0,-1)).intersectObject(m.root)
  expect(clearance.length).toBe(0)
  const body=new Box3().setFromObject(m.parts.body),wood=new Box3().setFromObject(meshes(m.parts.handle).find(o=>o.name.endsWith('/ open sculpted timber handle'))!)
  for(const mount of meshes(m.parts.handle).filter(o=>o.name.includes('handle bracket'))){
   const box=new Box3().setFromObject(mount);expect(box.intersectsBox(body)).toBe(true);expect(box.intersectsBox(wood)).toBe(true)
  }
 }finally{m.dispose()}
})
