import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  AmbientLight,
  Box3,
  Color,
  Vector3,
  DirectionalLight,
  Group,
  HemisphereLight,
  SRGBColorSpace,
  WebGPURenderer,
} from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { exportStaticGlb } from '../../../src/asset-forge/generator/glb.ts'
import type { CafeShapeInstance, CatalogModel, ModelPreview as PreviewInstance } from './catalog.ts'
import { controlValues, type CafeControls } from './cafe-controls.ts'
import { createKkPreview } from '../../../assets/cafe-kit/kk-core/preview.ts'
import { setCafeWoodFinish, type CafeWoodFinish } from '../../../assets/cafe-kit/kk-core/materials.ts'
import { DERIVED } from '../../../assets/cafe-kit/kk-core/palette.ts'

const DEFAULT_WOOD_TINT = `#${new Color(DERIVED.CEDAR).getHexString()}`
const DEFAULT_WOOD_ROUGHNESS = 0.78
interface ModelPreviewProps {
  model: CatalogModel
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function ModelPreview({ model }: ModelPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<PreviewInstance | undefined>(undefined)
  const [exporting, setExporting] = useState(false)
  const [ready, setReady] = useState(false)
  const [previewError, setPreviewError] = useState<string | undefined>(undefined)
  const [woodTint, setWoodTint] = useState(DEFAULT_WOOD_TINT)
  const [woodRoughness, setWoodRoughness] = useState(DEFAULT_WOOD_ROUGHNESS)
  const [woodMaterialCount, setWoodMaterialCount] = useState<number | undefined>(undefined)
  const [shapeControls, setShapeControls] = useState<CafeControls | undefined>(undefined)
  const [shapeValues, setShapeValues] = useState<Record<string, number>>({})
  const [woodError, setWoodError] = useState<string | undefined>(undefined)
  const instanceRef = useRef<CafeShapeInstance | undefined>(undefined)
  const woodPatchRef = useRef<CafeWoodFinish>({})
  const reframeRef = useRef<() => void>(() => {})

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const canvas = host.querySelector('canvas')
    if (!canvas) return

    let stopped = false
    let preview: PreviewInstance | undefined
    let instance: CafeShapeInstance | undefined
    let controls: OrbitControls | undefined
    let renderer: WebGPURenderer | undefined
    let previous = 0
    let previewDisposed = false
    const disposePreview = () => {
      if (!preview || previewDisposed) return
      previewDisposed = true
      preview.dispose()
    }
    previewRef.current = undefined
    instanceRef.current = undefined
    woodPatchRef.current = {}
    setReady(false)
    setPreviewError(undefined)
    setWoodError(undefined)
    setWoodTint(DEFAULT_WOOD_TINT)
    setWoodRoughness(DEFAULT_WOOD_ROUGHNESS)
    setWoodMaterialCount(undefined)
    setShapeControls(undefined)
    setShapeValues({})

    const resize = () => {
      if (!renderer || !preview) return
      const width = Math.max(host.clientWidth, 1)
      const height = Math.max(host.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(width, height, false)
      preview.camera.aspect = width / height
      preview.camera.updateProjectionMatrix()
    }
    const reframe = () => {
      if (!preview || !controls) return
      preview.root.updateMatrixWorld(true)
      const box = new Box3().setFromObject(preview.root)
      const center = box.getCenter(new Vector3())
      const direction = preview.camera.position.clone().sub(controls.target).normalize()
      const verticalHalfFov = preview.camera.fov * Math.PI / 360
      const halfFov = Math.min(verticalHalfFov, Math.atan(Math.tan(verticalHalfFov) * preview.camera.aspect))
      const distance = Math.max(box.getSize(new Vector3()).length() * 0.6 / Math.sin(halfFov), 0.4)
      controls.target.copy(center)
      preview.camera.position.copy(center).addScaledVector(direction, distance)
      preview.camera.lookAt(center)
      preview.camera.updateProjectionMatrix()
      controls.update()
    }
    reframeRef.current = reframe
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    void (async () => {
      renderer = new WebGPURenderer({ canvas, antialias: true })
      renderer.outputColorSpace = SRGBColorSpace
      renderer.toneMapping = ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.32
      await renderer.init()
      if (stopped) return

      const module = await model.load()
      if (stopped) return
      const aspect = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1)
      let loadedShapeControls: CafeControls | undefined
      let loadedShapeValues: Record<string, number> = {}
      if (model.kind === 'cafe-kit' && module.createModel) {
        instance = module.createModel()
        preview = createKkPreview(instance, { aspect, lighting: 'contrast' })
        loadedShapeControls = module.cafeShapeControls ?? module.structureControls
        if (loadedShapeControls) loadedShapeValues = controlValues(loadedShapeControls, instance.getConfig())
      } else {
        preview = await module.createPreview({ aspect })
      }
      const terrain = model.kind === 'terrain'
      renderer.toneMapping = terrain ? AgXToneMapping : ACESFilmicToneMapping
      // Browser canvas output needs its own exposure calibration; keep the reference light ratios.
      renderer.toneMappingExposure = terrain ? 1.05 : model.kind === 'cafe-kit' ? 3.2 : 1.32
      renderer.shadowMap.enabled = model.kind === 'cafe-kit'
      if (!terrain && model.kind !== 'cafe-kit') {
        preview.scene.background = new Color(0x4b5660)
        const studioLights = new Group()
        studioLights.name = 'vibe3d-docs-studio-lighting'
        studioLights.add(new AmbientLight(0xe7edf4, 1.15))
        const sky = new HemisphereLight(0xe8f3ff, 0x51473d, 2.2)
        studioLights.add(sky)
        const key = new DirectionalLight(0xfff5e8, 3.8)
        key.position.set(6, 9, 7)
        studioLights.add(key)
        const fill = new DirectionalLight(0xc8e2ff, 2.15)
        fill.position.set(-7, 4, 5)
        studioLights.add(fill)
        const rim = new DirectionalLight(0xb8ffd9, 2.4)
        rim.position.set(3, 6, -8)
        studioLights.add(rim)
        preview.scene.add(studioLights)
      }
      const woodCount = model.kind === 'cafe-kit' ? setCafeWoodFinish(preview.root, {}) : 0
      if (stopped) {
        disposePreview()
        if (instanceRef.current === instance) instanceRef.current = undefined
        return
      }
      setWoodMaterialCount(woodCount)
      setShapeControls(loadedShapeControls)
      setShapeValues(loadedShapeValues)
      previewRef.current = preview
      instanceRef.current = instance
      setReady(true)
      controls = new OrbitControls(preview.camera, canvas)
      controls.enableDamping = true
      controls.dampingFactor = 0.075
      preview.root.updateMatrixWorld(true)
      new Box3().setFromObject(preview.root).getCenter(controls.target)
      if (terrain) controls.maxDistance = 300
      controls.update()
      resize()
      renderer.setAnimationLoop((time) => {
        if (!preview || !renderer) return
        const delta = previous === 0 ? 0 : Math.min((time - previous) / 1_000, 0.05)
        previous = time
        preview.update(delta)
        controls?.update()
        renderer.render(preview.scene, preview.camera)
      })
    })().catch((error: unknown) => {
      if (stopped) return
      const message = error instanceof Error ? error.message : 'Unknown preview error'
      setPreviewError(message)
      console.error(`Unable to preview ${model.id}`, error)
    })

    return () => {
      stopped = true
      observer.disconnect()
      renderer?.setAnimationLoop(null)
      controls?.dispose()
      disposePreview()
      if (previewRef.current === preview) previewRef.current = undefined
      if (instanceRef.current === instance) instanceRef.current = undefined
      if (reframeRef.current === reframe) reframeRef.current = () => {}
      renderer?.dispose()
    }
  }, [model])

  const applyWoodFinish = (patch: CafeWoodFinish) => {
    const preview = previewRef.current
    if (!preview) return
    try {
      setCafeWoodFinish(preview.root, patch)
      setWoodError(undefined)
    } catch (error: unknown) {
      setWoodError(error instanceof Error ? error.message : 'Unable to update the wood finish')
    }
  }

  const changeWoodFinish = (patch: CafeWoodFinish) => {
    woodPatchRef.current = { ...woodPatchRef.current, ...patch }
    applyWoodFinish(patch)
  }

  const resetWoodFinish = () => {
    applyWoodFinish({ tint: null, roughness: null })
    woodPatchRef.current = {}
    setWoodTint(DEFAULT_WOOD_TINT)
    setWoodRoughness(DEFAULT_WOOD_ROUGHNESS)
  }

  const configureShape = (key: string, value: number) => {
    const instance = instanceRef.current
    const preview = previewRef.current
    if (!instance || !preview || !shapeControls) return
    try {
      instance.configure({ [key]: value })
      const config = instance.getConfig()
      setShapeValues(controlValues(shapeControls, config))
      const patch = woodPatchRef.current
      if (patch.tint !== undefined || patch.roughness !== undefined) setCafeWoodFinish(preview.root, patch)
      reframeRef.current()
      setWoodError(undefined)
    } catch (error: unknown) {
      setWoodError(error instanceof Error ? error.message : 'Unable to update the café shape')
    }
  }

  const resetShape = () => {
    if (!shapeControls) return
    for (const key of Object.keys(shapeControls)) configureShape(key, shapeControls[key]!.default)
  }

  const exportGlb = async () => {
    const preview = previewRef.current
    if (!preview || exporting) return
    setExporting(true)
    try {
      const blob = await exportStaticGlb(preview.root, { textureSize: 512 })
      download(blob, `${model.id}.glb`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="model-preview-layout">
    <div className="model-preview" ref={hostRef}>
      <canvas aria-label={`Interactive 3D preview of ${model.name}`} />
      {!ready && !previewError ? <div className="preview-status" aria-live="polite">Loading preview…</div> : null}
      {previewError ? <div className="preview-status preview-status--error" role="alert">Unable to load preview: {previewError}</div> : null}
      {model.kind === 'f1' ? <Link className="pit-link-button" to={`/scenes/f1-pit?focus=${encodeURIComponent(model.id)}`}>See in the pit</Link> : null}
      <button type="button" className="export-button" onClick={() => void exportGlb()} disabled={exporting || !ready}>
        {exporting ? 'Exporting…' : 'Export GLB'}
      </button>
    </div>
    <div className="cafe-model-controls">
      {shapeControls ? (
        <fieldset className="cafe-shape-controls" disabled={!ready}>
          <legend>Café shape</legend>
          {Object.keys(shapeControls).map((key) => {
            const control = shapeControls[key]!
            const value = shapeValues[key] ?? control.default
            return (
              <label key={key}>
                {control.label}
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={value}
                  aria-label={control.label}
                  onChange={(event) => configureShape(key, Number(event.target.value))}
                />
                <output>{value.toFixed(3)}</output>
              </label>
            )
          })}
          <button type="button" onClick={resetShape}>Reset shape</button>
        </fieldset>
      ) : null}
      {model.kind === 'cafe-kit' && (woodMaterialCount === undefined || woodMaterialCount > 0) ? (
        <fieldset className="cafe-finish-controls" disabled={!ready}>
          <legend>Café wood finish</legend>
          <label>
            Tint
            <input
              type="color"
              value={/^#[\da-f]{6}$/i.test(woodTint) ? woodTint : DEFAULT_WOOD_TINT}
              onChange={(event) => {
                const tint = event.target.value
                setWoodTint(tint)
                changeWoodFinish({ tint })
              }}
            />
            <input
              type="text"
              aria-label="Wood hex color"
              value={woodTint}
              maxLength={7}
              pattern="#[0-9a-fA-F]{6}"
              onChange={(event) => {
                const tint = event.target.value
                setWoodTint(tint)
                if (/^#[\da-f]{6}$/i.test(tint)) changeWoodFinish({ tint })
              }}
            />
          </label>
          <label>
            Roughness
            <input
              type="range"
              min="0.45"
              max="0.95"
              step="0.01"
              value={woodRoughness}
              onChange={(event) => {
                const roughness = Number(event.target.value)
                setWoodRoughness(roughness)
                changeWoodFinish({ roughness })
              }}
            />
            <output>{woodRoughness.toFixed(2)}</output>
          </label>
          <button type="button" onClick={resetWoodFinish}>Reset</button>
          {woodError ? <div className="cafe-finish-error" role="alert">{woodError}</div> : null}
        </fieldset>
      ) : null}
    </div>
    </div>
  )
}
