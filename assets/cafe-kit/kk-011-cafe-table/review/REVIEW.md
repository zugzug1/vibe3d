# kk-011 Two-person cafe table
reference: images/kk-011.png · manifest target 0.80 × 0.65 × 0.72 m · built 0.811 × 0.657 × 0.720 m
(the TOP is 0.800 × 0.650 exactly and its surface is at 0.720; the extra 11 × 7 mm is the splayed feet,
which finish 5 mm outside the top's corner line because that is where the reference puts them)
iterations: 8 · accepted score: 80 · critic: four independent fresh subagents (Sonnet), one per capture,
each given only the brief, the reference and the render — 58 → 60 → 70 → **80** → 79. Stopped on the
plateau rule (80, 79), not on 85.

## reads correctly
- Silhouette and stance: rounded-rectangular top on four outward-splayed tapered legs, at the right scale
  class. Every critic named this first.
- The apron's corner bracket: the cove that sweeps the rail's lower edge down into each leg is present and
  was named as the reference's signature joinery move by all four critics.
- Plank seams: three V-grooves dividing the top into four boards, straight and parallel in all eight views.
- Leg taper direction and rate, and the top's reveal standing proud of the apron.
- Material read: no baked ink, no baked directional shading, no painted knots — the consumer's cel pass
  owns all of that (kk-core/materials.ts bakes none).

## approximations / hidden-side assumptions
- The underside of the top, the inner faces of the apron and the leg heads are a plausible reconstruction;
  the reference is one elevated three-quarter view. Built as the construction that would actually hold —
  legs housed against the apron corners, top fixed from inside the frame. Fixings are not modelled: they
  are invisible in play and would cost triangles a player never sees.
- The reference's painted knots are art, not geometry, and are deliberately absent.
- Corner radius (0.165 m) is an ARBITRATED value, not a measured one: critic 1 asked for +30–40 %, critic 2
  for −30–40 % on the same image. Per modeling rule 14 the dimension was set to their midpoint and frozen,
  and the next two critics both passed it without comment.

## art-direction corrections
None. The reference is buildable as drawn; there is no impossible construction, no contextual cat and no
loose dressing to omit (manifest review_notes: "Optional loose dressing can be omitted").

## the one real finding, for the rest of the kit
A ROUNDOVER CANNOT CUT A SEAM. The first three attempts at the plank joint used a multi-ring bullnose and
measured 0.7 mm deep — three successive critics reported "no plank seams" on a top that had them. A
tangent curve leaves two lapped planks touching almost at full height: depth = b − √(b² − L²), which for
b = 7 mm, L = 3 mm is 0.7 mm. A straight one-facet CHAMFER crosses at depth = b − L, so at b = 3.5 mm,
L = 0.5 mm the seam is 3 mm deep and 6 mm wide, and it read immediately (58 → 80 across that change plus
the apron depth). Seam depth is a number you can set — but only with a chamfer.

## parts
- `top` — 4 plank prisms merged to one mesh. not movable. collider contribution: the slab.
- `apron` — 4 shaped rails (bracket cove integral to each rail) merged to one mesh. not movable.
- `legs` — 4 sheared tapered posts merged to one mesh. not movable.

collider: **box** (0.80 × 0.72 × 0.65 at bottom-centre). The compiled sidecar builds a real 156-triangle
closed manifold hull off the visual meshes — no AABB fallback — so a consumer may use that instead; but a
player can neither walk under the top nor get a foot between the legs, so the box is honest.

## materials / textures
materials: `cedar` (top, legs), `cedarDark` (apron) — 2 slots, 3 draw calls.
textures: `cedarGrainTexture` 256 × 256, one instance shared by both slots, `repeat 1.6`. Applied only to
a slot the consumer did NOT override (rule 17). The top's UVs are rewritten to the world XZ plan so each
plank samples a different run of grain instead of four identical ones; the legs' UVs are rewritten so the
grain runs DOWN the leg (the extruder's default side-wall UVs run it across, which reads as ladder rungs).

## budget
triangles: 1104 / 6000 (furnishing) · meshes: 3 · draw calls: 4

## gates
test ✓ (`bun test assets/cafe-kit -t kk-011`, 10 pass)
topology ✓ (`kk:compile-topology --only=kk-011-cafe-table`: 156 tris, manifold, closed, no AABB fallback;
`bun test assets/cafe-kit/cafe-kit.topology.test.ts -t kk-011`, 1 pass)
coplanar ✓ (exit 0 — see `open` below)
inventory ✓ (`--check`, ok, no breach, no warning)
qa-sheet ✓ (8 views inspected by me: symmetric, no floating part, no unclosed seam, all four brackets
identical, plank seams straight in every view)

## open
- **The coplanar lens is structurally blind to this model** and reports "0 authored parts". It captures
  meshes at `Group.add` and skips any whose name contains " / " — which is every mesh in this kit, because
  `finishModel` names them `<id> / <batch>`. It is a pass by vacancy, not by measurement. Coincidence was
  instead avoided by construction and each clearance is a stated number in the model header (plank lap
  0.5 mm, apron top 4 mm inside the slab, leg head 20 mm inside it). Raised as a kit-wide issue.
- Critic 4 reported "grain curves radially near the rounded corners". NOT REPRODUCIBLE: the top's UVs are
  `u = x, v = z`, strictly linear, and the seams are straight in all eight views. It is the chamfer
  highlight following the corner arc, read as grain.
- Critic 4 reported "a light-toned tab proud of the apron at the front-right leg". NOT AN ERROR: that is
  the leg head, which stands 14 mm proud of the apron's outer face by design (as in the reference) and is
  `cedar` against the apron's `cedarDark`. Present and identical on all four legs in the 8-view sheet.
