// 0.45 × 0.45 × 0.80 m, furnishing, 6000 triangles. Bottom-centre; +Y up, +Z front.
import { Group, Mesh, BufferGeometry, CylinderGeometry, SphereGeometry, TubeGeometry, CatmullRomCurve3, Vector3, Color, type MeshStandardMaterial, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, socket, DERIVED } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID='kk-022-scratching-column'
export type Slot='cedar'|'cedarDark'|'tatami'|'indigo'|'vermilion'
export interface ScratchingColumnConfig { toy: boolean }
export interface ScratchingColumnOptions extends Partial<ScratchingColumnConfig> { materials?: Partial<Record<Slot,Material>> }
export interface ScratchingColumnInstance {
 readonly root: Group
 readonly parts: { base: Group; column: Group; rope: Group; toy: Group }
 readonly materials: Readonly<Record<Slot,Material>>
 getConfig(): Readonly<ScratchingColumnConfig>
 configure(patch: Partial<ScratchingColumnConfig>): void
 setMaterial(slot: Slot, material: Material): void
 update(deltaSeconds: number): void
 dispose(): void
}

function coil(): BufferGeometry {
  const points=Array.from({length:673},(_,i)=>{
    const t=i/672, a=t*32*Math.PI*2, r=0.085-0.021*t
    return new Vector3(r*Math.sin(a),0.092+t*0.679,r*Math.cos(a))
  })
  // 21.22 mm pitch exceeds the 19.4 mm rope diameter: adjacent turns cannot intersect.
  // Both cut ends terminate wholly inside their timber collars.
  // Six-sided sections avoid the former diamond-section, rubber-ring appearance.
  return new TubeGeometry(new CatmullRomCurve3(points),416,0.0097,6,false)
}
/** Construct an independently owned, configurable café furnishing. */
export function createModel(options:ScratchingColumnOptions={}):ScratchingColumnInstance {
 const config:ScratchingColumnConfig={toy:options.toy??true}
 const bundle=acquireSurfaceMaterials<Slot>({ cedar: 'cedar', cedarDark: 'cedar', tatami: 'fabric', indigo: 'fabric', vermilion: 'fabric' },options.materials)
 const materials:Record<Slot,Material>={cedar:bundle.materials.cedar,cedarDark:bundle.materials.cedarDark,tatami:bundle.materials.tatami,indigo:bundle.materials.indigo,vermilion:bundle.materials.vermilion}
 if(!options.materials?.tatami)(materials.tatami as MeshStandardMaterial).color.set(DERIVED.WASHI).lerp(new Color(DERIVED.CEDAR),0.28)
 const root=new Group();root.name=ID;root.userData.category='furnishing';root.userData.triangleBudget=6000
 const parts={base:new Group(),column:new Group(),rope:new Group(),toy:new Group()}
 const content=new Map<Group,Group>()
 for(const [name,anchor] of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-kk-022-scratching-column',[0,0,0]))
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
   
for(const x of [-0.18,0.18]) for(const z of [-0.18,0.18]) box(parts.base,'cedarDark',[0.064,0.02,0.064],[x,0.01,z],'short bearing foot')
box(parts.base,'cedar',[0.45,0.057,0.45],[0,0.0465,0],'heavy square timber base')
emit(parts.base,new CylinderGeometry(0.106,0.109,0.032,24),'cedar',[0,0.087,0],'seated lower collar')
emit(parts.column,new CylinderGeometry(0.059,0.080,0.660,24),'tatami',[0,0.43,0],'tapered sisal core')
emit(parts.rope,coil(),'tatami',[0,0,0],'continuous helical sisal wrap')
emit(parts.column,new CylinderGeometry(0.081,0.081,0.042,24),'cedar',[0,0.779,0],'timber crown')
if(config.toy) {
  const path=new CatmullRomCurve3([new Vector3(0.05,0.78,0.055),new Vector3(0.078,0.72,0.08),new Vector3(0.085,0.613,0.085)])
  emit(parts.toy,new TubeGeometry(path,10,0.0035,5,false),'indigo',[0,0,0],'attached toy cord')
  emit(parts.toy,new SphereGeometry(0.027,12,8),'vermilion',[0.085,0.589,0.085],'cloth toy ball')
}

 }
 rebuild()
 return {root,parts,materials,getConfig:()=>({...config}),
   configure(patch){if(disposed)return;if(patch.toy!==undefined)config.toy=Boolean(patch.toy);rebuild()},
   setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},
   update(){},
   dispose(){if(disposed)return;disposed=true;geometries.splice(0).forEach(g=>g.dispose());bundle.dispose();root.removeFromParent()}
 }
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
