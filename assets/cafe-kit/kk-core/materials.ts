/**
 * The Kyoto Kat kit's material set, built from the five canonical colour tokens.
 *
 * Every prop acquires this bundle instead of picking its own hexes, so the whole café shares one answer
 * to "what colour is cedar here" and the eye reads the collection as one place. Plain PBR
 * (`MeshStandardMaterial`): the consumer game applies its own cel / ink-outline pass, so nothing here
 * bakes directional light, and no slot is emissive.
 *
 * Roughness stays inside 0.45–0.95 and metalness is non-zero only on `brass` and `steel`. `glass` is the
 * only transparent slot and exists for the two glazed cabinets (kk-003, kk-025) and the bean jar; it is
 * single-layer by contract — never stacked, never behind another transparent surface.
 */

import { DoubleSide, MeshStandardMaterial, type Material } from 'three/webgpu'

import { DERIVED, TOKEN } from './palette.ts'

export interface KkMaterials {
  /** Softened cedar: counters, frames, plinths, shelves. */
  readonly cedar: MeshStandardMaterial
  /** Oiled / shadowed cedar: drawer sides, undersides, end grain. */
  readonly cedarDark: MeshStandardMaterial
  /** Washi paper: shoji, lanterns, labels. Double-sided for panels that are seen from both faces. */
  readonly washi: MeshStandardMaterial
  /** Tatami mat surface. */
  readonly tatami: MeshStandardMaterial
  /** Ivory glaze on handmade ceramics. */
  readonly glaze: MeshStandardMaterial
  /** Moss glaze. */
  readonly glazeMoss: MeshStandardMaterial
  /** Charcoal / tenmoku glaze. */
  readonly glazeDeep: MeshStandardMaterial
  /** Indigo textile. */
  readonly indigo: MeshStandardMaterial
  /** Sun-faded indigo textile. */
  readonly indigoFaded: MeshStandardMaterial
  /** Restrained vermilion accent — an emblem, a seal, a cord. */
  readonly vermilion: MeshStandardMaterial
  /** Ink and iron: contour bands, pulls, hinges, kettle bodies. */
  readonly ink: MeshStandardMaterial
  /** Worn brass fittings. */
  readonly brass: MeshStandardMaterial
  /** Brushed steel machine bodies. */
  readonly steel: MeshStandardMaterial
  /** Single-layer tinted glass. */
  readonly glass: MeshStandardMaterial
}

export interface KkMaterialBundle {
  readonly materials: KkMaterials
  /** Every material the bundle created, for one-call disposal. */
  readonly owned: readonly Material[]
}

export interface KkMaterialOptions {
  /** Overrides merged over the bundle. An override is consumer-owned and never disposed here. */
  readonly overrides?: Partial<Record<keyof KkMaterials, MeshStandardMaterial>>
}

/**
 * Build the kit's material set. Anything passed through `overrides` replaces a slot and is excluded from
 * `owned`, so `disposeKkMaterials` never frees a material the consumer handed in (rule 17).
 */
export function acquireKkMaterials(options: KkMaterialOptions = {}): KkMaterialBundle {
  const owned: Material[] = []
  const make = (
    slot: keyof KkMaterials,
    parameters: ConstructorParameters<typeof MeshStandardMaterial>[0],
  ): MeshStandardMaterial => {
    const override = options.overrides?.[slot]
    if (override) return override
    const material = new MeshStandardMaterial({ name: `cafe-kit / ${slot}`, ...parameters })
    owned.push(material)
    return material
  }

  const materials: KkMaterials = {
    cedar: make('cedar', { color: DERIVED.CEDAR, roughness: 0.78, metalness: 0.0 }),
    cedarDark: make('cedarDark', { color: DERIVED.CEDAR_DARK, roughness: 0.82, metalness: 0.0 }),
    washi: make('washi', { color: DERIVED.WASHI, roughness: 0.95, metalness: 0.0, side: DoubleSide }),
    tatami: make('tatami', { color: DERIVED.TATAMI, roughness: 0.92, metalness: 0.0 }),
    glaze: make('glaze', { color: DERIVED.GLAZE_IVORY, roughness: 0.45, metalness: 0.0 }),
    glazeMoss: make('glazeMoss', { color: DERIVED.GLAZE_MOSS, roughness: 0.48, metalness: 0.0 }),
    glazeDeep: make('glazeDeep', { color: DERIVED.GLAZE_DEEP, roughness: 0.5, metalness: 0.0 }),
    indigo: make('indigo', { color: DERIVED.INDIGO_CLOTH, roughness: 0.95, metalness: 0.0 }),
    indigoFaded: make('indigoFaded', { color: DERIVED.INDIGO_FADED, roughness: 0.95, metalness: 0.0 }),
    vermilion: make('vermilion', { color: TOKEN.VERMILION, roughness: 0.6, metalness: 0.0 }),
    ink: make('ink', { color: DERIVED.INK, roughness: 0.7, metalness: 0.1 }),
    brass: make('brass', { color: DERIVED.BRASS, roughness: 0.5, metalness: 0.7 }),
    steel: make('steel', { color: DERIVED.STEEL, roughness: 0.45, metalness: 0.75 }),
    glass: make('glass', {
      color: DERIVED.GLASS,
      roughness: 0.15,
      metalness: 0.0,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  }

  return { materials, owned }
}

/** Frees every material the bundle created. Consumer-supplied overrides are left alone (rule 17). */
export function disposeKkMaterials(bundle: KkMaterialBundle): void {
  for (const material of bundle.owned) material.dispose()
}
