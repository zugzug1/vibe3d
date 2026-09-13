// Metres; Y-up, bottom-centre root. Generated geometry is instance-owned.
import { Group, Mesh, BoxGeometry, CylinderGeometry, Vector3, BufferGeometry, Shape, ExtrudeGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, member } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID = 'kk-047-grooming-box'
type Slot = 'cedar' | 'cedarDark' | 'indigo' | 'washi'
export const structureControls = {
  "handleHeight": {
    "min": 0.17,
    "max": 0.23,
    "default": 0.2,
    "step": 0.005,
    "label": "Carrying handle height (m)"
  },
  "combLean": {
    "min": 0,
    "max": 12,
    "default": 8,
    "step": 1,
    "label": "Comb lean (degrees)"
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
function sideCheek(height:number):BufferGeometry {
  const s=new Shape();s.moveTo(-.1,.009);s.lineTo(.1,.009);s.lineTo(.1,.085)
  s.quadraticCurveTo(.026,.083,.023,height-.023);s.quadraticCurveTo(.021,height,0,height)
  s.quadraticCurveTo(-.021,height,-.023,height-.023);s.quadraticCurveTo(-.026,.083,-.1,.085);s.closePath()
  const g=new ExtrudeGeometry(s,{depth:.014,steps:1,bevelEnabled:false,curveSegments:5})
  g.translate(0,0,-.007);g.rotateY(Math.PI/2);boardUVs(g,[.014,height,.2]);return g
}
function brushBody():BufferGeometry {
  const s=new Shape();s.moveTo(.115,-.012);s.quadraticCurveTo(.131,0,.115,.012)
  s.bezierCurveTo(.075,.02,.045,.005,.014,.029);s.bezierCurveTo(-.024,.061,-.115,.053,-.117,0)
  s.bezierCurveTo(-.115,-.053,-.024,-.061,.014,-.029);s.bezierCurveTo(.045,-.005,.075,-.02,.115,-.012);s.closePath()
  const g=new ExtrudeGeometry(s,{depth:.008,steps:1,bevelEnabled:true,bevelSize:.001,bevelThickness:.001,bevelSegments:1,curveSegments:5})
  g.translate(0,0,-.004);g.rotateX(-Math.PI/2);boardUVs(g,[.25,.01,.10]);return g
}
function combBody():BufferGeometry {
  const s=new Shape();s.moveTo(.019,0);s.lineTo(.026,0);s.lineTo(.026,.107)
  s.quadraticCurveTo(.001,.119,-.024,.107);s.lineTo(-.024,.098);s.lineTo(.006,.098)
  for(let i=11;i>=0;i--){const y=.005+i*.0075;s.lineTo(.006,y+.004);s.lineTo(-.024,y+.004);s.lineTo(-.024,y);s.lineTo(.006,y)}
  s.lineTo(.019,0);s.closePath()
  const g=new ExtrudeGeometry(s,{depth:.004,steps:1,bevelEnabled:false,curveSegments:4});g.translate(0,0,-.002);boardUVs(g,[.05,.113,.004]);return g
}

export function createModel(options: Options = {}) {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<'cedar' | 'cedarDark' | 'indigo'>({"cedar":"cedar","cedarDark":"cedar","indigo":"fabric"}, options.materials)
  const materials = Object.fromEntries((["cedar","cedarDark","indigo","washi"] as Slot[]).map(slot =>
    [slot, options.materials?.[slot] ?? bundle.materials[slot as keyof typeof bundle.materials]])) as Record<Slot, Material>
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { box: new Group(), handle: new Group(), tools: new Group(), comb: new Group() }
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

    const h=config.handleHeight
    box(parts.box,'cedarDark',[.3,.012,.2],[0,.006,0],'continuous caddy floor')
    for(const x of [-.143,.143])emit(parts.handle,sideCheek(h),'cedar',[x,0,0],'shaped handle end board')
    for(const z of [-.093,.093])box(parts.box,'cedar',[.274,.077,.014],[0,.0505,z],'joined caddy wall')
    rod(parts.handle,'cedar',[ -.143,h-.023,0],[.143,h-.023,0],.012,'through-seated carrying dowel',12)
    for(const x of [-.134,.134])for(const y of [.025,.05,.075])
      box(parts.box,'cedarDark',[.013,.007,.001],[x,y,.0994],'exposed finger joint',false)
    const liner=new Shape();liner.moveTo(-.11,-.08);liner.quadraticCurveTo(-.132,-.08,-.132,-.058)
    liner.lineTo(-.132,.058);liner.quadraticCurveTo(-.132,.08,-.11,.08);liner.lineTo(.11,.08)
    liner.quadraticCurveTo(.132,.08,.132,.058);liner.lineTo(.132,-.058);liner.quadraticCurveTo(.132,-.08,.11,-.08);liner.closePath()
    // Filled cloth liner supports the tools near the lip instead of concealing the paddle below it.
    const cushion=new ExtrudeGeometry(liner,{depth:.067,steps:1,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:1,curveSegments:4})
    cushion.rotateX(-Math.PI/2)
    emit(parts.tools,cushion,'indigo',[0,.015,0],'fitted cloth liner')
    emit(parts.tools,brushBody(),'cedar',[0,.09,.02],'continuous paddle brush')
    const bed=new CylinderGeometry(1,1,.006,16);bed.scale(.056,1,.037)
    emit(parts.tools,bed,'washi',[-.054,.098,.02],'continuous oval bristle bed')
    for(let row=0;row<6;row++)for(let col=0;col<8;col++){
      const x=-.096+col*.012,z=.02+(row-2.5)*.011
      if(((x+.054)/.052)**2+((z-.02)/.034)**2>1)continue
      rod(parts.tools,'washi',[x,.1005,z],[x,.117+(col%2)*.001,z],.0028,'seated bristle bundle',5)
    }
    parts.comb.position.set(.023,.085,-.053);parts.comb.rotation.x=-config.combLean*Math.PI/180
    emit(parts.comb,combBody(),'cedar',[0,0,0],'open-ended comb')

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
