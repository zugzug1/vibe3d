import type { Group, Object3D, PerspectiveCamera, Scene, Vector3 } from 'three/webgpu'

export interface Viewport {
  width: number
  height: number
  pixelRatio: number
}

export interface PlaygroundOptions {
  aspect: number
}

/** A complete, platform-neutral scene that browser and Node can both render. */
export interface Playground {
  readonly id: string
  readonly label: string
  readonly scene: Scene
  readonly camera: PerspectiveCamera
  readonly focus: Vector3
  update(elapsedSeconds: number): void
  resize(aspect: number): void
  dispose(): void
}

/** One representative prop in an inspect playground (markers / click-to-focus). */
export interface InspectTarget {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly object: Object3D
}

export interface InspectPlayground extends Playground {
  readonly inspectTargets: readonly InspectTarget[]
  readonly overview: {
    readonly position: Vector3
    readonly focus: Vector3
    readonly minDistance: number
    readonly maxDistance: number
  }
}

export function isInspectPlayground(playground: Playground): playground is InspectPlayground {
  return 'inspectTargets' in playground && Array.isArray((playground as InspectPlayground).inspectTargets)
}

export interface ProceduralProp {
  readonly root: Group
  update(elapsedSeconds: number): void
}
