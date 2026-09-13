import {
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
} from 'three/webgpu'

import type { Vec3 } from './parts.ts'
import { DERIVED, TOKEN, shade } from './palette.ts'

/**
 * The kit's single deterministic capture rig, plus the two framings the brief asks for.
 *
 * Fifty props photographed under fifty light rigs cannot be judged against each other. Every model.ts
 * calls this rather than hand-writing lights, so the only thing that varies per prop is framing.
 *
 * - `close`  — product-reference three-quarter, auto-distance from the model's diagonal. What the
 *   img2threejs comparison sheet and the vibe-model critic look at.
 * - `cafe`   — the gameplay camera: 35° elevation, a fixed 4.5 m from the target, 45° fov, ivory ground
 *   card. What the asset has to read at inside Kyoto Kat.
 *
 * The backdrop is the reference pack's neutral ivory (the concept PNGs sit on ivory) so a side-by-side
 * with the reference compares like with like. Soft upper-left key matches the reference prompt.
 */

export type KkFraming = 'close' | 'cafe'

export interface KkPreviewOptions {
  readonly aspect?: number
  readonly framing?: KkFraming
  /** Point the camera looks at, in model space. Defaults to the model's bounding-box centre. */
  readonly target?: Vec3
  /** Camera distance from the target, in metres. Overrides the framing's default. */
  readonly distance?: number
  /** Turntable angle in radians. 0 faces the model's +Z. */
  readonly yaw?: number
  /** Elevation in radians above the horizon. */
  readonly pitch?: number
  readonly fov?: number
  /** Ivory receive card. On by default under `cafe`, off under `close`. */
  readonly ground?: boolean
  readonly bloom?: boolean
  /** Opt-in stronger form separation for production review; legacy captures remain reproducible. */
  readonly lighting?: 'legacy' | 'contrast'
}

export interface KkPreviewModel {
  readonly root: Group
  lookAt?(camera: PerspectiveCamera): void
  update?(deltaSeconds: number): void
  dispose(): void
}

export interface KkPreview {
  readonly scene: Scene
  readonly root: Group
  readonly camera: PerspectiveCamera
  readonly bloom?: boolean
  update(deltaSeconds: number): void
  dispose(): void
}

/** Front-right three-quarter, elevated ~20°, as the reference prompt specifies. */
export const DEFAULT_YAW = 0.72
export const DEFAULT_PITCH = 0.35
/** Gameplay camera. */
export const CAFE_PITCH = 0.61
export const CAFE_DISTANCE = 4.5
export const CAFE_FOV = 45

export function createKkPreview(model: KkPreviewModel, options: KkPreviewOptions = {}): KkPreview {
  const framing: KkFraming = options.framing ?? 'close'
  const scene = new Scene()
  scene.name = 'cafe-kit / reference preview'
  scene.background = new Color(TOKEN.IVORY)
  scene.add(model.root)

  scene.add(new HemisphereLight(shade(TOKEN.IVORY, 0.3), shade(DERIVED.CEDAR_DARK, -0.3), 0.55))
  const key = new DirectionalLight(shade(TOKEN.IVORY, 0.4), 2.0)
  key.position.set(-6, 8, 7)
  scene.add(key)
  const fill = new DirectionalLight(shade(TOKEN.INDIGO, 0.5), 0.5)
  fill.position.set(7, 2.4, 5.5)
  scene.add(fill)
  const rim = new DirectionalLight(shade(TOKEN.IVORY, 0.2), 0.6)
  rim.position.set(4.5, 6, -7)
  scene.add(rim)

  const extras: Array<{ dispose: () => void }> = []
  const ground = options.ground ?? framing === 'cafe'
  if (ground) {
    const groundGeo = new PlaneGeometry(28, 28)
    groundGeo.rotateX(-Math.PI / 2)
    const groundMat = new MeshStandardMaterial({
      name: 'cafe-kit / preview ground',
      color: shade(TOKEN.IVORY, -0.08),
      roughness: 0.96,
      metalness: 0,
    })
    const groundMesh = new Mesh(groundGeo, groundMat)
    groundMesh.name = 'cafe-kit / preview ground'
    groundMesh.receiveShadow = true
    groundMesh.userData.excludeFromExport = true
    scene.add(groundMesh)
    extras.push({
      dispose: () => {
        scene.remove(groundMesh)
        groundGeo.dispose()
        groundMat.dispose()
      },
    })
  }

  // Frame from the model's own box so a worker never has to guess a distance.
  model.root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(model.root as never)
  const centre = box.getCenter(new Vector3())
  const diagonal = Math.max(0.2, box.getSize(new Vector3()).length())
  if (options.lighting === 'contrast') {
    model.root.traverse((object) => {
      if (object instanceof Mesh) {
        // Thin shells may explicitly opt out of self-shadow acne; metadata survives GLB extras.
        object.castShadow = object.userData.cafeCastShadow !== false
        object.receiveShadow = true
      }
    })
    scene.children.forEach((object) => { if (object instanceof HemisphereLight) object.intensity = 0.18 })
    key.intensity = 1.35; fill.intensity = 0.12; rim.intensity = 0.22
    key.castShadow = true
    key.target.position.copy(centre); scene.add(key.target)
    const extent = Math.max(0.3, diagonal * 0.65)
    Object.assign(key.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.1, far: 60 })
    key.shadow.camera.updateProjectionMatrix()
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.bias = -0.00005
    extras.push({ dispose: () => key.shadow.dispose() })
  }

  const target: Vec3 = options.target ?? [centre.x, centre.y, centre.z]
  const distance = options.distance ?? (framing === 'cafe' ? CAFE_DISTANCE : diagonal * 1.6)
  const yaw = options.yaw ?? DEFAULT_YAW
  const pitch = options.pitch ?? (framing === 'cafe' ? CAFE_PITCH : DEFAULT_PITCH)
  const fov = options.fov ?? (framing === 'cafe' ? CAFE_FOV : 30)
  const aspect = Number.isFinite(options.aspect) && (options.aspect ?? 0) > 0 ? options.aspect! : 1

  const camera = new PerspectiveCamera(fov, aspect, 0.05, 200)
  camera.name = 'cafe-kit / reference camera'
  camera.position.set(
    target[0] + Math.sin(yaw) * Math.cos(pitch) * distance,
    target[1] + Math.sin(pitch) * distance,
    target[2] + Math.cos(yaw) * Math.cos(pitch) * distance,
  )
  camera.lookAt(target[0], target[1], target[2])
  camera.updateProjectionMatrix()
  if (framing === 'close') {
    // Explicit artist distances can crop wide props or low-hanging feet.
    // Preserve angle/target, but enforce a 10% NDC margin around all box corners.
    camera.updateMatrixWorld(true)
    const tangent = Math.tan(fov * Math.PI / 360) * 0.9
    let retreat = 0
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const p = new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse)
          retreat = Math.max(retreat, Math.abs(p.x) / (tangent * aspect) + p.z,
            Math.abs(p.y) / tangent + p.z, p.z + camera.near * 2)
        }
      }
    }
    if (retreat > 0) {
      const away = camera.position.clone().sub(new Vector3(...target)).normalize()
      camera.position.addScaledVector(away, retreat)
      camera.updateMatrixWorld(true)
    }
  }
  scene.add(camera)

  return {
    scene,
    root: model.root,
    camera,
    bloom: options.bloom,
    update: (deltaSeconds: number) => {
      model.lookAt?.(camera)
      model.update?.(deltaSeconds)
    },
    dispose: () => {
      for (const extra of extras) extra.dispose()
      scene.remove(model.root)
      model.dispose()
    },
  }
}
