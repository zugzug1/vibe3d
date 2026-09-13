// 0.09 × 0.09 × 0.4 m (W,D,H); storytelling, 2000 triangles. Bottom-centre origin.
import { Group,Mesh,BufferGeometry,LatheGeometry,Vector2,Vector3,TubeGeometry,CatmullRomCurve3,SphereGeometry,Shape,Path,ExtrudeGeometry,type Material } from 'three/webgpu'
import { createKkPreview,socket } from '../kk-core/index.ts'
import { acquireSurfaceMaterials,boardUVs } from '../kk-core/surface-detail.ts'
const ID='kk-044-ceramic-wind-bell'
export type Slot='glaze'|'glazeMoss'|'vermilion'|'washi'|'indigo'
export interface WindBellConfig{paper:boolean}
export interface WindBellOptions extends Partial<WindBellConfig>{materials?:Partial<Record<Slot,Material>>}
export interface WindBellInstance{
 readonly root:Group;readonly parts:{shell:Group;suspension:Group;clapper:Group;paper:Group};readonly materials:Readonly<Record<Slot,Material>>
 getConfig():Readonly<WindBellConfig>;configure(patch:Partial<WindBellConfig>):void;setMaterial(slot:Slot,material:Material):void;update(deltaSeconds:number):void;dispose():void
}

function lathe(profile:number[][],segments=16):BufferGeometry{
 const g=new LatheGeometry(profile.map(([r,y])=>new Vector2(r!,y!)),segments),p=g.getAttribute('position'),index=g.index!,keep:number[]=[]
 for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],[a,b,c]=ids.map(j=>new Vector3().fromBufferAttribute(p,j));if(b!.sub(a!).cross(c!.sub(a!)).lengthSq()>1e-22)keep.push(...ids)}
 g.setIndex(keep);g.computeVertexNormals();return g
}
function tube(points:number[][],radius:number,segments=8,radial=4,closed=false):BufferGeometry{
 return new TubeGeometry(new CatmullRomCurve3(points.map(p=>new Vector3(...p as [number,number,number])),closed),segments,radius,radial,closed)
}


function paperStrip():BufferGeometry{
 const s=new Shape();s.moveTo(-0.014,0);s.lineTo(0.014,0);s.lineTo(0.011,0.18);s.lineTo(-0.011,0.18);s.closePath()
 const hole=new Path();hole.absarc(0,0.171,0.0021,0,Math.PI*2,true);s.holes.push(hole)
 const g=new ExtrudeGeometry(s,{depth:0.0006,bevelEnabled:false,curveSegments:6}),p=g.getAttribute('position')
 for(let i=0;i<p.count;i++){const t=1-p.getY(i)/0.18;p.setZ(i,p.getZ(i)+0.008*t*t);p.setX(i,p.getX(i)+0.006*t*t)}
 g.computeVertexNormals();return g
}

