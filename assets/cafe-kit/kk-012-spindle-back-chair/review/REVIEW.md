# kk-012 Spindle-back chair
reference: images/kk-012.png · manifest target 0.45 × 0.48 × 0.85 m · built 0.450 × 0.480 × 0.850 m —
exact, with each of the three numbers carried by a different member: the splayed feet own the width, the
raked bow's back face against the seat's nose owns the depth, the crown owns the height.
iterations: 5 · accepted score: 77 · critic: independent fresh subagents (Sonnet), one per capture, each
given only the brief, the reference and the render — 60 → 77 → 61. Stopped on inter-critic variance rather
than on 85 or on a plateau: 77 and 61 are the SAME build seen by two critics, and the 61's error list does
not survive the 8-view sheet. See `open`.

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
coplanar ✓ (exit 0 — see `open`)
inventory ✓ (`--check`, ok, no breach, no warning)
qa-sheet ✓ (8 views inspected by me — see `open` for what that inspection settled)

## open
- **Inter-critic variance is the reason iteration stopped, not a plateau.** The third critic scored 61 on a
  build the second had scored 77, and listed four modelling errors: a gapped seam at the top right of the
  hoop, the rightmost spindle poking past the hoop, a side stretcher falling short of its leg, and
  asymmetric stile curvature. I checked all four against the 8-view sheet and **none is reproducible**:
  the hoop is ONE swept tube and cannot have a seam; every spindle tip lands on a circle 7 mm inside the
  hoop's centreline, buried in a 14 mm-radius tube; each stretcher end is solved against the leg's true
  sheared axis at that height and sits inside a 18 mm-radius leg on an 11 mm-radius rail; the bow is built
  from mirrored control points and is symmetric by construction. All four claims come from the hero angle
  only. Recorded rather than chased.
- The ONE modelling error a critic did find and that was real: the medial stretcher's ends originally ran
  1.12 × past the side stretchers' axes and poked a ~20 mm stub out through them. Fixed at iteration 2 by
  landing the ends exactly on the axes.
- **The coplanar lens is structurally blind to this model** and reports "0 authored parts" — it skips any
  mesh whose name contains " / ", which `finishModel` gives every mesh in this kit. A pass by vacancy.
  Coincidence was avoided by construction instead, with each clearance a stated number in the header.
  Raised as a kit-wide issue.
