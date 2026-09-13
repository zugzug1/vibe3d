# kk-044-ceramic-wind-bell — final bounded handoff

Status: source frozen after the requested correction pass. Main recaptured the corrected contrast image and reported no further visual requests. Ready for coordinator export; no new critic score is claimed.

Initial Luna score: 56/100. Original reference: /Volumes/zug1/kyoto-kat-kit/v1/images/kk-044.png.
Coordinator capture: .asset-forge/previews/kk-044-ceramic-wind-bell-contrast/latest.png.

Original W × D × H: 0.09 × 0.09 × 0.40 m; storytelling ceiling: 2,000 triangles.
Runtime triangles: 1212; compiled triangles: 1212.

## Correction and physical evidence

Closed the suspension curve explicitly and added a separate seated stem through the bead. Kept the real underside cavity; lowered the striker to expose it beneath the rim. Blue wave glaze replaces selected shell faces rather than layering a decal.

Seven first/last tube-ring vertices coincide at the closed loop seam. An upward ray at radius 20 mm passes through the underside and first reaches the inner shell above 280 mm. Striker bottom is 195 mm, cord/striker and bead/stem contact checks pass. The paper hole is unobstructed when ray-tested against the paper.

## Runtime anatomy

paper: remove/reinstate the pierced paper strip; stable shell, suspension, clapper and paper anchors remain.

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

Wave-edge glazing is a restrained geometric interpretation, without the reference cat/floral painting. Cord and thin paper are simplified. The clapper has no swing simulation. Hanging origin is the bottom of the default paper; the suspension socket is at 400 mm.

Files: model.ts, model.test.ts, tsconfig.json, catalog.ts, kk-044-ceramic-wind-bell.vtopo, and this review record.

