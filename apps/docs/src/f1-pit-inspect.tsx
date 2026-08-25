import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu'
import type { InspectTarget } from '../../../src/core/types.ts'
import {
  createF1KitInspectPlayground,
  targetAnchor,
  targetFocus,
  targetInspectDistance,
} from '../../../src/playgrounds/f1-kit-inspect.ts'

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
}

interface InspectSession {
  focusTarget: (target: InspectTarget) => void
  returnOverview: () => void
}

interface SelectedProp {
  id: string
  label: string
  description: string
}

export function F1PitInspectPage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<InspectSession | null>(null)
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<SelectedProp | null>(null)
  const initialFocus = useRef(params.get('focus'))
  const setParamsRef = useRef(setParams)
  setParamsRef.current = setParams

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const canvas = host.querySelector('canvas')
    if (!canvas) return

    let stopped = false
    let renderer: WebGPURenderer | undefined
    let labelRenderer: CSS2DRenderer | undefined
    let controls: OrbitControls | undefined
    let previous = 0
    const markerObjects: CSS2DObject[] = []
    const lastCam = new Vector3()
    const lastTarget = new Vector3()
    let labelsDirty = true

    const playground = createF1KitInspectPlayground({
      aspect: Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1),
    })

    const tweenFromCam = new Vector3()
    const tweenFromTarget = new Vector3()
    const tweenToCam = new Vector3()
    const tweenToTarget = new Vector3()
    let tweening = false
    let tweenT = 0
    let tweenDuration = 0.75
    let current: InspectTarget | null = null

    const setMarkersVisible = (visible: boolean): void => {
      for (const marker of markerObjects) {
        marker.visible = visible
        marker.element.style.pointerEvents = visible ? 'auto' : 'none'
      }
      labelsDirty = true
    }

    const beginTween = (toCam: Vector3, toTarget: Vector3, duration = 0.75): void => {
      if (!controls) return
      tweenFromCam.copy(playground.camera.position)
      tweenFromTarget.copy(controls.target)
      tweenToCam.copy(toCam)
      tweenToTarget.copy(toTarget)
      tweenDuration = duration
      tweenT = 0
      tweening = true
      controls.enabled = false
      labelsDirty = true
    }

    const focusTarget = (target: InspectTarget): void => {
      if (!controls) return
      current = target
      setSelected({ id: target.id, label: target.label, description: target.description })
      // Keep markers up so you can click another prop without returning to overview.
      setMarkersVisible(true)
      for (const marker of markerObjects) {
        const active = marker.userData.targetId === target.id
        marker.element.classList.toggle('is-active', active)
      }
      setParamsRef.current((prev) => {
        const next = new URLSearchParams(prev)
        next.set('focus', target.id)
        return next
      }, { replace: true })

      targetFocus(target.object, tweenToTarget)
      const distance = targetInspectDistance(target.object)
      const offset = playground.camera.position.clone().sub(controls.target)
      if (offset.lengthSq() < 1e-6) offset.set(0.55, 0.28, 0.78)
      offset.normalize().multiplyScalar(distance)
      tweenToCam.copy(tweenToTarget).add(offset)
      controls.minDistance = Math.max(1.2, distance * 0.35)
      controls.maxDistance = Math.max(distance * 2.8, 12)
      beginTween(tweenToCam, tweenToTarget, 0.8)
    }

    const returnOverview = (): void => {
      if (!controls) return
      current = null
      setSelected(null)
      for (const marker of markerObjects) marker.element.classList.remove('is-active')
      setMarkersVisible(true)
      setParamsRef.current((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('focus')
        return next
      }, { replace: true })
      beginTween(playground.overview.position, playground.overview.focus, 0.85)
    }

    sessionRef.current = { focusTarget, returnOverview }

    const resize = () => {
      if (!renderer) return
      const width = Math.max(host.clientWidth, 1)
      const height = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
      renderer.setSize(width, height, false)
      playground.resize(width / height)
      labelRenderer?.setSize(width, height)
      labelsDirty = true
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    void (async () => {
      renderer = new WebGPURenderer({ canvas, antialias: true })
      renderer.outputColorSpace = SRGBColorSpace
      renderer.toneMapping = ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.2
      await renderer.init()
      if (stopped) return

      controls = new OrbitControls(playground.camera, canvas)
      controls.target.copy(playground.overview.focus)
      controls.enableDamping = true
      controls.dampingFactor = 0.055
      controls.minDistance = playground.overview.minDistance
      controls.maxDistance = playground.overview.maxDistance
      controls.maxPolarAngle = Math.PI * 0.495
      controls.update()

      labelRenderer = new CSS2DRenderer()
      labelRenderer.setSize(host.clientWidth, host.clientHeight)
      labelRenderer.domElement.className = 'pit-inspect-labels'
      host.appendChild(labelRenderer.domElement)

      for (const target of playground.inspectTargets) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'pit-inspect-marker'
        button.title = target.label
        button.innerHTML = `<span class="pit-inspect-marker__arrow" aria-hidden="true"></span><span class="pit-inspect-marker__label">${target.label}</span>`
        button.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          focusTarget(target)
        })
        const marker = new CSS2DObject(button)
        marker.userData.targetId = target.id
        targetAnchor(target.object, marker.position)
        playground.scene.add(marker)
        markerObjects.push(marker)
      }

      const bootFocus = initialFocus.current
      if (bootFocus) {
        const match = playground.inspectTargets.find((target) => target.id === bootFocus)
        if (match) focusTarget(match)
      }

      lastCam.copy(playground.camera.position)
      lastTarget.copy(controls.target)
      resize()
      renderer.setAnimationLoop((time) => {
        if (!renderer || !controls) return
        const dt = previous === 0 ? 1 / 60 : Math.min(0.05, (time - previous) / 1_000)
        previous = time

        if (tweening) {
          tweenT = Math.min(1, tweenT + dt / tweenDuration)
          const k = easeInOut(tweenT)
          playground.camera.position.lerpVectors(tweenFromCam, tweenToCam, k)
          controls.target.lerpVectors(tweenFromTarget, tweenToTarget, k)
          controls.update()
          labelsDirty = true
          if (tweenT >= 1) {
            tweening = false
            controls.enabled = true
            if (!current) {
              controls.minDistance = playground.overview.minDistance
              controls.maxDistance = playground.overview.maxDistance
              setMarkersVisible(true)
            }
          }
        } else {
          controls.update()
        }

        if (
          labelsDirty
          || lastCam.distanceToSquared(playground.camera.position) > 1e-6
          || lastTarget.distanceToSquared(controls.target) > 1e-6
        ) {
          labelsDirty = true
          lastCam.copy(playground.camera.position)
          lastTarget.copy(controls.target)
        }

        playground.update(time * 0.001)
        renderer.render(playground.scene, playground.camera)
        if (labelsDirty) {
          labelRenderer?.render(playground.scene, playground.camera)
          labelsDirty = false
        }
      })
    })().catch((error: unknown) => {
      console.error('Unable to open F1 pit inspect', error)
    })

    return () => {
      stopped = true
      sessionRef.current = null
      observer.disconnect()
      renderer?.setAnimationLoop(null)
      controls?.dispose()
      for (const marker of markerObjects) {
        playground.scene.remove(marker)
        marker.element.remove()
      }
      labelRenderer?.domElement.remove()
      playground.dispose()
      renderer?.dispose()
    }
  }, [])

  return (
    <div className="pit-inspect-page" ref={hostRef}>
      <canvas className="pit-inspect-canvas" aria-label="F1 pit straight inspect playground" />
      <div className="pit-inspect-chrome">
        <Link className="pit-inspect-home" to="/models">← Models</Link>
        <div className="pit-inspect-title">
          <p className="eyebrow">F1 Kit · Scene</p>
          <h1>Pit straight</h1>
          <p>Orbit and zoom the assembled kit. Click markers to inspect props — pick another without leaving overview.</p>
        </div>
        {selected ? (
          <aside className="pit-inspect-card">
            <p className="eyebrow">Selected prop</p>
            <h2>{selected.label}</h2>
            <p>{selected.description}</p>
            <button
              type="button"
              className="pit-inspect-back"
              onClick={() => sessionRef.current?.returnOverview()}
            >
              ← Back to overview
            </button>
          </aside>
        ) : null}
        <Link className="pit-inspect-explore" to="/scenes/f1-pit/explore">Explore pit</Link>
      </div>
    </div>
  )
}
