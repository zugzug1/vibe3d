// 0.25 × 0.25 × 0.55 m (W,D,H); storytelling, 2000 triangles. Bottom-centre origin.
import { Group,Mesh,BufferGeometry,BufferAttribute,LatheGeometry,Vector2,Vector3,ShapeUtils,CylinderGeometry,type Material } from 'three/webgpu'
import { createKkPreview,socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials,boardUVs } from '../kk-core/surface-detail.ts'
const ID='kk-045-maple-branch-vase'
export type Slot='glaze'|'glazeDeep'|'cedarDark'|'vermilion'
export interface MapleVaseConfig{branch:boolean}
export interface MapleVaseOptions extends Partial<MapleVaseConfig>{materials?:Partial<Record<Slot,Material>>}
export interface MapleVaseInstance{
 readonly root:Group;readonly parts:{vessel:Group;branch:Group;leaves:Group};readonly materials:Readonly<Record<Slot,Material>>
 getConfig():Readonly<MapleVaseConfig>;configure(patch:Partial<MapleVaseConfig>):void;setMaterial(slot:Slot,material:Material):void;update(deltaSeconds:number):void;dispose():void
}

function lathe(profile:number[][],segments=16):BufferGeometry{
 const g=new LatheGeometry(profile.map(([r,y])=>new Vector2(r!,y!)),segments),p=g.getAttribute('position'),index=g.index!,keep:number[]=[]
 for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],[a,b,c]=ids.map(j=>new Vector3().fromBufferAttribute(p,j));if(b!.sub(a!).cross(c!.sub(a!)).lengthSq()>1e-22)keep.push(...ids)}
 g.setIndex(keep);g.computeVertexNormals();return g
}
function surface(vertices:number[],indices:number[]):BufferGeometry{
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));g.setIndex(indices);g.computeVertexNormals();boardUVs(g,[0.3,0.3,0.3]);return g
}


function maple(start:Vector3,end:Vector3,width:number):BufferGeometry{
 const dir=end.clone().sub(start),length=dir.length(),up=dir.clone().normalize(),side=new Vector3().crossVectors(up,new Vector3(.4,.65,1))
 if(side.lengthSq()<0.01)side.crossVectors(up,new Vector3(1,0,0))
 side.normalize().applyAxisAngle(up,.25*Math.sin(start.x*37+start.z*21))
 const normal=new Vector3().crossVectors(side,up).normalize(),outline=[[0,0],[-.08,.13],[-.25,.16],[-.38,.23],[-.30,.32],[-.49,.40],[-.60,.56],[-.39,.54],[-.22,.44],[-.28,.67],[-.32,.84],[-.16,.72],[-.085,.59],[-.09,.82],[0,1],[.12,.80],[.105,.60],[.26,.73],[.40,.83],[.35,.63],[.23,.44],[.48,.53],[.61,.57],[.49,.38],[.29,.30],[.40,.21],[.20,.16],[.075,.11]]
 const p:number[]=[],idx:number[]=[],contour=outline.map(([x,y])=>new Vector2(x!,y!))
 for(const skin of [1,-1]){
  for(const [x,y]of outline){
   const fold=.0008*Math.sin(Math.PI*y!)*(1-.5*Math.abs(x!))
   p.push(...start.clone().addScaledVector(up,y!*length).addScaledVector(side,x!*width).addScaledVector(normal,fold+(skin===1?0:-.0005)).toArray())
  }
 }
 // Ear clipping respects every lobe notch; a radial fan crosses the concave outline.
 const n=outline.length,top:number[]=[]
 for(const triangle of ShapeUtils.triangulateShape(contour,[])){
  const [a,b,c]=triangle as [number,number,number],pa=contour[a]!,pb=contour[b]!,pc=contour[c]!
  if((pb.x-pa.x)*(pc.y-pa.y)-(pb.y-pa.y)*(pc.x-pa.x)>0)top.push(a,b,c);else top.push(a,c,b)
 }
 idx.push(...top)
 for(let i=0;i<top.length;i+=3)idx.push(n+top[i]!,n+top[i+2]!,n+top[i+1]!)
 const clockwise=ShapeUtils.isClockWise(contour)
 for(let a=0;a<n;a++){const b=(a+1)%n;if(clockwise)idx.push(a,b,n+a,b,n+b,n+a);else idx.push(a,n+a,b,b,n+a,n+b)}
 return surface(p,idx)
}

