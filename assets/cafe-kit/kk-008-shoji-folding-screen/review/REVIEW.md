# kk-008 Shoji folding screen
reference: images/kk-008.png · manifest target 1.80 × 0.45 × 1.70 m · built 1.833 × 0.507 × 1.700 m
(height and leaf are direct; W and D are the same fold measured two ways, so the angle is SOLVED, not
chosen — see below)
iterations: 3 · accepted score: 85 · critic: fresh subagent per round, given only the brief line, the
reference and the render. 85 is the loop's acceptance threshold, so iteration stopped there.

the solved fold: three 0.72 m leaves. Depth 0.45 needs sin θ = 0.45 / 0.72 → θ = 38.7°, which puts the
span at 0.72 + 2 × 0.72 cos θ = 1.84 m — the manifest's 1.80 within 3 %. So the declared W and D are
consistent with each other and with a 0.72 m leaf, and `fold` is exposed as config; every other angle
trades one against the other. The left wing stands 3.2° further round than the right, because a screen
is set by hand and never by protractor (modelling rule 3), which is where the extra 57 mm of depth goes.

reads correctly: three-panel fold angle and stance; the 3 × 6 kumiko grid with even muntins; two iron
strap hinges per joint at the right heights; the solid kick apron below the lattice; frame stiles
reading as continuous verticals.

approximations / hidden-side assumptions: the reference is one three-quarter view on a transparent
backdrop, so the backs of the leaves are a plausible reconstruction — plain washi over the frame's back
rebate, no second lattice (confirmed on the qa-sheet's back view, which is what it is for). The strap
hinges keep their knuckle on the panel's own pivot axis rather than on the strap, so the leaves stay
correct at every fold angle; a true surface-mounted pin cannot fold flat.

art-direction corrections (impossible construction, omitted dressing): the reference paints the kumiko
proud of the frame's face, which would leave the paper unsupported — here the lattice sits in the plane
of the frame, all but flush with its front face and 24 mm clear of the washi lapped onto the back
rebate, which is how a shoji is made and is what throws the shadow grid the reference is really drawing.
The reference folds as an S (left leaf back, right leaf forward) yet shows lattice on all three faces,
which needs kumiko on both sides of at least one leaf; built as a C instead, so one-sided kumiko gives
the same read from the front, the screen is self-supporting, and the leaf count of lattice is honest.
The reference's cyma-curved foot under each apron is a plain reveal between the stiles.

parts: panelLeft (MOVABLE) · panelCentre · panelRight (MOVABLE). Each leaf group SITS ON its own hinge
axis — the vertical line at the centre leaf's own edge — and its built fold is baked into its geometry,
so a consumer turning a wing about Y folds it further about the true hinge. Read `parts.panelLeft.
position` for the live axis; the assembly re-centres itself on its bounds after every rebuild, so the
number moves with `fold`.
collider: compound(box per leaf, 0.72 × 1.70 × 0.035, each on its leaf's transform). An AABB over the
fold claims the 0.45 × 1.80 m of floor a player walks through.

materials: cedar, washi, ink (3 — inside the kit guideline). Apron and kumiko are per-vertex value
moves off the cedar slot, not extra materials.
textures: washiFibreTexture 256 on the washi slot, tiled 4 × 8. Paper is the one surface here a flat
colour cannot carry — fibre is what separates washi from card — and 256 is well inside the 1024 ceiling.

triangles: 1476 / 15000                meshes: 17
gates: test ✓ (10 pass) · topology ✓ (manifold, declared-open, 80-tri hull) · coplanar ✓ (17 authored
parts, clean) · inventory ✓ (ok) · qa-sheet ✓ (8 views looked at: back shows plain paper on all three
leaves as intended, top confirms the C, no clipping at any joint)

open: the washi reads cool rather than the reference's warm ivory — DERIVED.WASHI is `shade(IVORY, 0.12)`
and the preview's indigo fill light cools it. A kk-core palette question, not warmed locally.
