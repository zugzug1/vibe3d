import { expect,test } from 'bun:test'
import { Box3,Group,Mesh,MeshStandardMaterial,Raycaster,Vector3,type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
const meshes=(root:Group):Mesh[]=>{const out:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)out.push(o)});return out}
test('kk-031-matcha-whisk-and-holder: dimensions and finite triangles stay inside original storytelling budget',()=>{
 const m=createModel()
 try{
  const bounds=new Box3().setFromObject(m.root),size=bounds.getSize(new Vector3()).toArray(),expected=[0.1,0.14,0.1]
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
test('kk-031-matcha-whisk-and-holder: anchors and caller resources survive rebuilding; owned resources dispose once',()=>{
 const probe=new MeshStandardMaterial();let probeDisposed=0;probe.addEventListener('dispose',()=>probeDisposed++)
 const m=createModel({materials:{glazeMoss:probe}}),anchors=Object.values(m.parts),root=m.root,attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let oldDisposed=0
 old.forEach(g=>g.addEventListener('dispose',()=>oldDisposed++))
 const mats=new Set(Object.values(m.materials).filter(m=>m!==probe)),textures=new Set<Texture>();let matDisposed=0,texDisposed=0
 mats.forEach(mat=>{mat.addEventListener('dispose',()=>matDisposed++);const standard=mat as MeshStandardMaterial;for(const t of [standard.map,standard.normalMap,standard.roughnessMap])if(t)textures.add(t)})
 textures.forEach(t=>t.addEventListener('dispose',()=>texDisposed++))
 m.configure({whisk:false});expect(oldDisposed).toBe(old.size)
 expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 const copy=m.getConfig() as {whisk:boolean};copy.whisk=true;expect(m.getConfig().whisk).toBe(false)
 m.configure({whisk:true})
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
test('031 tine tips seat on the holder floor; removable whisk exposes a genuine cavity',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try{
  const tines=meshes(m.parts.whisk).filter(o=>o.name.endsWith('/ seated curved bamboo tine'));expect(tines.length).toBe(32)
  for(const tine of tines){
   const bounds=new Box3().setFromObject(tine);expect(bounds.min.y).toBeLessThan(0.013)
   const p=tine.geometry.getAttribute('position')
   for(let i=0;i<p.count;i++)if(p.getY(i)<0.055)expect(Math.hypot(p.getX(i),p.getZ(i))).toBeLessThan(0.036)
  }
  const handle=new Raycaster(new Vector3(0.001,0.18,0),new Vector3(0,-1,0)).intersectObject(m.parts.whisk)[0]!
  expect(handle.point.y).toBeCloseTo(0.113,6)
  m.configure({whisk:false});m.root.updateMatrixWorld(true);expect(meshes(m.parts.whisk).length).toBe(0)
  const floor=new Raycaster(new Vector3(0.001,0.15,0),new Vector3(0,-1,0)).intersectObject(m.root)[0]!
  expect(floor.point.y).toBeCloseTo(0.013,6)
 }finally{m.dispose()}
})

