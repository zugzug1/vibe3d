// 0.70 × 0.30 × 0.45 m, furnishing, 6000 triangles. Bottom-centre; +Y up, +Z front.
import { Group, Mesh, BufferGeometry, BufferAttribute, Shape, Path, ExtrudeGeometry, CylinderGeometry, SphereGeometry, Vector3, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID='kk-029-garden-planter'
export type Slot='glaze'|'cedarDark'|'glazeMoss'|'vermilion'|'glazeDeep'|'indigo'
export interface GardenPlanterConfig { soil: boolean; plants: boolean }
export interface GardenPlanterOptions extends Partial<GardenPlanterConfig> { materials?: Partial<Record<Slot,Material>> }
export interface GardenPlanterInstance {
 readonly root: Group
 readonly parts: { vessel: Group; soil: Group; plants: Group }
 readonly materials: Readonly<Record<Slot,Material>>
 getConfig(): Readonly<GardenPlanterConfig>
 configure(patch: Partial<GardenPlanterConfig>): void
 setMaterial(slot: Slot, material: Material): void
 update(deltaSeconds: number): void
 dispose(): void
}

/** A single extruded annulus, tapered below the lip, with a separate seated floor. */
function trough():BufferGeometry {
  const outline=(w:number,d:number,r:number):Shape=>{
    const s=new Shape();s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r)
    s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r)
    s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);return s
  }
  const s=outline(0.7,0.3,0.024),hole=new Path(outline(0.658,0.258,0.017).getPoints(4).reverse());s.holes.push(hole)
  const g=new ExtrudeGeometry(s,{depth:0.168,bevelEnabled:false,curveSegments:4,steps:1});g.rotateX(-Math.PI/2)
  const p=g.getAttribute('position')
  for(let i=0;i<p.count;i++){const y=p.getY(i),scale=0.93+0.07*y/0.168;p.setXYZ(i,p.getX(i)*scale,y+0.032,p.getZ(i)*scale)}
  g.computeVertexNormals();boardUVs(g,[0.7,0.168,0.3]);return g
}
function leaf(start:Vector3,end:Vector3,width:number):BufferGeometry {
  const mid=start.clone().lerp(end,0.48),side=new Vector3(-(end.z-start.z),0,end.x-start.x).normalize().multiplyScalar(width)
  side.y=width*0.45*Math.sin(start.y*37+end.x*11)
  if(side.lengthSq()<1e-10)side.set(width,0,0)
  const ridge=mid.clone().add(new Vector3(0,0.012,0)),left=mid.clone().add(side),right=mid.clone().sub(side)
  const vertices=[start,left,ridge,end,right],index=[0,1,2,1,3,2,3,4,2,4,0,2]
  const p:number[]=[];for(const v of vertices)p.push(v.x,v.y,v.z)
  // Thin closed leaf: upper ridge and a matching lower skin, no double-sided material mutation.
  for(const v of vertices)p.push(v.x,v.y-0.001,v.z)
  const ids=[...index,...index.flatMap((_,i)=>i%3===0?[index[i]!+5,index[i+2]!+5,index[i+1]!+5]:[])]
  for(const [a,b] of [[0,1],[1,3],[3,4],[4,0]])ids.push(a!,b!,a!+5,b!,b!+5,a!+5)
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p),3));g.setIndex(ids);g.computeVertexNormals();boardUVs(g,[0.1,0.04,0.08]);return g
}
/** Thin blue fired decoration follows the sloping glaze, not a floating sign. */
function paintedMountains():BufferGeometry {
  const s=new Shape();s.moveTo(-0.295,0.071);s.lineTo(-0.295,0.086)
  for(const [x,y] of [[-0.24,0.092],[-0.18,0.121],[-0.135,0.097],[-0.105,0.109],[-0.065,0.085],[-0.025,0.094],[0.025,0.129],[0.062,0.100],[0.11,0.115],[0.155,0.090],[0.205,0.109],[0.26,0.093],[0.295,0.084]])s.lineTo(x!,y!)
  s.lineTo(0.295,0.071);s.closePath()
  const g=new ExtrudeGeometry(s,{depth:0.00035,bevelEnabled:false,curveSegments:1}),p=g.getAttribute('position')
  for(let i=0;i<p.count;i++)p.setZ(i,0.15*(0.93+0.07*(p.getY(i)-0.032)/0.168)+0.00015+p.getZ(i))
  g.computeVertexNormals();boardUVs(g,[0.59,0.058,0.001]);return g
}
/** Construct an independently owned, configurable café furnishing. */
export function createModel(options:GardenPlanterOptions={}):GardenPlanterInstance {
 const config:GardenPlanterConfig={soil:options.soil??true,plants:options.plants??true}
 const bundle=acquireSurfaceMaterials<Slot>({ glaze: 'glaze', cedarDark: 'cedar', glazeMoss: 'glaze', vermilion: 'glaze', glazeDeep: 'glaze', indigo: 'glaze' },options.materials)
 const materials:Record<Slot,Material>={glaze:bundle.materials.glaze,cedarDark:bundle.materials.cedarDark,glazeMoss:bundle.materials.glazeMoss,vermilion:bundle.materials.vermilion,glazeDeep:bundle.materials.glazeDeep,indigo:bundle.materials.indigo}
 const root=new Group();root.name=ID;root.userData.category='furnishing';root.userData.triangleBudget=6000
 const parts={vessel:new Group(),soil:new Group(),plants:new Group()}
 const content=new Map<Group,Group>()
 for(const [name,anchor] of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-kk-029-garden-planter',[0,0,0]))
 const geometries:BufferGeometry[]=[];let disposed=false
 const emit=(part:Group,g:BufferGeometry,slot:Slot,position:[number,number,number],name:string):Mesh=>{
   geometries.push(g);const mesh=new Mesh(g,materials[slot]);mesh.name=ID+' / '+name;mesh.position.set(...position)
   mesh.userData.materialSlot=slot;mesh.castShadow=true;mesh.receiveShadow=true;content.get(part)!.add(mesh);return mesh
 }
 const box=(part:Group,slot:Slot,size:[number,number,number],p:[number,number,number],name:string):void=>{
   const g=bevelBox(...size,Math.min(0.003,Math.min(...size)*0.15));boardUVs(g,size);emit(part,g,slot,p,name)
 }
 const rebuild=():void=>{
   content.forEach(g=>g.clear());geometries.splice(0).forEach(g=>g.dispose())
   
emit(parts.vessel,trough(),'glaze',[0,0,0],'hollow tapered ceramic trough')
emit(parts.vessel,paintedMountains(),'indigo',[0,0,0],'blue fired mountain silhouette')
box(parts.vessel,'glaze',[0.635,0.021,0.251],[0,0.039,0],'seated vessel floor')
for(const x of [-0.255,0.255])for(const z of [-0.096,0.096])box(parts.vessel,'glaze',[0.082,0.035,0.066],[x,0.0175,z],'ceramic bearing foot')
if(config.soil)box(parts.soil,'glazeDeep',[0.65,0.103,0.25],[0,0.10,0],'recessed soil bed')
if(config.soil)for(const [x,z,r] of [[-0.25,0.065,0.026],[-0.03,0.05,0.033],[0.17,0.055,0.037],[0.26,-0.025,0.019]]){
  const g=new SphereGeometry(1,10,6);g.scale(r!,r!*0.6,r!*0.75)
  emit(parts.soil,g,'glaze',[x!,0.153,z!],'partly embedded garden stone')
}
if(config.plants){
  const stem=(a:Vector3,b:Vector3,r:number,name='rooted branch'):void=>{
    const g=new CylinderGeometry(r*0.65,r,a.distanceTo(b),6);const m=emit(parts.plants,g,'cedarDark',a.clone().lerp(b,0.5).toArray() as [number,number,number],name)
    m.quaternion.setFromUnitVectors(new Vector3(0,1,0),b.clone().sub(a).normalize())
  }
  for(let branch=0;branch<3;branch++){
    const start=new Vector3(-0.19+branch*0.021,0.142,-0.014),end=new Vector3(-0.225+branch*0.041,branch===1?0.45:0.385,0.016*(branch-1))
    stem(start,end,0.003)
    for(let j=0;j<6;j++){
      const t=0.22+j*0.128,origin=start.clone().lerp(end,t),angle=j*2.4+branch
      const a=origin.clone().add(new Vector3(Math.sin(angle)*0.015,0.008,Math.cos(angle)*0.012))
      stem(origin,a,0.0014,'leaf petiole')
      const b=a.clone().add(new Vector3(Math.sin(angle)*0.079,0.031+(j%2)*0.012,Math.cos(angle)*0.059))
      b.y=Math.min(b.y,0.448)
      emit(parts.plants,leaf(a,b,0.022+(j%2)*0.004),j===5?'vermilion':'glazeMoss',[0,0,0],'attached broad shrub leaf')
    }
  }
  for(let i=0;i<9;i++){
    const angle=i/9*Math.PI*2,a=new Vector3(0.19,0.143,0.015),b=new Vector3(0.19+Math.sin(angle)*0.089,0.245+0.068*(i%3)/2,0.015+Math.cos(angle)*0.078)
    emit(parts.plants,leaf(a,b,0.012),'glazeMoss',[0,0,0],'arching grass blade')
  }
}

 }
 rebuild()
 return {root,parts,materials,getConfig:()=>({...config}),
   configure(patch){if(disposed)return;if(patch.soil!==undefined)config.soil=Boolean(patch.soil);if(patch.plants!==undefined)config.plants=Boolean(patch.plants);rebuild()},
   setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},
   update(){},
   dispose(){if(disposed)return;disposed=true;geometries.splice(0).forEach(g=>g.dispose());bundle.dispose();root.removeFromParent()}
 }
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
