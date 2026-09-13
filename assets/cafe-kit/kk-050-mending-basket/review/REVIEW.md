# kk-050-mending-basket — final bounded handoff

Status: source frozen after the requested correction pass. Main recaptured the corrected contrast image and reported no further visual requests. Ready for coordinator export; no new critic score is claimed.

Initial Luna score: 61/100. Original reference: /Volumes/zug1/kyoto-kat-kit/v1/images/kk-050.png.
Coordinator capture: .asset-forge/previews/kk-050-mending-basket-contrast/latest.png.

Original W × D × H: 0.30 × 0.25 × 0.20 m; storytelling ceiling: 2,000 triangles.
Runtime triangles: 1948; compiled triangles: 1868.

## Correction and physical evidence

Rebuilt the drape clearance relationship: front basket profile/stakes are inset within the unchanged canonical envelope, the cloth stays continuous outside them, and a tucked fold seats across the rim. Added existing woven maps to owned wicker cedar and darker binding cues. Seated every spool base on the floor.

Over 500 surface-ray samples at vertices and triangle interiors verify at least 0.3 mm free-drape clearance from actual wall/stake geometry; the intentionally tucked rim fold has a separate contact check. Spool base heights match actual basket-floor ray hits. The carrying arch remains within the 200 mm height.

## Runtime anatomy

cloth and contents independently remove/reinstate the front drape and sewing accessories; the box and carrying handle remain.

Typed createModel/configure/getConfig/setMaterial and createPreview/createCafePreview exports are present. Root and named anchors survive rebuilding. Only active material slots are advertised; default materials/maps and geometry are model-owned, while consumer materials remain unmodified and undisposed. Disposal is idempotent. Default owned cedar retains shared wood-finish registration.

## Validation

- Local geometry, dimensions, UVs, configuration, resources and contact tests pass.
- Nine scoped shared runtime contract tests pass for this ID.
- Per-model TypeScript check passes.
- Scoped topology test passes; emitted .vtopo bytes decode and validate without errors.
- Compiled manifold=true, boundaryMode=declared-open, one LOD and nonempty collision geometry; no AABB hull fallback. Declared-open boundaries are not a claim of a fully watertight union.
- Coplanar checker clean at the unchanged default 0.02 m² threshold; that checker is a bounds heuristic, not proof of every small contact.
- No shared file edits, commits, GPU renders, browser captures or exports by this worker.

## Remaining approximations

Wicker uses broad bands and portable woven detail instead of individually woven strands. Spools are six-sided and the cloth is a short formed mesh rather than a simulation. Sewing-box decoration and scissors omitted for budget. Compiler output has 80 fewer triangles than source after processing; both are explicitly recorded.

Files: model.ts, model.test.ts, tsconfig.json, catalog.ts, kk-050-mending-basket.vtopo, and this review record.

