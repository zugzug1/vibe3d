// Metres; Y-up, bottom-centre root. Generated geometry is instance-owned.
import { Group, Mesh, BoxGeometry, TorusGeometry, Vector3, BufferGeometry, Shape, ExtrudeGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, member } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID = 'kk-041-cat-adoption-ledger'
type Slot = 'cedar' | 'indigo' | 'indigoFaded' | 'washi' | 'brass' | 'glazeMoss' | 'vermilion'
export const structureControls = {
  "pageLift": {
    "min": 0.025,
    "max": 0.037,
    "default": 0.034,
    "step": 0.001,
    "label": "Open page shoulder height (m)"
  },
  "bookmarkOffset": {
    "min": -0.065,
    "max": 0.065,
    "default": 0.018,
    "step": 0.005,
    "label": "Bookmark position (m)"
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
/** Page block is an extruded cross-section, not a scaled cube or painted spine. */
function pageBlock(sign:number,lift:number,bottom:number,depth:number):BufferGeometry {
  let points=[[.014,bottom],[.191,bottom],[.191,.017],[.035,lift],[.024,lift+.001],[.014,.019]].map(([x,y])=>[sign*x,y])
  if(sign<0) points=points.reverse()
  const shape=new Shape(); points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y)); shape.closePath()
  const geo=new ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false});geo.translate(0,0,-depth/2);boardUVs(geo,[.177,.03,depth]);return geo
}

export function createModel(options: Options = {}) {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<'cedar' | 'indigo' | 'washi'>({"cedar":"cedar","indigo":"fabric","washi":"paper"}, options.materials)
  const materials = { ...bundle.materials, ...options.materials } as Record<Slot, Material>
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { binding: new Group(), pages: new Group(), portraits: new Group(), clips: new Group(), tabs: new Group() }
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

    box(parts.binding,'cedar',[.376,.001,.266],[0,.002,0],'binding board core',false)
    box(parts.binding,'indigo',[.4,.004,.28],[0,.002,0],'indigo cloth cover',false)
    box(parts.binding,'indigo',[.02,.007,.278],[0,.006,0],'flexible sewn spine',false)
    for(const sign of [-1,1]) {
      emit(parts.pages,pageBlock(sign,config.pageLift,.0045,.265),'washi',[0,0,0],'curved page block')
      // Stepped edge strips are actual paper folios, separated in depth and thickness.
      for(let layer=0;layer<3;layer++)
        box(parts.pages,'washi',[.175,.00065,.267+layer*.001],[sign*.102,.007+layer*.003,0],'exposed page folio',false)
      const slope=(.017-config.pageLift)/(.191-.035)
      const angle=Math.atan(sign*slope)
      for(const z of [-.069,.061]) {
        const y=config.pageLift+slope*(.108-.035)
        const card=box(parts.portraits,'washi',[.11,.0016,.108],[sign*.108,y+.0012,z],'blank portrait mounting card',false);card.rotation.z=angle
        const inset=box(parts.portraits,'indigoFaded',[.092,.0006,.081],[sign*.108,y+.0024,z-.005],'blank portrait placeholder',false);inset.rotation.z=angle
        // A folded wire clip follows the sloped card; its return jaw wraps underneath the edge.
        const cx=sign*.108,cz=z-.049,cy=y+.0025
        const left=cy-sign*slope*.007,right=cy+sign*slope*.007
        rod(parts.clips,'brass',[cx-.007,left,cz+.01],[cx-.007,left,cz-.009],.0008,'paper clip upper jaw',6)
        rod(parts.clips,'brass',[cx-.007,left,cz-.009],[cx+.007,right,cz-.009],.0008,'paper clip closed bend',6)
        rod(parts.clips,'brass',[cx+.007,right,cz-.009],[cx+.007,right-.0036,cz-.009],.0008,'paper clip folded edge',6)
        rod(parts.clips,'brass',[cx+.007,right-.0036,cz-.009],[cx+.007,right-.0036,cz+.007],.0008,'paper clip return jaw',6)
      }
    }
    for(const z of [-.095,0,.095]) {
      const ring=new TorusGeometry(.014,.003,4,12)
      emit(parts.binding,ring,'brass',[0,.023,z],'spine binding ring')
    }
    for(const x of [-.012,.012])
      box(parts.binding,'indigo',[.008,.01,.274],[x,.009,0],'cloth reinforced inner hinge',false)
    for(let i=0;i<3;i++) box(parts.tabs,i===0?'indigo':i===1?'glazeMoss':'vermilion',[.017,.0012,.025],[.1915,.010+i*.002,-.081+i*.064],'projecting index tab',false)
    box(parts.binding,'indigo',[.012,.0007,.06],[config.bookmarkOffset,.0045,.108],'bound ribbon bookmark',false)

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
