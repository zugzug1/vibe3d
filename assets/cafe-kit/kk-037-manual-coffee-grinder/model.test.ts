import { expect, test } from 'bun:test'
import { Box3, BufferGeometry, Group, Material, Mesh, MeshStandardMaterial, Raycaster, Texture, Vector3 } from 'three/webgpu'
import * as grinder from './model.ts'
import * as tray from '../kk-039-indigo-serving-tray/model.ts'
import * as ledger from '../kk-041-cat-adoption-ledger/model.ts'
import * as display from '../kk-042-instant-photo-display/model.ts'
import { setCafeWoodFinish } from '../kk-core/materials.ts'
const meshes=(root:Group):Mesh[]=>{const list:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)list.push(o)});return list}
const named=(root:Group,name:string):Mesh=>meshes(root).find(m=>m.name.endsWith('/ '+name))!
const bounds=(mesh:Mesh)=>new Box3().setFromObject(mesh)
for(const [id,module,dimensions] of [
  ['kk-037',grinder,[.14,.25,.14]],['kk-039',tray,[.4,.04,.28]],['kk-041',ledger,[.4,.04,.28]],['kk-042',display,[.45,.3,.08]],
] as const) {
  test(id+' default dimensions, all control corners, finite outward nondegenerate geometry and 2000 triangle budget',()=>{
    const m=module.createModel();m.root.updateMatrixWorld(true)
    new Box3().setFromObject(m.root).getSize(new Vector3()).toArray().forEach((v,i)=>expect(v).toBeCloseTo(dimensions[i]!,6))
    const controls=Object.entries(module.structureControls)
    for(let corner=-1;corner<2**controls.length;corner++) {
      if(corner>=0)m.configure(Object.fromEntries(controls.map(([key,c],i)=>[key,c[corner&(1<<i)?'max':'min']])))
      m.root.updateMatrixWorld(true);expect(new Box3().setFromObject(m.root).min.y).toBeCloseTo(0,6)
      let triangles=0
      for(const mesh of meshes(m.root)) {
        expect(mesh.scale.toArray()).toEqual([1,1,1])
        const g=mesh.geometry,p=g.getAttribute('position'),idx=g.index,count=idx?.count??p.count
        for(const key of ['position','normal','uv'])for(const v of g.getAttribute(key).array)expect(Number.isFinite(v)).toBe(true)
        let volume=0;triangles+=count/3
        for(let i=0;i<count;i+=3) {
          const [a,b,c]=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j)) as [Vector3,Vector3,Vector3]
          expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-22)
          volume+=a.dot(b.clone().cross(c))/6
        }
        expect(volume).toBeGreaterThan(0)
      }
      expect(triangles).toBeLessThanOrEqual(2000)
    }
    m.dispose()
  })
  test(id+' finite options are atomic, bounded and preserve undefined values',()=>{
    const m=module.createModel(),before=m.getConfig(),first=meshes(m.root)[0],controls=Object.entries(module.structureControls)
    for(const [key] of controls)for(const invalid of [NaN,Infinity,-Infinity,'2',null]) {
      const patch={[controls[0]![0]]:controls[0]![1].min,[key]:invalid}
      expect(()=>m.configure(patch as never)).toThrow();expect(()=>module.createModel(patch as never)).toThrow()
      expect(m.getConfig()).toEqual(before);expect(meshes(m.root)[0]).toBe(first)
    }
    for(const extreme of ['min','max'] as const) {
      m.configure(Object.fromEntries(controls.map(([key])=>[key,extreme==='min'?-999:999])))
      const expected=Object.fromEntries(controls.map(([key,c])=>[key,c[extreme]]))
      expect(m.getConfig()).toEqual(expected)
      m.configure(Object.fromEntries(controls.map(([key])=>[key,undefined])));expect(m.getConfig()).toEqual(expected)
    }
    m.dispose()
  })
  test(id+' stable attachments, active overrides, cedar controls and exactly-once resource ownership',()=>{
    const map=new Texture(),override=new MeshStandardMaterial({map}),replacement=new MeshStandardMaterial()
    const counts=new Map<object,number>(),original=[BufferGeometry.prototype.dispose,Material.prototype.dispose,Texture.prototype.dispose] as const
    BufferGeometry.prototype.dispose=function(){counts.set(this,(counts.get(this)??0)+1);original[0].call(this)}
    Material.prototype.dispose=function(){counts.set(this,(counts.get(this)??0)+1);original[1].call(this)}
    Texture.prototype.dispose=function(){counts.set(this,(counts.get(this)??0)+1);original[2].call(this)}
    try {
      const m=module.createModel({materials:{cedar:override}}),root=m.root
      root.position.set(1,2,3);root.rotation.set(.1,.4,.2);root.scale.set(1.1,.9,1.2);root.updateMatrixWorld(true)
      const matrix=root.matrixWorld.clone(),anchors=Object.values(m.parts),attached=anchors.map(a=>{const c=new Group();a.add(c);return c})
      const observed=new Set<object>()
      const collect=()=>{for(const mesh of meshes(root)){observed.add(mesh.geometry);const mat=mesh.material as MeshStandardMaterial;if(mat!==override&&mat!==replacement){observed.add(mat);for(const tex of [mat.map,mat.normalMap,mat.roughnessMap])if(tex)observed.add(tex)}}}
      collect();const color=override.color.clone()
      const owned=meshes(root).find(o=>o.userData.materialSlot==='cedarDark')?.material as MeshStandardMaterial|undefined
      const oldMap=owned?.map
      setCafeWoodFinish(root,{tint:'#b4754d',roughness:.62})
      expect(override.color.equals(color)).toBe(true);expect(override.map).toBe(map)
      if(owned){expect(owned.roughness).toBe(.62);expect(owned.map).toBe(oldMap)}
      for(const mode of ['min','max','default'] as const) {
        m.configure(Object.fromEntries(Object.entries(module.structureControls).map(([key,c])=>[key,c[mode]])));collect()
        root.updateMatrixWorld(true);expect(root.matrixWorld.equals(matrix)).toBe(true)
        anchors.forEach((a,i)=>expect(attached[i]!.parent).toBe(a))
        if(owned)expect(owned.roughness).toBe(.62)
      }
      m.setMaterial('cedar',replacement);m.configure({});collect()
      for(const mesh of meshes(root).filter(o=>o.userData.materialSlot==='cedar'))expect(mesh.material).toBe(replacement)
      m.dispose();m.dispose();for(const o of observed)expect(counts.get(o)).toBe(1)
      for(const o of [override,replacement,map])expect(counts.has(o)).toBe(false)
      for(const n of counts.values())expect(n).toBe(1)
      const stopped=m.getConfig();m.configure({});expect(m.getConfig()).toEqual(stopped)
    } finally {
      BufferGeometry.prototype.dispose=original[0];Material.prototype.dispose=original[1];Texture.prototype.dispose=original[2]
      override.dispose();replacement.dispose();map.dispose()
    }
  })
}
test('kk-037 crank bearing, knob and open hopper remain seated through rotation and drawer travel',()=>{
  const m=grinder.createModel(),ray=new Raycaster()
  for(const crankAngle of [-180,0,180])for(const drawerOpen of [0,1]){
    m.configure({crankAngle,drawerOpen});m.root.updateMatrixWorld(true)
    for(const [a,b] of [['continuous grinder spindle','crank hub arm'],['crank sweep','handle axle'],['handle axle','turned timber crank grip'],['drawer pull neck','grounds drawer face'],['round drawer pull','seated pull neck']] ) {
      const aa=a==='drawer pull neck'?'seated pull neck':a
      expect(bounds(named(m.root,aa)).intersectsBox(bounds(named(m.root,b)))).toBe(true)
    }
    ray.set(new Vector3(.025,.20,0),new Vector3(0,-1,0))
    const hit=ray.intersectObject(named(m.root,'open flared hopper'))[0]
    expect(hit).toBeDefined();expect(hit!.point.y).toBeLessThan(.17)
    expect(bounds(named(m.root,'grounds drawer floor')).min.z).toBeLessThan(.05)
  }m.dispose()
})
test('kk-039 handle slots are negative space and textile is seated on the tray floor',()=>{
  const m=tray.createModel(),ray=new Raycaster()
  for(const rimHeight of [.032,.04,.05])for(const handleWidth of [.075,.11]){
    m.configure({rimHeight,handleWidth});m.root.updateMatrixWorld(true)
    ray.set(new Vector3(.25,(.014+rimHeight-.008)/2,0),new Vector3(-1,0,0))
    expect(ray.intersectObject(m.root,true)).toHaveLength(0)
    ray.set(new Vector3(.25,rimHeight-.004,0),new Vector3(-1,0,0))
    expect(ray.intersectObject(m.parts.handles,true).length).toBeGreaterThan(0)
    expect(bounds(named(m.root,'recessed indigo textile inset')).min.y).toBeCloseTo(bounds(named(m.root,'oval timber tray floor')).max.y,6)
  }m.dispose()
})
test('kk-041 page depth, layered portrait contact, and binding are physical geometry',()=>{
  const m=ledger.createModel(),ray=new Raycaster()
  for(const pageLift of [.025,.034,.037]){
    m.configure({pageLift});m.root.updateMatrixWorld(true)
    for(const card of meshes(m.root).filter(o=>o.name.endsWith('/ blank portrait mounting card'))){
      ray.set(card.getWorldPosition(new Vector3()).add(new Vector3(0,.01,0)),new Vector3(0,-1,0))
      const a=ray.intersectObject(card)[0]!,b=ray.intersectObject(m.parts.pages,true)[0]!
      expect(a).toBeDefined();expect(b).toBeDefined();expect(a.point.y-b.point.y).toBeGreaterThan(0);expect(a.point.y-b.point.y).toBeLessThan(.004)
    }
    expect(meshes(m.root).filter(o=>o.name.endsWith('/ exposed page folio'))).toHaveLength(6)
  }m.dispose()
})
test('kk-042 photo clips meet the cord; frame and buttresses seat on the base',()=>{
  const m=display.createModel()
  for(const photoSpacing of [.1,.122,.14])for(const stringSag of [.003,.01,.017]){
    m.configure({photoSpacing,stringSag});m.root.updateMatrixWorld(true)
    const base=bounds(named(m.root,'broad display plinth'))
    for(const mesh of meshes(m.root).filter(o=>/socketed frame stile|triangular side buttress/.test(o.name)))expect(bounds(mesh).min.y).toBeCloseTo(base.max.y,6)
    for(const photo of m.parts.photos.children[0]!.children){
      photo.updateWorldMatrix(true,true)
      const paper=photo.children.find(o=>o.name.endsWith('/ instant photo paper')) as Mesh
      const jaws=photo.children.filter(o=>o.name.endsWith('/ clothespin jaw')) as Mesh[]
      const paperBounds=bounds(paper)
      expect(jaws).toHaveLength(2)
      for(const jaw of jaws){
        const b=bounds(jaw);expect(b.max.y).toBeGreaterThan(paperBounds.max.y-.005);expect(b.min.y).toBeLessThan(paperBounds.max.y)
        expect(b.intersectsBox(paperBounds)).toBe(true)
        // Check actual local contact depth, not only projected overlap in X/Y.
        jaw.geometry.computeBoundingBox();paper.geometry.computeBoundingBox()
        const localJaw=jaw.geometry.boundingBox!.clone().translate(jaw.position)
        const localPaper=paper.geometry.boundingBox!.clone().translate(paper.position)
        expect(localJaw.intersectsBox(localPaper)).toBe(true)
      }
      const wireY=(photo.position.y+.035)
      expect(bounds(jaws[0]!).min.y).toBeLessThan(wireY);expect(bounds(jaws[0]!).max.y).toBeGreaterThan(wireY)
    }
  }m.dispose()
})
 test('kk-037 hopper is a closed oriented shell with unit normals and uninterrupted inner-wall rays',()=>{
  const m=grinder.createModel();m.root.updateMatrixWorld(true)
  const hopper=named(m.root,'open flared hopper'),g=hopper.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),idx=g.index!
  const edges=new Map<string,{count:number,balance:number}>(),key=(v:Vector3)=>v.toArray().map(x=>Math.round(x*1e8)).join(',')
  for(let i=0;i<idx.count;i+=3) {
    const indices=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)]
    const v=indices.map(j=>new Vector3().fromBufferAttribute(p,j)) as [Vector3,Vector3,Vector3]
    const normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize()
    indices.forEach(j=>{const vn=new Vector3().fromBufferAttribute(n,j);expect(vn.length()).toBeCloseTo(1,6);expect(vn.dot(normal)).toBeGreaterThan(0)})
    for(let j=0;j<3;j++){const a=key(v[j]!),b=key(v[(j+1)%3]!),k=[a,b].sort().join('|'),edge=edges.get(k)??{count:0,balance:0};edge.count++;edge.balance+=a<b?1:-1;edges.set(k,edge)}
  }
  for(const edge of edges.values()){expect(edge.count).toBe(2);expect(edge.balance).toBe(0)}
  const ray=new Raycaster()
  for(let i=0;i<96;i++)for(const r of [.022,.035,.045,.05,.055]){
    const a=i*Math.PI/48;ray.set(new Vector3(r*Math.cos(a),.2,r*Math.sin(a)),new Vector3(0,-1,0))
    const hit=ray.intersectObject(hopper)[0];expect(hit).toBeDefined();expect(hit!.face!.normal.y).toBeGreaterThan(0)
  }
  for(const crankAngle of [-135,-90,-45,0,45,90,135]){
    m.configure({crankAngle});m.root.updateMatrixWorld(true)
    const b=new Box3().setFromObject(m.root);expect(b.max.x).toBeLessThan(.070001);expect(b.max.z).toBeLessThan(.070001);expect(b.min.x).toBeGreaterThan(-.070001);expect(b.min.z).toBeGreaterThan(-.070001)
  }m.dispose()
})
test('kk-042 brace contacts and volume-weighted centre stay inside the original 80mm support footprint',()=>{
  const m=display.createModel(),ray=new Raycaster()
  for(const photoSpacing of [.1,.14])for(const stringSag of [.003,.017]){
    m.configure({photoSpacing,stringSag});m.root.updateMatrixWorld(true)
    const base=named(m.root,'broad display plinth')
    for(const brace of meshes(m.root).filter(o=>o.name.endsWith('/ triangular side buttress'))){
      const b=bounds(brace);expect(b.min.z).toBeGreaterThanOrEqual(-.04);expect(b.max.z).toBeLessThanOrEqual(.04)
      ray.set(new Vector3(b.getCenter(new Vector3()).x,.013,.025),new Vector3(0,-1,0))
      const hit=ray.intersectObject(base)[0];expect(hit).toBeDefined();expect(hit!.point.y).toBeCloseTo(.012,6)
    }
    // Static centre-of-mass proxy: closed solid volumes with explicit material densities.
    // Overlapping housed joints are counted twice; this is not a certified tip/load simulation.
    let mass=0;const moment=new Vector3()
    for(const mesh of meshes(m.root)){
      const g=mesh.geometry,p=g.getAttribute('position'),idx=g.index,count=idx?.count??p.count
      const slot=mesh.userData.materialSlot as string,density=slot==='brass'?8500:slot==='cedar'||slot==='cedarDark'?450:900
      for(let i=0;i<count;i+=3){
        const [a,b,c]=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld)) as [Vector3,Vector3,Vector3]
        const dm=a.dot(b.clone().cross(c))/6*density
        mass+=dm;moment.add(a.clone().add(b).add(c).multiplyScalar(dm/4))
      }
    }
    const centre=moment.divideScalar(mass);expect(mass).toBeGreaterThan(0)
    expect(Math.abs(centre.x)).toBeLessThan(.18);expect(Math.abs(centre.z)).toBeLessThan(.025)
  }m.dispose()
})
