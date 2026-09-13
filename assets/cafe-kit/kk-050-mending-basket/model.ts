// 0.3 × 0.25 × 0.2 m (W,D,H); storytelling, 2000 triangles. Bottom-centre origin.
import { Group,Mesh,BufferGeometry,BufferAttribute,LatheGeometry,Vector2,Vector3,SphereGeometry,CylinderGeometry,type Material } from 'three/webgpu'
import { createKkPreview,socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials,boardUVs } from '../kk-core/surface-detail.ts'
const ID='kk-050-mending-basket'
export type Slot='cedar'|'cedarDark'|'indigo'|'washi'|'vermilion'|'glazeMoss'|'steel'
export interface MendingBasketConfig{cloth:boolean;contents:boolean}
export interface MendingBasketOptions extends Partial<MendingBasketConfig>{materials?:Partial<Record<Slot,Material>>}
export interface MendingBasketInstance{
 readonly root:Group;readonly parts:{basket:Group;handle:Group;cloth:Group;sewingBox:Group;contents:Group};readonly materials:Readonly<Record<Slot,Material>>
 getConfig():Readonly<MendingBasketConfig>;configure(patch:Partial<MendingBasketConfig>):void;setMaterial(slot:Slot,material:Material):void;update(deltaSeconds:number):void;dispose():void
}

function lathe(profile:number[][],segments=16):BufferGeometry{
 const g=new LatheGeometry(profile.map(([r,y])=>new Vector2(r!,y!)),segments),p=g.getAttribute('position'),index=g.index!,keep:number[]=[]
 for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],[a,b,c]=ids.map(j=>new Vector3().fromBufferAttribute(p,j));if(b!.sub(a!).cross(c!.sub(a!)).lengthSq()>1e-22)keep.push(...ids)}
 g.setIndex(keep);g.computeVertexNormals();return g
}
function surface(vertices:number[],indices:number[]):BufferGeometry{
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));g.setIndex(indices);g.computeVertexNormals();boardUVs(g,[0.3,0.3,0.3]);return g
}


function basket(height:number):BufferGeometry{
 const g=lathe([[0,0],[.75,0],[.78,.006],[.80,.022],[.83,.024],[.84,.041],[.87,.043],[.88,.060],[.91,.062],[.92,.079],[.95,.081],[.97,.100],[1,.106],[1,.113],[.94,.113],[.91,.100],[.77,.012],[0,.012]],20),p=g.getAttribute('position')
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),y=p.getY(i),a=Math.atan2(x,z),h=y<=.012?y:.012+(y-.012)*(height-.012)/.101
  // Reserve front drape clearance through the rim shoulders, inside the unchanged envelope.
  const relief=h>.012?.006*Math.max(0,Math.cos(a))**2:0
  p.setXYZ(i,x*.15,h-(h>.012?(h-.012)*.23*Math.max(0,Math.cos(a))**4:0),z*.125-relief)
 }
 g.computeVertexNormals();boardUVs(g,[.3,height,.25]);return g
}
function binding(a:number,height:number):BufferGeometry{
 const p:number[]=[],idx:number[]=[]
 for(let j=0;j<3;j++){
  const t=j/2,r=.785+.19*t,y=.012+t*(height-.015),dip=(y-.012)*.23*Math.max(0,Math.cos(a))**4
  for(const [dr,dt]of [[-.003,-.003],[.008,-.003],[.008,.003],[-.003,.003]])p.push((r+dr!)*.15*Math.sin(a)+dt!*Math.cos(a),y-dip,(r+dr!)*.125*Math.cos(a)-dt!*Math.sin(a)-.006*Math.max(0,Math.cos(a))**2)
 }
 for(let j=0;j<2;j++)for(let k=0;k<4;k++){const a=j*4+k,b=(j+1)*4+k,c=(j+1)*4+(k+1)%4,d=j*4+(k+1)%4;idx.push(a,b,d,b,c,d)}
 idx.push(0,2,1,0,3,2,8,9,10,8,10,11)
 return surface(p,idx)
}

function arch():BufferGeometry{
 const p:number[]=[],idx:number[]=[]
 for(let i=0;i<=16;i++){
  const a=i/16*Math.PI,n=new Vector3(.112*Math.cos(a),.138*Math.sin(a),0).normalize()
  for(const [r,z]of [[-.005,-.01],[.005,-.01],[.005,.01],[-.005,.01]])p.push(.138*Math.cos(a)+n.x*r!,.083+.112*Math.sin(a)+n.y*r!,z!)
 }
 for(let i=0;i<16;i++)for(let j=0;j<4;j++){const a=i*4+j,b=(i+1)*4+j,c=(i+1)*4+(j+1)%4,d=i*4+(j+1)%4;idx.push(a,b,d,b,c,d)}
 idx.push(0,2,1,0,3,2,64,65,66,64,66,67);return surface(p,idx)
}
function drape():BufferGeometry{
 const p:number[]=[],idx:number[]=[]
 for(const back of [false,true])for(let row=0;row<5;row++)for(let col=0;col<9;col++){
  const a=(col/8-.5)*1.4,t=row/4,r=1-.16*t,fold=.0005*Math.sin(col*2.3)*t
  p.push(.15*r*Math.sin(a),.086-.0168*Math.cos(a)**4-.051*t+fold,.125*r*Math.cos(a)+(back?-.0006:0))
 }
 const n=45
 for(let r=0;r<4;r++)for(let c=0;c<8;c++){const a=r*9+c,b=a+1,d=a+9,e=d+1;idx.push(a,d,b,b,d,e,a+n,b+n,d+n,b+n,e+n,d+n)}
 for(let c=0;c<8;c++)for(const r of [0,4]){const a=r*9+c,b=a+1;idx.push(a,b,a+n,b,b+n,a+n)}
 for(let r=0;r<4;r++)for(const c of [0,8]){const a=r*9+c,b=a+9;idx.push(a,b,a+n,b,b+n,a+n)}
 return surface(p,idx)
}
function tuckedFold():BufferGeometry{
 const p:number[]=[],idx:number[]=[]
 for(let col=0;col<9;col++){
  const a=(col/8-.5)*1.4,y=.086-.0168*Math.cos(a)**4
  // The inner edge seats within the rim; the outer edge shares the free drape seam.
  p.push(.15*Math.sin(a),y,.125*Math.cos(a))
  p.push(.15*.92*Math.sin(a),y-.003,.125*.92*Math.cos(a))
 }
 for(let col=0;col<8;col++){const a=col*2;idx.push(a,a+1,a+2,a+2,a+1,a+3)}
 return surface(p,idx)
}

