// 0.3 × 0.25 × 0.35 m (W,D,H); storytelling, 2000 triangles. Bottom-centre origin.
import { Group,Mesh,BufferGeometry,BufferAttribute,LatheGeometry,Vector2,Vector3,TubeGeometry,CatmullRomCurve3,SphereGeometry,CylinderGeometry,type MeshStandardMaterial,type Material } from 'three/webgpu'
import { createKkPreview,socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials,boardUVs } from '../kk-core/surface-detail.ts'
const ID='kk-046-cat-toy-basket'
export type Slot='cedar'|'cedarDark'|'glazeMoss'|'washi'|'vermilion'|'indigo'|'ink'
export interface ToyBasketConfig{toys:boolean;wand:boolean}
export interface ToyBasketOptions extends Partial<ToyBasketConfig>{materials?:Partial<Record<Slot,Material>>}
export interface ToyBasketInstance{
 readonly root:Group;readonly parts:{basket:Group;liner:Group;handles:Group;toys:Group;wand:Group};readonly materials:Readonly<Record<Slot,Material>>
 getConfig():Readonly<ToyBasketConfig>;configure(patch:Partial<ToyBasketConfig>):void;setMaterial(slot:Slot,material:Material):void;update(deltaSeconds:number):void;dispose():void
}

function lathe(profile:number[][],segments=16):BufferGeometry{
 const g=new LatheGeometry(profile.map(([r,y])=>new Vector2(r!,y!)),segments),p=g.getAttribute('position'),index=g.index!,keep:number[]=[]
 for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],[a,b,c]=ids.map(j=>new Vector3().fromBufferAttribute(p,j));if(b!.sub(a!).cross(c!.sub(a!)).lengthSq()>1e-22)keep.push(...ids)}
 g.setIndex(keep);g.computeVertexNormals();return g
}
function surface(vertices:number[],indices:number[]):BufferGeometry{
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));g.setIndex(indices);g.computeVertexNormals();boardUVs(g,[0.3,0.3,0.3]);return g
}
function tube(points:number[][],radius:number,segments=8,radial=4,closed=false):BufferGeometry{
 return new TubeGeometry(new CatmullRomCurve3(points.map(p=>new Vector3(...p as [number,number,number])),closed),segments,radius,radial,closed)
}


function basket(height:number):BufferGeometry{
 const g=lathe([[0,0],[.75,0],[.78,.006],[.80,.022],[.83,.024],[.84,.041],[.87,.043],[.88,.060],[.91,.062],[.92,.079],[.95,.081],[.97,.100],[1,.106],[1,.113],[.94,.113],[.91,.100],[.77,.012],[0,.012]],20),p=g.getAttribute('position')
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),y=p.getY(i),a=Math.atan2(x,z),h=y<=.012?y:.012+(y-.012)*(height-.012)/.101
  p.setXYZ(i,x*.15,h-(h>.012?(h-.012)*.23*Math.max(0,Math.cos(a))**4:0),z*.125)
 }
 g.computeVertexNormals();boardUVs(g,[.3,height,.25]);return g
}
function binding(a:number,height:number):BufferGeometry{
 const p:number[]=[],idx:number[]=[]
 for(let j=0;j<3;j++){
  const t=j/2,r=[.795,.932,.982][j]!,y=.012+t*(height-.015),dip=(y-.012)*.23*Math.max(0,Math.cos(a))**4
  for(const [dr,dt]of [[-.003,-.003],[.008,-.003],[.008,.003],[-.003,.003]])p.push((r+dr!)*.15*Math.sin(a)+dt!*Math.cos(a),y-dip,(r+dr!)*.125*Math.cos(a)-dt!*Math.sin(a))
 }
 for(let j=0;j<2;j++)for(let k=0;k<4;k++){const a=j*4+k,b=(j+1)*4+k,c=(j+1)*4+(k+1)%4,d=j*4+(k+1)%4;idx.push(a,b,d,b,c,d)}
 idx.push(0,2,1,0,3,2,8,9,10,8,10,11)
 return surface(p,idx)
}
function feather(length:number,width:number):BufferGeometry{
 const outline=[[0,0],[-.5,.2],[-1,.46],[-.72,.71],[-.34,.89],[0,1],[.44,.79],[.82,.55],[.52,.27]]
 const p:number[]=[],idx:number[]=[]
 for(const z of [.001,-.001]){
  p.push(0,length*.47,z)
  for(const [x,y]of outline)p.push(x!*width,y!*length,0)
 }
 for(let i=0;i<9;i++){const a=i+1,b=(i+1)%9+1;idx.push(0,a,b,10,10+b,10+a)}
 return surface(p,idx)
}

function mouse():BufferGeometry{
 const g=new SphereGeometry(1,10,6),p=g.getAttribute('position')
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),taper=.72-.25*x;p.setXYZ(i,x*.052,y*.050*taper,z*.034*taper)}
 g.computeVertexNormals();return g
}

