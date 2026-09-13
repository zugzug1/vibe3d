# Kyoto Kat: 50-item production handoff

Target: zugzug1/vibe3d (personal fork). Active branch: feat/kyoto-kat-kit.
Reference archive: /Volumes/zug1/kyoto-kat-kit/v1/
Local archive paths require access to this Mac and mounted drive.

## Deliverable
Build 50 distinct editable Three.js assets and portable textured GLBs from the references.
Production is underway in the existing `@cafe-kit` registry. See PRODUCTION.md and REVIEW-INDEX.md for saved checkpoints and review packages; inventory.json and delivery-manifest.json describe measured artifacts. Do not restart the kit from these original instructions.
Use 10 signature pieces, 20 furnishings, and 20 storytelling props.

## Art direction
1990s Kyoto machiya cat cafe. Manga ink contours, restrained cel shading, softened cedar,
washi paper, tatami, handmade glazed ceramics, indigo fabric and restrained vermilion.
Charcoal #262128; ivory #efe4cc; moss #788468; vermilion #d85645; indigo #667c9c.
Lived-in and carefully maintained; readable silhouettes and plausible construction.
Reference images are art direction, not construction drawings: correct impossible details
and keep unrelated supporting decorations as optional separate components.

## Existing workflow to reuse
Read .agents/skills/vibe-model/SKILL.md and its required references before hard-surface work.
Author direct Three.js createModel factories following existing registry contracts.
Use bun run vibe:model preview for deterministic comparison, scripts/coplanar-check.ts
for geometry checks, and the shared portable GLB exporter for standard PBR output.
Reuse `registries/cafe-kit`, `assets/cafe-kit/kk-core`, and the existing docs/export tooling.
Do not insert café objects into the Sci-Fi collection or introduce another registry framework.
Cloth, foliage and woven forms need suitable geometry approaches beyond hard-surface primitives.

## Production
The pilots and approved examples already exist. Preserve them and finish in disjoint batches.
Review silhouette, proportions, material values and construction before accepting each batch.
Keep editable sources, GLBs, previews, bounds, triangle/material/texture stats, and review notes
linked by stable asset ID in delivery-manifest.json. Original manifest.json remains reference provenance; its historical null production fields are superseded by the delivery manifest.
Use meters, Y-up, consistent forward direction, ground-centered pivots for furniture;
document attachment pivots for hanging and wall-mounted objects.
Expose separately identifiable components, semantic names, and simple collision guidance.

Target triangle ceilings: signature 15000; furnishing 6000; storytelling 2000.
Prefer shared materials, 1K-or-smaller textures, and 2K only for justified hero detail.
Record exceptions. Validate compression and materials in the actual consumer viewer.
Build both a 50-item review scene and a representative furnished cafe.
Measure sustained 30 fps on a named midrange phone; record device, browser, scene load,
render resolution and measurement duration. Budgets alone are not performance proof.

## Acceptance
All 50 assets have valid textured GLBs, editable sources and previews; no missing textures,
floating components, broken pivots, z-fighting or inconsistent scale.
Follow the existing model skill's independent critique loop, record unresolved approximations,
and present final renders plus live viewer links for visual acceptance.
Run existing relevant registry validation, type checks and export checks.
Record provenance and review redistribution rights before any OSS release.
Repository code is MIT; do not assume generated art or third-party inputs inherit that license.
Do not deploy to the live Spawn world as part of this issue.

## Roster

