import { expect, test } from 'bun:test'
import { Box3, BufferGeometry, Group, Material, Mesh, MeshStandardMaterial, Raycaster, Texture, Vector3 } from 'three/webgpu'
import * as radio from './model.ts'
import * as grooming from '../kk-047-grooming-box/model.ts'
import * as stamp from '../kk-048-loyalty-stamp-kit/model.ts'
import * as map from '../kk-049-neighborhood-map-frame/model.ts'
import { setCafeWoodFinish } from '../kk-core/materials.ts'
const meshes=(root:Group):Mesh[]=>{const result:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)result.push(o)});return result}
const named=(root:Group,name:string):Mesh=>meshes(root).find(o=>o.name.endsWith('/ '+name))!
const bounds=(o:Mesh)=>new Box3().setFromObject(o)
for(const [id,module,dimensions,slot] of [
  ['kk-043',radio,[.25,.15,.1],'glaze'],['kk-047',grooming,[.3,.2,.2],'cedar'],
  ['kk-048',stamp,[.2,.08,.15],'cedar'],['kk-049',map,[.45,.35,.03],'cedar'],
] as const){
  test(id+' exact default dimensions, all structural corners, finite outward triangles and 2000 budget',()=>{
    const m=module.createModel();m.root.updateMatrixWorld(true)
    new Box3().setFromObject(m.root).getSize(new Vector3()).toArray().forEach((n,i)=>expect(n).toBeCloseTo(dimensions[i]!,6))
    const controls=Object.entries(module.structureControls)
    for(let corner=-1;corner<2**controls.length;corner++){
      if(corner>=0)m.configure(Object.fromEntries(controls.map(([key,c],i)=>[key,c[corner&(1<<i)?'max':'min']])))
      m.root.updateMatrixWorld(true);expect(new Box3().setFromObject(m.root).min.y).toBeCloseTo(0,6)
      let triangles=0
      for(const mesh of meshes(m.root)){
        expect(mesh.scale.toArray()).toEqual([1,1,1]);expect(mesh.name.startsWith(id)).toBe(true)
        const g=mesh.geometry,p=g.getAttribute('position'),idx=g.index,count=idx?.count??p.count;triangles+=count/3
        for(const key of ['position','normal','uv'])for(const value of g.getAttribute(key).array)expect(Number.isFinite(value)).toBe(true)
        let volume=0
        for(let i=0;i<count;i+=3){
          const [a,b,c]=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j)) as [Vector3,Vector3,Vector3]
          expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-22);volume+=a.dot(b.clone().cross(c))/6
        }expect(volume).toBeGreaterThan(0)
      }expect(triangles).toBeLessThanOrEqual(2000)
    }m.dispose()
  })
  test(id+' atomic validation, bounded options and undefined preservation',()=>{
    const m=module.createModel(),before=m.getConfig(),first=meshes(m.root)[0],controls=Object.entries(module.structureControls)
    for(const [key] of controls)for(const value of [NaN,Infinity,-Infinity,null,'3']){
      const patch={[controls[0]![0]]:controls[0]![1].min,[key]:value}
      expect(()=>m.configure(patch as never)).toThrow();expect(()=>module.createModel(patch as never)).toThrow()
      expect(m.getConfig()).toEqual(before);expect(meshes(m.root)[0]).toBe(first)
    }
    for(const mode of ['min','max'] as const){
      m.configure(Object.fromEntries(controls.map(([key])=>[key,mode==='min'?-999:999])))
      expect(m.getConfig()).toEqual(Object.fromEntries(controls.map(([key,c])=>[key,c[mode]])))
      const c=m.getConfig();m.configure(Object.fromEntries(controls.map(([key])=>[key,undefined])));expect(m.getConfig()).toEqual(c)
    }m.dispose()
  })
  test(id+' transforms/anchors survive rebuilds; materials are isolated and all resources dispose once',()=>{
    const texture=new Texture(),supplied=new MeshStandardMaterial({map:texture}),replacement=new MeshStandardMaterial()
    const count=new Map<object,number>(),old=[BufferGeometry.prototype.dispose,Material.prototype.dispose,Texture.prototype.dispose] as const
    BufferGeometry.prototype.dispose=function(){count.set(this,(count.get(this)??0)+1);old[0].call(this)}
    Material.prototype.dispose=function(){count.set(this,(count.get(this)??0)+1);old[1].call(this)}
    Texture.prototype.dispose=function(){count.set(this,(count.get(this)??0)+1);old[2].call(this)}
    try {
      const m=module.createModel({materials:{[slot]:supplied}}),root=m.root,observed=new Set<object>()
      root.position.set(2,1,-3);root.rotation.set(.1,.7,.2);root.scale.set(1.1,.9,1.2);root.updateMatrixWorld(true)
      const transform=root.matrixWorld.clone(),anchors=Object.values(m.parts),children=anchors.map(a=>{const child=new Group();a.add(child);return child})
      const collect=()=>{for(const mesh of meshes(root)){observed.add(mesh.geometry);const mat=mesh.material as MeshStandardMaterial;if(mat!==supplied&&mat!==replacement){observed.add(mat);for(const t of [mat.map,mat.normalMap,mat.roughnessMap])if(t)observed.add(t)}}}
      expect(Object.keys(m.materials).sort()).toEqual([...new Set(meshes(root).map(o=>o.userData.materialSlot))].sort())
      collect();const originalColor=supplied.color.clone()
      setCafeWoodFinish(root,{tint:'#b4754d',roughness:.62});expect(supplied.color.equals(originalColor)).toBe(true)
      for(const mode of ['min','max','default'] as const){
        m.configure(Object.fromEntries(Object.entries(module.structureControls).map(([key,c])=>[key,c[mode]])))
        collect();root.updateMatrixWorld(true);expect(root.matrixWorld.equals(transform)).toBe(true)
        anchors.forEach((a,i)=>expect(children[i]!.parent).toBe(a))
        for(const mesh of meshes(root).filter(o=>o.userData.materialSlot===slot))expect(mesh.material).toBe(supplied)
      }
      // Exercise every ACTIVE slot, rather than merely checking the exported material dictionary.
      for(const active of new Set(meshes(root).map(o=>o.userData.materialSlot as string))){
        m.setMaterial(active as never,replacement);m.configure({});collect()
        for(const mesh of meshes(root).filter(o=>o.userData.materialSlot===active))expect(mesh.material).toBe(replacement)
      }
      m.dispose();m.dispose();for(const object of observed)expect(count.get(object)).toBe(1)
      for(const object of [texture,supplied,replacement])expect(count.has(object)).toBe(false)
      for(const n of count.values())expect(n).toBe(1)
      const config=m.getConfig();m.configure({});expect(m.getConfig()).toEqual(config)
    }finally{
      BufferGeometry.prototype.dispose=old[0];Material.prototype.dispose=old[1];Texture.prototype.dispose=old[2]
      supplied.dispose();replacement.dispose();texture.dispose()
    }
  })
}
test('kk-043 grille has recessed apertures, handle clearance, and seated telescopic antenna',()=>{
  const m=radio.createModel(),ray=new Raycaster()
  for(const antennaExtension of [.45,1]){
    m.configure({antennaExtension});m.root.updateMatrixWorld(true)
    ray.set(new Vector3(-.04,.022,.1),new Vector3(0,0,-1))
    expect(ray.intersectObject(named(m.root,'pierced ivory fascia'))).toHaveLength(0)
    const back=ray.intersectObject(named(m.root,'rounded charcoal cabinet'))[0]!
    expect(back.point.z).toBeLessThan(.036)
    ray.set(new Vector3(0,.112,.1),new Vector3(0,0,-1))
    expect(ray.intersectObject(m.parts.handle,true)).toHaveLength(0)
    const sections=meshes(m.root).filter(o=>o.name.endsWith('/ telescoping aerial section'))
    expect(bounds(sections[0]!).intersectsBox(bounds(named(m.root,'antenna ball socket')))).toBe(true)
    for(let i=1;i<sections.length;i++)expect(bounds(sections[i]!).intersectsBox(bounds(sections[i-1]!))).toBe(true)
  }m.dispose()
})
test('kk-047 carrying dowel, liner, shaped brush and open-ended comb have actual support',()=>{
  const m=grooming.createModel(),ray=new Raycaster()
  for(const handleHeight of [.17,.2,.23])for(const combLean of [0,12]){
    m.configure({handleHeight,combLean});m.root.updateMatrixWorld(true)
    const liner=bounds(named(m.root,'fitted cloth liner')),brush=bounds(named(m.root,'continuous paddle brush'))
    expect(brush.min.y).toBeCloseTo(liner.max.y,6)
    for(const cheek of meshes(m.root).filter(o=>o.name.endsWith('/ shaped handle end board')))
      expect(bounds(cheek).intersectsBox(bounds(named(m.root,'through-seated carrying dowel')))).toBe(true)
    for(const bristle of meshes(m.root).filter(o=>o.name.endsWith('/ seated bristle bundle'))){
      const centre=bounds(bristle).getCenter(new Vector3())
      ray.set(new Vector3(centre.x,.13,centre.z),new Vector3(0,-1,0))
      const hit=ray.intersectObject(named(m.root,'continuous oval bristle bed'))[0]
      expect(hit).toBeDefined();expect(bounds(bristle).min.y).toBeLessThan(hit!.point.y)
    }
    const comb=named(m.root,'open-ended comb')
    // Tooth gap runs all the way to the free left edge; test in comb local coordinates.
    const origin=comb.localToWorld(new Vector3(-.01,.010,.01)),end=comb.localToWorld(new Vector3(-.01,.010,-.01))
    ray.set(origin,end.sub(origin).normalize());expect(ray.intersectObject(comb)).toHaveLength(0)
    expect(bounds(comb).min.y).toBeLessThanOrEqual(liner.max.y+.00001)
  }m.dispose()
})
test('kk-048 stamp seats on its die, lid pivots at hinges, and cards retain physical layering',()=>{
  const m=stamp.createModel()
  for(const stampHeight of [.065,.08,.09])for(const lidAngle of [0,105,110]){
    m.configure({stampHeight,lidAngle});m.root.updateMatrixWorld(true)
    expect(bounds(named(m.root,'turned stamp grip')).min.y).toBeCloseTo(bounds(named(m.root,'bevelled stamp block')).max.y,6)
    expect(bounds(named(m.root,'bevelled stamp block')).min.y).toBeCloseTo(bounds(named(m.root,'rubber stamping die')).max.y,6)
    expect(m.parts.lid.position.toArray()).toEqual([.05,.016,-.0525])
    for(const hinge of meshes(m.root).filter(o=>o.name.endsWith('/ seated lid hinge')))expect(bounds(hinge).intersectsBox(bounds(named(m.root,'hinged tin lid')))).toBe(true)
    const cards=meshes(m.root).filter(o=>o.name.endsWith('/ blank loyalty card'))
    expect(cards).toHaveLength(7)
    for(let i=1;i<cards.length;i++)expect(bounds(cards[i]!).min.y).toBeCloseTo(bounds(cards[i-1]!).max.y,7)
  }m.dispose()
})
test('kk-049 printed features follow real folded paper, with clamped frame edges',()=>{
  const m=map.createModel(),ray=new Raycaster()
  for(const foldDepth of [.0005,.0015,.003]){
    m.configure({foldDepth});m.root.updateMatrixWorld(true)
    const paper=named(m.root,'folded street-plan sheet')
    for(const x of [-.1485,-.099,-.0495,0,.0495,.099,.1485]){
      ray.set(new Vector3(x,.15,.03),new Vector3(0,0,-1))
      const hit=ray.intersectObject(paper)[0]!
      expect(hit).toBeDefined()
      const t=(x+.198)/.099,fold=foldDepth*(1-2*Math.abs(t-Math.floor(t)-.5))
      expect(hit.point.z).toBeCloseTo(-.001+fold,6)
    }
    for(const stile of meshes(m.root).filter(o=>o.name.endsWith('/ continuous frame stile')))expect(bounds(stile).intersectsBox(bounds(paper))).toBe(true)
  }m.dispose()
})
test('kk-047/048/049 cedar finish is owned, isolated and retained through reconstruction',()=>{
  for(const module of [grooming,stamp,map]){
    const a=module.createModel(),b=module.createModel()
    const material=a.materials.cedar as MeshStandardMaterial,other=b.materials.cedar as MeshStandardMaterial
    const oldColor=other.color.clone(),oldMap=material.map
    expect(setCafeWoodFinish(a.root,{tint:'#b4754d',roughness:.61})).toBeGreaterThan(0)
    a.configure({});expect(a.materials.cedar).toBe(material);expect(material.map).toBe(oldMap)
    expect(material.roughness).toBe(.61);expect(other.color.equals(oldColor)).toBe(true)
    a.dispose();b.dispose()
  }
})
test('kk-047 visible paddle/bristle bed and comb spine remain joined at configuration extremes',()=>{
  const m=grooming.createModel(),ray=new Raycaster()
  for(const handleHeight of [.17,.23])for(const combLean of [0,12]){
    m.configure({handleHeight,combLean});m.root.updateMatrixWorld(true)
    const brush=named(m.root,'continuous paddle brush'),bed=named(m.root,'continuous oval bristle bed')
    expect(bounds(bed).min.y).toBeCloseTo(bounds(brush).max.y,6)
    expect(bounds(brush).max.y).toBeGreaterThan(bounds(named(m.root,'joined caddy wall')).max.y+.005)
    expect(meshes(m.root).filter(o=>o.name.endsWith('/ seated bristle bundle'))).toHaveLength(44)
    // Every bristle centre lies over the shaped paddle as well as its continuous bed.
    for(const bristle of meshes(m.root).filter(o=>o.name.endsWith('/ seated bristle bundle'))){
      const p=bounds(bristle).getCenter(new Vector3());ray.set(new Vector3(p.x,.13,p.z),new Vector3(0,-1,0))
      expect(ray.intersectObject(brush).length).toBeGreaterThan(0)
    }
    const comb=named(m.root,'open-ended comb')
    for(let i=0;i<12;i++){
      const p=comb.localToWorld(new Vector3(.016,.007+i*.0075,.01)),q=comb.localToWorld(new Vector3(.016,.007+i*.0075,-.01))
      ray.set(p,q.sub(p).normalize());expect(ray.intersectObject(comb).length).toBeGreaterThan(0)
    }
    expect(bounds(comb).max.x).toBeLessThan(.055)
  }m.dispose()
})
test('kk-043 cabinet value separates from ink without altering supplied materials',()=>{
  const m=radio.createModel()
  const body=m.materials.glazeDeep as MeshStandardMaterial,ink=m.materials.ink as MeshStandardMaterial
  expect(body.color.r).toBeGreaterThan(ink.color.r)
  const override=new MeshStandardMaterial(),color=override.color.clone()
  const custom=radio.createModel({materials:{glazeDeep:override}})
  expect(named(custom.root,'rounded charcoal cabinet').material).toBe(override)
  custom.configure({tuning:0});expect(override.color.equals(color)).toBe(true)
  custom.dispose();override.dispose();m.dispose()
})
test('kk-048 cat emblem seats inside lid lining and never adds writing to the cards',()=>{
  const m=stamp.createModel()
  for(const lidAngle of [0,105,110]){
    m.configure({lidAngle});m.root.updateMatrixWorld(true)
    const emblem=named(m.root,'unlettered cat silhouette emblem'),lining=named(m.root,'unlettered lid lining')
    emblem.geometry.computeBoundingBox();lining.geometry.computeBoundingBox()
    expect(emblem.geometry.boundingBox!.clone().translate(emblem.position).intersectsBox(lining.geometry.boundingBox!.clone().translate(lining.position))).toBe(true)
    expect(emblem.parent).toBe(lining.parent)
    expect(meshes(m.root).filter(o=>o.name.endsWith('/ blank loyalty card'))).toHaveLength(7)
  }m.dispose()
})
