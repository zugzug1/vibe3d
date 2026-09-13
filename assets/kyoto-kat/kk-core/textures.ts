/**
 * CPU-baked DataTextures for Kyoto Kat props. Headless Dawn has no `document`, so these never go through a
 * canvas. Every texture is procedural, deterministic (closed-form hash, no PRNG), tiles, and is capped at
 * 1024 px by the kit budget — pass a smaller `size` whenever the surface is small on screen.
 *
 * Colours are derived from the palette tokens; nothing here invents a hex.
 */

import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three/webgpu'

import { DERIVED, TOKEN, mixToken, shade } from './palette.ts'

export const MAX_TEXTURE_SIZE = 1024

function put(data: Uint8Array, w: number, x: number, y: number, hex: number): void {
  const i = (y * w + x) * 4
  data[i] = (hex >> 16) & 0xff
  data[i + 1] = (hex >> 8) & 0xff
  data[i + 2] = hex & 0xff
  data[i + 3] = 255
}

/** Closed-form 2-D hash in [0, 1). */
function hash(x: number, y: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return v - Math.floor(v)
}

function finish(data: Uint8Array, n: number): DataTexture {
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

function clampSize(size: number, floor: number): number {
  return Math.min(MAX_TEXTURE_SIZE, Math.max(floor, size))
}

/** Softened cedar: long grain along U, faint ray flecks, no directional light baked in. */
export function cedarGrainTexture(size = 256): DataTexture {
  const n = clampSize(size, 32)
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const grain = Math.sin((y / n) * Math.PI * 22 + hash(0, y * 0.03) * 3) * 0.5 + 0.5
      const fleck = hash(x * 0.9, y * 0.11) * 0.08
      const k = grain * 0.22 + fleck
      put(data, n, x, y, mixToken(DERIVED.CEDAR_LIGHT, DERIVED.CEDAR_DARK, 0.25 + k))
    }
  }
  return finish(data, n)
}

/** Tatami: igusa rush weave, rows along U with the characteristic slight ridge every 2 px. */
export function tatamiWeaveTexture(size = 256): DataTexture {
  const n = clampSize(size, 32)
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const row = Math.abs(Math.sin((y / n) * Math.PI * 48))
      const strand = hash(x * 0.3, Math.floor(y / 2)) * 0.12
      const k = 0.35 + row * 0.35 + strand
      put(data, n, x, y, mixToken(shade(DERIVED.TATAMI, -0.2), shade(DERIVED.TATAMI, 0.15), k))
    }
  }
  return finish(data, n)
}

/** Washi: long fibres laid at random-but-deterministic angles in an ivory sheet. */
export function washiFibreTexture(size = 256): DataTexture {
  const n = clampSize(size, 32)
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cloud = hash(x * 0.05, y * 0.05) * 0.06
      const fibre = hash(x * 0.7 + y * 0.31, y * 0.02) > 0.965 ? 0.1 : 0
      put(data, n, x, y, mixToken(shade(DERIVED.WASHI, -0.12), DERIVED.WASHI, 0.82 - cloud - fibre))
    }
  }
  return finish(data, n)
}

/** Shibori indigo: tied-resist rings on a worn indigo ground. */
export function shiboriTexture(size = 256, cells = 6): DataTexture {
  const n = clampSize(size, 32)
  const data = new Uint8Array(n * n * 4)
  const cell = n / cells
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cx = ((x % cell) - cell / 2) / cell
      const cy = ((y % cell) - cell / 2) / cell
      const r = Math.hypot(cx, cy)
      const ring = Math.abs(Math.sin(r * Math.PI * 4.5)) > 0.85 ? 1 : 0
      const wear = hash(x * 0.1, y * 0.1) * 0.1
      const ground = mixToken(DERIVED.INDIGO_CLOTH, TOKEN.CHARCOAL, 0.15 + wear)
      put(data, n, x, y, ring ? mixToken(ground, TOKEN.IVORY, 0.6) : ground)
    }
  }
  return finish(data, n)
}

/** Handmade glaze: subtle pooling variation for a bowl or cup, tinted from a glaze colour. */
export function glazePoolingTexture(base: number, size = 128): DataTexture {
  const n = clampSize(size, 16)
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const pool = hash(x * 0.06, y * 0.06) * 0.14
      const speck = hash(x * 1.3, y * 1.7) > 0.985 ? -0.12 : 0
      put(data, n, x, y, shade(base, -pool - speck))
    }
  }
  return finish(data, n)
}
