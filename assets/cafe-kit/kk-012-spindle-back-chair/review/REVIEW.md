# kk-012 Spindle-back chair
reference: images/kk-012.png · manifest target 0.45 × 0.48 × 0.85 m · built 0.450 × 0.480 × 0.850 m —
exact, with each of the three numbers carried by a different member: the splayed feet own the width, the
raked bow's back face against the seat's nose owns the depth, the crown owns the height.
iterations: 6 · accepted score: 77 · critic: independent fresh subagents (Sonnet), one per capture, each
given only the brief, the reference and the render — 60 → 77 → 61 → 73 (tie-break, adjudicating the 61).
Stopped on inter-critic variance rather than on 85: 77, 61 and 73 are all the same build family. The
tie-break earned its keep — see `the modelling error the critics found and I did not`.

## reads correctly
- The bow-back Windsor gestalt at a glance: continuous arched hoop, five spindles, plank seat, four raked
  turned legs, H-stretcher. Named first by every critic.
- Spindle count and lateral fan; the tops meeting the bow at five different heights, as the reference shows.
- The turned profiles now read as lathe-work rather than dowels — the vase swell in each spindle's lower
  third and the collar/cove under each leg were the last thing to land (60 → 77).
- Seat plan: a shield, not a rounded rectangle — narrow at the back (±0.158), waisted, widest at ±0.214
  forward of centre, shoulders, then a 9 mm cyma dip to the nose.
- Stretcher layout and the leg rake reading as a planted Windsor stance.

## approximations / hidden-side assumptions
- **The seat is a flat plank with a rolled edge, NOT an adzed saddle dish.** This is the reference's
  strongest seat cue and the one thing an extruded plan cannot give inside the budget. Stated up front and
  accepted; the cyma front IS modelled, in the plan outline, so the seat is not merely a slab.
- Turned rings are lathe-profile swells, not cut beads — no undercuts.
- The underside of the seat, the back of the bow and every mortise are a plausible reconstruction from one
  three-quarter view: through-tenons into the seat for legs, bow and spindles, none expressed on the top.
- Rake is 19°, bought by drawing the leg HEADS in to ±0.112 rather than pushing the feet past the 0.45 m
  datum. A critic asked for a stance "clearly wider than the seat"; that would break the manifest, so the
  splay was taken from the other end.

## art-direction corrections
- The reference's contour shows a fifth member on each side below the side stretcher. A chair has no such
  member; a Windsor H-stretcher is the construction the rest of the drawing implies, so it is read as the
  far-side stretcher seen through the frame and is not built.
- Painted wear and ink contours are not modelled — the consumer applies its own cel / ink pass.

