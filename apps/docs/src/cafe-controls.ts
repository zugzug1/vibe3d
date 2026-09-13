import type { ShapeControl } from '../../../assets/cafe-kit/kk-core/shape-controls.ts'
export type CafeControls = Readonly<Record<string, Readonly<ShapeControl>>>
export function controlValues(controls: CafeControls, config: Readonly<Record<string, unknown>>): Record<string, number> {
  return Object.fromEntries(Object.entries(controls).map(([key, control]) => {
    const value = config[key]
    if (![control.min, control.max, control.default, control.step, value].every(v => typeof v === 'number' && Number.isFinite(v))
      || control.min > control.max || control.step <= 0 || control.default < control.min || control.default > control.max) {
      throw new Error(`Invalid café control: ${key}`)
    }
    return [key, value as number]
  }))
}
