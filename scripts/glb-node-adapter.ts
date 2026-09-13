/** Minimal CLI-only browser adapters for RGBA DataTexture GLB export.
 * Not a general canvas implementation: unsupported drawing fails explicitly.
 */
import sharp from 'sharp'

class PixelData {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    if (data.length !== width * height * 4) throw new Error('Invalid RGBA image length')
    this.data = data
    this.width = width
    this.height = height
  }
}

class DataCanvas {
  private pixels?: PixelData
  width: number
  height: number
  constructor(width: number, height: number) { this.width = width; this.height = height }
  getContext(kind: string) {
    if (kind !== '2d') throw new Error('GLB CLI adapter supports only 2D data textures')
    return {
      // Canvas putImageData ignores the current transform by specification.
      translate: (_x: number, _y: number) => {},
      scale: (_x: number, _y: number) => {},
      putImageData: (pixels: PixelData, x: number, y: number) => {
        if (x !== 0 || y !== 0 || pixels.width !== this.width || pixels.height !== this.height) {
          throw new Error('GLB CLI adapter requires full-size RGBA data textures')
        }
        this.pixels = pixels
      },
      drawImage: () => { throw new Error('GLB CLI: DOM image textures require browser export') },
    }
  }
  async convertToBlob(options: { type?: string } = {}): Promise<Blob> {
    if (options.type && options.type !== 'image/png') throw new Error('GLB CLI adapter exports PNG only')
    if (!this.pixels) throw new Error('GLB CLI: no texture pixels supplied')
    const bytes = await sharp(Buffer.from(this.pixels.data), {
      raw: { width: this.width, height: this.height, channels: 4 },
    }).png().toBuffer()
    return new Blob([new Uint8Array(bytes)], { type: 'image/png' })
  }
}

class BlobReader {
  result: ArrayBuffer | null = null
  onloadend: (() => void) | null = null
  onerror: ((error: unknown) => void) | null = null
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onloadend?.()
    }, (error: unknown) => {
      if (this.onerror) this.onerror(error)
      else queueMicrotask(() => { throw error })
    })
  }
}

/** Install only missing globals in the dedicated CLI process. */
export function installGlbNodeAdapters(): void {
  const globals = globalThis as unknown as Record<string, unknown>
  globals.OffscreenCanvas ??= DataCanvas
  globals.ImageData ??= PixelData
  globals.FileReader ??= BlobReader
}
