import {
  Box3,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three/webgpu'

import { createScene } from '../../assets/f1-prototypes/f1-kit-scene/kit-scene.ts'
import { MODEL_CATALOG } from '../model-browser/registry.ts'
import { disposeObjectTree } from '../core/dispose.ts'
import type { InspectPlayground, InspectTarget, PlaygroundOptions } from '../core/types.ts'

/** One marker each — heroes / tools / structures, not every verge tile. */
const MARK = new Set([
  'f1-service-truck',
  'f1-team-motorhome',
  'f1-garage-box',
  'f1-pit-wall',
  'f1-pit-gantry',
  'f1-start-gantry',
  'f1-start-lights',
  'f1-start-finish-line',
  'f1-chequered-flag',
  'f1-grandstand-bay',
  'f1-jumbotron',
  'f1-timing-pylon',
  'f1-marshal-post',
  'f1-lollipop-board',
  'f1-pit-board',
  'f1-tyre-stack',
  'f1-tyre',
  'f1-tyre-gun',
  'f1-pit-jack',
  'f1-gun-rack',
  'f1-tool-cabinet',
  'f1-hose-reel',
  'f1-fire-extinguisher',
  'f1-champagne',
  'f1-ice-bucket',
  'f1-trophy-cup',
  'f1-trophy-table',
  'f1-podium',
  'f1-interview-backdrop',
  'f1-cooldown-board',
  'f1-race-control',
  'f1-medical-post',
  'f1-generator-cabin',
  'f1-spectator-bridge',
  'f1-floodlight',
  'f1-camera-tower',
  'f1-oranje-can',
  'f1-kerb',
  'f1-gravel-trap',
  'f1-astroturf-strip',
])

function collectTargets(root: Group): InspectTarget[] {
  const seen = new Set<string>()
  const targets: InspectTarget[] = []
  for (const child of root.children) {
    const id = child.name
    if (!MARK.has(id) || seen.has(id)) continue
    seen.add(id)
    const entry = MODEL_CATALOG.find((item) => item.id === id)
    targets.push({
      id,
      label: entry?.label ?? id.replace(/^f1-/, '').replace(/-/g, ' '),
      description: entry?.description ?? 'F1 kit prop in the pit-straight assembly.',
      object: child,
    })
  }
  targets.sort((a, b) => a.label.localeCompare(b.label))
  return targets
}

export function createF1KitInspectPlayground(options: PlaygroundOptions): InspectPlayground {
  const scene = new Scene()
  scene.name = 'PLAYGROUND / F1 KIT INSPECT'
  scene.background = new Color(0x04070b)
  scene.fog = new Fog(0x04070b, 160, 320)

  const overviewPosition = new Vector3(22, 32, -48)
  const overviewFocus = new Vector3(0, 2.2, 28)

  const camera = new PerspectiveCamera(34, options.aspect, 0.35, 480)
  camera.name = 'CAMERA / F1 INSPECT OVERVIEW'
  camera.position.copy(overviewPosition)
  camera.lookAt(overviewFocus)

  const focus = overviewFocus.clone()
  const world = new Group()
  world.name = 'WORLD'
  scene.add(world)

  const kit = createScene()
  kit.update(0.38)
  world.add(kit.root)

  const inspectTargets = collectTargets(kit.root)

  const sky = new HemisphereLight(0x91a4b0, 0x080b0f, 0.5)
  sky.name = 'LIGHT / SKY'
  scene.add(sky)

  const key = new DirectionalLight(0xffeee0, 2.2)
  key.name = 'LIGHT / KEY'
  key.position.set(-36, 58, 28)
  key.castShadow = true
  scene.add(key)

  const fill = new DirectionalLight(0x83a8be, 0.52)
  fill.name = 'LIGHT / FILL'
  fill.position.set(40, 16, 22)
  scene.add(fill)

  let last = 0
  return {
    id: 'f1-kit-inspect',
    label: 'F1 KIT // INSPECT',
    scene,
    camera,
    focus,
    inspectTargets,
    overview: {
      position: overviewPosition.clone(),
      focus: overviewFocus.clone(),
      minDistance: 5,
      maxDistance: 160,
    },
    update(elapsedSeconds) {
      const dt = last === 0 ? 0 : Math.max(0, elapsedSeconds - last)
      last = elapsedSeconds
      kit.update(dt > 0.25 ? 1 / 60 : dt)
    },
    resize(aspect) {
      camera.aspect = aspect
      camera.updateProjectionMatrix()
    },
    dispose() {
      kit.dispose()
      disposeObjectTree(scene)
      scene.clear()
    },
  }
}

/** World-space point above a target for marker / camera aim. */
export function targetAnchor(object: InspectTarget['object'], out = new Vector3()): Vector3 {
  const box = new Box3().setFromObject(object)
  box.getCenter(out)
  out.y = box.max.y + Math.max(0.6, (box.max.y - box.min.y) * 0.12)
  return out
}

export function targetFocus(object: InspectTarget['object'], out = new Vector3()): Vector3 {
  const box = new Box3().setFromObject(object)
  box.getCenter(out)
  const size = box.getSize(new Vector3())
  out.y = box.min.y + size.y * 0.42
  return out
}

export function targetInspectDistance(object: InspectTarget['object']): number {
  const size = new Box3().setFromObject(object).getSize(new Vector3())
  return Math.min(28, Math.max(3.2, size.length() * 0.95 + 1.4))
}
