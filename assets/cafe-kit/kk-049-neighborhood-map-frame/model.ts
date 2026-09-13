// Metres; Y-up, bottom-centre root. Generated geometry is instance-owned.
import { Group, Mesh, BoxGeometry, BufferGeometry, Float32BufferAttribute, Shape, ExtrudeGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID = 'kk-049-neighborhood-map-frame'
type Slot = 'cedar' | 'cedarDark' | 'washi' | 'indigoFaded' | 'glaze' | 'glazeMoss' | 'ink' | 'vermilion'
export const structureControls = {
  "railWidth": {
    "min": 0.022,
    "max": 0.038,
    "default": 0.03,
    "step": 0.002,
    "label": "Cross rail height (m)"
  },
  "foldDepth": {
    "min": 0.0005,
    "max": 0.003,
    "default": 0.0015,
    "step": 0.0005,
    "label": "Paper fold relief (m)"
  }
} as const
export type Config = { -readonly [K in keyof typeof structureControls]: number }
export type Options = Partial<Config> & { materials?: Partial<Record<Slot, Material>> }
function configuration(patch: Partial<Config>, previous?: Config): Config {
  const next = {} as Config
  for (const key of Object.keys(structureControls) as (keyof Config)[]) {
    const rule = structureControls[key]; const value = patch[key] === undefined ? previous?.[key] ?? rule.default : patch[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${key} must be finite`)
    next[key] = Math.max(rule.min, Math.min(rule.max, value))
  }
  return next
}
/** Fold displacement is shared by the paper and every printed shape, preventing floating graphics. */
function fold(x:number,depth:number):number {
  const t=(x+.198)/.099
  return depth*(1-2*Math.abs((t-Math.floor(t))-.5))
}
function relief(shape:Shape,depth:number,foldDepth:number,z:number):BufferGeometry {
  const g=new ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false,curveSegments:5})
  const p=g.getAttribute('position'),uv=g.getAttribute('uv'),positions:number[]=[],uvs:number[]=[]
  // Split faces at every crease BEFORE warping: large paper triangles otherwise bridge the folds.
  type V=number[]
  const clip=(poly:V[],x:number,side:number):V[]=>{
    const out:V[]=[]
    for(let i=0;i<poly.length;i++){
      const a=poly[i]!,b=poly[(i+1)%poly.length]!,inside=side*(a[0]!-x)>=-1e-10,next=side*(b[0]!-x)>=-1e-10
      if(inside)out.push(a)
      if(inside!==next){const t=(x-a[0]!)/(b[0]!-a[0]!);out.push(a.map((v,j)=>v+t*(b[j]!-v)))}
    }return out
  }
  for(let i=0;i<p.count;i+=3){
    let polys:V[][]=[[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j),uv.getX(i+j),uv.getY(i+j)])]
    for(let k=1;k<8;k++){
      const x=-.198+k*.0495
      polys=polys.flatMap(poly=>Math.min(...poly.map(v=>v[0]!))<x-1e-10&&Math.max(...poly.map(v=>v[0]!))>x+1e-10?
        [clip(poly,x,-1),clip(poly,x,1)]:[poly])
    }
    for(const poly of polys)for(let j=1;j<poly.length-1;j++){
      const tri=[poly[0]!,poly[j]!,poly[j+1]!]
      const a=tri[0]!,b=tri[1]!,c=tri[2]!
      const ab=[b[0]!-a[0]!,b[1]!-a[1]!,b[2]!-a[2]!],ac=[c[0]!-a[0]!,c[1]!-a[1]!,c[2]!-a[2]!]
      if(Math.hypot(ab[1]!*ac[2]!-ab[2]!*ac[1]!,ab[2]!*ac[0]!-ab[0]!*ac[2]!,ab[0]!*ac[1]!-ab[1]!*ac[0]!)<1e-12)continue
      for(const v of tri){positions.push(v[0]!,v[1]!,v[2]!+z+fold(v[0]!,foldDepth));uvs.push(v[3]!,v[4]!)}
    }
  }
  g.dispose()
  const result=new BufferGeometry();result.setAttribute('position',new Float32BufferAttribute(positions,3));result.setAttribute('uv',new Float32BufferAttribute(uvs,2));result.computeVertexNormals();return result
}
function polygon(points:[number,number][]):Shape {
  const s=new Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s
}

export function createModel(options: Options = {}) {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<'cedar' | 'cedarDark' | 'washi'>({"cedar":"cedar","cedarDark":"cedar","washi":"paper"}, options.materials)
  const materials = Object.fromEntries((["cedar","cedarDark","washi","indigoFaded","glaze","glazeMoss","ink","vermilion"] as Slot[]).map(slot =>
    [slot, options.materials?.[slot] ?? bundle.materials[slot as keyof typeof bundle.materials]])) as Record<Slot, Material>
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { frame: new Group(), map: new Group() }
  const content = new Map<Group, Group>()
  for (const [name, anchor] of Object.entries(parts)) {
    anchor.name = `${ID} / ${name}`; root.add(anchor)
    const generated = new Group(); generated.name = `${anchor.name} / generated`; anchor.add(generated); content.set(anchor, generated)
  }
  const geometries: BufferGeometry[] = []; let disposed = false
  const emit = (part: Group, geo: BufferGeometry, slot: Slot, pos: [number, number, number], name: string): Mesh => {
    geometries.push(geo); const mesh = new Mesh(geo, materials[slot]); mesh.name = `${ID} / ${name}`; mesh.position.set(...pos)
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.materialSlot = slot; content.get(part)!.add(mesh); return mesh
  }
  const box = (part: Group, slot: Slot, size: [number, number, number], pos: [number, number, number], name: string, bevel = true): Mesh => {
    const geo = bevel ? bevelBox(...size, Math.min(0.0008, Math.min(...size) * 0.12)) : new BoxGeometry(...size)
    boardUVs(geo, size); return emit(part, geo, slot, pos, name)
  }
  const rebuild = (): void => {
    content.forEach(group => group.clear()); geometries.splice(0).forEach(geo => geo.dispose())

    const rail=config.railWidth
    for(const x of [-.201,.201])box(parts.frame,'cedar',[.03,.35,.03],[x,.175,0],'continuous frame stile')
    for(const y of [.027,.318]){
      box(parts.frame,'cedar',[.45,rail,.023],[0,y,0],'through-tenoned cross rail')
      for(const x of [-.201,.201])box(parts.frame,'cedarDark',[.006,.014,.003],[x,y,.0134],'locking timber peg')
    }
    box(parts.frame,'cedarDark',[.394,.294,.008],[0,.175,-.011],'map backing board',false)
    const paper=polygon([[-.198,.028],[.198,.028],[.198,.322],[-.198,.322]])
    emit(parts.map,relief(paper,.001,config.foldDepth,-.002),'washi',[0,0,0],'folded street-plan sheet')
    const print=(shape:Shape,slot:Slot,name:string)=>{
      const layer=name.includes('street')?1:name.includes('block')?2:name.includes('district')?3:name.includes('landmark')?4:0
      return emit(parts.map,relief(shape,.00015+layer*.00017,config.foldDepth,-.00102),slot,[0,0,0],name)
    }
    const river=new Shape();river.moveTo(.018,.039);river.bezierCurveTo(.084,.11,.025,.17,.075,.245);river.quadraticCurveTo(.092,.284,.132,.311)
    river.lineTo(.107,.311);river.quadraticCurveTo(.070,.284,.055,.245);river.bezierCurveTo(.005,.17,.064,.11,-.006,.039);river.closePath()
    print(river,'indigoFaded','winding river')
    const pond=new Shape();pond.moveTo(-.159,.182);pond.bezierCurveTo(-.184,.203,-.157,.237,-.122,.229)
    pond.bezierCurveTo(-.084,.225,-.085,.196,-.114,.183);pond.quadraticCurveTo(-.144,.166,-.159,.182);pond.closePath()
    print(pond,'indigoFaded','garden pond')
    // Street corridors and block footprints are unlettered symbolic cartography, not extruded buildings.
    for(const x of [-.083,-.018,.126])print(polygon([[x-.003,.048],[x+.004,.048],[x+.021,.298],[x+.014,.298]]),'glaze','north south street')
    for(const y of [.102,.163,.256])print(polygon([[-.181,y-.004],[.182,y+.012],[.182,y+.019],[-.181,y+.003]]),'glaze','cross street and bridge')
    for(let row=0;row<4;row++)for(let col=0;col<6;col++){
      const x=-.164+col*.06,y=.065+row*.061
      if((col===0&&row===2)||(col===1&&row===2)||col===3)continue
      const w=.019+(row%2)*.005
      print(polygon([[x,y],[x+w,y+.002],[x+w-.003,y+.022],[x-.002,y+.019]]),col%3===0?'glazeMoss':'ink','printed neighborhood block')
    }
    for(const [x,y] of [[-.147,.28],[.153,.219],[-.112,.123]]){
      const park=new Shape();park.moveTo(x-.022,y-.011);park.quadraticCurveTo(x-.031,y+.01,x-.01,y+.018)
      park.quadraticCurveTo(x+.006,y+.035,x+.025,y+.012);park.quadraticCurveTo(x+.036,y-.015,x+.008,y-.021)
      park.quadraticCurveTo(x-.012,y-.026,x-.022,y-.011);park.closePath();print(park,'glazeMoss','shaped garden district')
    }
    // Two small torii-like landmark symbols; no writing, logo, or fabricated address.
    for(const [x,y] of [[.124,.195],[-.127,.065]]){
      for(const dx of [-.006,.006])print(polygon([[x+dx-.001,y],[x+dx+.001,y],[x+dx+.001,y+.019],[x+dx-.001,y+.019]]),'vermilion','map landmark upright')
      print(polygon([[x-.014,y+.018],[x+.014,y+.018],[x+.016,y+.022],[x-.016,y+.022]]),'vermilion','map landmark lintel')
    }

  }
  rebuild()
  return { root, parts, materials, getConfig: () => ({ ...config }),
    configure(patch: Partial<Config>) { if (disposed) return; const next = configuration(patch, config); Object.assign(config, next); rebuild() },
    setMaterial(slot: Slot, material: Material) {
      if (disposed) return
      materials[slot] = material
      content.forEach(group => group.traverse(o => { if (o instanceof Mesh && o.userData.materialSlot === slot) o.material = material }))
    },
    update(_deltaSeconds: number) {},
    dispose() { if (disposed) return; disposed = true; geometries.splice(0).forEach(geo => geo.dispose()); bundle.dispose(); root.removeFromParent() },
  }
}
export function createPreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch }) }
export function createCafePreview({ aspect, yaw, pitch }: { aspect?: number; yaw?: number; pitch?: number } = {}) { return createKkPreview(createModel(), { aspect, yaw, pitch, framing: 'cafe' }) }
