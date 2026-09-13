import { expect,test } from 'bun:test'
import { Box3,Group,Mesh,MeshStandardMaterial,Raycaster,Vector3,type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
const meshes=(root:Group):Mesh[]=>{const out:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)out.push(o)});return out}
test('kk-035-wagashi-serving-plate: dimensions and finite triangles stay inside original storytelling budget',()=>{
 const m=createModel()
 try{
  const bounds=new Box3().setFromObject(m.root),size=bounds.getSize(new Vector3()).toArray(),expected=[0.25,0.07,0.2]
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
test('kk-035-wagashi-serving-plate: anchors and caller resources survive rebuilding; owned resources dispose once',()=>{
 const probe=new MeshStandardMaterial();let probeDisposed=0;probe.addEventListener('dispose',()=>probeDisposed++)
 const m=createModel({materials:{glaze:probe}}),anchors=Object.values(m.parts),root=m.root,attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let oldDisposed=0
 old.forEach(g=>g.addEventListener('dispose',()=>oldDisposed++))
 const mats=new Set(Object.values(m.materials).filter(m=>m!==probe)),textures=new Set<Texture>();let matDisposed=0,texDisposed=0
 mats.forEach(mat=>{mat.addEventListener('dispose',()=>matDisposed++);const standard=mat as MeshStandardMaterial;for(const t of [standard.map,standard.normalMap,standard.roughnessMap])if(t)textures.add(t)})
 textures.forEach(t=>t.addEventListener('dispose',()=>texDisposed++))
 m.configure({sweets:false});expect(oldDisposed).toBe(old.size)
 expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 const copy=m.getConfig() as {sweets:boolean};copy.sweets=true;expect(m.getConfig().sweets).toBe(false)
 m.configure({sweets:true})
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
test('035 three distinct sweets sit on the dish floor and leaf wrap follows mochi surface',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try{
  const sweets=meshes(m.parts.sweets).filter(o=>!o.name.endsWith('/ nerikiri flower centre'))
  expect(sweets.length).toBe(3)
  for(const sweet of sweets)expect(new Box3().setFromObject(sweet).min.y).toBeCloseTo(0.012,6)
  const flower=sweets.find(o=>o.name.endsWith('/ five-petal nerikiri'))!,fp=flower.geometry.getAttribute('position'),radii:number[]=[]
  for(let i=0;i<fp.count;i++)if(Math.abs(fp.getY(i))<1e-7)radii.push(Math.hypot(fp.getX(i),fp.getZ(i)))
  expect(Math.max(...radii)/Math.min(...radii)).toBeGreaterThan(2)
  const plateMeshes=meshes(m.parts.plate),faces=new Set<string>()
  expect(plateMeshes.find(o=>o.userData.materialSlot==='indigo')!.geometry.index!.count).toBeGreaterThan(0)
  for(const mesh of plateMeshes){const index=mesh.geometry.index!;for(let i=0;i<index.count;i+=3){
   const key=[index.getX(i),index.getX(i+1),index.getX(i+2)].sort((a,b)=>a-b).join(',')
   expect(faces.has(key)).toBe(false);faces.add(key)
  }}
  const leaf=meshes(m.parts.leaf)[0]!,p=leaf.geometry.getAttribute('position')
  for(let i=0;i<p.count;i++){
   const radius=Math.sqrt((p.getX(i)/0.027)**2+(p.getY(i)/0.024)**2+(p.getZ(i)/0.027)**2)
   expect(radius).toBeGreaterThan(1.02);expect(radius).toBeLessThan(1.04)
  }
  m.configure({sweets:false});m.root.updateMatrixWorld(true)
  const floor=new Raycaster(new Vector3(0.001,0.1,0),new Vector3(0,-1,0)).intersectObject(m.root)[0]!
  expect(floor.point.y).toBeCloseTo(0.012,6)
  const p2=meshes(m.parts.plate)[0]!.geometry.getAttribute('position')
  expect(Array.from({length:p2.count},(_,i)=>p2.getY(i)).some(y=>y>0.02)).toBe(true)
 }finally{m.dispose()}
})
