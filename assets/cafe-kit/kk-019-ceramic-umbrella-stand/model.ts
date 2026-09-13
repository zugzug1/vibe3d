// 0.25 × 0.25 × 0.50 m, furnishing, 6000 triangles. Bottom-centre; +Y up, +Z front.
import { Group, Mesh, BufferGeometry, LatheGeometry, Vector2, type Material } from 'three/webgpu'
import { createKkPreview, socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials } from '../kk-core/surface-detail.ts'
const ID='kk-019-ceramic-umbrella-stand'
export type Slot='glazeMoss'
export interface UmbrellaStandConfig { ribbed: boolean }
export interface UmbrellaStandOptions extends Partial<UmbrellaStandConfig> { materials?: Partial<Record<Slot,Material>> }
export interface UmbrellaStandInstance {
 readonly root: Group
 readonly parts: { vessel: Group }
 readonly materials: Readonly<Record<Slot,Material>>
 getConfig(): Readonly<UmbrellaStandConfig>
 configure(patch: Partial<UmbrellaStandConfig>): void
 setMaterial(slot: Slot, material: Material): void
 update(deltaSeconds: number): void
 dispose(): void
}

/** Cup/feeder-style continuous half-section: underside, wall, rolled lip, interior, floor. */
function vessel(ribbed: boolean): BufferGeometry {
  const profile = [[0,0.003],[0.10,0.003],[0.107,0],[0.112,0.005],[0.116,0.025],[0.121,0.075],[0.121,0.38],[0.116,0.43],[0.115,0.46],[0.123,0.47],[0.125,0.481],[0.123,0.492],[0.118,0.5],[0.111,0.496],[0.108,0.485],[0.105,0.46],[0.106,0.43],[0.110,0.38],[0.109,0.075],[0.10,0.026],[0,0.026]]
  for (const k of [5,6]) profile[k]![0]=0.118
  const g = new LatheGeometry(profile.map(([r,y]) => new Vector2(r!,y!)),128)
  const p = g.getAttribute('position')
  if (ribbed) for(let i=0;i<p.count;i++) {
    // LatheGeometry stores one complete profile per azimuth column.
    const k=i%profile.length
    if(k<4 || k>7) continue
    const x=p.getX(i), z=p.getZ(i), radius=Math.hypot(x,z)
    const angle=Math.atan2(x,z), lift=0.006*(0.5+0.5*Math.cos(16*angle))**2
    p.setXYZ(i,x*(1+lift/radius),p.getY(i),z*(1+lift/radius))
  }
  const index=g.index!, keep:number[]=[]
  for(let i=0;i<index.count;i+=3) {
    const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2)
    const same=(u:number,v:number):boolean=>p.getX(u)===p.getX(v)&&p.getY(u)===p.getY(v)&&p.getZ(u)===p.getZ(v)
    if(!same(a,b)&&!same(b,c)&&!same(c,a)) keep.push(a,b,c)
  }
  g.setIndex(keep); g.computeVertexNormals(); return g
}
/** Construct an independently owned, configurable café furnishing. */
export function createModel(options:UmbrellaStandOptions={}):UmbrellaStandInstance {
 const config:UmbrellaStandConfig={ribbed:options.ribbed??true}
 const bundle=acquireSurfaceMaterials<Slot>({ glazeMoss: 'glaze' },options.materials)
 const materials:Record<Slot,Material>={glazeMoss:bundle.materials.glazeMoss}
 const root=new Group();root.name=ID;root.userData.category='furnishing';root.userData.triangleBudget=6000
 const parts={vessel:new Group()}
 const content=new Map<Group,Group>()
 for(const [name,anchor] of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-kk-019-ceramic-umbrella-stand',[0,0,0]))
 const geometries:BufferGeometry[]=[];let disposed=false
 const emit=(part:Group,g:BufferGeometry,slot:Slot,position:[number,number,number],name:string):Mesh=>{
   geometries.push(g);const mesh=new Mesh(g,materials[slot]);mesh.name=ID+' / '+name;mesh.position.set(...position)
   mesh.userData.materialSlot=slot;mesh.castShadow=true;mesh.receiveShadow=true;content.get(part)!.add(mesh);return mesh
 }
 
 const rebuild=():void=>{
   content.forEach(g=>g.clear());geometries.splice(0).forEach(g=>g.dispose())
   emit(parts.vessel, vessel(config.ribbed), 'glazeMoss', [0,0,0], 'ribbed hollow ceramic vessel')
 }
 rebuild()
 return {root,parts,materials,getConfig:()=>({...config}),
   configure(patch){if(disposed)return;if(patch.ribbed!==undefined)config.ribbed=Boolean(patch.ribbed);rebuild()},
   setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},
   update(){},
   dispose(){if(disposed)return;disposed=true;geometries.splice(0).forEach(g=>g.dispose());bundle.dispose();root.removeFromParent()}
 }
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
