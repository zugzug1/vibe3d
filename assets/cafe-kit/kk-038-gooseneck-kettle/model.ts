// Storytelling prop; 0.26 W × 0.15 D × 0.22 H m. 2000 triangle ceiling.
// Bottom-centre origin, +Y up, +Z front. Preview content stays outside the model.
import { Group, Mesh, BufferGeometry, LatheGeometry, Vector2, Vector3, Shape, ExtrudeGeometry, CatmullRomCurve3, BufferAttribute, type MeshStandardMaterial, type Material } from 'three/webgpu'
import { createKkPreview, socket, bevelBox } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID='kk-038-gooseneck-kettle'
export type Slot='ink'|'cedar'|'brass'
export interface GooseneckKettleConfig{lid:boolean}
export interface GooseneckKettleOptions extends Partial<GooseneckKettleConfig>{materials?:Partial<Record<Slot,Material>>}
export interface GooseneckKettleInstance{
 readonly root:Group
 readonly parts:{body:Group;spout:Group;handle:Group;lid:Group}
 readonly materials:Readonly<Record<Slot,Material>>
 getConfig():Readonly<GooseneckKettleConfig>
 configure(patch:Partial<GooseneckKettleConfig>):void
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

/** Remove the wall patch hidden within the spout flange, through both skins. */
function body():BufferGeometry{
 const g=lathe([[0,0],[0.07,0],[0.075,0.014],[0.073,0.028],[0.068,0.052],[0.048,0.166],[0.044,0.168],[0.044,0.160],[0.064,0.052],[0.068,0.028],[0.065,0.010],[0,0.010]],24)
 g.rotateY(-Math.PI/24)
 const p=g.getAttribute('position'),index=g.index!,keep:number[]=[]
 for(let i=0;i<index.count;i+=3){
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)]
  const cut=ids.every(j=>p.getX(j)<-0.060&&Math.abs(p.getZ(j))<0.012&&p.getY(j)>=0.02799&&p.getY(j)<=0.05201)
   if(!cut)keep.push(...ids)
  }
  g.setIndex(keep);g.scale(1,1,1/Math.cos(Math.PI/24));g.computeVertexNormals();return g
}
function spout():BufferGeometry{
 const curve=new CatmullRomCurve3([new Vector3(-0.064,0.040,0),new Vector3(-0.087,0.040,0),new Vector3(-0.098,0.062,0),new Vector3(-0.103,0.128,0),new Vector3(-0.119,0.170,0),new Vector3(-0.125,0.175,0),new Vector3(-0.14,0.175,0)])
 const frames=curve.computeFrenetFrames(16,false),p:number[]=[],indices:number[]=[]
 for(let skin=0;skin<2;skin++)for(let i=0;i<=16;i++){
  const t=i/16,c=curve.getPointAt(t),r=(0.017*(1-t)+0.0058*t)-(skin?0.0024:0)
  for(let j=0;j<8;j++){const a=j/8*Math.PI*2,v=c.clone().addScaledVector(frames.normals[i]!,Math.cos(a)*r).addScaledVector(frames.binormals[i]!,Math.sin(a)*r);p.push(v.x,v.y,v.z)}
 }
 const n=17*8
 for(let i=0;i<16;i++)for(let j=0;j<8;j++){
  const a=i*8+j,b=i*8+(j+1)%8,c=b+8,d=a+8
  indices.push(a,b,d,b,c,d,a+n,d+n,b+n,b+n,d+n,c+n)
 }
 for(const i of [0,16])for(let j=0;j<8;j++){
  const a=i*8+j,b=i*8+(j+1)%8
  if(i===16)indices.push(a,b,a+n,b,b+n,a+n);else indices.push(a,a+n,b,b,a+n,b+n)
 }
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p),3));g.setIndex(indices);g.computeVertexNormals()
 // Project each triangle independently: valid nonzero UV area even on annular ends.
 const mapped=g.toNonIndexed();g.dispose()
 const positions=mapped.getAttribute('position'),uv:number[]=[]
 for(let i=0;i<positions.count;i+=3){
  const a=new Vector3().fromBufferAttribute(positions,i),b=new Vector3().fromBufferAttribute(positions,i+1),c=new Vector3().fromBufferAttribute(positions,i+2)
  const u=b.clone().sub(a).normalize(),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize(),v=normal.cross(u)
  for(const p of [a,b,c]){const d=p.clone().sub(a);uv.push(d.dot(u)/0.04,d.dot(v)/0.04)}
 }
 mapped.setAttribute('uv',new BufferAttribute(new Float32Array(uv),2));return mapped
}
function handle():BufferGeometry{
 const s=new Shape();s.moveTo(0.057,0.158);s.lineTo(0.084,0.189);s.quadraticCurveTo(0.105,0.190,0.111,0.174);s.lineTo(0.120,0.102);s.quadraticCurveTo(0.119,0.074,0.103,0.071);s.lineTo(0.065,0.078);s.lineTo(0.065,0.092);s.lineTo(0.087,0.094);s.lineTo(0.099,0.109);s.lineTo(0.095,0.153);s.lineTo(0.081,0.165);s.lineTo(0.064,0.145);s.closePath()
 const g=new ExtrudeGeometry(s,{depth:0.018,bevelEnabled:false,curveSegments:4});g.translate(0,0,-0.009);boardUVs(g,[0.065,0.12,0.018]);return g
}
/** Creates owned geometry and stable semantic anchors for one storytelling prop. */
export function createModel(options:GooseneckKettleOptions={}):GooseneckKettleInstance{
 const config:GooseneckKettleConfig={lid:options.lid??true}
 const bundle=acquireSurfaceMaterials({ink:'glaze',cedar:'cedar',brass:'glaze'},options.materials)
 const materials:Record<Slot,Material>={ink:bundle.materials.ink,cedar:bundle.materials.cedar,brass:bundle.materials.brass}
 if(!options.materials?.ink){const iron=materials.ink as MeshStandardMaterial;iron.roughness=0.55;iron.metalness=0.35;iron.color.multiplyScalar(1.16)}
 const root=new Group();root.name=ID;root.userData.category='storytelling';root.userData.triangleBudget=2000
 const parts={body:new Group(),spout:new Group(),handle:new Group(),lid:new Group()},content=new Map<Group,Group>()
 for(const [name,anchor]of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-'+ID,[0,0,0]))
 const geometries:BufferGeometry[]=[];let disposed=false
 const emit=(part:Group,g:BufferGeometry,slot:Slot,p:[number,number,number],name:string):Mesh=>{
  geometries.push(g);const mesh=new Mesh(g,materials[slot]);mesh.name=ID+' / '+name;mesh.position.set(...p);mesh.userData.materialSlot=slot;mesh.castShadow=true;mesh.receiveShadow=true;content.get(part)!.add(mesh);return mesh
 }
 const rebuild=():void=>{
  content.forEach(g=>g.clear());geometries.splice(0).forEach(g=>g.dispose())
  
emit(parts.body,body(),'ink',[0,0,0],'hollow tapered kettle body')
emit(parts.spout,spout(),'ink',[0,0,0],'open continuous gooseneck spout')
emit(parts.handle,handle(),'cedar',[0,0,0],'open sculpted timber handle')
emit(parts.handle,bevelBox(0.025,0.020,0.022,0.001),'ink',[0.0565,0.151,0],'seated upper handle bracket')
emit(parts.handle,bevelBox(0.018,0.012,0.020,0.001),'ink',[0.063,0.084,0],'seated lower handle bracket')
if(config.lid){
 emit(parts.lid,lathe([[0,0.165],[0.045,0.165],[0.049,0.171],[0.045,0.180],[0.016,0.184],[0,0.184]],24),'ink',[0,0,0],'seated metal lid')
 emit(parts.lid,lathe([[0,0.182],[0.009,0.182],[0.009,0.195],[0.016,0.201],[0.016,0.215],[0.012,0.220],[0,0.220]],12),'cedar',[0,0,0],'timber lid knob')
}
emit(parts.handle,lathe([[0,0],[0.003,0],[0.003,0.002],[0,0.002]],8),'brass',[0.063,0.151,0.009],'handle fixing')

 }
 rebuild()
 return{root,parts,materials,getConfig:()=>({...config}),
  configure(patch){if(disposed)return;if(patch.lid!==undefined)config.lid=Boolean(patch.lid);rebuild()},
  setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},
  update(){},
  dispose(){if(disposed)return;disposed=true;geometries.splice(0).forEach(g=>g.dispose());bundle.dispose();root.removeFromParent()}
 }
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
