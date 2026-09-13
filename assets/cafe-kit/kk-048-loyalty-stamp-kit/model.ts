// Metres; Y-up, bottom-centre root. Generated geometry is instance-owned.
import { Group, Mesh, BoxGeometry, LatheGeometry, Vector2, Vector3, BufferGeometry, Shape, ExtrudeGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, member } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID = 'kk-048-loyalty-stamp-kit'
type Slot = 'cedar' | 'glaze' | 'ink' | 'vermilion' | 'indigo' | 'washi' | 'brass'
export const structureControls = {
  "stampHeight": {
    "min": 0.065,
    "max": 0.09,
    "default": 0.08,
    "step": 0.005,
    "label": "Stamp grip overall height (m)"
  },
  "lidAngle": {
    "min": 0,
    "max": 110,
    "default": 105,
    "step": 5,
    "label": "Ink pad lid angle (degrees)"
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
function turnedGrip(height:number):BufferGeometry {
  const profile=[[0,0],[.016,0],[.017,.006],[.012,.015],[.008,.03],[.010,.043],[.019,.055],[.020,.060],[.015,.066],[0,.066]]
  const g=new LatheGeometry(profile.map(([r,y])=>new Vector2(r,y*height/.066)),16)
  // Profile height is authored in the canonical 66mm grip domain.
  const p=g.getAttribute('position'),index=g.index!,indices:number[]=[]
  for(let i=0;i<index.count;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)]
    const [a,b,c]=ids.map(j=>new Vector3().fromBufferAttribute(p,j)) as [Vector3,Vector3,Vector3]
    if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-22)indices.push(...ids)
  }
  g.setIndex(indices);g.normalizeNormals();return g
}

export function createModel(options: Options = {}) {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<'cedar' | 'glaze' | 'washi'>({"cedar":"cedar","glaze":"glaze","washi":"paper"}, options.materials)
  const materials = Object.fromEntries((["cedar","glaze","ink","vermilion","indigo","washi","brass"] as Slot[]).map(slot =>
    [slot, options.materials?.[slot] ?? bundle.materials[slot as keyof typeof bundle.materials]])) as Record<Slot, Material>
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { stamp: new Group(), pad: new Group(), lid: new Group(), cards: new Group() }
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

    box(parts.stamp,'ink',[.064,.002,.064],[-.068,.001,-.043],'rubber stamping die',false)
    box(parts.stamp,'cedar',[.064,.012,.064],[-.068,.008,-.043],'bevelled stamp block')
    emit(parts.stamp,turnedGrip(config.stampHeight-.014),'cedar',[-.068,.014,-.043],'turned stamp grip')
    box(parts.pad,'glaze',[.09,.004,.055],[.05,.002,-.025],'ink pad tin floor')
    for(const x of [.006,.094])box(parts.pad,'glaze',[.004,.011,.055],[x,.0095,-.025],'ink tin side')
    for(const z of [-.0505,.0005])box(parts.pad,'glaze',[.084,.011,.004],[.05,.0095,z],'ink tin end')
    box(parts.pad,'ink',[.081,.005,.045],[.05,.0065,-.025],'pad rubber backing',false)
    box(parts.pad,'vermilion',[.078,.004,.042],[.05,.011,-.025],'recessed ink felt',false)
    parts.lid.position.set(.05,.016,-.0525);parts.lid.rotation.x=-config.lidAngle*Math.PI/180
    box(parts.lid,'glaze',[.09,.003,.055],[0,0,.0275],'hinged tin lid')
    box(parts.lid,'indigo',[.08,.0008,.045],[0,-.0017,.0275],'unlettered lid lining',false)
    const cat=new Shape();cat.moveTo(-.011,-.004);cat.lineTo(-.011,.004);cat.lineTo(-.013,.013)
    cat.lineTo(-.004,.008);cat.quadraticCurveTo(0,.010,.004,.008);cat.lineTo(.013,.013);cat.lineTo(.011,.004)
    cat.lineTo(.011,-.004);cat.quadraticCurveTo(.010,-.013,0,-.013);cat.quadraticCurveTo(-.010,-.013,-.011,-.004);cat.closePath()
    const emblem=new ExtrudeGeometry(cat,{depth:.0004,steps:1,bevelEnabled:false,curveSegments:4});emblem.rotateX(Math.PI/2)
    emit(parts.lid,emblem,'vermilion',[0,-.002,.0275],'unlettered cat silhouette emblem')
    for(const x of [.022,.078])rod(parts.pad,'brass',[x-.006,.016,-.0525],[x+.006,.016,-.0525],.002,'seated lid hinge',8)
    for(let i=0;i<7;i++)box(parts.cards,'washi',[.1,.0008,.072],[.05,.0004+i*.0008,.039],'blank loyalty card',false)
    const y=.0057
    for(const z of [.008,.070])box(parts.cards,'vermilion',[.089,.00025,.0006],[.05,y,z],'unlettered card border',false)
    for(const x of [.0055,.0945])box(parts.cards,'vermilion',[.0006,.00025,.062],[x,y,.039],'unlettered card border',false)

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