/** Independent resources and stable named anatomy; the consumer owns supplied materials. */
export function createModel(options:MapleVaseOptions={}):MapleVaseInstance{
 const config:MapleVaseConfig={branch:options.branch??true}
 const bundle=acquireSurfaceMaterials<Slot>({"glaze":"glaze","glazeDeep":"glaze","cedarDark":"cedar","vermilion":"fabric"},options.materials)
 const materials:Record<Slot,Material>={glaze:bundle.materials.glaze,glazeDeep:bundle.materials.glazeDeep,cedarDark:bundle.materials.cedarDark,vermilion:bundle.materials.vermilion}
 const root=new Group();root.name=ID;root.userData.category='storytelling';root.userData.triangleBudget=2000
 const parts={vessel:new Group(),branch:new Group(),leaves:new Group()},content=new Map<Group,Group>()
 for(const [name,anchor]of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-'+ID,[0,0,0]))
 const geometries=new Set<BufferGeometry>();let disposed=false
 const release=():void=>{geometries.forEach(g=>g.dispose());geometries.clear()}
 const emit=(part:Group,g:BufferGeometry,slot:Slot,p:[number,number,number],name:string):Mesh=>{
  geometries.add(g);if(!g.getAttribute('uv'))boardUVs(g,[.3,.3,.3]);const mesh=new Mesh(g,materials[slot]);mesh.name=ID+' / '+name;mesh.userData.materialSlot=slot;mesh.position.set(...p);mesh.castShadow=true;mesh.receiveShadow=true;content.get(part)!.add(mesh);return mesh
 }
 const rebuild=():void=>{content.forEach(g=>g.clear());release()
 
emit(parts.vessel,lathe([[0,0],[.029,0],[.038,.017],[.047,.068],[.045,.118],[.036,.171],[.023,.211],[.019,.228],[.022,.241],[.024,.245],[.019,.245],[.014,.229],[.017,.210],[.031,.168],[.039,.111],[.039,.031],[.027,.012],[0,.012]],16),'glaze',[0,0,0],'hollow narrow handmade vase')
emit(parts.vessel,lathe([[.0292,.001],[.0381,.018],[.0458,.052],[.0459,.052],[.0382,.018],[.0293,.001],[.0292,.001]],16),'glazeDeep',[0,0,0],'dark foot glaze')
if(config.branch){
 const stem=(a:Vector3,b:Vector3,r:number):void=>{const g=new CylinderGeometry(r*.72,r,a.distanceTo(b),6),m=emit(parts.branch,g,'cedarDark',a.clone().lerp(b,.5).toArray() as [number,number,number],'connected angular maple branch');m.quaternion.setFromUnitVectors(new Vector3(0,1,0),b.clone().sub(a).normalize())}
 const trunk=[new Vector3(0,.012,0),new Vector3(0,.249,0),new Vector3(-.018,.322,0),new Vector3(-.048,.388,-.015),new Vector3(-.058,.461,-.025)]
 for(let i=0;i<trunk.length-1;i++)stem(trunk[i]!,trunk[i+1]!,0.006-i*.001)
 const leaves=[
  [trunk[4]!,new Vector3(-.057,.481,-.027),new Vector3(-.057,.55,-.027),.065],
  [trunk[3]!,new Vector3(-.070,.413,-.015),new Vector3(-.12492,.443,-.015),.062],
  [trunk[2]!,new Vector3(.056,.369,.008),new Vector3(.12492,.401,.008),.069],
  [trunk[3]!,new Vector3(-.026,.437,-.066),new Vector3(-.026,.477,-.12486),.065],
  [trunk[2]!,new Vector3(.012,.347,.066),new Vector3(.012,.389,.12486),.050],
  [trunk[3]!,new Vector3(-.033,.400,.041),new Vector3(-.062,.437,.066),.053]
 ] as const
 for(const [origin,a,b,w]of leaves){stem(origin,a,.0025);emit(parts.leaves,maple(a,b,w),'vermilion',[0,0,0],'attached five-lobed maple leaf')}
}

 }
 rebuild()
 return{root,parts,materials,getConfig:()=>({...config}),configure(patch){if(disposed)return;if(patch.branch!==undefined)config.branch=Boolean(patch.branch);rebuild()},
 setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},update(){},dispose(){if(disposed)return;disposed=true;release();bundle.dispose();root.removeFromParent()}}
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
