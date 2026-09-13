import { expect, test } from 'bun:test'
import { Box3, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3, type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
import { setCafeWoodFinish } from '../kk-core/index.ts'
const meshes=(root:Group):Mesh[]=>{const out:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)out.push(o)});return out}
test('kk-019-ceramic-umbrella-stand: canonical dimensions, finite nondegenerate triangles and 6000 budget',()=>{
 const m=createModel()
 try {
  const box=new Box3().setFromObject(m.root),actual=box.getSize(new Vector3()).toArray(),expected=[0.25,0.5,0.25]
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
test('kk-019-ceramic-umbrella-stand: stable anchors, configuration, consumer ownership and exact-once disposal',()=>{
 const external=new MeshStandardMaterial(),slot='glazeMoss' as const
 let externalDisposed=0;external.addEventListener('dispose',()=>externalDisposed++)
 const m=createModel({materials:{[slot]:external}}),root=m.root,anchors=Object.values(m.parts),attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let oldDisposed=0
 old.forEach(g=>g.addEventListener('dispose',()=>oldDisposed++))
 const mats=new Set(Object.values(m.materials).filter(v=>v!==external)),textures=new Set<Texture>()
 let matDisposed=0,texDisposed=0
 mats.forEach(mat=>{mat.addEventListener('dispose',()=>matDisposed++);const p=mat as MeshStandardMaterial;for(const t of [p.map,p.normalMap,p.roughnessMap])if(t)textures.add(t)})
 textures.forEach(t=>t.addEventListener('dispose',()=>texDisposed++))
 m.configure({ribbed:false})
 expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 expect(oldDisposed).toBe(old.size)
 const copy=m.getConfig() as {ribbed:boolean};copy.ribbed=true;expect(m.getConfig().ribbed).toBe(false)
 m.setMaterial(slot,external);m.configure({ribbed:true})
 expect(meshes(root).filter(o=>o.userData.materialSlot===slot).every(o=>o.material===external)).toBe(true)
 const color=external.color.getHex();setCafeWoodFinish(root,{tint:'#956441'});expect(external.color.getHex()).toBe(color)
 const current=new Set(meshes(root).map(o=>o.geometry));let disposed=0
 current.forEach(g=>g.addEventListener('dispose',()=>disposed++))
 m.dispose();m.dispose();m.configure({ribbed:false})
 expect(disposed).toBe(current.size);expect(matDisposed).toBe(mats.size);expect(texDisposed).toBe(textures.size);expect(externalDisposed).toBe(0);external.dispose()
})
test('019 hollow mouth sees recessed floor and exterior ribs are integral to wall',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try {
  const down=new Raycaster(new Vector3(0.001,0.6,0.001),new Vector3(0,-1,0)).intersectObject(m.root)[0]!
  expect(down.point.y).toBeCloseTo(0.026,6)
  const side=new Raycaster(new Vector3(0.2,0.2,0),new Vector3(-1,0,0)).intersectObject(m.root)[0]!
  expect(side.point.x).toBeGreaterThan(0.12);expect(side.point.x).toBeLessThan(0.125)
  m.configure({ribbed:false});m.root.updateMatrixWorld(true)
  const plain=new Raycaster(new Vector3(0.2,0.2,0),new Vector3(-1,0,0)).intersectObject(m.root)[0]!
  expect(side.point.x-plain.point.x).toBeCloseTo(0.006,5)
 }finally{m.dispose()}
})