/** Independent resources and stable named anatomy; the consumer owns supplied materials. */
export function createModel(options:ToyBasketOptions={}):ToyBasketInstance{
 const config:ToyBasketConfig={toys:options.toys??true,wand:options.wand??true}
 const bundle=acquireSurfaceMaterials<Slot>({"cedar":"fabric","cedarDark":"fabric","glazeMoss":"fabric","washi":"fabric","vermilion":"fabric","indigo":"fabric","ink":"fabric"},options.materials)
 const materials:Record<Slot,Material>={cedar:bundle.materials.cedar,cedarDark:bundle.materials.cedarDark,glazeMoss:bundle.materials.glazeMoss,washi:bundle.materials.washi,vermilion:bundle.materials.vermilion,indigo:bundle.materials.indigo,ink:bundle.materials.ink}
 if(!options.materials?.glazeMoss)(materials.glazeMoss as MeshStandardMaterial).roughness=.92
 const root=new Group();root.name=ID;root.userData.category='storytelling';root.userData.triangleBudget=2000
 const parts={basket:new Group(),liner:new Group(),handles:new Group(),toys:new Group(),wand:new Group()},content=new Map<Group,Group>()
 for(const [name,anchor]of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-'+ID,[0,0,0]))
 const geometries=new Set<BufferGeometry>();let disposed=false
 const release=():void=>{geometries.forEach(g=>g.dispose());geometries.clear()}
 const emit=(part:Group,g:BufferGeometry,slot:Slot,p:[number,number,number],name:string):Mesh=>{
  geometries.add(g);if(!g.getAttribute('uv'))boardUVs(g,[.3,.3,.3]);const mesh=new Mesh(g,materials[slot]);mesh.name=ID+' / '+name;mesh.userData.materialSlot=slot;mesh.position.set(...p);mesh.castShadow=true;mesh.receiveShadow=true;content.get(part)!.add(mesh);return mesh
 }
 const rebuild=():void=>{content.forEach(g=>g.clear());release()
 
emit(parts.basket,basket(.120),'cedar',[0,0,0],'dense shallow woven toy basket')
for(let i=0;i<10;i++)emit(parts.basket,binding(i/10*Math.PI*2,.120),'cedarDark',[0,0,0],'seated flat wicker stake')
const liner=lathe([[0,.013],[.74,.013],[.86,.085],[.915,.119],[.985,.123],[.987,.118],[.925,.105]],20),lp=liner.getAttribute('position')
for(let i=0;i<lp.count;i++){const x=lp.getX(i),z=lp.getZ(i),y=lp.getY(i),a=Math.atan2(x,z);lp.setXYZ(i,x*.15,y-(y-.013)*.23*Math.max(0,Math.cos(a))**4,z*.125)}
const linerIndex=liner.index!,inside:number[]=[]
for(let i=0;i<linerIndex.count;i+=3)inside.push(linerIndex.getX(i),linerIndex.getX(i+2),linerIndex.getX(i+1))
liner.setIndex(inside);liner.computeVertexNormals()
emit(parts.liner,liner,'glazeMoss',[0,0,0],'fitted moss cloth lining')
for(const side of [-1,1]){
 emit(parts.handles,tube([[side*.132,.096,-.036],[side*.141,.142,-.026],[side*.143,.171,0],[side*.141,.142,.027],[side*.132,.096,.036]],.005,12,5),'cedar',[0,0,0],'seated side basket handle')
 for(const z of [-.036,.036])emit(parts.handles,new CylinderGeometry(.006,.007,.013,4),'cedarDark',[side*.132,.098,z],'rounded handle attachment binding')
}
if(config.toys){
 const mouseShape=mouse();mouseShape.computeBoundingBox()
 emit(parts.toys,mouseShape,'washi',[-.048,.013-mouseShape.boundingBox!.min.y,.035],'tapered cloth mouse')
 // Base touches the lining, with muzzle and ears sculpted into the mouse silhouette.
 const ear=new SphereGeometry(1,6,4);ear.scale(.012,.014,.003)
 emit(parts.toys,ear,'vermilion',[-.064,.080,.058],'mouse fabric ear')
 emit(parts.toys,ear,'vermilion',[-.073,.080,.024],'mouse second fabric ear')
 emit(parts.toys,new SphereGeometry(.003,6,4),'ink',[-.023,.064,.052],'mouse stitched eye')
 emit(parts.toys,tube([[-.096,.039,.035],[-.105,.022,.057],[-.081,.014,.070]],.0018,8,4),'vermilion',[0,0,0],'curved sewn mouse tail')
 const fish=lathe([[0,-.045],[.006,-.042],[.022,-.022],[.025,.004],[.016,.025],[.005,.035],[.014,.047],[0,.047]],8);fish.rotateZ(-Math.PI/2)
 emit(parts.toys,fish,'vermilion',[.047,.038,.033],'tapered cloth fish with tail')
 const ball=new SphereGeometry(1,10,6);ball.scale(.034,.060,.032)
 emit(parts.toys,ball,'indigo',[.025,.073,-.037],'soft oval play ball')
}
if(config.wand){
 const a=new Vector3(-.058,.013,-.020),b=new Vector3(-.102,.276,-.020),g=new CylinderGeometry(.002,.003,a.distanceTo(b),6),wand=emit(parts.wand,g,'cedar',a.clone().lerp(b,.5).toArray() as [number,number,number],'seated feather wand')
 wand.quaternion.setFromUnitVectors(new Vector3(0,1,0),b.clone().sub(a).normalize())
 for(const [angle,length,width,slot]of [[-.55,.065,.012,'indigo'],[0,.074,.015,'vermilion'],[.52,.063,.012,'washi']] as const){const f=feather(length,width);f.rotateZ(angle);emit(parts.wand,f,slot,b.toArray() as [number,number,number],'shaped attached feather')}
 emit(parts.wand,tube([[-.100,.269,-.020],[-.105,.265,-.020],[-.099,.260,-.020]],.002,4,4),'ink',[0,0,0],'wand feather binding')
 emit(parts.wand,new CylinderGeometry(.005,.005,.012,4),'ink',[-.102,.275,-.020],'seated feather ferrule')
}

 }
 rebuild()
 return{root,parts,materials,getConfig:()=>({...config}),configure(patch){if(disposed)return;if(patch.toys!==undefined)config.toys=Boolean(patch.toys);if(patch.wand!==undefined)config.wand=Boolean(patch.wand);rebuild()},
 setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},update(){},dispose(){if(disposed)return;disposed=true;release();bundle.dispose();root.removeFromParent()}}
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
