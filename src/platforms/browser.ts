import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { Vector3 } from 'three/webgpu'
import { RENDER_SETTINGS } from '../core/config.ts'
import { createRenderer, setRendererViewport } from '../core/renderer.ts'
import { isInspectPlayground, type InspectTarget, type Playground } from '../core/types.ts'
import { createActivePlayground } from '../playgrounds/active.ts'
import { createF1KitPlayground } from '../playgrounds/f1-kit-scene.ts'
import {
  createF1KitInspectPlayground,
  targetFocus,
  targetInspectDistance,
  targetAnchor,
} from '../playgrounds/f1-kit-inspect.ts'

function browserPixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, RENDER_SETTINGS.maxBrowserPixelRatio)
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
}

export async function startBrowserPlayground(host: HTMLDivElement): Promise<() => void> {
  const params = new URLSearchParams(window.location.search)
  const playgroundId = params.get('playground')
  const inspectMode = playgroundId === 'f1' && params.get('mode') === 'inspect'

  host.innerHTML = `
    <main class="playground-shell${inspectMode ? ' playground-shell--inspect' : ''}">
      <canvas class="viewport" aria-label="Interactive 3D sci-fi kit playground"></canvas>

      <header class="hud hud--top" aria-label="Playground status">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true"></span>
          <div>
            <p class="eyebrow">PROCEDURAL ASSET LAB</p>
            <h1>SCI-FI <span>KIT</span></h1>
          </div>
        </div>
        <div class="renderer-state">
          <span class="status-dot" aria-hidden="true"></span>
          <div>
            <p class="eyebrow">RENDER PATH</p>
            <p class="status-value" data-renderer-status>INITIALIZING</p>
          </div>
        </div>
      </header>

      <section class="subject-card hud" aria-label="Current procedural asset">
        <p class="eyebrow">ACTIVE SUBJECT</p>
        <h2 data-subject-label>LOADING</h2>
        <div class="subject-meta">
          <span>PROCEDURAL</span>
          <span>REAL-TIME</span>
          <span>DAWN READY</span>
        </div>
      </section>

      ${inspectMode ? `
      <aside class="inspect-card hud" data-inspect-card hidden>
        <p class="eyebrow">SELECTED PROP</p>
        <h2 data-inspect-title>—</h2>
        <p class="inspect-card__body" data-inspect-body></p>
        <button type="button" class="inspect-card__back" data-inspect-back>← BACK TO OVERVIEW</button>
      </aside>
      ` : ''}

      <section class="telemetry hud" aria-label="Renderer telemetry">
        <p class="eyebrow">FRAME TELEMETRY</p>
        <p data-telemetry>-- DRAW / -- TRI</p>
      </section>

      <div class="focus-reticle" aria-hidden="true">
        <i></i><i></i><i></i><i></i>
      </div>

      <footer class="hud hud--bottom">
        <p><span>DRAG</span> ORBIT</p>
        <p><span>WHEEL</span> DOLLY</p>
        <p><span>RIGHT DRAG</span> PAN</p>
        ${inspectMode ? '<p><span>CLICK ▲</span> INSPECT</p>' : ''}
        <p class="build-tag">THREE / WEBGPU</p>
      </footer>

      <div class="boot-screen" data-boot-screen>
        <span class="boot-line"></span>
        <p>REQUESTING GPU DEVICE</p>
      </div>
    </main>
  `

  const canvas = host.querySelector<HTMLCanvasElement>('canvas')!
  const status = host.querySelector<HTMLElement>('[data-renderer-status]')!
  const subject = host.querySelector<HTMLElement>('[data-subject-label]')!
  const telemetry = host.querySelector<HTMLElement>('[data-telemetry]')!
  const bootScreen = host.querySelector<HTMLElement>('[data-boot-screen]')!
  const inspectCard = host.querySelector<HTMLElement>('[data-inspect-card]')
  const inspectTitle = host.querySelector<HTMLElement>('[data-inspect-title]')
  const inspectBody = host.querySelector<HTMLElement>('[data-inspect-body]')
  const inspectBack = host.querySelector<HTMLButtonElement>('[data-inspect-back]')

  const playground: Playground = playgroundId === 'f1'
    ? (inspectMode
      ? createF1KitInspectPlayground({ aspect: 1 })
      : createF1KitPlayground({ aspect: 1 }))
    : createActivePlayground({ aspect: 1 })

  const renderer = createRenderer({ canvas })
  const controls = new OrbitControls(playground.camera, canvas)
  let stopped = false
  let lastTelemetryUpdate = 0

  controls.target.copy(playground.focus)
  controls.enableDamping = true
  controls.dampingFactor = 0.055

  const inspect = isInspectPlayground(playground) ? playground : null
  const wide = playground.id === 'f1-kit-scene' || playground.id === 'f1-kit-inspect'
  if (inspect) {
    controls.minDistance = inspect.overview.minDistance
    controls.maxDistance = inspect.overview.maxDistance
    controls.maxPolarAngle = Math.PI * 0.495
  } else {
    controls.minDistance = wide ? 14 : 5.5
    controls.maxDistance = wide ? 150 : 24
    controls.maxPolarAngle = Math.PI * 0.49
  }
  controls.update()

  let labelRenderer: CSS2DRenderer | undefined
  const markerObjects: CSS2DObject[] = []
  const overviewCamera = new Vector3()
  const overviewTarget = new Vector3()
  const tweenFromCam = new Vector3()
  const tweenFromTarget = new Vector3()
  const tweenToCam = new Vector3()
  const tweenToTarget = new Vector3()
  let tweening = false
  let tweenT = 0
  let tweenDuration = 0.75
  let selected: InspectTarget | null = null

  const setMarkersVisible = (visible: boolean): void => {
    for (const marker of markerObjects) {
      marker.visible = visible
      marker.element.style.pointerEvents = visible ? 'auto' : 'none'
    }
  }

  const showOverviewHud = (): void => {
    selected = null
    if (inspectCard) inspectCard.hidden = true
    subject.textContent = playground.label
    setMarkersVisible(true)
    if (inspect) {
      controls.minDistance = inspect.overview.minDistance
      controls.maxDistance = inspect.overview.maxDistance
    }
  }

  const beginTween = (
    toCam: Vector3,
    toTarget: Vector3,
    duration = 0.75,
  ): void => {
    tweenFromCam.copy(playground.camera.position)
    tweenFromTarget.copy(controls.target)
    tweenToCam.copy(toCam)
    tweenToTarget.copy(toTarget)
    tweenDuration = duration
    tweenT = 0
    tweening = true
    controls.enabled = false
  }

  const focusTarget = (target: InspectTarget): void => {
    selected = target
    if (inspectCard && inspectTitle && inspectBody) {
      inspectCard.hidden = false
      inspectTitle.textContent = target.label
      inspectBody.textContent = target.description
    }
    subject.textContent = target.label
    setMarkersVisible(false)

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
    if (!inspect) return
    overviewCamera.copy(inspect.overview.position)
    overviewTarget.copy(inspect.overview.focus)
    beginTween(overviewCamera, overviewTarget, 0.85)
    // Apply overview limits after tween ends via flag
    selected = null
    if (inspectCard) inspectCard.hidden = true
    subject.textContent = playground.label
  }

  if (inspect) {
    labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(host.clientWidth, host.clientHeight)
    labelRenderer.domElement.className = 'inspect-labels'
    host.querySelector('.playground-shell')!.appendChild(labelRenderer.domElement)

    for (const target of inspect.inspectTargets) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'inspect-marker'
      button.title = target.label
      button.innerHTML = `<span class="inspect-marker__arrow" aria-hidden="true"></span><span class="inspect-marker__label">${target.label}</span>`
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        focusTarget(target)
      })
      const marker = new CSS2DObject(button)
      targetAnchor(target.object, marker.position)
      playground.scene.add(marker)
      markerObjects.push(marker)
    }

    inspectBack?.addEventListener('click', () => {
      returnOverview()
      // Restore markers after camera returns
      const restore = (): void => {
        if (tweening) {
          requestAnimationFrame(restore)
          return
        }
        showOverviewHud()
      }
      requestAnimationFrame(restore)
    })
  }

  const resize = () => {
    const width = Math.max(host.clientWidth, 1)
    const height = Math.max(host.clientHeight, 1)
    const pixelRatio = browserPixelRatio()
    setRendererViewport(renderer, { width, height, pixelRatio })
    playground.resize(width / height)
    labelRenderer?.setSize(width, height)
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  resize()

  try {
    await renderer.init()
  } catch (error) {
    status.textContent = 'DEVICE ERROR'
    bootScreen.classList.add('boot-screen--error')
    bootScreen.querySelector('p')!.textContent =
      error instanceof Error ? error.message : 'Unable to initialize renderer'
    console.error(error)

    return () => {
      resizeObserver.disconnect()
      controls.dispose()
      for (const marker of markerObjects) {
        playground.scene.remove(marker)
        marker.element.remove()
      }
      labelRenderer?.domElement.remove()
      playground.dispose()
      renderer.dispose()
    }
  }

  const usingWebGPU = Boolean(
    (renderer.backend as typeof renderer.backend & { isWebGPUBackend?: boolean })
      .isWebGPUBackend,
  )
  status.textContent = usingWebGPU ? 'WEBGPU / READY' : 'WEBGL 2 / FALLBACK'
  subject.textContent = playground.label
  host.dataset.backend = usingWebGPU ? 'webgpu' : 'webgl'
  bootScreen.classList.add('boot-screen--complete')

  const fixedTimeValue = new URLSearchParams(window.location.search).get('time')
  const fixedTime = fixedTimeValue === null ? null : Number(fixedTimeValue)
  let prevFrame = 0

  await renderer.setAnimationLoop((time) => {
    if (stopped) return

    const elapsedSeconds =
      fixedTime !== null && Number.isFinite(fixedTime) ? fixedTime : time * 0.001
    const dt = prevFrame === 0 ? 1 / 60 : Math.min(0.05, (time - prevFrame) * 0.001)
    prevFrame = time

    if (tweening) {
      tweenT = Math.min(1, tweenT + dt / tweenDuration)
      const k = easeInOut(tweenT)
      playground.camera.position.lerpVectors(tweenFromCam, tweenToCam, k)
      controls.target.lerpVectors(tweenFromTarget, tweenToTarget, k)
      controls.update()
      if (tweenT >= 1) {
        tweening = false
        controls.enabled = true
        if (!selected && inspect) {
          controls.minDistance = inspect.overview.minDistance
          controls.maxDistance = inspect.overview.maxDistance
          setMarkersVisible(true)
        }
      }
    } else {
      controls.update()
    }

    playground.update(elapsedSeconds)
    renderer.render(playground.scene, playground.camera)
    labelRenderer?.render(playground.scene, playground.camera)

    if (time - lastTelemetryUpdate > 400) {
      const renderInfo = renderer.info.render
      const extra = inspect ? ` · ${inspect.inspectTargets.length} MARKERS` : ''
      telemetry.textContent = `${renderInfo.drawCalls} DRAW / ${renderInfo.triangles.toLocaleString()} TRI${extra}`
      lastTelemetryUpdate = time
    }
  })

  return () => {
    stopped = true
    resizeObserver.disconnect()
    void renderer.setAnimationLoop(null)
    controls.dispose()
    for (const marker of markerObjects) {
      playground.scene.remove(marker)
      marker.element.remove()
    }
    labelRenderer?.domElement.remove()
    playground.dispose()
    renderer.dispose()
  }
}
