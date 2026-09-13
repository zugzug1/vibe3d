/**
 * Canonical colour tokens for the Kyoto Kat café kit.
 *
 * Five hexes, copied verbatim from `docs/kyoto-kat/HANDOFF.md` ("Art direction"). Nothing here invents a
 * near-match: every other value a prop needs is *derived* from one of these with {@link shade} or
 * {@link mixToken}, so a cedar plinth, a shadowed drawer front and a sun-faded cushion all trace back to
 * an approved colour instead of drifting into a dozen hand-picked browns.
 *
 * Rule for every model.ts in the kit: no hex literal outside this file.
 */

export const TOKEN = {
  /** Ink contours, iron pulls, deepest shadow, charcoal glaze. */
  CHARCOAL: 0x262128,
  /** Washi, unglazed bisque, ivory glaze, paper labels. */
  IVORY: 0xefe4cc,
  /** Tatami, moss glaze, planted greens, patina. */
  MOSS: 0x788468,
  /** Restrained accent: emblem, seal, a single cord. Never a whole surface. */
  VERMILION: 0xd85645,
  /** Indigo textile, noren, cushions, shibori. */
  INDIGO: 0x667c9c,
} as const

export type Token = keyof typeof TOKEN

/**
 * Moves a token along its own value ramp. Positive lifts toward white, negative sinks toward black, and
 * hue is preserved because each channel is interpolated against the same endpoint.
 */
export function shade(hex: number, amount: number): number {
  const target = amount >= 0 ? 255 : 0
  const mix = Math.min(1, Math.abs(amount))
  const channel = (shift: number): number => {
    const value = (hex >> shift) & 0xff
    return Math.round(value + (target - value) * mix)
  }
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/** Blends two tokens; used for cedar (ivory sunk toward charcoal), tinted glass and stained substrates. */
export function mixToken(a: number, b: number, amount: number): number {
  const mix = Math.min(1, Math.max(0, amount))
  const channel = (shift: number): number => {
    const from = (a >> shift) & 0xff
    const to = (b >> shift) & 0xff
    return Math.round(from + (to - from) * mix)
  }
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/**
 * Derived material colours, all traceable to the five tokens. Kept here (not in materials.ts) so a
 * vertex-colour pass and a material can agree on "what colour is cedar" without a second definition.
 */
export const DERIVED = {
  /** Softened cedar: restrained vermilion warms ivory before charcoal lowers its value. */
  CEDAR: mixToken(mixToken(TOKEN.IVORY, TOKEN.VERMILION, 0.48), TOKEN.CHARCOAL, 0.42),
  /** Shadowed / oiled cedar — drawer sides, undersides, end grain. */
  CEDAR_DARK: mixToken(mixToken(TOKEN.IVORY, TOKEN.VERMILION, 0.48), TOKEN.CHARCOAL, 0.62),
  /** Fresh-planed cedar highlight for a worn edge. */
  CEDAR_LIGHT: mixToken(mixToken(TOKEN.IVORY, TOKEN.VERMILION, 0.32), TOKEN.CHARCOAL, 0.25),
  /** Washi and paper labels: ivory lifted a touch. */
  WASHI: shade(TOKEN.IVORY, 0.12),
  /** Tatami: moss lifted toward ivory (dried igusa rush). */
  TATAMI: mixToken(TOKEN.MOSS, TOKEN.IVORY, 0.35),
  /** Ivory glaze on handmade ceramics. */
  GLAZE_IVORY: shade(TOKEN.IVORY, -0.04),
  /** Moss glaze. */
  GLAZE_MOSS: TOKEN.MOSS,
  /** Charcoal / tenmoku glaze. */
  GLAZE_DEEP: shade(TOKEN.CHARCOAL, 0.1),
  /** Indigo textile, worn one step lighter than the token. */
  INDIGO_CLOTH: shade(TOKEN.INDIGO, 0.06),
  /** Faded indigo — sun-facing cushion tops, aprons. */
  INDIGO_FADED: mixToken(TOKEN.INDIGO, TOKEN.IVORY, 0.3),
  /** Worn brass: ivory sunk toward charcoal with the vermilion cast of old brass. */
  BRASS: mixToken(mixToken(TOKEN.IVORY, TOKEN.VERMILION, 0.22), TOKEN.CHARCOAL, 0.3),
  /** Brushed steel / darkened kettle metal. */
  STEEL: mixToken(TOKEN.IVORY, TOKEN.CHARCOAL, 0.7),
  /** Iron pulls and ink lines. */
  INK: shade(TOKEN.CHARCOAL, -0.3),
  /** Glass tint. */
  GLASS: mixToken(TOKEN.IVORY, TOKEN.INDIGO, 0.25),
} as const