/** Independent resources and stable named anatomy; the consumer owns supplied materials. */
export function createModel(options:WindBellOptions={}):WindBellInstance{
 const config:WindBellConfig={paper:options.paper??true}
 const bundle=acquireSurfaceMaterials<Slot>({"glaze":"glaze","glazeMoss":"glaze","vermilion":"fabric","washi":"paper","indigo":"glaze"},options.materials)
 const materials:Record<Slot,Material>={glaze:bundle.materials.glaze,glazeMoss:bundle.materials.glazeMoss,vermilion:bundle.materials.vermilion,washi:bundle.materials.washi,indigo:bundle.materials.indigo}
 const root=new Group();root.name=ID;root.userData.category='storytelling';root.userData.triangleBudget=2000
 const parts={shell:new Group(),suspension:new Group(),clapper:new Group(),paper:new Group()},content=new Map<Group,Group>()
 for(const [name,anchor]of Object.entries(parts)){anchor.name=ID+' / '+name;root.add(anchor);const generated=new Group();anchor.add(generated);content.set(anchor,generated)}
 root.add(socket('anchor-'+ID,[0,.4,0]))
 const geometries=new Set<BufferGeometry>();let disposed=false
 const release=():void=>{geometries.forEach(g=>g.dispose());geometries.clear()}
 const emit=(part:Group,g:BufferGeometry,slot:Slot,p:[number,number,number],name:string):Mesh=>{
  geometries.add(g);if(!g.getAttribute('uv'))boardUVs(g,[.3,.3,.3]);const mesh=new Mesh(g,materials[slot]);mesh.name=ID+' / '+name;mesh.userData.materialSlot=slot;mesh.position.set(...p);mesh.castShadow=true;mesh.receiveShadow=true;content.get(part)!.add(mesh);return mesh
 }
 const rebuild=():void=>{content.forEach(g=>g.clear());release()
 
const shell=lathe([[.045,.210],[.0445,.233],[.044,.255],[.036,.289],[.022,.303],[.0025,.310],[.0025,.305],[.018,.298],[.031,.284],[.039,.250],[.040,.211],[.045,.210]],24),sp=shell.getAttribute('position')
for(let i=0;i<sp.count;i++)if(Math.abs(sp.getY(i)-.233)<1e-6)sp.setY(i,.233+.0035*Math.cos(6*Math.atan2(sp.getX(i),sp.getZ(i))))
shell.computeVertexNormals()
const wave=shell.clone(),si=shell.index!,ivory:number[]=[],blue:number[]=[]
for(let i=0;i<si.count;i+=3){const ids=[si.getX(i),si.getX(i+1),si.getX(i+2)];const isWave=ids.every(j=>sp.getY(j)<.238&&Math.hypot(sp.getX(j),sp.getZ(j))>.0444);(isWave?blue:ivory).push(...ids)}
shell.setIndex(ivory);wave.setIndex(blue)
emit(parts.shell,shell,'glaze',[0,0,0],'open glazed bell dome')
emit(parts.shell,wave,'indigo',[0,0,0],'in-surface blue wave glaze')
const loop=tube([[0,.333,0],[.006,.354,0],[.006,.384,0],[0,.3985,0],[-.006,.384,0],[-.006,.354,0]],.0015,24,6,true)
loop.computeBoundingBox()
const loopPosition=loop.getAttribute('position'),loopScale=(.4-.335)/(loop.boundingBox!.max.y-.335)
for(let i=0;i<loopPosition.count;i++)if(loopPosition.getY(i)>.335)loopPosition.setY(i,.335+(loopPosition.getY(i)-.335)*loopScale)
loop.computeVertexNormals();loop.computeBoundingBox()
emit(parts.suspension,loop,'vermilion',[0,0,0],'closed hanging cord loop')
emit(parts.suspension,tube([[0,.309,0],[0,.334,0]],.0015,2,4),'vermilion',[0,0,0],'seated suspension stem')
const bead=new SphereGeometry(.0065,10,6)
emit(parts.suspension,bead,'glazeMoss',[0,.325,0],'seated upper ceramic bead')
emit(parts.clapper,tube([[0,.310,0],[0,.233,0],[0,.209,0],[0,.170,0]],.001,6,4),'vermilion',[0,0,0],'continuous clapper cord')
emit(parts.clapper,new SphereGeometry(.010,12,8),'glaze',[0,.205,0],'ceramic striker')
if(config.paper)emit(parts.paper,paperStrip(),'washi',[0,0,0],'pierced gently bowed paper strip')

 }
 rebuild()
 return{root,parts,materials,getConfig:()=>({...config}),configure(patch){if(disposed)return;if(patch.paper!==undefined)config.paper=Boolean(patch.paper);rebuild()},
 setMaterial(slot,material){if(disposed)return;materials[slot]=material;root.traverse(o=>{if(o instanceof Mesh&&o.userData.materialSlot===slot)o.material=material})},update(){},dispose(){if(disposed)return;disposed=true;release();bundle.dispose();root.removeFromParent()}}
}
export function createPreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),options)}
export function createCafePreview(options:{aspect?:number;yaw?:number;pitch?:number}={}){return createKkPreview(createModel(),{...options,framing:'cafe'})}
