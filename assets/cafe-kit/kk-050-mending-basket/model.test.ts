import { expect,test } from 'bun:test'
import { Box3,Group,Mesh,MeshStandardMaterial,Raycaster,Vector3,type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
const meshes=(root:Group):Mesh[]=>{const result:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)result.push(o)});return result}
test('050 spool bases rest on the basket floor and front cloth folds seat across the rim',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try{
  for(const spool of meshes(m.parts.contents).filter(o=>o.name.endsWith('/ hollow wooden thread spool'))){
   const bottom=new Box3().setFromObject(spool).min.y
   const floor=new Raycaster(new Vector3(spool.position.x,.03,spool.position.z),new Vector3(0,-1,0)).intersectObject(m.parts.basket)[0]!
   expect(bottom).toBeCloseTo(floor.point.y,6)
  }
  const fold=meshes(m.parts.cloth).find(o=>o.name.endsWith('/ seated cloth fold across rim'))!,p=fold.geometry.getAttribute('position')
  const tucked=new Vector3().fromBufferAttribute(p,9),wall=new Raycaster(new Vector3(0,tucked.y,.25),new Vector3(0,0,-1)).intersectObject(m.parts.basket)[0]!
  expect(tucked.z).toBeLessThan(wall.point.z);expect(wall.point.z-tucked.z).toBeLessThan(.009)
  m.configure({cloth:false,contents:false});expect(meshes(m.parts.cloth).length+meshes(m.parts.contents).length).toBe(0)
 }finally{m.dispose()}
})
test('050 draped cloth remains outside actual basket wall between vertices, not just at bounds',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try{
  const cloth=meshes(m.parts.cloth)[0]!,p=cloth.geometry.getAttribute('position'),index=cloth.geometry.index!
  let samples=0
  for(let i=0;i<index.count;i+=3){
   const [a,b,c]=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,index.getX(i+j)))
   for(const [u,v]of [[0,0],[1,0],[0,1],[.25,.25],[.5,.25],[.25,.5],[.5,.5]]){
    const point=a!.clone().multiplyScalar(1-u!-v!).addScaledVector(b!,u!).addScaledVector(c!,v!),direction=new Vector3(point.x,0,point.z).normalize()
    const origin=direction.clone().multiplyScalar(.25).setY(point.y)
    const hit=new Raycaster(origin,direction.clone().negate()).intersectObject(m.parts.basket)[0]
    if(!hit)continue // Top fold is above the physical rim.
    samples++
    expect(origin.distanceTo(point)).toBeLessThan(hit.distance-.0003)
   }
  }
  expect(samples).toBeGreaterThan(500)
 }finally{m.dispose()}
})
test('kk-050-mending-basket: canonical dimensions, finite UV geometry and 2000 triangle budget',()=>{
 const m=createModel()
 try{
  const box=new Box3().setFromObject(m.root),size=box.getSize(new Vector3()).toArray(),target=[0.3,0.2,0.25]
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
test('kk-050-mending-basket: stable anchors, structural options and exact resource ownership',()=>{
 const probe=new MeshStandardMaterial(),originalColor=probe.color.clone();let probeDisposals=0;probe.addEventListener('dispose',()=>probeDisposals++)
 const m=createModel({materials:{cedar:probe}}),root=m.root,anchors=Object.values(m.parts),attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let releasedOld=0;old.forEach(g=>g.addEventListener('dispose',()=>releasedOld++))
 const mats=new Set(Object.values(m.materials).filter(v=>v!==probe)),maps=new Set<Texture>();let releasedMats=0,releasedMaps=0
 for(const mat of mats){mat.addEventListener('dispose',()=>releasedMats++);const s=mat as MeshStandardMaterial;for(const t of [s.map,s.normalMap,s.roughnessMap])if(t)maps.add(t)}
 maps.forEach(t=>t.addEventListener('dispose',()=>releasedMaps++))
 m.configure({cloth:false,contents:false})
 expect(releasedOld).toBe(old.size);expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 const copy=m.getConfig() as {cloth:boolean;contents:boolean};copy.cloth=true;expect(m.getConfig().cloth).toBe(false)
 m.configure({cloth:true,contents:true})
 for(const slot of Object.keys(m.materials) as Array<keyof typeof m.materials>){m.setMaterial(slot,probe);expect(meshes(root).some(o=>o.userData.materialSlot===slot&&o.material===probe)).toBe(true)}
 m.configure({});expect(meshes(root).every(o=>o.material===probe)).toBe(true)
 const owned=new Set(meshes(root).map(o=>o.geometry));let released=0;owned.forEach(g=>g.addEventListener('dispose',()=>released++))
 m.dispose();m.dispose();m.configure({})
 expect(released).toBe(owned.size);expect(releasedMats).toBe(mats.size);expect(releasedMaps).toBe(maps.size)
 expect(probeDisposals).toBe(0);expect(probe.color.equals(originalColor)).toBe(true);probe.dispose()
})
