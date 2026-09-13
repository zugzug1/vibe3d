# Pilot calibration and production gate

2026-09-12. One Astra-medium read-only review was used (Fermat,
`01a09872-f922-77b3-a4db-dd1fc9a319e4`). No further Astra/Sol review is authorized.
The reviewer inspected all seven reference, close-up and gameplay images.
Scores below are resemblance judgments, not approval or technical certification.

## Shared rules for subsequent Luna batches

1. Separate warm cedar, ivory paper, indigo fabric, ceramic glaze and metal with
   shared PBR colors/roughness. Keep ink/cel lighting in the game, not baked into
   assets. The previous cedar mix was too gray; a restrained vermilion contribution
   now warms the shared derived cedar ramp without adding palette tokens.
2. Spend vertices on identifying silhouette and construction. Wood has narrow
   bevels and broad flat faces; cloth has thin edges and shallow uneven folds.
   Do not apply the same rounded-box treatment to every material.
3. Use sparse meaningful surface variation, not blanket tessellation or noise.
   Tiny gameplay props do not justify more geometry just to reveal microdetails.
   Reuse existing surface helpers; do not create an atlas system for seven pilots.

## Review findings before the correction pass

- 001 espresso, 6/10: keep construction; improve material separation. Loose café
  accessories remain separate roster assets rather than duplicated geometry.
- 004 tower, 6/10: keep assembly; flatten zigzag rope-post silhouette.
- 008 screen, 8/10: keep geometry; improve cedar/paper contrast.
- 011 table, 6/10: seat legs beneath the overhanging top and restore modest splay.
- 012 chair, 8/10: keep geometry; shared wood treatment has higher value than detail.
- 034 cup, 7/10: preserve geometry budget; subtle glaze variation rather than more vertices.
- 040 apron, 6/10: thin pockets and add shallow asymmetric folds; avoid rigid slabs.

Luna applied one focused correction pass. No post-correction expert score is
claimed. Miguel approved the seven corrected pilots on 2026-09-12 ("everything
lgtm, continue"). Production of the remaining 43 may proceed in Luna batches.

## Technical qualifications

- The coplanar CLI now inspects disconnected components of merged café meshes
  and fails on zero coverage. This is an AABB heuristic, NOT a triangle-level
  proof. Welded/touching solids and curved/rotated bounds remain limitations.
- Luna identified remaining espresso/screen warnings as bounds false positives;
  their source reasoning is in per-asset review notes. Do not silently suppress
  the nonzero checker exit or call the whole check green.
- Node GLB export uses the existing portable exporter with a CLI-only adapter for
  RGBA DataTextures. Embedded PNG pixels have a round-trip regression test.
  DOM image textures still require browser export; unsupported drawing fails.
- Close preview framing now guarantees margins for the model bounds. Gameplay
  framing remains the existing fixed camera, not proof of phone performance.
- Node typecheck still reports errors in F1 assets and the shared render-headless
  scene-selection code. These are not fixed by this café pilot pass.
- Some Dawn captures have exited with SIGSEGV after writing their output. Check
  actual images; an emitted success JSON does not make the process exit clean.

## Continuation

After pilot approval, use two Luna-medium builders with disjoint batches of 2–4
assets, grouped by construction techniques. Coordinator owns shared changes,
serialized captures, registry integration and commits. Use one temporary Luna
critic per batch and one correction pass; unresolved work goes to a repair queue.
No further strong-model escalation without Miguel's approval.

Final acceptance still requires all 50 models/GLBs, reimport/viewer QA, complete
scene tests, named-device mobile measurements, archive checksums and licensing
review. No deployment, publication or main/upstream push is authorized here.
