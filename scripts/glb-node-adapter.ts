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
    let sx = 1; let sy = 1; let tx = 0; let ty = 0
    const fullRect = (x: number, y: number, width: number, height: number): void => {
      if (x !== 0 || y !== 0 || width !== this.width || height !== this.height) {
        throw new Error('GLB CLI adapter requires full-size RGBA rectangles (no resizing)')
      }
    }
    const context = {
      fillStyle: '#000000',
      translate: (x: number, y: number) => { tx += sx * x; ty += sy * y },
      scale: (x: number, y: number) => { sx *= x; sy *= y },
      fillRect: (x: number, y: number, width: number, height: number) => {
        fullRect(x, y, width, height)
        if (sx !== 1 || sy !== 1 || tx !== 0 || ty !== 0 || !/^#[\da-f]{6}$/i.test(context.fillStyle)) {
          throw new Error('GLB CLI adapter supports untransformed opaque hex fills only')
        }
        const color = Number.parseInt(context.fillStyle.slice(1), 16)
        const data = new Uint8ClampedArray(width * height * 4)
        for (let i = 0; i < data.length; i += 4) data.set([color >> 16, (color >> 8) & 255, color & 255, 255], i)
        this.pixels = new PixelData(data, width, height)
      },
      getImageData: (x: number, y: number, width: number, height: number) => {
        fullRect(x, y, width, height)
        // Canvas reads are snapshots: exporter mutates composite independently of subsequent draws.
        return new PixelData(this.pixels ? new Uint8ClampedArray(this.pixels.data) : new Uint8ClampedArray(width * height * 4), width, height)
      },
      putImageData: (pixels: PixelData, x: number, y: number) => {
        fullRect(x, y, pixels.width, pixels.height)
        // putImageData ignores transforms and copies its input by specification.
        this.pixels = new PixelData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)
      },
      drawImage: (image: unknown, x: number, y: number, width: number, height: number) => {
        fullRect(x, y, width, height)
        const source = image instanceof DataCanvas ? image.pixels : image as PixelData | undefined
        if (!source || !(source.data instanceof Uint8Array || source.data instanceof Uint8ClampedArray)
          || source.width !== width || source.height !== height || source.data.length !== width * height * 4) {
          throw new Error('GLB CLI drawImage requires same-size RGBA8 data or an adapter canvas')
        }
        if (!((sx === 1 && tx === 0) || (sx === -1 && tx === width))
          || !((sy === 1 && ty === 0) || (sy === -1 && ty === height))) {
          throw new Error('GLB CLI drawImage supports identity or full-image flips only')
        }
        const data = new Uint8ClampedArray(source.data.length)
        for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
          const from = (row * width + col) * 4
          if (source.data[from + 3] !== 255) throw new Error('GLB CLI drawImage requires opaque pixels; alpha compositing requires browser export')
          const to = ((sy === 1 ? row : height - 1 - row) * width + (sx === 1 ? col : width - 1 - col)) * 4
          data.set(source.data.subarray(from, from + 4), to)
        }
        this.pixels = new PixelData(data, width, height)
      },
    }
    return context
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
