# kk-001 Espresso station
reference: images/kk-001.png · manifest target 1.80 × 0.75 × 1.35 m · built 1.800 × 0.750 × 1.350 m (exact)
iterations: 7 · accepted score: 47 · critic: fresh subagent per round, given only the brief line, the
reference and the render — three independent passes scored 58 / 42 / 47, so the loop stopped on two
plateauing scores rather than on 85. The three passes disagreed on the number and agreed on the same
three gaps, which is what was acted on (modelling rule 14: recurrence, not gradient).

reads correctly: the stepped three-tier massing (counter → lower riser shelf → upper riser shelf, with
the machine closing just under the top shelf); counter proportions and the slab's overhang; the open
left bay with two shelves against the boarded cabinet to its right; the board-and-batten front with its
proud frame and chunky corner posts; the knock-box sunk through the worktop in the right place; the
machine's brushed case, slotted drip grate, projecting group head with the portafilter hanging under it,
centred pressure gauge flanked by two brass taps, and the steam wand.

approximations / hidden-side assumptions: the back and the left return are a three-quarter view away
from the reference camera and are a plausible reconstruction — plain boarded back panel, left flank
framed like the right. Machine internals, the knock-box drain and every shelf fixing are not modelled.
The perforated drip grate is seven solid bars, not real perforation. The gauge dial is blank (the kit
forbids writing).

art-direction corrections (impossible construction, omitted dressing): every loose object in the
reference is omitted per the manifest review note — plant, cup stacks, bean jars, saucers, folded
cloths, milk jug, tamper and its mat. Those are other roster items (kk-032, kk-034, kk-036, kk-039).
The knock-box is NOT dressing and stays: it is cut through the worktop, so the worktop is laid as four
planks around a real opening with the pan lapped under their edges and its rim 5 mm proud.
Two corrections to the reference's own construction: the group head was raised so the portafilter has a
pouring gap above the drip tray (drawn at a height where it would reach into the grate), and the
machine's top was brought below the riser so the riser stays the tallest mass, as the reference reads.
The portafilter is turned 32° to the RIGHT out over open counter — turned left it lands across the
knock-box opening and the two fuse into one diagonal arm, which a critic misread every round.

parts: counter · riser · machine · portafilter (MOVABLE — pivot on the group head's vertical axis at
(0.36, 1.12, 0.15) m, rotates about Y to lock into and out of the head) · steamWand (MOVABLE — pivot on
its ball joint at (0.78, 1.16, 0.06) m, rotates about Y across the drip tray). The build is authored
centred, so these are also the world coordinates.
collider: compound(box counter 1.80 × 0.92 × 0.71 + box riser 0.92 × 0.43 × 0.28 + box machine
0.60 × 0.43 × 0.48). A single AABB seals the open left bay and the worktop the player reaches over; the
counter box alone is the right cheap fallback.

materials: cedar, steel, brass (3 — inside the kit guideline). Every darker and lighter value is a
per-vertex multiplier onto the slot's own palette colour, solved in linear space: oiled plinth, bay
lining, riser back board, machine feet and drip grate, rosewood portafilter handle, brushed case, cup
deck, gauge dial. No material clones, no baked light direction.
textures: none — flat palette plus the vertex ramp carries this piece.

triangles: 5368 / 15000                meshes: 14
gates: test ✓ (10 pass) · topology ✓ (manifold, closed, 896-tri hull) · coplanar source repair ✓ (rear
posts/back board, divider end laps, and machine crown/body no longer share the reported planes) · inventory
✓ (ok, no warnings) · qa-sheet ✓ (8 existing views; no new visual approval claimed)

checker note (2026-09-12): the recovered-component checker still reports two y.max=0.860 candidates at
(-0.41, 0.86, -0.02) and (0.22, 0.86, 0.30). Direct source inspection finds only bbox overlap from
separate carcass/top-edge members at those samples; their authored top faces do not overlap over area, so
these are justified bounds false positives and were not moved merely to satisfy the heuristic.

open: DERIVED.CEDAR is `mixToken(IVORY, CHARCOAL, 0.42)`, which renders as a warm GREY, not cedar — the
reference's saturated red-brown is out of reach of the five tokens without a warm derivation. Raised as
a kk-core wish rather than warmed locally, because a cedar that differs from every other worker's prop
is worse than a pale one.
