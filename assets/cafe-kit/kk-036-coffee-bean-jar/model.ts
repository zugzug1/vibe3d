// Storytelling prop; 0.14 W × 0.14 D × 0.24 H m. 2000 triangle ceiling.
// Bottom-centre origin, +Y up, +Z front. Preview content stays outside the model.
import { Group, Mesh, BufferGeometry, BufferAttribute, LatheGeometry, Vector2, Vector3, Matrix4, DoubleSide, type MeshStandardMaterial, type Material } from 'three/webgpu'
import { createKkPreview, socket, DERIVED } from '../kk-core/index.ts'
import { acquireSurfaceMaterials } from '../kk-core/surface-detail.ts'
const ID='kk-036-coffee-bean-jar'
export type Slot='glass'|'glazeMoss'|'washi'|'ink'
export interface CoffeeBeanJarConfig{lid:boolean;beans:boolean}
export interface CoffeeBeanJarOptions extends Partial<CoffeeBeanJarConfig>{materials?:Partial<Record<Slot,Material>>}
export interface CoffeeBeanJarInstance{
 readonly root:Group
 readonly parts:{vessel:Group;lid:Group;beans:Group}
 readonly materials:Readonly<Record<Slot,Material>>
 getConfig():Readonly<CoffeeBeanJarConfig>
 configure(patch:Partial<CoffeeBeanJarConfig>):void
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

function bean():BufferGeometry{
 // Closed 16-triangle ellipsoid: two raised lobes flank a real recessed seam.
 const p=[0,0,-0.016, 0.010,0,-0.008, 0.010,0,0.008, 0,0,0.016,
  -0.010,0,0.008, -0.010,0,-0.008, 0.0045,0.0055,0, 0,0.001,0,
  -0.0045,0.0055,0, 0,-0.0055,0]
 const index=[0,6,1,1,6,2,2,6,3,3,8,4,4,8,5,5,8,0,0,7,6,6,7,3,3,7,8,8,7,0]
 for(let i=0;i<6;i++)index.push(i,(i+1)%6,9)
 const g=new BufferGeometry(),uv:number[]=[]
 for(let i=0;i<p.length;i+=3)uv.push(p[i]!/0.020+0.5,p[i+2]!/0.032+0.5)
 g.setAttribute('position',new BufferAttribute(new Float32Array(p),3));g.setAttribute('uv',new BufferAttribute(new Float32Array(uv),2))
 g.setIndex(index);g.computeVertexNormals();return g
}
/** Creates owned geometry and stable semantic anchors for one storytelling prop. */
export function createModel(options:CoffeeBeanJarOptions={}):CoffeeBeanJarInstance{
 const config:CoffeeBeanJarConfig={lid:options.lid??true,beans:options.beans??true}
 const bundle=acquireSurfaceMaterials<'glazeMoss'|'washi'|'ink'>({glazeMoss:'glaze',washi:'paper',ink:'glaze'},options.materials)
 const materials:Record<Slot,Material>={glass:(bundle.materials as Record<Slot,Material>).glass,glazeMoss:bundle.materials.glazeMoss,washi:bundle.materials.washi,ink:bundle.materials.ink}
 if(!options.materials?.glass)(materials.glass as MeshStandardMaterial).side=DoubleSide
if(!options.materials?.ink){const ink=materials.ink as MeshStandardMaterial;ink.color.set(DERIVED.CEDAR_DARK).multiplyScalar(0.38);ink.roughness=0.84}
 const root=new Group();root.name=ID;root.userData.category='storytelling';root.userData.triangleBudget=2000
 const parts={vessel:new Group(),lid:new Group(),beans:new Group()},content=new Map<Group,Group>()
 for(const [name,anchor]of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-'+ID,[0,0,0]))
 const geometries:BufferGeometry[]=[];let disposed=false
 const emit=(part:Group,g:BufferGeometry,slot:Slot,p:[number,number,number],name:string):Mesh=>{
  if(!geometries.includes(g))geometries.push(g);const mesh=new Mesh(g,materials[slot]);mesh.name=ID+' / '+name;mesh.position.set(...p);mesh.userData.materialSlot=slot;mesh.castShadow=slot!=='glass';mesh.receiveShadow=true;content.get(part)!.add(mesh);return mesh
 }
 const rebuild=():void=>{
  content.forEach(g=>g.clear());geometries.splice(0).forEach(g=>g.dispose())
  
emit(parts.vessel,lathe([[0,0],[0.060,0],[0.067,0.006],[0.07,0.018],[0.07,0.174],[0.065,0.19],[0.058,0.199],[0.058,0.211]],16),'glass',[0,0,0],'single-layer open glass vessel')
emit(parts.vessel,lathe([[0.058,0.199],[0.061,0.199],[0.062,0.210],[0.057,0.210],[0.058,0.199]],16),'washi',[0,0,0],'hollow fitted neck gasket')
if(config.lid){
 // Recessed plug overlaps the neck bore; the shoulder seats over the gasket.
 emit(parts.lid,lathe([[0,0.205],[0.058,0.205],[0.058,0.209],[0.063,0.209],[0.065,0.215],[0.064,0.224],[0,0.225]],16),'glazeMoss',[0,0,0],'fitted ceramic lid')
 emit(parts.lid,lathe([[0,0.224],[0.010,0.224],[0.013,0.237],[0.011,0.240],[0,0.240]],10),'glazeMoss',[0,0,0],'ceramic lid knob')
}
if(config.beans){
 // No cylinder or bulk mesh anywhere: every visible and interior piece is a bean.
 const sharedBean=bean()
 for(let row=0;row<10;row++)for(let i=0;i<8;i++){
  const a=(i+(row%2)*0.28)/8*Math.PI*2,radial=new Vector3(Math.sin(a),0,Math.cos(a))
  const b=emit(parts.beans,sharedBean,'ink',[0.043*radial.x,0.010+row*0.0165,0.043*radial.z],'visible coffee bean')
  b.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0,1,0),radial,new Vector3(Math.cos(a),0,-Math.sin(a))))
  if(row>0)b.rotateY((i%3-1)*0.16)
 }
 for(let i=0;i<4;i++){const a=i/4*Math.PI*2;const b=emit(parts.beans,sharedBean,'ink',[0.022*Math.sin(a),0.160,0.022*Math.cos(a)],'top coffee bean');b.rotation.y=a}
}

 }
 rebuild()
 return{root,parts,materials,getConfig:()=>({...config}),
  configure(patch){if(disposed)return;if(patch.lid!==undefined)config.lid=Boolean(patch.lid);if(patch.beans!==undefined)config.beans=Boolean(patch.beans);rebuild()},
  setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},
  update(){},
  dispose(){if(disposed)return;disposed=true;geometries.splice(0).forEach(g=>g.dispose());bundle.dispose();root.removeFromParent()}
 }
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
