import { expect,test } from 'bun:test'
import { Box3,Group,Mesh,MeshStandardMaterial,Raycaster,Vector3,type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
const meshes=(root:Group):Mesh[]=>{const result:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)result.push(o)});return result}
test('044 genuine open underside, closed loop and seated striker/cord',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try{
  const loop=meshes(m.parts.suspension).find(o=>o.name.endsWith('/ closed hanging cord loop'))!,p=loop.geometry.getAttribute('position')
  for(let j=0;j<7;j++)expect(new Vector3().fromBufferAttribute(p,j).distanceTo(new Vector3().fromBufferAttribute(p,24*7+j))).toBeLessThan(1e-7)
  const cavity=new Raycaster(new Vector3(.020,.19,0),new Vector3(0,1,0)).intersectObject(m.parts.shell)[0]!
  expect(cavity.point.y).toBeGreaterThan(.28)
  const striker=meshes(m.parts.clapper).find(o=>o.name.endsWith('/ ceramic striker'))!,cord=meshes(m.parts.clapper).find(o=>o.name.endsWith('/ continuous clapper cord'))!
  expect(new Box3().setFromObject(striker).min.y).toBeCloseTo(.195,6)
  expect(new Box3().setFromObject(striker).intersectsBox(new Box3().setFromObject(cord))).toBe(true)
  const hit=new Raycaster(new Vector3(0,.19,0),new Vector3(0,1,0)).intersectObject(striker)[0]!
  expect(hit.point.y).toBeCloseTo(.195,6)
  const bead=meshes(m.parts.suspension).find(o=>o.name.endsWith('/ seated upper ceramic bead'))!,stem=meshes(m.parts.suspension).find(o=>o.name.endsWith('/ seated suspension stem'))!
  expect(new Box3().setFromObject(bead).intersectsBox(new Box3().setFromObject(stem))).toBe(true)
  expect(new Box3().setFromObject(loop).intersectsBox(new Box3().setFromObject(stem))).toBe(true)
  const paper=meshes(m.parts.paper)[0]!
  expect(new Raycaster(new Vector3(.000015,.171,.02),new Vector3(0,0,-1)).intersectObject(paper).length).toBe(0)
  m.configure({paper:false});expect(meshes(m.parts.paper).length).toBe(0)
 }finally{m.dispose()}
})
test('kk-044-ceramic-wind-bell: canonical dimensions, finite UV geometry and 2000 triangle budget',()=>{
 const m=createModel()
 try{
  const box=new Box3().setFromObject(m.root),size=box.getSize(new Vector3()).toArray(),target=[0.09,0.4,0.09]
  for(let i=0;i<3;i++)expect(Math.abs(size[i]!-target[i]!)).toBeLessThan(.0001)
  expect(box.min.y).toBeCloseTo(0,6);expect(m.root.userData.category).toBe('storytelling')
  let triangles=0
  for(const mesh of meshes(m.root)){
   const g=mesh.geometry,p=g.getAttribute('position'),uv=g.getAttribute('uv'),normal=g.getAttribute('normal'),index=g.index,count=index?.count??p.count
   triangles+=count/3;expect(uv.count).toBe(p.count);expect(normal.count).toBe(p.count)
   for(let i=0;i<p.count;i++){expect([p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i),normal.getX(i),normal.getY(i),normal.getZ(i)].every(Number.isFinite)).toBe(true)}
   for(let i=0;i<count;i+=3){const [a,b,c]=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j));expect(b!.sub(a!).cross(c!.sub(a!)).lengthSq()).toBeGreaterThan(1e-22)}
  }
  expect(triangles).toBeLessThanOrEqual(2000)
 }finally{m.dispose()}
})
test('kk-044-ceramic-wind-bell: stable anchors, structural options and exact resource ownership',()=>{
 const probe=new MeshStandardMaterial(),originalColor=probe.color.clone();let probeDisposals=0;probe.addEventListener('dispose',()=>probeDisposals++)
 const m=createModel({materials:{glaze:probe}}),root=m.root,anchors=Object.values(m.parts),attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let releasedOld=0;old.forEach(g=>g.addEventListener('dispose',()=>releasedOld++))
 const mats=new Set(Object.values(m.materials).filter(v=>v!==probe)),maps=new Set<Texture>();let releasedMats=0,releasedMaps=0
 for(const mat of mats){mat.addEventListener('dispose',()=>releasedMats++);const s=mat as MeshStandardMaterial;for(const t of [s.map,s.normalMap,s.roughnessMap])if(t)maps.add(t)}
 maps.forEach(t=>t.addEventListener('dispose',()=>releasedMaps++))
 m.configure({paper:false})
 expect(releasedOld).toBe(old.size);expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 const copy=m.getConfig() as {paper:boolean};copy.paper=true;expect(m.getConfig().paper).toBe(false)
 m.configure({paper:true})
 for(const slot of Object.keys(m.materials) as Array<keyof typeof m.materials>){m.setMaterial(slot,probe);expect(meshes(root).some(o=>o.userData.materialSlot===slot&&o.material===probe)).toBe(true)}
 m.configure({});expect(meshes(root).every(o=>o.material===probe)).toBe(true)
 const owned=new Set(meshes(root).map(o=>o.geometry));let released=0;owned.forEach(g=>g.addEventListener('dispose',()=>released++))
 m.dispose();m.dispose();m.configure({})
 expect(released).toBe(owned.size);expect(releasedMats).toBe(mats.size);expect(releasedMaps).toBe(maps.size)
 expect(probeDisposals).toBe(0);expect(probe.color.equals(originalColor)).toBe(true);probe.dispose()
})