## the two real findings, for the rest of the kit
1. **A colour map must go on ALL cedar slots or none.** Mapping only the seat sank it a full value step
   below the frame (the map multiplies its slot's base colour) and inverted the reference's relationship —
   scrubbed seat, darker handled frame. Both slots now share one texture instance.
2. **Shear a raked leg; never rotate it.** A rotated lathe stands on the edge of an ellipse and its head
   beds on a slant. Shearing keeps every horizontal section horizontal, so all four feet sit flat at y = 0
   and all four heads bed flat under the seat. Same trick as kk-011's legs.

## parts
- `seat` — one bullnosed shield plank. not movable. collider: box 0.43 × 0.04 × 0.40 at y = 0.425.
- `back` — the bent hoop and five turned spindles, merged to one mesh. not movable.
- `legs` — four sheared turned legs and the three-piece H-stretcher, merged to one mesh. not movable.

collider: **compound** — the seat box above plus a thin upright box for the back (0.34 × 0.40 × 0.05,
leaned with the bow). The compiled sidecar builds a real 972-triangle closed manifold hull off the visual
meshes (no AABB fallback), which a physics consumer can use directly; a plain AABB is the cheap fallback.

## materials / textures
materials: `cedar` (seat — the worn, scrubbed plank), `cedarDark` (bow, spindles, legs, stretchers — oiled
and handled) — 2 slots, 3 draw calls.
textures: `cedarGrainTexture` 256 × 256, one instance shared by both slots, `repeat 2.2`. Applied only to a
slot the consumer did NOT override (rule 17).

## budget
triangles: 4236 / 6000 (furnishing) · meshes: 3 · draw calls: 4

## gates
test ✓ (`bun test assets/cafe-kit -t kk-012`, 10 pass)
topology ✓ (`kk:compile-topology --only=kk-012-spindle-back-chair`: 972 tris, manifold, closed, no AABB
fallback; `bun test assets/cafe-kit/cafe-kit.topology.test.ts -t kk-012`, 1 pass)
coplanar ✓ (new component-bounds checker: 14 components inspected, all clean; heuristic only, not a proof)
inventory ✓ (`--check`, ok, no breach, no warning)
qa-sheet ✓ (8 views inspected by me — see `open` for what that inspection settled)

## the modelling error the critics found and I did not — and why my own inspection missed it

The third critic (61) claimed the outer spindles poked past the bow. I talked myself out of it from the
arithmetic — `SPINDLE_LANDING_R` 0.161 against a hoop centreline of 0.168 in a 0.014 tube *is* 7 mm of
burial — and from an 8-view sheet that showed nothing. A tie-break critic then CONFIRMED it and added that
it was **systemic on both end spindles, not right-only**. That detail is what made me measure instead of
argue, and measuring proved the critics right:

```
BROKEN  max radius over the crown arc 0.19729  allowed 0.18200  breach +0.01529   at (-0.137, 0.810)
FIXED   max radius over the crown arc 0.18192  allowed 0.18200  breach -0.00008
```

Cause: `const landing = Math.max(0.02, R² − x²)`. A guard floor, written to stop a negative sqrt, is
LARGER than the real value for exactly the two outer spindles (their x² term is biggest): 0.161² − 0.132²
= 0.0085 < 0.02. So the clamp fired on precisely the cases it was meant to protect, lifted both end tips
to radius 0.194 and crossed them 12 mm in front of the hoop. **A clamp whose bound is reached in normal
operation is not a guard, it is a silent second implementation.** The floor is now 0 and the real
invariant (`SPINDLE_SPREAD < SPINDLE_LANDING_R`) throws instead of being clamped around.

Why the 8-view sheet did not catch it: **it was not an 8-view sheet.** All eight panels rendered the same
pose. `scripts/qa-sheet.mjs` orbits by generating a module that calls `createPreview({ yaw, pitch })`, but
the asset contract's `createPreview({ aspect })` destructures only `aspect` and drops them. Every asset in
this kit that follows the contract literally produces eight copies of its hero shot — and the kit's own
step 5 ("look at the 8-view sheet yourself: a part floating off its mount hides at the hero angle") is
therefore doing nothing for anyone. `createPreview` here now forwards `yaw`/`pitch`; the committed sheet
is a genuine turntable, and the front elevation is the view that proves the spindles land in the bow.

## open
- The other three claims from the 61 remain NOT REPRODUCIBLE, and the tie-break critic agreed on a real
  turntable: the hoop is ONE swept tube and cannot have a seam; each stretcher end is solved against the
  leg's true sheared axis and sits inside an 18 mm-radius leg; the bow is built from mirrored control
  points. The tie-break's own extra claim (a stray knob by the front-left leg, "low confidence, single
  view") does not appear in any panel of the regenerated sheet.
- The earlier real error, fixed at iteration 2: the medial stretcher's ends ran 1.12 × past the side
  stretchers' axes and poked a ~20 mm stub through them.
- The new coplanar checker inspected 14 real component bounds and found no flagged pair. This is a heuristic
  pass, not a geometric proof; the authored clearances remain the stronger evidence for the bow landings,
  leg joints, and stretcher ends.
