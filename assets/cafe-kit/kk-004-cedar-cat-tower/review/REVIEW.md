# kk-004 Cedar cat tower
reference: images/kk-004.png · manifest target 1.00 × 0.80 × 1.65 m · built 1.000 × 0.800 × 1.682 m
(the base deck IS the footprint, so every platform cantilevers inside it; the extra 32 mm is the top
rail closing the silhouette, +1.9 %)
iterations: 4 · accepted score: 57 · critic: fresh subagent per round, given only the brief line, the
reference and the render — two independent passes both returned 57, so the loop stopped on two
plateauing scores. The second pass's two remaining "fixes" (no cushion on the right-hand platform; no
scratch surface on the lower pad and the ramp) are misreads — both exist and are built in the rush
material; the palette simply desaturates them toward the cedar.

reads correctly: the asymmetric four-tier cascade and its height proportions; the cubby with its round
mouth and lattice flank sitting on the plank deck; the sisal-wrapped posts with their iron ferrules,
distinct from the smooth cedar spine; both railed round platforms; the lattice panel as a support rather
than a decoration; the leaning scratch ramp; the crowned cushions.

approximations / hidden-side assumptions: the back and the left return are away from the reference
camera and are a plausible reconstruction, boarded to match the visible faces. The round mouth is a
boarded square opening closed down to a circle by an applied collar — the reference's cut hole, built
the way a cat house is actually made. Sisal is a lathe whose profile alternates every 26 mm, so the coil
reads as wound rope at café distance; it is not a wound helix. The cedar upright in the reference has a
round cut-out, modelled solid: a hole read at 1.5 m costs more than it returns.

art-direction corrections (impossible construction, omitted dressing): the hanging toy ball on its cord
is omitted — loose dressing, and the roster's own kk-046. The reference's three differently-coloured
cushions (ivory-and-red, blue, green) are unified to two cloths, indigo and rush, with the top one
sun-faded: the kit's restraint rule over the painting's variety. The right-mid platform's back board was
set in from the plate's rounded corners — run to full width it overhangs them and reads detached. The
lattice panel was seated on the base deck and passed BEHIND the lower-right platform; drawn floating
between two posts it read as a stray grille, which is exactly what the first critique called it.

parts: base · cubby · structure · platforms · cushions · ramp (MOVABLE — pivot on its foot edge where it
rests on the deck at (0.31, 0.09, 0.31) m, rotates about X to be leaned steeper or flatter; it is a
separate object in the reference, not joinery)
collider: compound(box base 1.00 × 0.09 × 0.80 + box cubby 0.50 × 0.44 × 0.44 + capsule spine 0.09 r ×
1.41 h). The platforms are cantilevers a player walks under — a single AABB walls off the whole cell.

materials: cedar, washi (sisal rope), tatami (woven scratch pads + rush cushion), indigo (cloth
cushions) — 4, one over the kit guideline and flagged as a warning by the inventory, not a breach. The
fourth buys the rope its ivory against the pads' moss; folding them into one slot loses the reference's
clearest material separation. Darker values — cubby interior, deck feet, post ferrules, the rope's
shaded lay, the faded top cushion — are per-vertex multipliers, not extra materials.
textures: none.

triangles: 10462 / 15000               meshes: 15
gates: test ✓ (10 pass) · topology ✓ (manifold, closed, 972-tri hull) · coplanar ✓ (15 authored parts,
clean) · inventory ✓ (warn: 4 materials, see above) · qa-sheet ✓ (8 views looked at: the lattice seats on
the deck in back and right, the ramp meets its post, nothing floats above the top platform)

open: two of the three cushions are lathe-crowned but none is button-tufted; the reference's tufting is
not modelled. The cedar reads as a warm grey rather than the reference's red-brown — a kk-core palette
question, raised there rather than warmed locally.
