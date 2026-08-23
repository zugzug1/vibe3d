import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  WebGPURenderer,
} from 'three/webgpu'
import { createF1KitPlayground } from '../../../src/playgrounds/f1-kit-scene.ts'

export function F1PitExplorePage() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const canvas = host.querySelector('canvas')
    if (!canvas) return

    let stopped = false
    let renderer: WebGPURenderer | undefined
    let controls: OrbitControls | undefined

    const playground = createF1KitPlayground({
      aspect: Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1),
    })

    const resize = () => {
      if (!renderer) return
      const width = Math.max(host.clientWidth, 1)
      const height = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(width, height, false)
      playground.resize(width / height)
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
      controls.target.copy(playground.focus)
      controls.enableDamping = true
      controls.dampingFactor = 0.055
      controls.minDistance = 14
      controls.maxDistance = 150
      controls.maxPolarAngle = Math.PI * 0.49
      controls.update()

      resize()
      renderer.setAnimationLoop((time) => {
        if (!renderer || !controls) return
        controls.update()
        playground.update(time * 0.001)
        renderer.render(playground.scene, playground.camera)
      })
    })().catch((error: unknown) => {
      console.error('Unable to open F1 pit explore', error)
    })

    return () => {
      stopped = true
      observer.disconnect()
      renderer?.setAnimationLoop(null)
      controls?.dispose()
      playground.dispose()
      renderer?.dispose()
    }
  }, [])

  return (
    <div className="pit-inspect-page" ref={hostRef}>
      <canvas className="pit-inspect-canvas" aria-label="F1 pit straight cinematic orbit" />
      <div className="pit-inspect-chrome">
        <Link className="pit-inspect-home" to="/scenes/f1-pit">← Inspect</Link>
        <div className="pit-inspect-title">
          <p className="eyebrow">F1 Kit · Scene</p>
          <h1>Explore pit</h1>
          <p>Drag to orbit, scroll to dolly, right-drag to pan.</p>
        </div>
      </div>
    </div>
  )
}
