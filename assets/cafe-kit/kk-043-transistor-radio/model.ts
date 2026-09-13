// Metres; Y-up, bottom-centre root. Generated geometry is instance-owned.
import { Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, Path, Vector3, BufferGeometry, Shape, ExtrudeGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, member } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID = 'kk-043-transistor-radio'
type Slot = 'glaze' | 'glazeDeep' | 'ink' | 'brass' | 'steel' | 'glazeMoss' | 'vermilion'
export const structureControls = {
  "antennaExtension": {
    "min": 0.45,
    "max": 1,
    "default": 1,
    "step": 0.05,
    "label": "Aerial extension"
  },
  "tuning": {
    "min": 0,
    "max": 1,
    "default": 0.7,
    "step": 0.02,
    "label": "Analog tuning position"
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
function fascia():BufferGeometry {
  const s=new Shape(),w=.123,h=.05,r=.008
  s.moveTo(-w+r,-h);s.lineTo(w-r,-h);s.quadraticCurveTo(w,-h,w,-h+r);s.lineTo(w,h-r);s.quadraticCurveTo(w,h,w-r,h)
  s.lineTo(-w+r,h);s.quadraticCurveTo(-w,h,-w,h-r);s.lineTo(-w,-h+r);s.quadraticCurveTo(-w,-h,-w+r,-h)
  const grille=new Path();grille.moveTo(-.111,-.039);grille.lineTo(-.111,.039);grille.lineTo(.027,.039);grille.lineTo(.027,-.039);grille.closePath();s.holes.push(grille)
  const dial=new Path();dial.absarc(.077,.012,.029,0,Math.PI*2,true);s.holes.push(dial)
  const g=new ExtrudeGeometry(s,{depth:.006,steps:1,bevelEnabled:true,bevelSize:.0007,bevelThickness:.0007,bevelSegments:1,curveSegments:8})
  g.translate(0,0,-.003);return g
}

export function createModel(options: Options = {}) {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<'glaze'>({"glaze":"glaze"}, options.materials)
  const materials = Object.fromEntries((["glaze","glazeDeep","ink","brass","steel","glazeMoss","vermilion"] as Slot[]).map(slot =>
    [slot, options.materials?.[slot] ?? bundle.materials[slot as keyof typeof bundle.materials]])) as Record<Slot, Material>
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { case: new Group(), grille: new Group(), dial: new Group(), handle: new Group(), antenna: new Group() }
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
  const rod = (part: Group, slot: Slot, a: [number, number, number], b: [number, number, number], radius: number, name: string, segments = 8): Mesh =>
    emit(part, member(new Vector3(...a), new Vector3(...b), radius, segments), slot, [0, 0, 0], name)
  const rebuild = (): void => {
    content.forEach(group => group.clear()); geometries.splice(0).forEach(geo => geo.dispose())

    // Existing lifted-charcoal kit slot separates the cabinet from the deeper ink dial/handle.
    box(parts.case,'glazeDeep',[.25,.103,.085],[0,.0555,-.0075],'rounded charcoal cabinet')
    emit(parts.case,fascia(),'glaze',[0,.055,.038],'pierced ivory fascia')
    for(const x of [-.1,.1])for(const z of [-.031,.031])box(parts.case,'ink',[.022,.004,.018],[x,.002,z],'rubber foot')
    for(let i=0;i<13;i++)box(parts.grille,'glaze',[.139,.0025,.004],[-.042,.019+i*.006,.04],'speaker grille rib')
    const disk=new CylinderGeometry(.028,.028,.002,24);disk.rotateX(Math.PI/2)
    emit(parts.dial,disk,'ink',[.077,.067,.04],'recessed analog dial')
    const bezel=new TorusGeometry(.029,.0015,4,24)
    emit(parts.dial,bezel,'brass',[.077,.067,.042],'dial bezel')
    for(let i=0;i<13;i++){
      const a=-Math.PI*.75+i*Math.PI*1.5/12
      const x=.077+Math.sin(a)*.023,y=.067+Math.cos(a)*.023
      const tick=box(parts.dial,'glaze',[.0008,.003,.0007],[x,y,.0416],'unlettered dial tick',false);tick.rotation.z=-a
    }
    const a=config.tuning*Math.PI*1.5-Math.PI*.75
    rod(parts.dial,'vermilion',[.077,.067,.0425],[.077+Math.sin(a)*.021,.067+Math.cos(a)*.021,.0425],.0008,'tuning needle',6)
    for(const x of [.053,.096]){
      rod(parts.dial,'glazeMoss',[x,.020,.038],[x,.020,.047],.009,'control knob',12)
      rod(parts.dial,'brass',[x,.020,.0465],[x,.020,.05],.007,'knob face',12)
    }
    // A U handle seats on two side pivots and leaves open finger space above the case.
    for(const x of [-.113,.113]){
      box(parts.handle,'brass',[.006,.027,.01],[x,.11,0],'carry handle cheek')
      rod(parts.handle,'brass',[x-.004,.1,0],[x+.004,.1,0],.004,'handle pivot')
    }
    box(parts.handle,'ink',[.222,.007,.012],[0,.12,0],'carry handle grip')
    const start=new Vector3(.103,.102,-.025),direction=new Vector3(-.09,.0465,0).multiplyScalar(config.antennaExtension)
    rod(parts.antenna,'brass',[.103,.098,-.025],[.103,.107,-.025],.004,'antenna ball socket',12)
    for(let i=0;i<3;i++){
      const a=start.clone().addScaledVector(direction,i/3),b=start.clone().addScaledVector(direction,(i+1)/3+.008*(i<2?1:0))
      rod(parts.antenna,'steel',a.toArray() as [number,number,number],b.toArray() as [number,number,number],.0025-i*.0005,'telescoping aerial section',8)
    }
    const end=start.clone().add(direction)
    emit(parts.antenna,new SphereGeometry(.0015,8,4),'steel',end.toArray() as [number,number,number],'aerial safety tip')

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
