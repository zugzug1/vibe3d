// Metres; Y-up, bottom-centre root. Generated geometry is instance-owned.
import { Group, Mesh, BoxGeometry, Vector3, BufferGeometry, Shape, ExtrudeGeometry, type Material } from 'three/webgpu'
import { bevelBox, createKkPreview, member } from '../kk-core/index.ts'
import { acquireSurfaceMaterials, boardUVs } from '../kk-core/surface-detail.ts'
const ID = 'kk-042-instant-photo-display'
type Slot = 'cedar' | 'cedarDark' | 'washi' | 'indigoFaded' | 'glazeMoss' | 'ink' | 'brass'
export const structureControls = {
  "photoSpacing": {
    "min": 0.1,
    "max": 0.14,
    "default": 0.122,
    "step": 0.005,
    "label": "Photo centre spacing (m)"
  },
  "stringSag": {
    "min": 0.003,
    "max": 0.017,
    "default": 0.01,
    "step": 0.001,
    "label": "Cord sag (m)"
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
function cheek():BufferGeometry {
  const s=new Shape();s.moveTo(-.037,.012);s.lineTo(.034,.012);s.lineTo(.009,.11);s.lineTo(-.009,.11);s.closePath()
  const g=new ExtrudeGeometry(s,{depth:.012,steps:1,bevelEnabled:false});g.translate(0,0,-.006);g.rotateY(Math.PI/2);boardUVs(g,[.012,.098,.071]);return g
}
/** Deliberately simplified, unlettered cat portrait silhouette in a physical photo inset. */
function catPortrait():BufferGeometry {
  const s=new Shape();s.moveTo(-.019,-.028);s.quadraticCurveTo(-.026,-.006,-.015,.003)
  s.lineTo(-.017,.022);s.lineTo(-.006,.014);s.quadraticCurveTo(0,.017,.006,.014)
  s.lineTo(.017,.022);s.lineTo(.015,.003);s.quadraticCurveTo(.026,-.006,.019,-.028);s.closePath()
  return new ExtrudeGeometry(s,{depth:.0005,steps:1,bevelEnabled:false,curveSegments:3})
}

export function createModel(options: Options = {}) {
  const config = configuration(options)
  const bundle = acquireSurfaceMaterials<'cedar' | 'cedarDark' | 'washi'>({"cedar":"cedar","cedarDark":"cedar","washi":"paper"}, options.materials)
  const materials = { ...bundle.materials, ...options.materials } as Record<Slot, Material>
  const root = new Group(); root.name = ID; root.userData.attachment = 'ground'
  const parts = { frame: new Group(), supports: new Group(), strings: new Group(), photos: new Group() }
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

    box(parts.frame,'cedar',[.45,.012,.08],[0,.006,0],'broad display plinth')
    for(const x of [-.197,.197]) {
      box(parts.frame,'cedar',[.022,.279,.024],[x,.1515,0],'socketed frame stile')
      emit(parts.supports,cheek(),'cedarDark',[x,0,0],'triangular side buttress')
      for(const y of [.244,.133]) rod(parts.strings,'brass',[x,y,0],[x,y,.012],.0025,'string fixing peg')
    }
    box(parts.frame,'cedar',[.414,.018,.024],[0,.291,0],'housed upper frame rail')
    for(let row=0;row<2;row++) {
      const height=.244-row*.111
      const wireY=(x:number)=>height-config.stringSag*(1-(x/.197)**2)
      for(let i=0;i<12;i++) {
        const x=-.197+i*.394/12,n=x+.394/12
        rod(parts.strings,'ink',[x,wireY(x),.01],[n,wireY(n),.01],.00065,'taut hanging cord',4)
      }
      for(let col=0;col<3;col++) {
        const x=(col-1)*config.photoSpacing, y=wireY(x)
        const portrait=new Group();portrait.name=`${ID} / clipped portrait ${row}-${col}`
        content.get(parts.photos)!.add(portrait);portrait.position.set(x,y-.035,.013)
        portrait.rotation.z=([-.045,.03,-.02][col])*(row===0?1:-1)
        const into=(mesh:Mesh)=>{portrait.add(mesh);return mesh}
        into(box(parts.photos,'washi',[.092,.086,.0015],[0,0,0],'instant photo paper',false))
        into(box(parts.photos,row===0?'indigoFaded':'glazeMoss',[.077,.061,.0007],[0,.006,.0012],'unlettered photo field',false))
        into(emit(parts.photos,catPortrait(),col===1?'cedarDark':'ink',[0,.011,.0017],'stylized cat portrait'))
        // A two-jaw timber clip straddles paper and cord; its bridge closes above both.
        for(const z of [-.0027,.0027]) into(box(parts.photos,'cedar',[.007,.022,.004],[0,.039,z],'clothespin jaw',false))
        into(box(parts.photos,'cedar',[.007,.004,.0094],[0,.048,0],'clothespin bridge',false))
        into(rod(parts.photos,'brass',[-.004,.039,-.0005],[.004,.039,-.0005],.0015,'clothespin spring pin',6))
      }
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
