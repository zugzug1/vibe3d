import { expect,test } from 'bun:test'
import { Box3,Group,Mesh,MeshStandardMaterial,Raycaster,Vector3,type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
const meshes=(root:Group):Mesh[]=>{const result:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)result.push(o)});return result}
test('046 inward-facing cloth, seated toys and attached feathers',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try{
  const lining=meshes(m.parts.liner)[0]!
  for(const a of [0,.8,1.7,2.6,3.7,4.6]){
   const ray=new Raycaster(new Vector3(0,.06,0),new Vector3(Math.sin(a),0,Math.cos(a)))
   const cloth=ray.intersectObject(m.parts.liner)[0]!,wood=ray.intersectObject(m.parts.basket)[0]!
   expect(cloth.object).toBe(lining);expect(cloth.distance).toBeLessThan(wood.distance)
  }
  for(const name of ['tapered cloth mouse','tapered cloth fish with tail','soft oval play ball']){
   const toy=meshes(m.parts.toys).find(o=>o.name.endsWith('/ '+name))!
   expect(new Box3().setFromObject(toy).min.y).toBeCloseTo(.013,6)
  }
  const ferrule=meshes(m.parts.wand).find(o=>o.name.endsWith('/ seated feather ferrule'))!
  const ferruleBox=new Box3().setFromObject(ferrule)
  for(const feather of meshes(m.parts.wand).filter(o=>o.name.endsWith('/ shaped attached feather'))){
   const start=new Vector3().fromBufferAttribute(feather.geometry.getAttribute('position'),1).applyMatrix4(feather.matrixWorld)
   expect(ferruleBox.containsPoint(start)).toBe(true)
  }
  m.configure({toys:false,wand:false});expect(meshes(m.parts.toys).length+meshes(m.parts.wand).length).toBe(0)
 }finally{m.dispose()}
})
test('kk-046-cat-toy-basket: canonical dimensions, finite UV geometry and 2000 triangle budget',()=>{
 const m=createModel()
 try{
  const box=new Box3().setFromObject(m.root),size=box.getSize(new Vector3()).toArray(),target=[0.3,0.35,0.25]
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
test('kk-046-cat-toy-basket: stable anchors, structural options and exact resource ownership',()=>{
 const probe=new MeshStandardMaterial(),originalColor=probe.color.clone();let probeDisposals=0;probe.addEventListener('dispose',()=>probeDisposals++)
 const m=createModel({materials:{cedar:probe}}),root=m.root,anchors=Object.values(m.parts),attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let releasedOld=0;old.forEach(g=>g.addEventListener('dispose',()=>releasedOld++))
 const mats=new Set(Object.values(m.materials).filter(v=>v!==probe)),maps=new Set<Texture>();let releasedMats=0,releasedMaps=0
 for(const mat of mats){mat.addEventListener('dispose',()=>releasedMats++);const s=mat as MeshStandardMaterial;for(const t of [s.map,s.normalMap,s.roughnessMap])if(t)maps.add(t)}
 maps.forEach(t=>t.addEventListener('dispose',()=>releasedMaps++))
 m.configure({toys:false,wand:false})
 expect(releasedOld).toBe(old.size);expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 const copy=m.getConfig() as {toys:boolean;wand:boolean};copy.toys=true;expect(m.getConfig().toys).toBe(false)
 m.configure({toys:true,wand:true})
 for(const slot of Object.keys(m.materials) as Array<keyof typeof m.materials>){m.setMaterial(slot,probe);expect(meshes(root).some(o=>o.userData.materialSlot===slot&&o.material===probe)).toBe(true)}
 m.configure({});expect(meshes(root).every(o=>o.material===probe)).toBe(true)
 const owned=new Set(meshes(root).map(o=>o.geometry));let released=0;owned.forEach(g=>g.addEventListener('dispose',()=>released++))
 m.dispose();m.dispose();m.configure({})
 expect(released).toBe(owned.size);expect(releasedMats).toBe(mats.size);expect(releasedMaps).toBe(maps.size)
 expect(probeDisposals).toBe(0);expect(probe.color.equals(originalColor)).toBe(true);probe.dispose()
})
