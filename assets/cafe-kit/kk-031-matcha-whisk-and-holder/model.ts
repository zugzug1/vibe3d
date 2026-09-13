// Storytelling prop; 0.1 W × 0.1 D × 0.14 H m. 2000 triangle ceiling.
// Bottom-centre origin, +Y up, +Z front. Preview content stays outside the model.
import { Group, Mesh, BufferGeometry, LatheGeometry, Vector2, Vector3, TubeGeometry, CatmullRomCurve3, TorusGeometry, Color, type MeshStandardMaterial, type Material } from 'three/webgpu'
import { createKkPreview, socket, DERIVED } from '../kk-core/index.ts'
import { acquireSurfaceMaterials } from '../kk-core/surface-detail.ts'
const ID='kk-031-matcha-whisk-and-holder'
export type Slot='glazeMoss'|'tatami'|'ink'
export interface MatchaWhiskConfig{whisk:boolean}
export interface MatchaWhiskOptions extends Partial<MatchaWhiskConfig>{materials?:Partial<Record<Slot,Material>>}
export interface MatchaWhiskInstance{
 readonly root:Group
 readonly parts:{holder:Group;whisk:Group;binding:Group}
 readonly materials:Readonly<Record<Slot,Material>>
 getConfig():Readonly<MatchaWhiskConfig>
 configure(patch:Partial<MatchaWhiskConfig>):void
 setMaterial(slot:Slot,material:Material):void
 update(deltaSeconds:number):void
 dispose():void
}
function lathe(profile:number[][],segments:number):BufferGeometry{
 const g=new LatheGeometry(profile.map(([r,y])=>new Vector2(r!,y!)),segments),p=g.getAttribute('position'),index=g.index!,keep:number[]=[]
 for(let i=0;i<index.count;i+=3){
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],[a,b,c]=ids.map(j=>new Vector3().fromBufferAttribute(p,j))
  if(b!.sub(a!).cross(c!.sub(a!)).lengthSq()>1e-22)keep.push(...ids)
 }
 g.setIndex(keep);g.computeVertexNormals();return g
}

/** Creates owned geometry and stable semantic anchors for one storytelling prop. */
export function createModel(options:MatchaWhiskOptions={}):MatchaWhiskInstance{
 const config:MatchaWhiskConfig={whisk:options.whisk??true}
 const bundle=acquireSurfaceMaterials({glazeMoss:'glaze',tatami:'cedar',ink:'fabric'},options.materials)
 const materials:Record<Slot,Material>={glazeMoss:bundle.materials.glazeMoss,tatami:bundle.materials.tatami,ink:bundle.materials.ink}
 if(!options.materials?.tatami)(materials.tatami as MeshStandardMaterial).color.set(DERIVED.WASHI).lerp(new Color(DERIVED.CEDAR),0.42)
 const root=new Group();root.name=ID;root.userData.category='storytelling';root.userData.triangleBudget=2000
 const parts={holder:new Group(),whisk:new Group(),binding:new Group()},content=new Map<Group,Group>()
 for(const [name,anchor]of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-'+ID,[0,0,0]))
 const geometries:BufferGeometry[]=[];let disposed=false
 const emit=(part:Group,g:BufferGeometry,slot:Slot,p:[number,number,number],name:string):Mesh=>{
  geometries.push(g);const mesh=new Mesh(g,materials[slot]);mesh.name=ID+' / '+name;mesh.position.set(...p);mesh.userData.materialSlot=slot;mesh.castShadow=true;mesh.receiveShadow=true;content.get(part)!.add(mesh);return mesh
 }
 const rebuild=():void=>{
  content.forEach(g=>g.clear());geometries.splice(0).forEach(g=>g.dispose())
  
emit(parts.holder,lathe([[0,0.003],[0.031,0.003],[0.034,0],[0.035,0.009],[0.047,0.019],[0.050,0.034],[0.044,0.055],[0.042,0.060],[0.037,0.060],[0.036,0.054],[0.042,0.031],[0.033,0.013],[0,0.013]],16),'glazeMoss',[0,0,0],'hollow footed ceramic holder')
if(config.whisk){
 emit(parts.whisk,lathe([[0.014,0.093],[0.014,0.105],[0.013,0.109],[0.014,0.14],[0.010,0.14],[0.010,0.113],[0,0.113]],16),'tatami',[0,0,0],'open bamboo handle')
 for(let i=0;i<32;i++){
  const a=i/32*Math.PI*2
  const points=[[0.020,0.0128],[0.029,0.035],[0.034,0.061],[0.031,0.074],[0.021,0.090],[0.013,0.097]].map(([radius,y])=>new Vector3(radius!*Math.sin(a),y!,radius!*Math.cos(a)))
  emit(parts.whisk,new TubeGeometry(new CatmullRomCurve3(points),6,0.00065,3,false),'tatami',[0,0,0],'seated curved bamboo tine')
 }
 const binding=new TorusGeometry(0.0143,0.0011,3,24);binding.rotateX(Math.PI/2)
 emit(parts.binding,binding,'ink',[0,0.097,0],'neck binding')
}

 }
 rebuild()
 return{root,parts,materials,getConfig:()=>({...config}),
  configure(patch){if(disposed)return;if(patch.whisk!==undefined)config.whisk=Boolean(patch.whisk);rebuild()},
  setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},
  update(){},
  dispose(){if(disposed)return;disposed=true;geometries.splice(0).forEach(g=>g.dispose());bundle.dispose();root.removeFromParent()}
 }
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
