// Metres; Y-up, bottom-centre root. Generated geometry is instance-owned.
import { Group, Mesh, CylinderGeometry, BufferGeometry, Float32BufferAttribute, type Material } from 'three/webgpu'
import { createKkPreview } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID = 'kk-039-indigo-serving-tray'
type Slot = 'cedar' | 'cedarDark' | 'indigo'
export const structureControls = {
  "rimHeight": {
    "min": 0.032,
    "max": 0.05,
    "default": 0.04,
    "step": 0.001,
    "label": "Rim height (m)"
  },
  "handleWidth": {
    "min": 0.075,
    "max": 0.11,
    "default": 0.095,
    "step": 0.005,
    "label": "Handle opening width (m)"
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
/** Closed elliptical bentwood band, optionally stopped to leave a real hand opening. */
function band(bottom: number, top: number, start = 0, end = Math.PI * 2, segments = 48): BufferGeometry {
  const positions: number[] = []
  const v = (angle: number, y: number, inner: boolean): number[] => [(inner ? .190 : .2)*Math.cos(angle),y,(inner ? .130 : .14)*Math.sin(angle)]
  const face = (a:number[],b:number[],c:number[],d:number[]) => positions.push(...a,...b,...c,...a,...c,...d)
  for (let i=0;i<segments;i++) {
    const a=start+(end-start)*i/segments,b=start+(end-start)*(i+1)/segments
    const ob=v(a,bottom,false),ot=v(a,top,false),ib=v(a,bottom,true),it=v(a,top,true)
    const nb=v(b,bottom,false),nt=v(b,top,false),jb=v(b,bottom,true),jt=v(b,top,true)
    face(ob,ot,nt,nb); face(ib,jb,jt,it); face(ot,it,jt,nt); face(ob,nb,jb,ib)
    if (end-start < Math.PI*2-.001) { if(i===0) face(ob,ib,it,ot); if(i===segments-1) face(nb,nt,jt,jb) }
  }
  const g=new BufferGeometry(); g.setAttribute('position',new Float32BufferAttribute(positions,3)); g.computeVertexNormals()
  boardUVs(g,[.4,top-bottom,.28]); return g
}

export function createModel(options: Options = {}) {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<'cedar' | 'cedarDark' | 'indigo'>({"cedar":"cedar","cedarDark":"cedar","indigo":"fabric"}, options.materials)
  const materials = { ...bundle.materials, ...options.materials } as Record<Slot, Material>
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { base: new Group(), rim: new Group(), handles: new Group(), inset: new Group() }
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
  const rebuild = (): void => {
    content.forEach(group => group.clear()); geometries.splice(0).forEach(geo => geo.dispose())

    const h=config.rimHeight, opening=config.handleWidth/.26
    emit(parts.rim,band(.004,.014),'cedar',[0,0,0],'continuous lower bentwood rim')
    emit(parts.handles,band(h-.008,h),'cedar',[0,0,0],'continuous upper handle rail')
    for(const [start,end] of [[opening,Math.PI-opening],[Math.PI+opening,2*Math.PI-opening]])
      emit(parts.rim,band(.014,h-.008,start,end,18),'cedar',[0,0,0],'handle jamb and oval wall')
    const base=new CylinderGeometry(1,1,.004,48); base.scale(.2,1,.14)
    emit(parts.base,base,'cedarDark',[0,.002,0],'oval timber tray floor')
    const textile=new CylinderGeometry(1,1,.0014,48); textile.scale(.1898,1,.1298)
    emit(parts.inset,textile,'indigo',[0,.0047,0],'recessed indigo textile inset')

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