Checkboxes below denote final collection acceptance, not mere source existence; see the production ledger for granular status.
- [ ] kk-001 — Espresso station: stepped cedar counter with compact brushed metal espresso machine and worn brass controls
- [ ] kk-002 — Matcha preparation station: inset tray, bamboo whisk cradle and softly irregular bowl
- [ ] kk-003 — Wagashi display cabinet: low glazed cedar case with sliding doors and tiered pastry trays
- [ ] kk-004 — Cedar cat tower: asymmetric resting platforms, lattice supports and replaceable scratch pads
- [ ] kk-005 — Machiya window bench: deep sill, indigo cushions and storage cubbies
- [ ] kk-006 — Ceramic feeding station: raised twin ceramic bowls in low timber frame
- [ ] kk-007 — Washi pendant lantern: broad ribbed paper shade with subtly repaired seam
- [ ] kk-008 — Shoji folding screen: three articulated cedar lattice panels with translucent paper
- [ ] kk-009 — Engawa lounge platform: raised cedar deck, inset tatami and rounded step
- [ ] kk-010 — Cafe entrance assembly: cedar frame and split indigo noren with small vermilion emblem
- [ ] kk-011 — Two-person cafe table: rounded rectangular cedar top and splayed legs
- [ ] kk-012 — Spindle-back chair: curved timber back and worn seat
- [ ] kk-013 — Low tea table: broad cedar top and short trestle base
- [ ] kk-014 — Zabuton cushion: compressed indigo cloth, stitched seams and corner ties
- [ ] kk-015 — Service trolley: two timber trays, modest wheels and curved handle
- [ ] kk-016 — Cup shelving unit: staggered open cedar compartments
- [ ] kk-017 — Sliding-door pantry: tall cedar silhouette and recessed pulls
- [ ] kk-018 — Handwashing basin: glazed bowl, brass tap and cedar towel rail
- [ ] kk-019 — Ceramic umbrella stand: tall ribbed moss-glazed body
- [ ] kk-020 — Shoe cubby rack: low slatted cedar compartments
- [ ] kk-021 — Wall cat walkway: stepped cedar platforms with substantial brackets
- [ ] kk-022 — Scratching column: tapered sisal-wrapped trunk and heavy timber base
- [ ] kk-023 — Cat sleeping basket: oval woven shell and removable indigo cushion
- [ ] kk-024 — Ventilated litter enclosure: low cedar cabinet with offset entrance
- [ ] kk-025 — Adoption notice cabinet: glazed upper panel with blank profile cards and document drawer
- [ ] kk-026 — Cash-register counter: compact mechanical register on narrow cedar pedestal
- [ ] kk-027 — Waste-sorting cabinet: paired openings and removable bins
- [ ] kk-028 — Coat-and-bag stand: branched timber pegs and stable foot
- [ ] kk-029 — Garden planter: rectangular ceramic trough and sparse plants
- [ ] kk-030 — Exterior menu stand: weighted cedar frame and blank replaceable writing panel
- [ ] kk-031 — Matcha whisk and holder: fine bamboo whisk in handmade ceramic holder
- [ ] kk-032 — Tea caddy: squat metal tin with worn blank paper label
- [ ] kk-033 — Kyusu teapot: handmade glazed vessel with side handle and short spout
- [ ] kk-034 — Repaired ceramic cup: uneven ivory glaze and a fine visible repair seam
- [ ] kk-035 — Wagashi serving plate: scalloped ceramic plate with three distinct small Japanese sweets
- [ ] kk-036 — Coffee bean jar: glass body filled with beans and fitted lid
- [ ] kk-037 — Manual coffee grinder: metal crank and hopper with wooden drawer body
- [ ] kk-038 — Gooseneck kettle: long curved spout and darkened metal
- [ ] kk-039 — Indigo serving tray: shallow timber rim and indigo textile inset
- [ ] kk-040 — Folded cafe apron: faded indigo fabric, neck loop and pockets visible
- [ ] kk-041 — Cat adoption ledger: open book, tabs and clipped blank portrait placeholders
- [ ] kk-042 — Instant-photo display: small timber frame with uneven clipped cat photographs
- [ ] kk-043 — Transistor radio: cream and charcoal case, analog dial and telescopic antenna
- [ ] kk-044 — Ceramic wind bell: compact glazed bell with hanging blank paper strip
- [ ] kk-045 — Maple branch vase: narrow handmade vessel with sparse angular maple branch
- [ ] kk-046 — Cat toy basket: woven basket with feather wand and cloth toys
- [ ] kk-047 — Grooming box: handled cedar box holding brush and comb
- [ ] kk-048 — Loyalty stamp kit: wooden stamp, ink pad and blank stacked cards
- [ ] kk-049 — Neighborhood map frame: folded stylized street plan under simple timber frame without text
- [ ] kk-050 — Mending basket: patched indigo cloth, thread and rounded sewing box
