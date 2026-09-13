// Storytelling prop; 0.25 W × 0.2 D × 0.07 H m. 2000 triangle ceiling.
// Bottom-centre origin, +Y up, +Z front. Preview content stays outside the model.
import { Group, Mesh, BufferGeometry, LatheGeometry, Vector2, Vector3, SphereGeometry, Color, type MeshStandardMaterial, type Material } from 'three/webgpu'
import { createKkPreview, socket, DERIVED } from '../kk-core/index.ts'
import { acquireSurfaceMaterials } from '../kk-core/surface-detail.ts'
const ID='kk-035-wagashi-serving-plate'
export type Slot='glaze'|'vermilion'|'glazeMoss'|'indigo'
export interface WagashiPlateConfig{sweets:boolean}
export interface WagashiPlateOptions extends Partial<WagashiPlateConfig>{materials?:Partial<Record<Slot,Material>>}
export interface WagashiPlateInstance{
 readonly root:Group
 readonly parts:{plate:Group;sweets:Group;leaf:Group}
 readonly materials:Readonly<Record<Slot,Material>>
 getConfig():Readonly<WagashiPlateConfig>
 configure(patch:Partial<WagashiPlateConfig>):void
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

function plate():BufferGeometry{
 const g=lathe([[0,0.004],[0.55,0.004],[0.60,0],[0.70,0.002],[1,0.016],[1,0.020],[0.91,0.023],[0.70,0.012],[0,0.012]],48)
 const p=g.getAttribute('position')
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),radius=Math.hypot(x,z),a=Math.atan2(x,z),scallop=radius>0.7?0.97+0.03*Math.cos(12*a):1;p.setXYZ(i,x*0.125*scallop,p.getY(i),z*0.1*scallop)}
 g.computeVertexNormals();return g
}
function sweet(kind:'flower'|'kinton'|'mochi'):BufferGeometry{
 const g=new SphereGeometry(1,kind==='flower'?20:kind==='kinton'?24:16,kind==='kinton'?10:8),p=g.getAttribute('position')
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(x,z)
  const r=kind==='flower'?0.030*(0.73+0.27*Math.cos(5*a)):kind==='kinton'?0.028*(0.88+0.12*Math.cos(12*a+Math.round(y*5)*1.7)):0.027
  const h=kind==='flower'?0.022:kind==='kinton'?0.029:0.024
  const height=kind==='flower'&&y>0?y*0.018-0.012*y**8:y*h
  p.setXYZ(i,x*r,height,z*r)
 }
 g.computeVertexNormals();return g
}
/** Creates owned geometry and stable semantic anchors for one storytelling prop. */
export function createModel(options:WagashiPlateOptions={}):WagashiPlateInstance{
 const config:WagashiPlateConfig={sweets:options.sweets??true}
 const bundle=acquireSurfaceMaterials({glaze:'glaze',vermilion:'glaze',glazeMoss:'glaze',indigo:'glaze'},options.materials)
 const materials:Record<Slot,Material>={glaze:bundle.materials.glaze,vermilion:bundle.materials.vermilion,glazeMoss:bundle.materials.glazeMoss,indigo:bundle.materials.indigo}
 if(!options.materials?.vermilion)(materials.vermilion as MeshStandardMaterial).color.lerp(new Color(DERIVED.WASHI),0.52)
for(const slot of ['vermilion','glazeMoss'] as const)if(!options.materials?.[slot])(materials[slot] as MeshStandardMaterial).roughness=0.9
 const root=new Group();root.name=ID;root.userData.category='storytelling';root.userData.triangleBudget=2000
 const parts={plate:new Group(),sweets:new Group(),leaf:new Group()},content=new Map<Group,Group>()
 for(const [name,anchor]of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-'+ID,[0,0,0]))
 const geometries:BufferGeometry[]=[];let disposed=false
 const emit=(part:Group,g:BufferGeometry,slot:Slot,p:[number,number,number],name:string):Mesh=>{
  geometries.push(g);const mesh=new Mesh(g,materials[slot]);mesh.name=ID+' / '+name;mesh.position.set(...p);mesh.userData.materialSlot=slot;mesh.castShadow=true;mesh.receiveShadow=true;content.get(part)!.add(mesh);return mesh
 }
 const rebuild=():void=>{
  content.forEach(g=>g.clear());geometries.splice(0).forEach(g=>g.dispose())
  
// Blue brush marks replace selected rim faces: no overlay or coplanar duplicate.
const dish=plate(),marks=dish.clone(),p=dish.getAttribute('position'),index=dish.index!,cream:number[]=[],blue:number[]=[]
for(let i=0;i<index.count;i+=3){
 const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)]
 const c=ids.reduce((v,j)=>v.add(new Vector3().fromBufferAttribute(p,j)),new Vector3()).divideScalar(3)
 const a=Math.atan2(c.x/0.125,c.z/0.1),radius=Math.hypot(c.x/0.125,c.z/0.1)
 const painted=c.y>0.014&&radius>0.76&&radius<0.97&&Math.cos(12*a)>0.65
 ;(painted?blue:cream).push(...ids)
}
dish.setIndex(cream);marks.setIndex(blue)
emit(parts.plate,dish,'glaze',[0,0,0],'scalloped shallow serving plate')
emit(parts.plate,marks,'indigo',[0,0,0],'in-surface blue rim brushwork')
if(config.sweets){
 emit(parts.sweets,sweet('flower'),'vermilion',[-0.045,0.034,0.025],'five-petal nerikiri')
 emit(parts.sweets,sweet('kinton'),'glazeMoss',[0,0.041,-0.035],'ridged green kinton')
 emit(parts.sweets,sweet('mochi'),'glaze',[0.045,0.036,0.020],'round ivory mochi')
 for(let i=0;i<3;i++){const a=i/3*Math.PI*2,g=new SphereGeometry(1,6,4);g.scale(0.002,0.003,0.002);emit(parts.sweets,g,'glaze',[-0.045+0.003*Math.sin(a),0.042,0.025+0.003*Math.cos(a)],'nerikiri flower centre')}
 const leaf=new SphereGeometry(1,8,8,Math.PI*0.2,Math.PI*0.6);leaf.scale(0.0277,0.0247,0.0277)
 emit(parts.leaf,leaf,'glazeMoss',[0.045,0.036,0.020],'fitted mochi leaf wrap')
}

 }
 rebuild()
 return{root,parts,materials,getConfig:()=>({...config}),
  configure(patch){if(disposed)return;if(patch.sweets!==undefined)config.sweets=Boolean(patch.sweets);rebuild()},
  setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},
  update(){},
  dispose(){if(disposed)return;disposed=true;geometries.splice(0).forEach(g=>g.dispose());bundle.dispose();root.removeFromParent()}
 }
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
