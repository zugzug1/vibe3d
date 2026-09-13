// 0.50 × 0.40 × 0.20 m, furnishing, 6000 triangles. Bottom-centre; +Y up, +Z front.
import { Group, Mesh, BufferGeometry, BufferAttribute, CylinderGeometry, LatheGeometry, Vector2, TubeGeometry, CatmullRomCurve3, Vector3, Color, type MeshStandardMaterial, type Material } from 'three/webgpu'
import { createKkPreview, socket, DERIVED } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID='kk-023-cat-sleeping-basket'
export type Slot='tatami'|'indigo'
export interface SleepingBasketConfig { cushion: boolean }
export interface SleepingBasketOptions extends Partial<SleepingBasketConfig> { materials?: Partial<Record<Slot,Material>> }
export interface SleepingBasketInstance {
 readonly root: Group
 readonly parts: { floor: Group; weave: Group; rim: Group; cushion: Group }
 readonly materials: Readonly<Record<Slot,Material>>
 getConfig(): Readonly<SleepingBasketConfig>
 configure(patch: Partial<SleepingBasketConfig>): void
 setMaterial(slot: Slot, material: Material): void
 update(deltaSeconds: number): void
 dispose(): void
}

const dip=(a:number):number=>0.038*Math.max(0,Math.cos(a))**8
function ribbon(row:number): BufferGeometry {
  const t=(row+0.5)/7, positions:number[]=[], indices:number[]=[]
  for(let i=0;i<48;i++) {
    const a=i/48*Math.PI*2, weave=0.0015*Math.cos(20*a+row*Math.PI)
    const x=0.199+0.042*t+weave,z=0.149+0.042*t+weave,y=0.012+t*(0.177-dip(a))
    const halfHeight=(0.177-dip(a))/7*0.49
    for(const [dr,dy] of [[-0.002,-halfHeight],[0.002,-halfHeight],[0.002,halfHeight],[-0.002,halfHeight]]) positions.push((x+dr!)*Math.sin(a),y+dy!,(z+dr!)*Math.cos(a))
  }
  for(let i=0;i<48;i++) for(let j=0;j<4;j++) {
    const a=i*4+j,b=((i+1)%48)*4+j,c=((i+1)%48)*4+(j+1)%4,d=i*4+(j+1)%4
    indices.push(a,b,d,b,c,d)
  }
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setIndex(indices);g.computeVertexNormals();boardUVs(g,[0.5,0.018,0.4]);return g
}
function cushion():BufferGeometry {
  const profile=[[0,0.012],[0.8,0.012],[1,0.044],[1,0.080],[0.96,0.116],[0.80,0.141],[0.56,0.131],[0.30,0.090],[0,0.076]]
  const g=new LatheGeometry(profile.map(([r,y])=>new Vector2(r!,y!)),48),p=g.getAttribute('position')
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),radius=Math.hypot(x,z),angle=Math.atan2(x,z)
    const fold=p.getY(i)>0.08?0.014*Math.max(0,Math.cos(5*angle+0.3))**10*Math.sin(Math.PI*radius)**2:0
    p.setXYZ(i,x*0.195,p.getY(i)-fold,z*0.145)
  }
  const index=g.index!,keep:number[]=[]
  for(let i=0;i<index.count;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)]
    const [a,b,c]=ids.map(j=>new Vector3().fromBufferAttribute(p,j))
    if(b!.sub(a!).cross(c!.sub(a!)).lengthSq()>1e-20)keep.push(...ids)
  }
  g.setIndex(keep);g.computeVertexNormals();boardUVs(g,[0.390,0.129,0.290]);return g
}
/** Flat bindings with no twisted tube frames or sharp projecting stake tips. */
function binding(angle:number):BufferGeometry {
  const p:number[]=[],index:number[]=[]
  for(let j=0;j<8;j++){
    const t=j/7,r=0.199+0.042*t,d=0.149+0.042*t,y=0.012+t*(0.178-dip(angle))
    for(const [rad,tan] of [[-0.001,-0.004],[0.001,-0.004],[0.001,0.004],[-0.001,0.004]])
      p.push((r+rad!)*Math.sin(angle)+tan!*Math.cos(angle),y,(d+rad!)*Math.cos(angle)-tan!*Math.sin(angle))
  }
  for(let j=0;j<7;j++)for(let k=0;k<4;k++){const a=j*4+k,b=a+4,c=(j+1)*4+(k+1)%4,d=j*4+(k+1)%4;index.push(a,d,b,b,d,c)}
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p),3));g.setIndex(index);g.computeVertexNormals();boardUVs(g,[0.008,0.18,0.004]);return g
}
/** Construct an independently owned, configurable café furnishing. */
export function createModel(options:SleepingBasketOptions={}):SleepingBasketInstance {
 const config:SleepingBasketConfig={cushion:options.cushion??true}
 const bundle=acquireSurfaceMaterials<Slot>({ tatami: 'fabric', indigo: 'fabric' },options.materials)
 const materials:Record<Slot,Material>={tatami:bundle.materials.tatami,indigo:bundle.materials.indigo}
 if(!options.materials?.tatami)(materials.tatami as MeshStandardMaterial).color.set(DERIVED.WASHI).lerp(new Color(DERIVED.CEDAR),0.32)
 const root=new Group();root.name=ID;root.userData.category='furnishing';root.userData.triangleBudget=6000
 const parts={floor:new Group(),weave:new Group(),rim:new Group(),cushion:new Group()}
 const content=new Map<Group,Group>()
 for(const [name,anchor] of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-kk-023-cat-sleeping-basket',[0,0,0]))
 const geometries:BufferGeometry[]=[];let disposed=false
 const emit=(part:Group,g:BufferGeometry,slot:Slot,position:[number,number,number],name:string):Mesh=>{
   geometries.push(g);const mesh=new Mesh(g,materials[slot]);mesh.name=ID+' / '+name;mesh.position.set(...position)
   mesh.userData.materialSlot=slot;mesh.castShadow=true;mesh.receiveShadow=true;content.get(part)!.add(mesh);return mesh
 }
 
 const rebuild=():void=>{
   content.forEach(g=>g.clear());geometries.splice(0).forEach(g=>g.dispose())
   
const floor=new CylinderGeometry(1,1,0.012,32);floor.scale(0.201,1,0.151)
emit(parts.floor,floor,'tatami',[0,0.006,0],'woven bearing floor')
for(let row=0;row<7;row++) emit(parts.weave,ribbon(row),'tatami',[0,0,0],'interlaced horizontal ribbon')
for(let i=0;i<20;i++){
  const a=i/20*Math.PI*2
  emit(parts.weave,binding(a),'tatami',[0,0,0],'seated flat basket binding')
}
const edge=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return new Vector3(0.242*Math.sin(a),0.192-dip(a),0.192*Math.cos(a))})
emit(parts.rim,new TubeGeometry(new CatmullRomCurve3(edge,true),48,0.008,8,true),'tatami',[0,0,0],'bound oval rim with low entrance')
if(config.cushion) emit(parts.cushion,cushion(),'indigo',[0,0,0],'removable tufted cushion')

 }
 rebuild()
 return {root,parts,materials,getConfig:()=>({...config}),
   configure(patch){if(disposed)return;if(patch.cushion!==undefined)config.cushion=Boolean(patch.cushion);rebuild()},
   setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},
   update(){},
   dispose(){if(disposed)return;disposed=true;geometries.splice(0).forEach(g=>g.dispose());bundle.dispose();root.removeFromParent()}
 }
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
