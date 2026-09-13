import { expect, test } from 'bun:test'
import { Box3, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3, type Texture } from 'three/webgpu'
import { createModel } from './model.ts'
import { setCafeWoodFinish } from '../kk-core/index.ts'
const meshes=(root:Group):Mesh[]=>{const out:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)out.push(o)});return out}
test('kk-022-scratching-column: canonical dimensions, finite nondegenerate triangles and 6000 budget',()=>{
 const m=createModel()
 try {
  const box=new Box3().setFromObject(m.root),actual=box.getSize(new Vector3()).toArray(),expected=[0.45,0.8,0.45]
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
test('kk-022-scratching-column: stable anchors, configuration, consumer ownership and exact-once disposal',()=>{
 const external=new MeshStandardMaterial(),slot='cedar' as const
 let externalDisposed=0;external.addEventListener('dispose',()=>externalDisposed++)
 const m=createModel({materials:{[slot]:external}}),root=m.root,anchors=Object.values(m.parts),attachment=new Group()
 anchors[0]!.add(attachment)
 const old=new Set(meshes(root).map(o=>o.geometry));let oldDisposed=0
 old.forEach(g=>g.addEventListener('dispose',()=>oldDisposed++))
 const mats=new Set(Object.values(m.materials).filter(v=>v!==external)),textures=new Set<Texture>()
 let matDisposed=0,texDisposed=0
 mats.forEach(mat=>{mat.addEventListener('dispose',()=>matDisposed++);const p=mat as MeshStandardMaterial;for(const t of [p.map,p.normalMap,p.roughnessMap])if(t)textures.add(t)})
 textures.forEach(t=>t.addEventListener('dispose',()=>texDisposed++))
 m.configure({toy:false})
 expect(m.root).toBe(root);expect(Object.values(m.parts)).toEqual(anchors);expect(attachment.parent).toBe(anchors[0]!)
 expect(oldDisposed).toBe(old.size)
 const copy=m.getConfig() as {toy:boolean};copy.toy=true;expect(m.getConfig().toy).toBe(false)
 m.setMaterial(slot,external);m.configure({toy:true})
 expect(meshes(root).filter(o=>o.userData.materialSlot===slot).every(o=>o.material===external)).toBe(true)
 const color=external.color.getHex();setCafeWoodFinish(root,{tint:'#956441'});expect(external.color.getHex()).toBe(color)
 const current=new Set(meshes(root).map(o=>o.geometry));let disposed=0
 current.forEach(g=>g.addEventListener('dispose',()=>disposed++))
 m.dispose();m.dispose();m.configure({toy:false})
 expect(disposed).toBe(current.size);expect(matDisposed).toBe(mats.size);expect(texDisposed).toBe(textures.size);expect(externalDisposed).toBe(0);external.dispose()
})
test('022 load path contacts base/collars and continuous rope stays seated on its core',()=>{
 const m=createModel();m.root.updateMatrixWorld(true)
 try {
  const all=meshes(m.root),get=(name:string)=>all.find(o=>o.name.endsWith('/ '+name))!
  const base=new Box3().setFromObject(get('heavy square timber base')),collar=new Box3().setFromObject(get('seated lower collar'))
  expect(base.intersectsBox(collar)).toBe(true)
  const core=new Box3().setFromObject(get('tapered sisal core')),crown=new Box3().setFromObject(get('timber crown'))
  expect(core.intersectsBox(collar)).toBe(true);expect(core.intersectsBox(crown)).toBe(true)
  const rope=get('continuous helical sisal wrap'),p=rope.geometry.getAttribute('position')
  // The swept rope's actual end sections sit inside collars; no exposed cut ends.
  for(const i of [0,1,2,3,4,5,6])expect(collar.containsPoint(new Vector3().fromBufferAttribute(p,i))).toBe(true)
  for(let i=p.count-7;i<p.count;i++)expect(crown.containsPoint(new Vector3().fromBufferAttribute(p,i))).toBe(true)
  expect(0.679/32-2*0.0097).toBeGreaterThan(0.001)
  for(let i=0;i<p.count;i+=5){
   const y=p.getY(i),radius=Math.hypot(p.getX(i),p.getZ(i))
   expect(radius).toBeLessThan(0.095);expect(y).toBeGreaterThan(0.082);expect(y).toBeLessThan(0.782)
  }
  const down=new Raycaster(new Vector3(0,0.9,0),new Vector3(0,-1,0)).intersectObject(m.root)[0]!
  expect(down.point.y).toBeCloseTo(0.8,6)
  m.configure({toy:false});expect(meshes(m.parts.toy).length).toBe(0)
 }finally{m.dispose()}
})
