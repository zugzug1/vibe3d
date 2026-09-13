/** Dimensions are metres; finite out-of-range inputs clamp without quantizing. */
export interface CafeShapeConfig { archSpan: number; archRise: number; archThickness: number }
export interface ShapeControl { min: number; max: number; default: number; step: number; label: string }
export type ShapeControls = Readonly<Record<keyof CafeShapeConfig, Readonly<ShapeControl>>>
export function shapeConfig(controls: ShapeControls, patch: Partial<CafeShapeConfig>, current?: CafeShapeConfig): CafeShapeConfig {
  const result = {} as CafeShapeConfig
  for (const key of ['archSpan', 'archRise', 'archThickness'] as const) {
    const value = patch[key] === undefined ? (current?.[key] ?? controls[key].default) : patch[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${key} must be finite`)
    result[key] = Math.min(controls[key].max, Math.max(controls[key].min, value))
  }
  return result
}
export function finiteOption(value: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite`)
  return value
}