/** Independent resources and stable named anatomy; the consumer owns supplied materials. */
export function createModel(options:MendingBasketOptions={}):MendingBasketInstance{
 const config:MendingBasketConfig={cloth:options.cloth??true,contents:options.contents??true}
 const bundle=acquireSurfaceMaterials<Slot>({"cedar":"fabric","cedarDark":"cedar","indigo":"fabric","washi":"fabric","vermilion":"fabric","glazeMoss":"fabric","steel":"glaze"},options.materials)
 const materials:Record<Slot,Material>={cedar:bundle.materials.cedar,cedarDark:bundle.materials.cedarDark,indigo:bundle.materials.indigo,washi:bundle.materials.washi,vermilion:bundle.materials.vermilion,glazeMoss:bundle.materials.glazeMoss,steel:bundle.materials.steel}
 const root=new Group();root.name=ID;root.userData.category='storytelling';root.userData.triangleBudget=2000
 const parts={basket:new Group(),handle:new Group(),cloth:new Group(),sewingBox:new Group(),contents:new Group()},content=new Map<Group,Group>()
 for(const [name,anchor]of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-'+ID,[0,0,0]))
 const geometries=new Set<BufferGeometry>();let disposed=false
 const release=():void=>{geometries.forEach(g=>g.dispose());geometries.clear()}
 const emit=(part:Group,g:BufferGeometry,slot:Slot,p:[number,number,number],name:string):Mesh=>{
  geometries.add(g);if(!g.getAttribute('uv'))boardUVs(g,[.3,.3,.3]);const mesh=new Mesh(g,materials[slot]);mesh.name=ID+' / '+name;mesh.userData.materialSlot=slot;mesh.position.set(...p);mesh.castShadow=true;mesh.receiveShadow=true;content.get(part)!.add(mesh);return mesh
 }
 const rebuild=():void=>{content.forEach(g=>g.clear());release()
 
emit(parts.basket,basket(.085),'cedar',[0,0,0],'low oval woven sewing basket')
for(let i=0;i<8;i++)emit(parts.basket,binding(i/8*Math.PI*2,.085),'cedarDark',[0,0,0],'seated flat wicker stake')
emit(parts.handle,arch(),'cedar',[0,0,0],'arched bentwood carrying handle')
if(config.cloth){
 emit(parts.cloth,drape(),'indigo',[0,0,0],'folded indigo cloth over front rim')
 emit(parts.cloth,tuckedFold(),'indigo',[0,0,0],'seated cloth fold across rim')
}
const box=lathe([[0,.012],[.95,.012],[1,.017],[1,.077],[.95,.083],[0,.083]],16);box.scale(.056,1,.045)
emit(parts.sewingBox,box,'cedarDark',[-.048,0,-.014],'rounded wooden sewing box')
const lid=lathe([[0,.082],[1,.082],[1,.090],[.92,.094],[0,.094]],16);lid.scale(.057,1,.046)
emit(parts.sewingBox,lid,'cedarDark',[-.048,0,-.014],'seated sewing box lid')
if(config.contents){
 for(const [x,z,slot]of [[.035,-.041,'indigo'],[.072,-.006,'glazeMoss'],[.047,.036,'vermilion']] as const){
  emit(parts.contents,lathe([[0,.012],[.018,.012],[.018,.018],[.010,.019],[.010,.067],[.018,.068],[.018,.073],[.006,.073],[.006,.065],[0,.065]],6),'cedar',[x,0,z],'hollow wooden thread spool')
  emit(parts.contents,lathe([[.010,.019],[.014,.021],[.014,.064],[.010,.067],[.010,.019]],6),slot,[x,0,z],'wound thread on spool')
 }
 const pad=new SphereGeometry(1,8,4);pad.scale(.030,.022,.025)
 emit(parts.contents,pad,'indigo',[-.006,.034,.048],'soft pincushion')
 for(const x of [-.012,0,.012]){
  emit(parts.contents,new CylinderGeometry(.0007,.0007,.028,4),'steel',[x,.058,.05],'seated sewing pin')
  emit(parts.contents,new SphereGeometry(.003,4,2),'vermilion',[x,.074,.05],'round pin head')
 }
 // Ivory folded cloth remains a formed textile, with a thin rounded cross section.
 const cloth=new SphereGeometry(1,8,4);cloth.scale(.031,.038,.012)
 emit(parts.contents,cloth,'washi',[.056,.050,-.065],'folded spare mending cloth')
}

 }
 rebuild()
 return{root,parts,materials,getConfig:()=>({...config}),configure(patch){if(disposed)return;if(patch.cloth!==undefined)config.cloth=Boolean(patch.cloth);if(patch.contents!==undefined)config.contents=Boolean(patch.contents);rebuild()},
 setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},update(){},dispose(){if(disposed)return;disposed=true;release();bundle.dispose();root.removeFromParent()}}
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
