import { expect,test } from 'bun:test'
import { Box3,Group,Mesh,MeshStandardMaterial,Raycaster,Vector3,type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
const meshes=(root:Group):Mesh[]=>{const result:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)result.push(o)});return result}
test('045 hollow vase, attached petioles and non-overturned lobed leaf surfaces',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try{
  const floor=new Raycaster(new Vector3(.010,.3,0),new Vector3(0,-1,0)).intersectObject(m.parts.vessel)[0]!
  expect(floor.point.y).toBeCloseTo(.012,6)
  expect(new Box3().setFromObject(m.parts.branch).min.y).toBeCloseTo(.012,5)
  const branches=meshes(m.parts.branch)
  for(const leaf of meshes(m.parts.leaves)){
   const p=leaf.geometry.getAttribute('position'),base=new Vector3().fromBufferAttribute(p,0)
   let contact=Infinity
   for(const branch of branches){
    branch.geometry.computeBoundingBox();const half=(branch.geometry.boundingBox!.max.y-branch.geometry.boundingBox!.min.y)/2
    for(const sign of [-1,1])contact=Math.min(contact,base.distanceTo(new Vector3(0,sign*half,0).applyMatrix4(branch.matrixWorld)))
   }
   expect(contact).toBeLessThan(.00001)
   const normal=new Vector3().fromBufferAttribute(p,0).sub(new Vector3().fromBufferAttribute(p,28)).normalize(),index=leaf.geometry.index!
   const signs:number[]=[]
   for(let j=0;j<26;j++){
    const [a,b,c]=[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,index.getX(j*3+k)))
    signs.push(Math.sign(b!.sub(a!).cross(c!.sub(a!)).dot(normal)))
   }
   expect(new Set(signs).size).toBe(1);expect(signs[0]).not.toBe(0)
  }
  m.configure({branch:false});expect(meshes(m.parts.branch).length+meshes(m.parts.leaves).length).toBe(0)
 }finally{m.dispose()}
})
test('kk-045-maple-branch-vase: canonical dimensions, finite UV geometry and 2000 triangle budget',()=>{
 const m=createModel()
 try{
  const box=new Box3().setFromObject(m.root),size=box.getSize(new Vector3()).toArray(),target=[0.25,0.55,0.25]
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
test('kk-045-maple-branch-vase: stable anchors, structural options and exact resource ownership',()=>{
 const probe=new MeshStandardMaterial(),originalColor=probe.color.clone();let probeDisposals=0;probe.addEventListener('dispose',()=>probeDisposals++)
 const m=createModel({materials:{glaze:probe}}),root=m.root,anchors=Object.values(m.parts),attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let releasedOld=0;old.forEach(g=>g.addEventListener('dispose',()=>releasedOld++))
 const mats=new Set(Object.values(m.materials).filter(v=>v!==probe)),maps=new Set<Texture>();let releasedMats=0,releasedMaps=0
 for(const mat of mats){mat.addEventListener('dispose',()=>releasedMats++);const s=mat as MeshStandardMaterial;for(const t of [s.map,s.normalMap,s.roughnessMap])if(t)maps.add(t)}
 maps.forEach(t=>t.addEventListener('dispose',()=>releasedMaps++))
 m.configure({branch:false})
 expect(releasedOld).toBe(old.size);expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 const copy=m.getConfig() as {branch:boolean};copy.branch=true;expect(m.getConfig().branch).toBe(false)
 m.configure({branch:true})
 for(const slot of Object.keys(m.materials) as Array<keyof typeof m.materials>){m.setMaterial(slot,probe);expect(meshes(root).some(o=>o.userData.materialSlot===slot&&o.material===probe)).toBe(true)}
 m.configure({});expect(meshes(root).every(o=>o.material===probe)).toBe(true)
 const owned=new Set(meshes(root).map(o=>o.geometry));let released=0;owned.forEach(g=>g.addEventListener('dispose',()=>released++))
 m.dispose();m.dispose();m.configure({})
 expect(released).toBe(owned.size);expect(releasedMats).toBe(mats.size);expect(releasedMaps).toBe(maps.size)
 expect(probeDisposals).toBe(0);expect(probe.color.equals(originalColor)).toBe(true);probe.dispose()
})
