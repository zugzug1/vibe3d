import { expect, test } from 'bun:test'
import { Box3, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3, type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
import { setCafeWoodFinish } from '../kk-core/index.ts'
const meshes=(root:Group):Mesh[]=>{const out:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)out.push(o)});return out}
test('kk-029-garden-planter: canonical dimensions, finite nondegenerate triangles and 6000 budget',()=>{
 const m=createModel()
 try {
  const box=new Box3().setFromObject(m.root),actual=box.getSize(new Vector3()).toArray(),expected=[0.7,0.45,0.3]
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
test('kk-029-garden-planter: stable anchors, configuration, consumer ownership and exact-once disposal',()=>{
 const external=new MeshStandardMaterial(),slot='glaze' as const
 let externalDisposed=0;external.addEventListener('dispose',()=>externalDisposed++)
 const m=createModel({materials:{[slot]:external}}),root=m.root,anchors=Object.values(m.parts),attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let oldDisposed=0
 old.forEach(g=>g.addEventListener('dispose',()=>oldDisposed++))
 const mats=new Set(Object.values(m.materials).filter(v=>v!==external)),textures=new Set<Texture>()
 let matDisposed=0,texDisposed=0
 mats.forEach(mat=>{mat.addEventListener('dispose',()=>matDisposed++);const p=mat as MeshStandardMaterial;for(const t of [p.map,p.normalMap,p.roughnessMap])if(t)textures.add(t)})
 textures.forEach(t=>t.addEventListener('dispose',()=>texDisposed++))
 m.configure({soil:false,plants:false})
 expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 expect(oldDisposed).toBe(old.size)
 const copy=m.getConfig() as {soil:boolean};copy.soil=true;expect(m.getConfig().soil).toBe(false)
 m.setMaterial(slot,external);m.configure({soil:true,plants:true})
 expect(meshes(root).filter(o=>o.userData.materialSlot===slot).every(o=>o.material===external)).toBe(true)
 const color=external.color.getHex();setCafeWoodFinish(root,{tint:'#956441'});expect(external.color.getHex()).toBe(color)
 const current=new Set(meshes(root).map(o=>o.geometry));let disposed=0
 current.forEach(g=>g.addEventListener('dispose',()=>disposed++))
 m.dispose();m.dispose();m.configure({soil:false})
 expect(disposed).toBe(current.size);expect(matDisposed).toBe(mats.size);expect(texDisposed).toBe(textures.size);expect(externalDisposed).toBe(0);external.dispose()
})
test('029 trough has a real cavity and supported soil/roots; foliage is removable',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try{
  const soil=new Box3().setFromObject(m.parts.soil)
  const floor=meshes(m.parts.vessel).find(o=>o.name.endsWith('/ seated vessel floor'))!
  expect(soil.min.y).toBeLessThan(new Box3().setFromObject(floor).max.y)
  const roots=meshes(m.parts.plants).filter(o=>o.name.endsWith('/ rooted branch'))
  for(const root of roots)expect(new Box3().setFromObject(root).min.y).toBeLessThan(soil.max.y)
  const leaves=meshes(m.parts.plants).filter(o=>o.name.endsWith('/ attached broad shrub leaf'))
  const petioles=meshes(m.parts.plants).filter(o=>o.name.endsWith('/ leaf petiole'))
  expect(leaves.length).toBe(18);expect(petioles.length).toBe(leaves.length)
  for(let i=0;i<leaves.length;i++){
   const start=new Vector3().fromBufferAttribute(leaves[i]!.geometry.getAttribute('position'),0).applyMatrix4(leaves[i]!.matrixWorld)
   const p=petioles[i]!.geometry.getAttribute('position')
   let nearest=Infinity
   for(let j=0;j<p.count;j++)nearest=Math.min(nearest,start.distanceTo(new Vector3().fromBufferAttribute(p,j).applyMatrix4(petioles[i]!.matrixWorld)))
   expect(nearest).toBeLessThan(1e-6)
  }
  const stones=meshes(m.parts.soil).filter(o=>o.name.endsWith('/ partly embedded garden stone'))
  expect(stones.length).toBe(4)
  for(const stone of stones){const b=new Box3().setFromObject(stone);expect(b.min.y).toBeLessThan(0.1515);expect(b.max.y).toBeGreaterThan(0.1515)}
  const paint=meshes(m.parts.vessel).find(o=>o.name.endsWith('/ blue fired mountain silhouette'))!
  const p=paint.geometry.getAttribute('position')
  for(let i=0;i<p.count;i++){
   const host=0.15*(0.93+0.07*(p.getY(i)-0.032)/0.168)
   expect(p.getZ(i)-host).toBeGreaterThan(0.0001);expect(p.getZ(i)-host).toBeLessThan(0.0006)
  }
  m.configure({soil:false,plants:false});m.root.updateMatrixWorld(true)
  const hit=new Raycaster(new Vector3(0,0.5,0),new Vector3(0,-1,0)).intersectObject(m.root)[0]!
  expect(hit.object.name).toEndWith('/ seated vessel floor');expect(hit.point.y).toBeCloseTo(0.0495,6)
  for(const x of [-0.30,0.30]) {
   const edge=new Raycaster(new Vector3(x,0.5,0),new Vector3(0,-1,0)).intersectObject(m.root)[0]!
   expect(edge.point.y).toBeCloseTo(0.0495,6)
  }
  expect(meshes(m.parts.plants).length).toBe(0)
 }finally{m.dispose()}
})
